import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientDetail } from './components/PatientDetail';
import { IngestionLogView } from './components/IngestionLog';

// Simple Router State to avoid complex routing in this demo environment
type ViewState = 'dashboard' | 'patients' | 'ingestion' | 'reports' | 'detail';

// Inline SVG Component for reliable rendering without file path issues
const EnterpriseLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-12 h-12 shadow-sm rounded-lg">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor:'#0f766e', stopOpacity:1}} />
        <stop offset="100%" style={{stopColor:'#14b8a6', stopOpacity:1}} />
      </linearGradient>
    </defs>
    <path d="M256 32C174 69.06 64 85.22 64 246.56C64 366 168.6 462.64 256 480C343.4 462.64 448 366 448 246.56C448 85.22 338 69.06 256 32Z" fill="url(#grad1)"/>
    <circle cx="256" cy="180" r="24" fill="white"/>
    <circle cx="180" cy="300" r="24" fill="white" opacity="0.8"/>
    <circle cx="332" cy="300" r="24" fill="white" opacity="0.8"/>
    <line x1="256" y1="180" x2="180" y2="300" stroke="white" strokeWidth="12" strokeLinecap="round" />
    <line x1="256" y1="180" x2="332" y2="300" stroke="white" strokeWidth="12" strokeLinecap="round" />
    <line x1="180" y1="300" x2="332" y2="300" stroke="white" strokeWidth="12" strokeLinecap="round" />
  </svg>
);

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Track selected patient AND the source (Local vs Public)
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; source: 'local' | 'public' } | null>(null);

  const handleNavigate = (view: string) => {
    // If clicking "Patients" or "Dashboard", reset selection
    if (view === 'patients' || view === 'dashboard') {
      setSelectedPatient(null);
    }
    setCurrentView(view as ViewState);
  };

  const handlePatientSelect = (id: string, source: 'local' | 'public') => {
    setSelectedPatient({ id, source });
    setCurrentView('detail');
  };

  const renderContent = () => {
    if (currentView === 'detail' && selectedPatient) {
      return (
        <PatientDetail 
          patientId={selectedPatient.id} 
          source={selectedPatient.source}
          onBack={() => {
            setSelectedPatient(null);
            setCurrentView('dashboard');
          }} 
        />
      );
    }

    if (currentView === 'ingestion') {
      return <IngestionLogView />;
    }

    if (currentView === 'reports') {
      return (
        <div className="text-center p-20">
          <h2 className="text-2xl font-bold text-gray-300">Global Reporting Module</h2>
          <p className="text-gray-400 mt-2">Aggregate analytics implementation pending.</p>
        </div>
      );
    }

    // Default to Dashboard (which serves as Patient Registry here)
    return <Dashboard onSelectPatient={handlePatientSelect} />;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-slate-800">
      <Sidebar 
        currentView={currentView === 'detail' ? 'patients' : currentView} 
        onChangeView={handleNavigate} 
      />
      
      <main className="flex-1 ml-64 p-8 transition-all duration-300 ease-in-out">
        {/* Top Header Area */}
        <header className="flex justify-between items-center mb-8 no-print border-b border-gray-200 pb-6">
          <div className="flex items-center gap-4">
            <EnterpriseLogo />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                AetherHealth Enterprise Layer
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                FHIR R4 Interoperability & Clinical AI Engine
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System Status</div>
                <div className="text-sm font-medium text-green-600 flex items-center justify-end gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Online
                </div>
             </div>
             <div className="h-10 w-px bg-gray-200"></div>
             <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-white font-bold shadow-md">
                AH
             </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default App;