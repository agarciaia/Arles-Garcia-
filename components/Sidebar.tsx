import React from 'react';
import { LayoutDashboard, Wrench, DollarSign, Settings, Car, FileText } from 'lucide-react';
import { AppView, AppSettings } from '../types';

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onNavigate?: () => void;
  settings: AppSettings;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onNavigate, settings }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.SERVICES, label: 'Servicios', icon: Wrench },
    { id: AppView.QUOTES, label: 'Cotizaciones', icon: FileText },
    { id: AppView.COSTS, label: 'Costos', icon: DollarSign },
    { id: AppView.SETTINGS, label: 'Configuración', icon: Settings },
  ];

  const handleNavigation = (view: AppView) => {
    setCurrentView(view);
    if (onNavigate) onNavigate();
  };

  const getThemeColorClass = () => {
    switch(settings.themeColor) {
      case 'purple': return 'text-purple-500';
      case 'emerald': return 'text-emerald-500';
      case 'orange': return 'text-orange-500';
      case 'red': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  const getActiveBgClass = () => {
    switch(settings.themeColor) {
      case 'purple': return 'bg-purple-600 shadow-purple-900/50';
      case 'emerald': return 'bg-emerald-600 shadow-emerald-900/50';
      case 'orange': return 'bg-orange-600 shadow-orange-900/50';
      case 'red': return 'bg-red-600 shadow-red-900/50';
      default: return 'bg-blue-600 shadow-blue-900/50';
    }
  };

  // Date formatting
  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 h-full flex flex-col">
      <div className="p-6 border-b border-slate-800 flex flex-col gap-2 h-auto">
        <div className="flex items-center gap-3">
          <div className={`${settings.themeColor === 'blue' ? 'bg-blue-600' : getActiveBgClass().split(' ')[0]} p-1.5 rounded-lg shrink-0`}>
            <Car className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
            {settings.companyName}
          </h1>
        </div>
        <div className="text-xs font-medium text-slate-500 capitalize pl-1">
          {dateStr}
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? `${getActiveBgClass()} text-white shadow-lg` 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500 text-center">
          v1.2.0 • {settings.companyName}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;