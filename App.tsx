import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Services from './components/Services';
import Quotes from './components/Quotes';
import Costs from './components/Costs';
import Settings from './components/Settings';
import { AppView, Service, Cost, Quote, AppSettings } from './types';
import { Menu, X, Maximize, Minimize } from 'lucide-react';

const initialServices: Service[] = [];
const initialCosts: Cost[] = [];
const initialQuotes: Quote[] = [];

const defaultSettings: AppSettings = {
  themeColor: 'blue',
  companyName: 'Yahveh Jireh',
  companyAddress: 'Quiriquina 3738, Comuna Lo Espejo',
  companyPhone: '+56 9 5795 1027',
  whatsappServiceTemplate: '*TALLER: {taller}*\n\nHola {cliente}, tu vehículo {vehiculo} está actualmente en estado: *{estado}*.\n\n💰 Total: ${total}\n💳 Abono: ${abono}\n❗ Pendiente: ${saldo}\n\nDetalles:\n{detalle}',
  whatsappQuoteTemplate: '*COTIZACIÓN #{id}*\n🔧 {taller}\n\nHola {cliente}, aquí tienes el presupuesto para tu {vehiculo}.\n\n📋 *Detalle:*\n{detalle}\n\n💰 *TOTAL: ${total}*\n\n_Válido por {dias} días._'
};

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  
  // --- Data States ---
  const [services, setServices] = useState<Service[]>(() => {
    try {
      const saved = localStorage.getItem('taller_services');
      return saved ? JSON.parse(saved) : initialServices;
    } catch (error) { return initialServices; }
  });

  const [costs, setCosts] = useState<Cost[]>(() => {
    try {
      const saved = localStorage.getItem('taller_costs');
      return saved ? JSON.parse(saved) : initialCosts;
    } catch (error) { return initialCosts; }
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    try {
      const saved = localStorage.getItem('taller_quotes');
      return saved ? JSON.parse(saved) : initialQuotes;
    } catch (error) { return initialQuotes; }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('taller_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch (error) { return defaultSettings; }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close mobile menu on view change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('taller_services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('taller_costs', JSON.stringify(costs)); }, [costs]);
  useEffect(() => { localStorage.setItem('taller_quotes', JSON.stringify(quotes)); }, [quotes]);
  useEffect(() => { localStorage.setItem('taller_settings', JSON.stringify(settings)); }, [settings]);

  // Handle Fullscreen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => { setIsFullscreen(!!document.fullscreenElement); };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const renderView = () => {
    switch(currentView) {
      case AppView.DASHBOARD:
        return <Dashboard services={services} costs={costs} />;
      case AppView.SERVICES:
        return <Services services={services} setServices={setServices} settings={settings} />;
      case AppView.QUOTES:
        return <Quotes quotes={quotes} setQuotes={setQuotes} settings={settings} services={services} setServices={setServices} onNavigate={setCurrentView} />;
      case AppView.COSTS:
        return <Costs costs={costs} setCosts={setCosts} />;
      case AppView.SETTINGS:
        return <Settings 
          settings={settings} 
          setSettings={setSettings} 
          services={services} 
          setServices={setServices} 
          costs={costs}       
          setCosts={setCosts}       
          quotes={quotes}     
          setQuotes={setQuotes}     
        />;
      default:
        return <Dashboard services={services} costs={costs} />;
    }
  };

  const getViewTitle = () => {
    switch(currentView) {
      case AppView.DASHBOARD: return 'Dashboard';
      case AppView.SERVICES: return 'Gestión de Servicios';
      case AppView.QUOTES: return 'Cotizaciones';
      case AppView.COSTS: return 'Control de Costos';
      case AppView.SETTINGS: return 'Configuración';
      default: return 'TallerManager';
    }
  };

  // Helper to get text color based on theme
  const getThemeColorClass = () => {
    switch(settings.themeColor) {
      case 'purple': return 'text-purple-500';
      case 'emerald': return 'text-emerald-500';
      case 'orange': return 'text-orange-500';
      case 'red': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      
      {/* Sidebar (Mobile Wrapper) */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none`}>
        <Sidebar 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          onNavigate={() => setIsMobileMenuOpen(false)}
          settings={settings}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
        
        {/* Unified Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
             {/* Mobile Menu Toggle */}
             <button 
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
               className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
             >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
             </button>
             
             {/* Title */}
             <div>
               <h1 className="md:hidden font-bold text-lg text-white tracking-tight truncate max-w-[200px]">
                 {settings.companyName}
               </h1>
               <h2 className="hidden md:block text-lg font-semibold text-white">{getViewTitle()}</h2>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleFullScreen} 
              className={`p-2.5 rounded-lg transition-all active:scale-95 ${isFullscreen ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} 
              aria-label="Pantalla completa"
            >
               {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </header>

        {/* View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;