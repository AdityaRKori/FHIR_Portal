import React, { useState, useEffect } from 'react';
import { getPatients, getTriageColor } from '../services/store';
import { searchPublicPatients } from '../services/externalFhirService';
import { Patient } from '../types';
import { Search, RefreshCw, ChevronRight, Globe, Database, Server, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  onSelectPatient: (id: string, source: 'local' | 'public') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [source, setSource] = useState<'local' | 'public'>('local');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ active: 0, critical: 0, waitTime: 14 });
  const [errorMsg, setErrorMsg] = useState('');

  const refreshData = async () => {
    setLoading(true);
    setErrorMsg('');
    
    if (source === 'local') {
      const data = await getPatients();
      setPatients(data);
      setStats({
        active: data.length,
        critical: data.filter(p => p.extension?.some(e => e.valueString === 'P1')).length,
        waitTime: Math.floor(Math.random() * 20) + 5
      });
      setLoading(false);
    } else {
      // Public Source
      try {
        const data = await searchPublicPatients(searchTerm);
        setPatients(data);
        setStats({
          active: data.length,
          critical: 0, // Public data usually lacks our specific Triage extension
          waitTime: 0
        });
      } catch (e) {
        setErrorMsg('Failed to connect to public FHIR server.');
        setPatients([]);
      }
      setLoading(false);
    }
  };

  // Debounce search for public API
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, source]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      
      {/* Hero / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="text-sm text-gray-500 font-medium">
             {source === 'local' ? 'Active Patients' : 'Public Results'}
           </div>
           <div className="text-3xl font-bold text-gray-900 mt-2">{stats.active}</div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
           <div className="text-sm text-red-600 font-medium">Critical (P1)</div>
           <div className="text-3xl font-bold text-red-700 mt-2">{stats.critical}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="text-sm text-gray-500 font-medium">Data Source</div>
           <div className="flex items-center gap-2 mt-2">
              {source === 'local' ? (
                <div className="flex items-center gap-2 text-oil-600 font-bold text-lg">
                   <Database className="w-5 h-5" /> Local Store
                </div>
              ) : (
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
                   <Globe className="w-5 h-5" /> HAPI FHIR (Public)
                </div>
              )}
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="text-sm text-gray-500 font-medium">Avg Wait Time</div>
           <div className="text-3xl font-bold text-gray-900 mt-2">{stats.waitTime}m</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        
        {/* Source Switcher */}
        <div className="flex bg-gray-200 p-1 rounded-xl">
          <button 
            onClick={() => { setSource('local'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              source === 'local' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4" /> Local DB
          </button>
          <button 
             onClick={() => { setSource('public'); setSearchTerm(''); }}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              source === 'public' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4" /> Public API
          </button>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={source === 'local' ? "Search local patients..." : "Search HAPI FHIR server..."} 
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oil-500/20 focus:border-oil-500 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={refreshData} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-sm font-medium">
              <th className="px-6 py-4">Patient Name</th>
              <th className="px-6 py-4">ID / MRN</th>
              <th className="px-6 py-4">Triage / Status</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Last Updated</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr>
                 <td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading data...</td>
               </tr>
            ) : patients.map(patient => {
              const triage = patient.extension?.find(e => e.url.includes('triage'))?.valueString;
              const nameStr = `${patient.name[0]?.given?.join(' ') || ''} ${patient.name[0]?.family || ''}`.trim() || 'Unknown';
              
              return (
                <tr key={patient.id} className="hover:bg-gray-50/80 transition group cursor-pointer" onClick={() => onSelectPatient(patient.id, source)}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">
                      {nameStr}
                    </div>
                    <div className="text-xs text-gray-400">
                      {patient.gender || 'unknown'}, {patient.birthDate || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    {patient.id}
                  </td>
                  <td className="px-6 py-4">
                    {source === 'local' ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getTriageColor(triage)}`}>
                        {triage || 'P4'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                         {patient.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.telecom?.[0]?.value || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(patient.meta?.lastUpdated || '').toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 text-gray-400 hover:text-oil-600 hover:bg-oil-50 rounded-full transition">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && patients.length === 0 && (
          <div className="p-10 text-center text-gray-400">
             {errorMsg ? (
               <div className="flex flex-col items-center gap-2 text-amber-600">
                 <AlertTriangle className="w-6 h-6" />
                 <span>{errorMsg}</span>
                 <span className="text-xs text-gray-400">The public HAPI server may be experiencing downtime or rate-limiting.</span>
               </div>
             ) : (
                source === 'local' 
                 ? "No local patients found. Sync data via Ingestion tab." 
                 : "No patients found on public server matching query."
             )}
          </div>
        )}
      </div>
    </div>
  );
};