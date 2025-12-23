import { Patient, Encounter, Observation } from '../types';

// --- HL7 Generator (Form Data -> HL7 String) ---

export interface FormData {
  timestamp: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  symptoms: string;
  triageLevel: string; // P1-P4
  heartRate?: string;
  temp?: string;
  patientId?: string; // Optional: If provided, used for matching
}

export const generateHL7v2 = (data: FormData): string => {
  const now = new Date().toISOString().replace(/[-:T\.]/g, '').slice(0, 14);
  const msgId = `MSG${Math.floor(Math.random() * 100000)}`;
  const [given, ...familyParts] = data.fullName.split(' ');
  const family = familyParts.join(' ');
  const dobClean = data.dob.replace(/-/g, '');
  
  // Use provided ID or generate a random MRN
  // HL7 PID Segment: PID|1|PATIENT_ID^^^MRN|INTERNAL_ID|...
  const idValue = data.patientId || Math.floor(Math.random() * 10000).toString();

  // Segments
  const MSH = `MSH|^~\\&|GOOGLE_FORMS|AETHER|FHIR_PORTAL|HOSPITAL|${now}||ADT^A01|${msgId}|P|2.5`;
  
  // PID Field 3 is Patient Identifier List
  const PID = `PID|1||${idValue}^^^MRN||${family}^${given}||${dobClean}|${Math.random() > 0.5 ? 'M' : 'F'}|||^^^${data.email}^^CP^^${data.phone}`;
  
  const PV1 = `PV1|1|E|TRIAGE^^^||||||||||||||||${data.triageLevel}|||||||||||||||||||||||||${now}`;
  
  const OBX1 = data.heartRate ? `OBX|1|NM|8867-4^Heart Rate^LN||${data.heartRate}|bpm||||F` : '';
  const OBX2 = data.temp ? `OBX|2|NM|8310-5^Body Temp^LN||${data.temp}|Cel||||F` : '';
  
  // Clean empty lines if OBX is missing
  const DG1 = `DG1|1||^${data.symptoms}|||A`;

  return [MSH, PID, PV1, OBX1, OBX2, DG1].filter(Boolean).join('\r');
};

// --- HL7 Parser (HL7 String -> FHIR Objects) ---

export const parseHL7toFHIR = (hl7Message: string): { patient: Patient, encounter: Encounter, observations: Observation[] } => {
  const segments = hl7Message.split('\r').map(s => s.split('|'));
  
  const pid = segments.find(s => s[0] === 'PID');
  const pv1 = segments.find(s => s[0] === 'PV1');
  const obxList = segments.filter(s => s[0] === 'OBX');
  
  if (!pid) throw new Error("Missing PID segment");

  // Parse PID
  const nameParts = pid[5].split('^');
  const family = nameParts[0];
  const given = nameParts[1];
  const dob = pid[7] ? `${pid[7].slice(0,4)}-${pid[7].slice(4,6)}-${pid[7].slice(6,8)}` : '1990-01-01';
  const contactParts = pid[13] ? pid[13].split('^') : [];
  const telecom = contactParts[3] ? [{ system: 'email' as const, value: contactParts[3] }] : [];
  
  // Extract ID from PID-3 (The first component)
  const rawId = pid[3].split('^')[0];
  // If the ID is numeric or short, we prepend 'p-' to ensure it's a valid string ID, unless it already has a prefix
  const patientId = rawId.startsWith('p-') || isNaN(Number(rawId)) ? rawId : `p-${rawId}`;

  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    active: true,
    name: [{ family, given: [given] }],
    gender: pid[8] === 'M' ? 'male' : 'female',
    birthDate: dob,
    telecom,
    identifier: [{ system: 'urn:mrn', value: rawId }],
    extension: [{ url: 'http://aetherhealth.io/triage', valueString: pv1?.[19] || 'P4' }],
    meta: { lastUpdated: new Date().toISOString(), versionId: '1' }
  };

  // Parse PV1 (Encounter)
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: `e-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    status: 'arrived',
    class: { system: 'actCode', code: 'EMER', display: 'Emergency' },
    subject: { reference: `Patient/${patientId}` },
    period: { start: new Date().toISOString() },
    reasonCode: [{ text: segments.find(s => s[0] === 'DG1')?.[3]?.replace('^', '') || 'Checkup' }]
  };

  // Parse OBX (Observations)
  const observations: Observation[] = obxList.map((obx, index) => {
    const codeParts = obx[3].split('^');
    return {
      resourceType: 'Observation',
      id: `obs-${Date.now()}-${index}`,
      status: 'final',
      subject: { reference: `Patient/${patientId}` },
      code: { coding: [{ system: 'LOINC', code: codeParts[0], display: codeParts[1] }], text: codeParts[1] },
      valueQuantity: { 
        value: parseFloat(obx[5]), 
        unit: obx[6], 
        system: 'http://unitsofmeasure.org', 
        code: obx[6] 
      },
      effectiveDateTime: new Date().toISOString()
    };
  });

  return { patient, encounter, observations };
};