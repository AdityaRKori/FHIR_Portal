import { Patient, Encounter, Observation, IngestionLog } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'ah_patients',
  ENCOUNTERS: 'ah_encounters',
  OBSERVATIONS: 'ah_observations',
  LOGS: 'ah_logs'
};

// Helper to load/save
const load = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultVal;
};

const save = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize Store if empty
const initStore = () => {
  if (!localStorage.getItem(STORAGE_KEYS.PATIENTS)) {
    const demoPatient: Patient = {
      resourceType: 'Patient',
      id: 'p-demo-1',
      active: true,
      name: [{ use: 'official', family: 'Demo', given: ['User'] }],
      gender: 'other',
      birthDate: '2000-01-01',
      telecom: [{ system: 'email', value: 'demo@example.com' }],
      extension: [{ url: 'http://aetherhealth.io/triage', valueString: 'P4' }],
      meta: { lastUpdated: new Date().toISOString(), versionId: '1' }
    };
    save(STORAGE_KEYS.PATIENTS, [demoPatient]);
    save(STORAGE_KEYS.ENCOUNTERS, []);
    save(STORAGE_KEYS.OBSERVATIONS, []);
    save(STORAGE_KEYS.LOGS, []);
  }
};

initStore();

// --- API Methods ---

export const getPatients = async (): Promise<Patient[]> => {
  return load<Patient[]>(STORAGE_KEYS.PATIENTS, []);
};

export const getPatientById = async (id: string): Promise<Patient | undefined> => {
  const patients = load<Patient[]>(STORAGE_KEYS.PATIENTS, []);
  return patients.find(p => p.id === id);
};

export const getEncountersByPatient = async (id: string): Promise<Encounter[]> => {
  const encounters = load<Encounter[]>(STORAGE_KEYS.ENCOUNTERS, []);
  return encounters.filter(e => e.subject.reference.includes(id));
};

export const getObservationsByPatient = async (id: string): Promise<Observation[]> => {
  const obs = load<Observation[]>(STORAGE_KEYS.OBSERVATIONS, []);
  return obs.filter(o => o.subject.reference.includes(id));
};

export const getIngestionLogs = async (): Promise<IngestionLog[]> => {
  return load<IngestionLog[]>(STORAGE_KEYS.LOGS, []).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

// --- Write Methods ---

export const addPatient = async (patient: Patient) => {
  const patients = load<Patient[]>(STORAGE_KEYS.PATIENTS, []);
  // Check for existing patient by ID
  const existingIndex = patients.findIndex(p => p.id === patient.id);
  
  if (existingIndex >= 0) {
    // UPDATE: Merge details but keep existing creation info if needed. 
    // Here we overwrite mostly to ensure latest data from Forms is reflected.
    // However, we might want to preserve some existing extensions if not provided in update.
    const existing = patients[existingIndex];
    patients[existingIndex] = {
      ...existing,
      ...patient,
      meta: {
        ...existing.meta,
        lastUpdated: new Date().toISOString(),
        versionId: String(Number(existing.meta?.versionId || '1') + 1)
      }
    };
  } else {
    // INSERT
    patients.push(patient);
  }
  save(STORAGE_KEYS.PATIENTS, patients);
};

export const addEncounter = async (encounter: Encounter) => {
  const list = load<Encounter[]>(STORAGE_KEYS.ENCOUNTERS, []);
  list.push(encounter);
  save(STORAGE_KEYS.ENCOUNTERS, list);
};

export const addObservation = async (observation: Observation) => {
  const list = load<Observation[]>(STORAGE_KEYS.OBSERVATIONS, []);
  list.push(observation);
  save(STORAGE_KEYS.OBSERVATIONS, list);
};

export const addLog = async (log: IngestionLog) => {
  const list = load<IngestionLog[]>(STORAGE_KEYS.LOGS, []);
  list.push(log);
  save(STORAGE_KEYS.LOGS, list);
};

export const resetStore = async () => {
  localStorage.clear();
  initStore();
  window.location.reload();
};

export const getTriageColor = (level?: string) => {
  switch (level) {
    case 'P1': return 'bg-red-100 text-red-700 border-red-200';
    case 'P2': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'P3': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'P4': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};