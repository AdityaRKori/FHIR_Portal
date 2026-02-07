import React, { useEffect, useState } from 'react';
import { getIngestionLogs, addPatient, addEncounter, addObservation, addLog } from '../services/store';
import { generateHL7v2, parseHL7toFHIR } from '../utils/hl7Generator';
import { IngestionLog as LogType } from '../types';
import { CheckCircle, XCircle, RefreshCw, DownloadCloud, FileSpreadsheet, ArrowRight, ShieldCheck, AlertCircle, Link, ExternalLink, FileText } from 'lucide-react';

export const IngestionLogView: React.FC = () => {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const refreshLogs = () => getIngestionLogs().then(setLogs);

  useEffect(() => {
    refreshLogs();
  }, []);

  // Updated with the user's specific published sheets.
  const PRESET_SHEETS = [
    { 
      label: "Form 1: Patient SOAP Notes & Triage", 
      csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRh7DqUADDoL6_ACzJLgA3z3UnV3IRDFrKJtHXUIQauVok2X1Gx_tInzsyOKdnvmdVgbiZGdtY-wvFX/pub?output=csv",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdST7Gm8bSD8rCs89AMzKrXhiww0SfTGZcXMgNpZyyue2cbQw/viewform"
    },
    { 
      label: "Form 2: Vitals & Monitoring", 
      csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQW0aRj-dJIS_sqFGXvoLxiSLQw5PwpaQyUpvDyAFs2_g010u8ru8g39TM2irtecgR2pX_8yqPbmwkw/pub?output=csv",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeTcuHPtPYJA1d4wfR8VINS_a2VThH7x1v3vh6dUj-yrY_P5A/viewform"
    }
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
        // Attempt to convert edit link to pub link, though this often requires manual "Publish" action first
        csvUrl = csvUrl.replace(/\/edit.*$/, '/pub?output=csv');
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
        symptoms: findCol(headers, ['symptom', 'reason', 'complaint', 'issue', 'diagnosis', 'problem', 'soap', 'history']),
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
      
      {/* Live Form Links */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Live Data Collection Forms
        </h2>
        <p className="text-sm text-indigo-700 mb-4">
          Data entry is performed via standard Google Forms. Responses are written to the Sheets below, then ingested by AetherHealth.
        </p>
        <div className="flex flex-wrap gap-4">
          {PRESET_SHEETS.map((preset, idx) => (
             <a 
               key={idx} 
               href={preset.formUrl} 
               target="_blank" 
               rel="noreferrer"
               className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 font-medium rounded-lg shadow-sm border border-indigo-100 hover:bg-indigo-600 hover:text-white transition"
             >
                <ExternalLink className="w-4 h-4" />
                Open {preset.label}
             </a>
          ))}
        </div>
      </div>

      {/* Connector Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg text-green-700">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Google Sheets Integration</h2>
            <p className="text-sm text-gray-500">Sync patient responses. Supports automatic HL7 mapping.</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
          <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-oil-600" />
            Active Sheet Connections
          </h4>
          <p className="text-sm text-gray-600 mb-3">
             Select a source below to pull the latest CSV data from the cloud.
            <br/>
            <span className="text-xs text-orange-600 font-medium">Requirement: Sheets must be "Published to Web" as CSV.</span>
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {PRESET_SHEETS.map((preset, idx) => (
              <button 
                key={idx}
                onClick={() => {
                   setSheetUrl(preset.csvUrl);
                   // Optionally auto-trigger
                }}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:border-oil-500 hover:text-oil-600 rounded-lg transition font-medium"
              >
                <Link className="w-3 h-3" />
                Use {preset.label} Source
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Paste Google Sheet Published CSV URL here..." 
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oil-500 focus:outline-none font-mono text-sm"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
          <button 
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="px-6 py-2 bg-oil-600 text-white font-medium rounded-xl hover:bg-oil-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Sync Now
          </button>
        </div>
        {statusMsg && (
          <div className={`mt-3 text-sm font-medium ${statusMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
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