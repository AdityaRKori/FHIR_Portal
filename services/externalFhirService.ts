import { Patient, Encounter, Observation } from '../types';

const PUBLIC_FHIR_ENDPOINT = 'https://hapi.fhir.org/baseR4';

// Helper to safely map external FHIR JSON to our simplified Types
const mapExternalPatient = (resource: any): Patient => ({
  resourceType: 'Patient',
  id: resource.id,
  active: resource.active ?? true,
  name: resource.name || [{ family: 'Unknown', given: ['Patient'] }],
  telecom: resource.telecom || [],
  gender: resource.gender || 'unknown',
  birthDate: resource.birthDate || '1900-01-01',
  address: resource.address,
  identifier: resource.identifier,
  meta: {
    lastUpdated: resource.meta?.lastUpdated || new Date().toISOString(),
    versionId: resource.meta?.versionId || '1'
  }
});

const mapExternalEncounter = (resource: any): Encounter => ({
  resourceType: 'Encounter',
  id: resource.id,
  status: resource.status || 'finished',
  class: resource.class || { code: 'AMB', display: 'Ambulatory' },
  type: resource.type,
  subject: { reference: resource.subject?.reference || '' },
  period: resource.period || { start: new Date().toISOString() },
  reasonCode: resource.reasonCode
});

const mapExternalObservation = (resource: any): Observation => ({
  resourceType: 'Observation',
  id: resource.id,
  status: resource.status || 'final',
  code: resource.code || { text: 'Unknown Observation' },
  subject: { reference: resource.subject?.reference || '' },
  effectiveDateTime: resource.effectiveDateTime || resource.issued || new Date().toISOString(),
  valueQuantity: resource.valueQuantity,
  valueString: resource.valueString,
  component: resource.component
});

// --- API Calls ---

export const searchPublicPatients = async (nameQuery: string = ''): Promise<Patient[]> => {
  try {
    // Search for patients. Limit to 20 for performance.
    // If no query, we just fetch recent ones using _sort=-_lastUpdated
    const query = nameQuery 
      ? `name=${encodeURIComponent(nameQuery)}` 
      : '_sort=-_lastUpdated&_count=20';

    const response = await fetch(`${PUBLIC_FHIR_ENDPOINT}/Patient?${query}`);
    if (!response.ok) throw new Error('Failed to fetch from public API');
    
    const data = await response.json();
    if (!data.entry) return [];

    return data.entry.map((e: any) => mapExternalPatient(e.resource));
  } catch (error) {
    console.error("Public FHIR Search Error:", error);
    return [];
  }
};

export const getPublicPatientById = async (id: string): Promise<Patient | null> => {
  try {
    const response = await fetch(`${PUBLIC_FHIR_ENDPOINT}/Patient/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return mapExternalPatient(data);
  } catch (error) {
    return null;
  }
};

export const getPublicEncounters = async (patientId: string): Promise<Encounter[]> => {
  try {
    const response = await fetch(`${PUBLIC_FHIR_ENDPOINT}/Encounter?subject=Patient/${patientId}&_sort=-date&_count=10`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.entry || []).map((e: any) => mapExternalEncounter(e.resource));
  } catch (error) {
    return [];
  }
};

export const getPublicObservations = async (patientId: string): Promise<Observation[]> => {
  try {
    const response = await fetch(`${PUBLIC_FHIR_ENDPOINT}/Observation?subject=Patient/${patientId}&_sort=-date&_count=20`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.entry || []).map((e: any) => mapExternalObservation(e.resource));
  } catch (error) {
    return [];
  }
};
