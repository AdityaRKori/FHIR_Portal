import React, { useEffect, useState } from 'react';
import { Patient, Encounter, Observation } from '../types';
import { getPatientById, getEncountersByPatient, getObservationsByPatient, getTriageColor } from '../services/store';
import { getPublicPatientById, getPublicEncounters, getPublicObservations } from '../services/externalFhirService';
import { generateClinicalSummary } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Printer, BrainCircuit, Activity, Clock, ArrowLeft, Globe, FileJson, Copy, Check, Download } from 'lucide-react';

interface PatientDetailProps {
  patientId: string;
  source: 'local' | 'public';
  onBack: () => void;
}

export const PatientDetail: React.FC<PatientDetailProps> = ({ patientId, source, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [viewMode, setViewMode] = useState<'clinical' | 'json'>('clinical');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoadingData(true);
    setAiSummary("");
    
    const fetchData = async () => {
      let p, e, o;
      if (source === 'local') {
        [p, e, o] = await Promise.all([
          getPatientById(patientId),
          getEncountersByPatient(patientId),
          getObservationsByPatient(patientId)
        ]);
      } else {
        [p, e, o] = await Promise.all([
          getPublicPatientById(patientId),
          getPublicEncounters(patientId),
          getPublicObservations(patientId)
        ]);
      }
      setPatient(p || null);
      setEncounters(e);
      setObservations(o);
      setLoadingData(false);
    };

    fetchData();
  }, [patientId, source]);

  const handleGenerateAi = async () => {
    if (!patient) return;
    setLoadingAi(true);
    const summary = await generateClinicalSummary(patient, encounters, observations);
    setAiSummary(summary);
    setLoadingAi(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const generateBundle = () => {
    return JSON.stringify({
      resourceType: "Bundle",
      type: "collection",
      entry: [
        { resource: patient },
        ...encounters.map(e => ({ resource: e })),
        ...observations.map(o => ({ resource: o }))
      ]
    }, null, 2);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(generateBundle());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([generateBundle()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patient-${patient?.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingData) return <div className="p-20 text-center text-gray-500">Loading Clinical Data...</div>;
  if (!patient) return <div className="p-20 text-center text-red-500">Patient Not Found</div>;

  const fullName = `${patient.name[0]?.given?.join(' ') || ''} ${patient.name[0]?.family || ''}`;
  const triageLevel = patient.extension?.find(e => e.url.includes('triage'))?.valueString || 'P4';
  
  const heartRateData = observations
    .filter(o => o.code?.text?.toLowerCase().includes('heart') || o.code?.text?.toLowerCase().includes('rate'))
    .map(o => ({
      date: new Date(o.effectiveDateTime).toLocaleDateString(),
      value: o.valueQuantity?.value || parseFloat(o.valueString || '0')
    }))
    .filter(d => d.value > 0)
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header Action Bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center text-gray-500 hover:text-oil-600 transition">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Registry
        </button>
        <div className="flex gap-3">
           <div className="bg-gray-100 p-1 rounded-lg flex text-sm">
              <button 
                onClick={() => setViewMode('clinical')}
                className={`px-3 py-1.5 rounded-md transition ${viewMode === 'clinical' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Clinical View
              </button>
              <button 
                onClick={() => setViewMode('json')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-2 ${viewMode === 'json' ? 'bg-white shadow-sm font-medium text-oil-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <FileJson className="w-4 h-4" /> Raw FHIR
              </button>
           </div>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 shadow-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Main Patient Header Card */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-oil-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
              {source === 'local' && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getTriageColor(triageLevel)}`}>
                  {triageLevel} Priority
                </span>
              )}
               {source === 'public' && (
                <span className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs border border-indigo-100">
                  <Globe className="w-3 h-3" /> Public Record
                </span>
              )}
            </div>
            <div className="text-gray-500 flex flex-wrap gap-6 text-sm">
              <span>ID: {patient.id}</span>
              <span>DOB: {patient.birthDate}</span>
              <span>Gender: {patient.gender}</span>
              <span>Phone: {patient.telecom?.[0]?.value || 'N/A'}</span>
            </div>
          </div>
          <div className="mt-4 md:mt-0 text-right">
             <div className="text-sm text-gray-400">Last Updated</div>
             <div className="font-medium text-gray-700">{new Date(patient.meta?.lastUpdated || '').toLocaleString()}</div>
          </div>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
            <h3 className="text-slate-200 font-mono font-medium">FHIR Bundle (R4)</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleCopyJson}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button 
                onClick={handleDownloadJson}
                className="flex items-center gap-2 px-3 py-1.5 bg-oil-600 hover:bg-oil-700 text-white rounded text-xs font-medium transition"
              >
                <Download className="w-3 h-3" /> Download .json
              </button>
            </div>
          </div>
          <div className="p-6 overflow-auto max-h-[600px]">
            <pre className="text-xs md:text-sm font-mono text-green-400 leading-relaxed whitespace-pre-wrap">
              {generateBundle()}
            </pre>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: AI & Vitals */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* AI Clinical Insight */}
            <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                  <BrainCircuit className="w-5 h-5 text-indigo-600" />
                  AI Clinical Summary
                </div>
                {!aiSummary && (
                  <button 
                    onClick={handleGenerateAi} 
                    disabled={loadingAi}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {loadingAi ? 'Generating...' : 'Generate Insight'}
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-700 leading-relaxed min-h-[60px]">
                {aiSummary ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">
                    Click generate to analyze {source === 'public' ? 'Public FHIR' : 'Local'} data for clinical trends and risk assessment using Gemini.
                  </p>
                )}
              </div>
            </div>

            {/* Vitals Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
               <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-oil-600" /> Vitals History
               </h3>
               <div className="h-64 w-full">
                 {heartRateData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={heartRateData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                       <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                       />
                       <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={3} dot={{r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                     </LineChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="h-full flex items-center justify-center text-gray-400 italic">No historical graph data available.</div>
                 )}
               </div>
            </div>

            {/* Observations Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">
                  Recent Clinical Observations
               </div>
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-500 font-medium">
                   <tr>
                     <th className="px-6 py-3">Test / Code</th>
                     <th className="px-6 py-3">Value</th>
                     <th className="px-6 py-3">Date</th>
                     <th className="px-6 py-3">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {observations.length > 0 ? observations.map(obs => (
                     <tr key={obs.id} className="hover:bg-gray-50/50">
                       <td className="px-6 py-4 text-gray-900">{obs.code?.text || 'Unknown Test'}</td>
                       <td className="px-6 py-4 font-medium text-gray-800">
                         {obs.valueQuantity ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` : obs.valueString || '-'}
                       </td>
                       <td className="px-6 py-4 text-gray-500">{new Date(obs.effectiveDateTime).toLocaleDateString()}</td>
                       <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${obs.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                           {obs.status}
                         </span>
                       </td>
                     </tr>
                   )) : (
                     <tr>
                       <td colSpan={4} className="px-6 py-4 text-center text-gray-400 italic">No recent observations found.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>

          {/* Right Column: Encounters & Timeline */}
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-full">
                <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-oil-600" /> Encounter Timeline
                </h3>
                <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pl-6 pb-2">
                  {encounters.map((encounter) => (
                    <div key={encounter.id} className="relative">
                      <div className="absolute -left-[31px] bg-white border-2 border-oil-200 rounded-full w-4 h-4"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-oil-600 uppercase tracking-wider mb-1">
                          {new Date(encounter.period?.start || '').toLocaleDateString()}
                        </span>
                        <h4 className="font-medium text-gray-900">{encounter.reasonCode?.[0]?.text || "Consultation"}</h4>
                        <p className="text-sm text-gray-500 mt-1">{encounter.class?.display || encounter.class?.code} • {encounter.status}</p>
                      </div>
                    </div>
                  ))}
                  
                  {encounters.length === 0 && (
                     <div className="text-gray-400 text-sm italic">No recorded encounters.</div>
                  )}
                </div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
};