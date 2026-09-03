import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Sidebar from './components/Sidebar';
import { AppView, Service, Cost, Quote, AppSettings, UserRole } from './types';
import { Menu, X, Maximize, Minimize } from 'lucide-react';
import { saveWorkshopState, subscribeToWorkshopState } from './services/cloudData';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Services = lazy(() => import('./components/Services'));
const Quotes = lazy(() => import('./components/Quotes'));
const Costs = lazy(() => import('./components/Costs'));
const Settings = lazy(() => import('./components/Settings'));
const Guide = lazy(() => import('./components/Guide'));

const initialServices: Service[] = [];
const initialCosts: Cost[] = [];
const initialQuotes: Quote[] = [];
const LOCAL_OWNER_KEY = 'taller_owner_uid';

const defaultSettings: AppSettings = {
  themeColor: 'blue',
  companyName: 'Ingrese nombre de su taller',
  companyAddress: 'Dirección de su taller',
  companyPhone: 'Teléfono de contacto',
  mechanicName: 'Freddy Rincón',
  logoUrl: '',
  whatsappServiceTemplate: '🛠️\n\nTALLER: {taller}\n\nHola {cliente},\nTu vehículo 🚗: {marca_modelo}\n🪪 Patente: {patente}\n📅 Fecha: {fecha}\n📌 Estado actual: *{estado}*\n\n🔧 Detalle del Servicio\n{detalle}\n\n💰 Resumen de Pago\nTotal: ${total}\nAbono: ${abono}\nPendiente: ${saldo}\n\n📲 Ante cualquier duda o consulta, no dudes en contactarnos.\nGracias por confiar en {taller}',
  whatsappQuoteTemplate: '*COTIZACIÓN #{id}*\n🔧 {taller}\n\nHola {cliente}, aquí tienes el presupuesto para tu {vehiculo}.\n\n📋 *Detalle:*\n{detalle}\n\n💰 *TOTAL: ${total}*\n\n_Válido por {dias} días._'
};

const persistLocal = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`No fue posible guardar ${key} en el dispositivo.`, error);
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('guest');
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        // El rol nunca debe inferirse desde palabras contenidas en el correo.
        // Hasta contar con roles administrados desde servidor, solo la cuenta propietaria es admin.
        if (currentUser.email === 'ag.analisis247@gmail.com') {
          setRole('admin');
        } else {
          setRole('alumno');
        }
      } else {
        setRole('guest');
      }
    });
    return () => unsubscribe();
  }, []);
  
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
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [cloudReady, setCloudReady] = useState(false);
  const lastCloudState = useRef('');

  // Close mobile menu on view change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  // Persistence Effects
  useEffect(() => { persistLocal('taller_services', services); }, [services]);
  useEffect(() => { persistLocal('taller_costs', costs); }, [costs]);
  useEffect(() => { persistLocal('taller_quotes', quotes); }, [quotes]);
  useEffect(() => { persistLocal('taller_settings', settings); }, [settings]);

  // Firestore is the durable source of truth while localStorage remains an offline cache.
  useEffect(() => {
    setCloudReady(false);
    lastCloudState.current = '';
    if (!user) {
      setSyncStatus('local');
      return;
    }

    setSyncStatus('syncing');
    return subscribeToWorkshopState(
      user.uid,
      async (remoteState) => {
        try {
          if (remoteState) {
            const normalized = JSON.stringify(remoteState);
            lastCloudState.current = normalized;
            setServices(remoteState.services);
            setCosts(remoteState.costs);
            setQuotes(remoteState.quotes);
            setSettings({ ...defaultSettings, ...remoteState.settings });
            localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
          } else {
            // Solo migramos la copia local si pertenece a esta cuenta (o si todavía
            // no tenía propietario). Esto evita copiar datos de otro usuario del navegador.
            const localOwner = localStorage.getItem(LOCAL_OWNER_KEY);
            const canMigrateLocalData = !localOwner || localOwner === user.uid;
            const seedState = canMigrateLocalData
              ? { services, costs, quotes, settings }
              : { services: initialServices, costs: initialCosts, quotes: initialQuotes, settings: defaultSettings };
            setServices(seedState.services);
            setCosts(seedState.costs);
            setQuotes(seedState.quotes);
            setSettings(seedState.settings);
            await saveWorkshopState(user.uid, seedState);
            localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
            lastCloudState.current = JSON.stringify(seedState);
          }
          setCloudReady(true);
          setSyncStatus('synced');
        } catch {
          setCloudReady(true);
          setSyncStatus('error');
        }
      },
      () => {
        setCloudReady(true);
        setSyncStatus('error');
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    const state = { services, costs, quotes, settings };
    const serialized = JSON.stringify(state);
    if (serialized === lastCloudState.current) return;

    setSyncStatus('syncing');
    const timer = window.setTimeout(async () => {
      try {
        await saveWorkshopState(user.uid, state);
        localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
        lastCloudState.current = serialized;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, services, costs, quotes, settings]);

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
    // Permitir ver la Guía y la Configuración (donde está el Login) sin estar autenticado
    if (!user && currentView !== AppView.GUIDE && currentView !== AppView.SETTINGS) {
        return <Guide onStart={() => setCurrentView(AppView.SETTINGS)} />;
    }

    switch(currentView) {
      case AppView.DASHBOARD:
        return <Dashboard services={services} costs={costs} setServices={setServices} setCosts={setCosts} />;
      case AppView.SERVICES:
        // Solo Admin y Profesor ven Servicios
        if (role === 'admin' || role === 'profesor') {
            return <Services services={services} setServices={setServices} settings={settings} />;
        }
        return <div className="p-10 text-center text-slate-400">No tienes permiso para gestionar servicios.</div>;
      case AppView.QUOTES:
        return <Quotes quotes={quotes} setQuotes={setQuotes} settings={settings} services={services} setServices={setServices} onNavigate={setCurrentView} />;
      case AppView.COSTS:
        // Solo el Admin ve los Costos reales
        if (role === 'admin') {
            return <Costs costs={costs} setCosts={setCosts} />;
        }
        return <div className="p-10 text-center text-slate-400">Acceso restringido: Solo Administración puede ver costos.</div>;
      case AppView.SETTINGS:
        return <Settings 
          user={user}
          settings={settings} 
          setSettings={setSettings} 
          services={services} 
          setServices={setServices} 
          costs={costs}       
          setCosts={setCosts}       
          quotes={quotes}     
          setQuotes={setQuotes}     
          syncStatus={syncStatus}
        />;
      case AppView.GUIDE:
        return <Guide onStart={() => setCurrentView(AppView.SETTINGS)} />;
      default:
        return <Dashboard services={services} costs={costs} setServices={setServices} setCosts={setCosts} />;
    }
  };

  const getViewTitle = () => {
    switch(currentView) {
      case AppView.DASHBOARD: return 'Dashboard';
      case AppView.SERVICES: return 'Gestión de Servicios';
      case AppView.QUOTES: return 'Cotizaciones';
      case AppView.COSTS: return 'Control de Costos';
      case AppView.SETTINGS: return 'Configuración';
      case AppView.GUIDE: return 'Guía del Taller';
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
          user={user}
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
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Cargando módulo…</div>}>
              {renderView()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
