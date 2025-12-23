import React, { useEffect, useState } from 'react';
import { getIngestionLogs, addPatient, addEncounter, addObservation, addLog } from '../services/store';
import { generateHL7v2, parseHL7toFHIR } from '../utils/hl7Generator';
import { IngestionLog as LogType } from '../types';
import { CheckCircle, XCircle, RefreshCw, DownloadCloud, FileSpreadsheet, ArrowRight, ShieldCheck, AlertCircle, Link } from 'lucide-react';

export const IngestionLogView: React.FC = () => {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const refreshLogs = () => getIngestionLogs().then(setLogs);

  useEffect(() => {
    refreshLogs();
  }, []);

  const PRESET_SHEETS = [
    { label: "Form 1 (General)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQW0aRj-dJIS_sqFGXvoLxiSLQw5PwpaQyUpvDyAFs2_g010u8ru8g39TM2irtecgR2pX_8yqPbmwkw/pub?output=csv" },
    { label: "Form 2 (Follow-up)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRh7DqUADDoL6_ACzJLgA3z3UnV3IRDFrKJtHXUIQauVok2X1Gx_tInzsyOKdnvmdVgbiZGdtY-wvFX/pub?output=csv" }
  ];

  // Helper to find column index by lenient keyword matching (handles Google Form questions)
  const findCol = (headers: string[], keywords: string[]) => {
    return headers.findIndex(h => {
      const headerLower = h.toLowerCase();
      return keywords.some(k => headerLower.includes(k));
    });
  };

  const handleSyncGoogleSheet = async () => {
    if (!sheetUrl.includes('google.com/spreadsheets')) {
      setStatusMsg('Error: Invalid Google Sheet URL.');
      return;
    }

    setIsSyncing(true);
    setStatusMsg('Connecting to Google Sheets...');

    try {
      // Fetch CSV (User must publish sheet to web as CSV)
      // Trick: ensure URL ends with output=csv and add random param to bypass cache
      let csvUrl = sheetUrl;
      
      // If user accidentally uses an edit link, try to fix it (though presets are now correct)
      if (csvUrl.includes('/edit')) {
        csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
      } 
      
      // Cache buster
      const separator = csvUrl.includes('?') ? '&' : '?';
      csvUrl += `${separator}t=${Date.now()}`;

      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error("Failed to fetch. Ensure Sheet is 'Published to Web' as CSV (File > Share > Publish to Web).");
      
      const text = await response.text();
      const rows = text.split('\n');
      
      if (rows.length < 2) throw new Error("Sheet appears empty. Please add at least one response.");

      // SMART PARSING: Detect headers
      // Google Forms often wraps headers in quotes: "What is your name?"
      const headers = rows[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      
      console.log("Detected Headers:", headers);

      // Map columns dynamically based on keywords commonly found in forms
      const colMap = {
        timestamp: findCol(headers, ['timestamp', 'date', 'time']),
        email: findCol(headers, ['email', 'address', 'mail']),
        // Name might be "Full Name", "Patient Name", "Name", "Who is the patient?"
        name: findCol(headers, ['name', 'patient', 'full', 'subject']),
        // ID might be "ID", "MRN", "Record Number", "Identifier"
        id: findCol(headers, ['id', 'mrn', 'identifier', 'record', 'number']),
        dob: findCol(headers, ['dob', 'birth', 'born']),
        phone: findCol(headers, ['phone', 'contact', 'mobile', 'cell']),
        // Symptoms might be "Reason", "Complaint", "Symptoms", "Issue"
        symptoms: findCol(headers, ['symptom', 'reason', 'complaint', 'issue', 'diagnosis', 'problem']),
        triage: findCol(headers, ['triage', 'level', 'priority', 'p1', 'p2', 'status']),
        heartRate: findCol(headers, ['heart', 'rate', 'pulse', 'bpm', 'hr']),
        temp: findCol(headers, ['temp', 'fever', 'celsius', 'fahrenheit']),
      };

      if (colMap.name === -1 && colMap.id === -1) {
        throw new Error(`Could not find 'Name' or 'ID' column. Detected headers: ${headers.join(', ')}`);
      }

      const dataRows = rows.slice(1);
      let count = 0;

      for (const row of dataRows) {
        if (!row.trim()) continue;
        
        // Simple CSV split (handles basic commas)
        // In a real prod app, use a library like 'papaparse' for quoted CSVs
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        
        // Extract data using the map
        const getVal = (idx: number) => idx !== -1 && cols[idx] ? cols[idx] : '';

        const formData = {
          timestamp: getVal(colMap.timestamp) || new Date().toISOString(),
          patientId: getVal(colMap.id), 
          email: getVal(colMap.email),
          fullName: getVal(colMap.name) || 'Unknown Patient',
          dob: getVal(colMap.dob) || '2000-01-01',
          phone: getVal(colMap.phone),
          symptoms: getVal(colMap.symptoms) || 'General Update',
          triageLevel: getVal(colMap.triage) || 'P4',
          heartRate: getVal(colMap.heartRate),
          temp: getVal(colMap.temp)
        };

        // 1. Generate HL7
        const hl7Message = generateHL7v2(formData);

        // 2. Parse HL7 to FHIR
        const { patient, encounter, observations } = parseHL7toFHIR(hl7Message);

        // 3. Save to Store (Upsert Logic)
        await addPatient(patient);
        await addEncounter(encounter);
        for (const obs of observations) await addObservation(obs);

        // 4. Log
        await addLog({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          source: 'GoogleForms',
          status: 'Success',
          rawSnippet: hl7Message, 
          patientReference: `Patient/${patient.id}`
        });

        count++;
      }

      setStatusMsg(`Success: Synced ${count} records from Sheet.`);
      refreshLogs();
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`Error: ${error.message}`);
      await addLog({
        id: `log-err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'GoogleForms',
        status: 'Failed',
        rawSnippet: `Failed to fetch CSV: ${error.message}`
      });
      refreshLogs();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Connector Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg text-green-700">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Google Sheets Connector</h2>
            <p className="text-sm text-gray-500">Sync patient responses. Supports automatic column mapping.</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
          <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-oil-600" />
            Smart Mapping Active
          </h4>
          <p className="text-sm text-gray-600 mb-3">
            The system automatically detects columns like <b>"Patient ID", "Name", "Score", "Triage"</b> in your form responses.
            <br/>
            <span className="text-xs text-orange-600 font-medium">Note: Updates from Google Forms to the "Published CSV" link can take up to 5 minutes.</span>
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {PRESET_SHEETS.map((preset, idx) => (
              <button 
                key={idx}
                onClick={() => setSheetUrl(preset.url)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:border-oil-500 hover:text-oil-600 rounded-lg transition"
              >
                <Link className="w-3 h-3" />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Paste Google Sheet CSV URL here..." 
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oil-500 focus:outline-none"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
          <button 
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="px-6 py-2 bg-oil-600 text-white font-medium rounded-xl hover:bg-oil-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Sync Sheet
          </button>
        </div>
        {statusMsg && (
          <div className={`mt-3 text-sm font-medium ${statusMsg.includes('Error') || statusMsg.includes('Warning') ? 'text-orange-600' : 'text-green-600'}`}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* Logs View */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Interoperability Logs</h2>
          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">Protocol: HL7 v2.5 over MLLP (Simulated)</span>
        </div>

        <div className="space-y-4">
          {logs.length === 0 && (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              No data ingested yet. Sync a sheet to see logs.
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-0 shadow-sm overflow-hidden hover:shadow-md transition">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {log.status === 'Success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="font-bold text-gray-700 text-sm">Inbound Message</span>
                       <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">ADT^A01</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(log.timestamp).toLocaleString()} • Source: {log.source}</div>
                  </div>
                </div>
                {log.patientReference && (
                  <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
                    <ShieldCheck className="w-3 h-3" />
                    Ref: <b>{log.patientReference}</b>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-900 p-4 overflow-x-auto">
                <div className="flex items-center text-gray-500 text-xs mb-2 gap-2 uppercase tracking-wider font-bold">
                   <span>Raw HL7 v2.5 Stream</span>
                   <div className="h-px bg-gray-700 flex-1"></div>
                </div>
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
                  {log.rawSnippet}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};