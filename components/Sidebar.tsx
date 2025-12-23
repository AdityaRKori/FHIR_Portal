import React from 'react';
import { LayoutDashboard, Users, Activity, FileText, Database, Settings } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Triage Board', icon: LayoutDashboard },
    { id: 'patients', label: 'Patient Registry', icon: Users },
    { id: 'ingestion', label: 'Data Ingestion', icon: Database },
    { id: 'reports', label: 'Global Reports', icon: FileText },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-50 no-print">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-oil-600 flex items-center justify-center">
          <Activity className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-xl text-oil-900 tracking-tight">AetherHealth</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-oil-50 text-oil-800 font-medium shadow-sm ring-1 ring-oil-100'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-oil-600' : 'text-gray-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 cursor-pointer text-gray-500">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </div>
        <div className="mt-4 px-4 text-xs text-gray-400">
          v2.5.0-alpha • FHIR R4
        </div>
      </div>
    </div>
  );
};