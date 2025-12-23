import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientDetail } from './components/PatientDetail';
import { IngestionLogView } from './components/IngestionLog';

// Simple Router State to avoid complex routing in this demo environment
type ViewState = 'dashboard' | 'patients' | 'ingestion' | 'reports' | 'detail';

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
        <header className="flex justify-between items-center mb-8 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentView === 'dashboard' && 'Operations Dashboard'}
              {currentView === 'patients' && 'Patient Registry'}
              {currentView === 'ingestion' && 'System Logs'}
              {currentView === 'detail' && 'Patient Clinical View'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentView === 'dashboard' ? 'Real-time overview of triage status and facility load.' : ''}
              {currentView === 'detail' ? 'Comprehensive FHIR resource visualization.' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-medium text-gray-600">HL7 Listener Active</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-oil-100 border border-oil-200 flex items-center justify-center text-oil-700 font-bold">
                DR
             </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
