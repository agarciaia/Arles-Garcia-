import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Sidebar from './components/Sidebar';
import { AccountInfo, AppView, Service, Cost, Quote, AppSettings, UserRole } from './types';
import { AlertTriangle, Menu, X, Maximize, Minimize } from 'lucide-react';
import {
  ensureAccount,
  completeOnboarding,
  getEffectiveAccountStatus,
  migrateWorkshopData,
  recordActivity,
  subscribeToAccount,
  subscribeToWorkshopState,
  syncWorkshopState,
  WorkshopState,
} from './services/cloudData';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Services = lazy(() => import('./components/Services'));
const Quotes = lazy(() => import('./components/Quotes'));
const Costs = lazy(() => import('./components/Costs'));
const Settings = lazy(() => import('./components/Settings'));
const Guide = lazy(() => import('./components/Guide'));
const Onboarding = lazy(() => import('./components/Onboarding'));

const initialServices: Service[] = [];
const initialCosts: Cost[] = [];
const initialQuotes: Quote[] = [];
const LOCAL_OWNER_KEY = 'taller_owner_uid';

const defaultSettings: AppSettings = {
  themeColor: 'blue',
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  mechanicName: '',
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
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Cada cuenta autenticada administra su propio taller. Las reglas de Firestore
      // aíslan los datos por UID, por lo que una cuenta no puede acceder a otra.
      setRole(currentUser?.emailVerified ? 'admin' : 'guest');
    });
    return () => unsubscribe();
  }, []);

  const finishOnboarding = async (nextSettings: AppSettings) => {
    if (!user || !lastCloudState.current) throw new Error('Cuenta no preparada');
    const nextState = { services, costs, quotes, settings: nextSettings };
    await syncWorkshopState(user.uid, nextState, lastCloudState.current);
    lastCloudState.current = nextState;
    setSettings(nextSettings);
    await completeOnboarding(user.uid);
  };

  const showReadOnlyMessage = () => {
    window.alert('Tu período de prueba finalizó. Puedes revisar y respaldar tus datos, pero debes renovar para guardar cambios.');
    setCurrentView(AppView.SETTINGS);
  };

  const setServicesSafely: React.Dispatch<React.SetStateAction<Service[]>> = (value) => {
    if (canWrite) setServices(value);
    else showReadOnlyMessage();
  };
  const setCostsSafely: React.Dispatch<React.SetStateAction<Cost[]>> = (value) => {
    if (canWrite) setCosts(value);
    else showReadOnlyMessage();
  };
  const setQuotesSafely: React.Dispatch<React.SetStateAction<Quote[]>> = (value) => {
    if (canWrite) setQuotes(value);
    else showReadOnlyMessage();
  };
  const setSettingsSafely: React.Dispatch<React.SetStateAction<AppSettings>> = (value) => {
    if (canWrite) setSettings(value);
    else showReadOnlyMessage();
  };
  
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
  const lastCloudState = useRef<WorkshopState | null>(null);
  const accountStatus = getEffectiveAccountStatus(account);
  const canWrite = accountStatus === 'trialing' || accountStatus === 'active';

  // Close mobile menu on view change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  // Las claves antiguas se conservan solo hasta completar la migración. Después,
  // Firestore usa IndexedDB como caché sin el límite reducido de localStorage.
  useEffect(() => {
    if (!user || !cloudReady) {
      persistLocal('taller_services', services);
      persistLocal('taller_costs', costs);
      persistLocal('taller_quotes', quotes);
      persistLocal('taller_settings', settings);
      return;
    }
    ['taller_services', 'taller_costs', 'taller_quotes', 'taller_settings']
      .forEach((key) => localStorage.removeItem(key));
  }, [user, cloudReady, services, costs, quotes, settings]);

  // Firestore es la fuente de verdad; la caché persistente se mantiene en IndexedDB.
  useEffect(() => {
    setCloudReady(false);
    lastCloudState.current = null;
    setAccount(null);
    if (!user || !user.emailVerified) {
      setSyncStatus('local');
      return;
    }

    setSyncStatus('syncing');
    let stopAccount = () => undefined;
    let stopWorkshop = () => undefined;
    let cancelled = false;
    const start = async () => {
      try {
        await ensureAccount(user.uid, user.email || '');
        const localOwner = localStorage.getItem(LOCAL_OWNER_KEY);
        const canMigrateLocalData = !localOwner || localOwner === user.uid;
        const fallback = canMigrateLocalData
          ? { services, costs, quotes, settings }
          : { services: initialServices, costs: initialCosts, quotes: initialQuotes, settings: defaultSettings };
        await migrateWorkshopData(user.uid, fallback);
        if (cancelled) return;
        stopAccount = subscribeToAccount(user.uid, setAccount, () => setSyncStatus('error'));
        stopWorkshop = subscribeToWorkshopState(user.uid, (remoteState) => {
          lastCloudState.current = remoteState;
          setServices(remoteState.services);
          setCosts(remoteState.costs);
          setQuotes(remoteState.quotes);
          setSettings({ ...defaultSettings, ...remoteState.settings });
          localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
          setCloudReady(true);
          setSyncStatus('synced');
        }, () => {
          setCloudReady(true);
          setSyncStatus('error');
        });
        recordActivity(user.uid).catch(() => undefined);
      } catch {
        setCloudReady(true);
        setSyncStatus('error');
      }
    };
    start();
    return () => {
      cancelled = true;
      stopAccount();
      stopWorkshop();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !cloudReady || !canWrite || !lastCloudState.current) return;
    const state = { services, costs, quotes, settings };
    if (JSON.stringify(state) === JSON.stringify(lastCloudState.current)) return;

    setSyncStatus('syncing');
    const timer = window.setTimeout(async () => {
      try {
        await syncWorkshopState(user.uid, state, lastCloudState.current!);
        localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
        lastCloudState.current = state;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, canWrite, services, costs, quotes, settings]);

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
    if ((!user || !user.emailVerified) && currentView !== AppView.GUIDE && currentView !== AppView.SETTINGS) {
        return <Guide onStart={() => setCurrentView(AppView.SETTINGS)} />;
    }

    switch(currentView) {
      case AppView.DASHBOARD:
        return <Dashboard services={services} costs={costs} setServices={setServicesSafely} setCosts={setCostsSafely} />;
      case AppView.SERVICES:
        // Solo Admin y Profesor ven Servicios
        if (role === 'admin' || role === 'profesor') {
            return <Services services={services} setServices={setServicesSafely} settings={settings} />;
        }
        return <div className="p-10 text-center text-slate-400">No tienes permiso para gestionar servicios.</div>;
      case AppView.QUOTES:
        return <Quotes quotes={quotes} setQuotes={setQuotesSafely} settings={settings} services={services} setServices={setServicesSafely} onNavigate={setCurrentView} />;
      case AppView.COSTS:
        // Solo el Admin ve los Costos reales
        if (role === 'admin') {
            return <Costs costs={costs} setCosts={setCostsSafely} />;
        }
        return <div className="p-10 text-center text-slate-400">Acceso restringido: Solo Administración puede ver costos.</div>;
      case AppView.SETTINGS:
        return <Settings 
          user={user}
          settings={settings} 
          setSettings={setSettingsSafely}
          services={services}
          setServices={setServicesSafely}
          costs={costs}
          setCosts={setCostsSafely}
          quotes={quotes}
          setQuotes={setQuotesSafely}
          syncStatus={syncStatus}
          account={account}
          canWrite={canWrite}
        />;
      case AppView.GUIDE:
        return <Guide onStart={() => setCurrentView(AppView.SETTINGS)} />;
      default:
        return <Dashboard services={services} costs={costs} setServices={setServicesSafely} setCosts={setCostsSafely} />;
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
      default: return 'Gestión Taller';
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

  if (user?.emailVerified && cloudReady && account && !account.onboardingCompleted) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">Preparando tu taller…</div>}>
        <Onboarding settings={settings} onComplete={finishOnboarding} />
      </Suspense>
    );
  }

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
            {(accountStatus === 'expired' || accountStatus === 'suspended') && (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100 flex items-start gap-3">
                <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-bold">Cuenta en modo lectura</p>
                  <p className="text-sm text-amber-100/80">Tu información sigue disponible. Renueva el Plan Fundador para volver a crear y editar registros.</p>
                </div>
              </div>
            )}
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
