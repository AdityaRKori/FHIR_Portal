// Simplified FHIR R4 interfaces

export type ResourceType = 'Patient' | 'Observation' | 'Encounter' | 'Condition' | 'DiagnosticReport';

export interface BaseResource {
  resourceType: ResourceType;
  id: string;
  meta?: {
    lastUpdated: string;
    versionId: string;
  };
}

export interface HumanName {
  use?: 'official' | 'usual';
  family: string;
  given: string[];
}

export interface Identifier {
  system: string;
  value: string;
  type?: { text: string };
}

export interface Telecom {
  system: 'phone' | 'email';
  value: string;
  use?: 'home' | 'work' | 'mobile';
}

export interface Patient extends BaseResource {
  resourceType: 'Patient';
  active: boolean;
  name: HumanName[];
  telecom?: Telecom[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  address?: Array<{
    text: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  identifier?: Identifier[];
  // Custom extension for Triage (simulated FHIR extension)
  extension?: Array<{
    url: string;
    valueString?: string; // P1, P2, P3, P4
  }>;
}

export interface Coding {
  system: string;
  code: string;
  display: string;
}

export interface Observation extends BaseResource {
  resourceType: 'Observation';
  status: 'final' | 'preliminary';
  category?: Array<{ coding: Coding[] }>;
  code: { coding: Coding[]; text?: string };
  subject: { reference: string }; // Reference to Patient
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
  valueString?: string;
  component?: Array<{
    code: { coding: Coding[] };
    valueQuantity: { value: number; unit: string };
  }>;
}

export interface Encounter extends BaseResource {
  resourceType: 'Encounter';
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'finished';
  class: Coding;
  type?: Array<{ text: string }>;
  subject: { reference: string };
  period?: { start: string; end?: string };
  reasonCode?: Array<{ text: string }>;
}

export interface IngestionLog {
  id: string;
  timestamp: string;
  source: 'HL7v2' | 'GoogleForms' | 'ExternalXML' | 'WearableAPI';
  status: 'Success' | 'Failed' | 'Pending';
  rawSnippet: string;
  patientReference?: string;
}
