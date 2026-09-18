import React, { useState, useRef } from 'react';
import { User, GoogleAuthProvider } from 'firebase/auth';
import {
  auth,
  createUserWithEmailAndPassword,
  deleteUser,
  googleProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from '../firebase';
import { Building2, Palette, MessageSquare, LayoutTemplate, RotateCcw, Maximize2, X, Check, ChevronRight, ArrowLeft, Smartphone, Database, Download, Upload, AlertTriangle, Image as ImageIcon, Trash2, LogIn, LogOut, Mail, Lock, UserPlus, HardDrive } from 'lucide-react';
import { AccountInfo, AppSettings, Cost, Quote, QuoteItem, Service, ServiceExpense, ServicePayment } from '../types';
import { createId } from '../services/id';
import { deleteAllAccountData, getEffectiveAccountStatus } from '../services/cloudData';

interface SettingsProps {
  user: User | null;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  costs: Cost[];
  setCosts: React.Dispatch<React.SetStateAction<Cost[]>>;
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  account: AccountInfo | null;
  canWrite: boolean;
}

type SettingsSection = 'menu' | 'company' | 'templates' | 'theme' | 'data' | 'legal';

const Settings: React.FC<SettingsProps> = ({ 
  user,
  settings, setSettings, 
  services, setServices, 
  costs, setCosts, 
  quotes, setQuotes,
  syncStatus,
  account,
  canWrite,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('menu');
  const [editingTemplate, setEditingTemplate] = useState<'service' | 'quote' | null>(null);
  const [tempTemplateValue, setTempTemplateValue] = useState('');
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [resetConfirmStep, setResetConfirmStep] = useState<0 | 1 | 2>(0);
  const [resetInputWord, setResetInputWord] = useState('');

  // Refs for file inputs
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const quoteInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fullBackupInputRef = useRef<HTMLInputElement>(null);

  // --- STORAGE BREAKDOWN AND VALUE CALCULATORS ---
  const getStorageBreakdown = () => {
    const getBytes = (key: string) => {
      const val = localStorage.getItem(key);
      // UTF-16 character is 2 bytes
      return val ? (val.length + key.length) * 2 : 0;
    };

    const servicesBytes = getBytes('taller_services');
    const costsBytes = getBytes('taller_costs');
    const quotesBytes = getBytes('taller_quotes');
    const settingsBytes = getBytes('taller_settings');
    
    // Exact weight of the Base64 image
    let logoBytes = 0;
    if (settings.logoUrl) {
      logoBytes = settings.logoUrl.length * 2;
    }

    const otherSettingsBytes = Math.max(0, settingsBytes - logoBytes);
    const totalBytes = servicesBytes + costsBytes + quotesBytes + settingsBytes;
    
    // Standard secure browser limit of 5MB
    const limitBytes = 5 * 1024 * 1024; 
    
    return {
      services: servicesBytes,
      costs: costsBytes,
      quotes: quotesBytes,
      logo: logoBytes,
      settings: otherSettingsBytes,
      total: totalBytes,
      limit: limitBytes,
      free: Math.max(0, limitBytes - totalBytes),
      percent: Math.min(100, (totalBytes / limitBytes) * 100)
    };
  };

  const getLogoOriginalSize = () => {
    if (!settings.logoUrl) return 0;
    // Base64-encoded strings carry approximately 3/4 (75%) of the actual bytes in binary
    return Math.round(settings.logoUrl.length * 0.75);
  };

  // --- FULL JSON BACKUP & RESTORE HELPERS ---
  const exportFullBackupJSON = () => {
    const backupData = {
      services,
      costs,
      quotes,
      settings,
      backupVersion: '1.0',
      exportedAt: new Date().toISOString()
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `respaldo_completo_taller_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('El respaldo supera el límite de seguridad de 20 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const validSettings = data.settings
          && typeof data.settings === 'object'
          && typeof data.settings.companyName === 'string'
          && typeof data.settings.whatsappServiceTemplate === 'string'
          && typeof data.settings.whatsappQuoteTemplate === 'string';

        if (!Array.isArray(data.services) || !Array.isArray(data.costs) || !Array.isArray(data.quotes) || !validSettings) {
          throw new Error('Estructura de respaldo inválida');
        }

        let importedCount = 0;
        
        if (data.services && Array.isArray(data.services)) {
          setServices(data.services);
          importedCount++;
        }
        if (data.costs && Array.isArray(data.costs)) {
          setCosts(data.costs);
          importedCount++;
        }
        if (data.quotes && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
          importedCount++;
        }
        if (validSettings) {
          setSettings(data.settings);
          importedCount++;
        }

        if (importedCount > 0) {
          alert('🛡️ ¡Respaldo completo de seguridad restaurado exitosamente!\n\nSe han restaurado la información de servicios, gastos, cotizaciones y la configuración del taller.');
          window.location.reload();
        } else {
          alert('El archivo no posee un formato de respaldo válido o está vacío.');
        }
      } catch (err) {
        alert('Error al leer el archivo de configuración. Asegúrate de seleccionar un archivo .json de respaldo válido.');
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be imported again
    e.target.value = '';
  };

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Selecciona una imagen válida para el logotipo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimized = canvas.toDataURL('image/webp', 0.8);
        if (optimized.length > 450_000) {
          window.alert('El logotipo sigue siendo demasiado pesado. Prueba con una imagen más pequeña.');
          return;
        }
        setSettings((previous) => ({ ...previous, logoUrl: optimized }));
      };
      image.onerror = () => window.alert('No pudimos procesar esta imagen. Prueba con otro archivo.');
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSettings(prev => ({ ...prev, logoUrl: undefined }));
  };

  const themes = [
    { id: 'blue', color: 'bg-blue-500', label: 'Azul Profesional' },
    { id: 'purple', color: 'bg-purple-500', label: 'Violeta Moderno' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Verde Motor' },
    { id: 'orange', color: 'bg-orange-500', label: 'Naranja Industrial' },
    { id: 'red', color: 'bg-red-500', label: 'Rojo Potencia' },
  ];

  const resetTemplates = () => {
    if(confirm('¿Restablecer las plantillas de mensaje a su valor original?')) {
        setSettings(prev => ({
            ...prev,
            whatsappServiceTemplate: '🛠️\n\nTALLER: {taller}\n\nHola {cliente},\nTu vehículo 🚗: {marca_modelo}\n🪪 Patente: {patente}\n📅 Fecha: {fecha}\n📌 Estado actual: *{estado}*\n\n🔧 Detalle del Servicio\n{detalle}\n\n💰 Resumen de Pago\nTotal: ${total}\nAbono: ${abono}\nPendiente: ${saldo}\n\n📲 Ante cualquier duda o consulta, no dudes en contactarnos.\nGracias por confiar en {taller}',
            whatsappQuoteTemplate: '*COTIZACIÓN #{id}*\n🔧 {taller}\n\nHola {cliente}, aquí tienes el presupuesto para tu {vehiculo}.\n\n📋 *Detalle:*\n{detalle}\n\n💰 *TOTAL: ${total}*\n\n_Válido por {dias} días._'
        }));
    }
  };

  const openEditor = (type: 'service' | 'quote') => {
    const currentVal = type === 'service' ? settings.whatsappServiceTemplate : settings.whatsappQuoteTemplate;
    setTempTemplateValue(currentVal);
    setEditingTemplate(type);
  };

  const saveEditor = () => {
    if (editingTemplate === 'service') {
      handleChange('whatsappServiceTemplate', tempTemplateValue);
    } else if (editingTemplate === 'quote') {
      handleChange('whatsappQuoteTemplate', tempTemplateValue);
    }
    setEditingTemplate(null);
  };

  // --- IMPORT/EXPORT LOGIC ---
  
  // Helper to parse dates like "DD/MM/YYYY" or ISO
  const parseImportDate = (dateStr: string): string => {
    if (!dateStr || dateStr === '-' || dateStr === 'Sin fecha registro') return new Date().toISOString();
    // Try simplified DD/MM/YYYY parsing first (common in Excel CSV exports in LatAm)
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Assume Day/Month/Year
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(d.getTime())) return d.toISOString();
        }
    }
    // Fallback to standard parse
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [
      headers.join(';'),
      ...rows.map(e => e.map(item => {
        const str = String(item || '').replace(/;/g, ','); 
        // Remove line breaks to prevent CSV breakage
        return str.replace(/(\r\n|\n|\r)/gm, " ");
      }).join(';'))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const readCSV = (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.split(';'));
        // Remove empty rows and header
        resolve(rows.filter(r => r.length > 1)); 
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // --- EXPORT FUNCTIONS ---

  const exportServices = () => {
    const headers = [
      'ID Servicio', 'Estado', 'Fecha Ingreso', 'Fecha Término', 'Cliente', 
      'Teléfono', 'Vehículo', 'Patente', 'Motivo Ingreso', 
      'Detalle Trabajos', 'Costos Asociados', 'Monto Total', 'Monto Abono', 'Fecha Abono'
    ];

    const rows = services.map(s => {
      const laborTotal = (s.laborItems || []).reduce((acc, curr) => acc + curr.amount, 0) + (s.price || 0);
      const expensesTotal = (s.expenses || []).reduce((acc, curr) => acc + curr.amount, 0);
      const total = laborTotal + expensesTotal;
      
      const advancePayment = (s.payments || []).find(p => p.type === 'advance');
      const finalPayment = (s.payments || []).find(p => p.type === 'final');
      
      const advanceAmount = advancePayment ? advancePayment.amount : (s.advance || 0);
      const advanceDate = advancePayment ? new Date(advancePayment.date).toLocaleDateString() : '-';
      const endDate = finalPayment ? new Date(finalPayment.date).toLocaleDateString() : (s.status === 'completed' ? 'Sin fecha registro' : 'En proceso');
      
      const laborDetails = (s.laborItems || []).map(i => `${i.description} ($${i.amount})`).join(' | ') || `Mano de Obra Base ($${s.price || 0})`;
      const expenseDetails = (s.expenses || []).map(i => `${i.description} ($${i.amount})`).join(' | ');
      
      return [
        s.id,
        s.status === 'completed' ? 'Completado' : s.status === 'in-progress' ? 'En Proceso' : s.status === 'cancelled' ? 'Cancelado' : 'Pendiente',
        new Date(s.entryDate).toLocaleDateString(),
        endDate,
        s.clientName,
        s.phone,
        `${s.brand} ${s.model}`,
        s.plate,
        s.reason,
        laborDetails,
        expenseDetails,
        total,
        advanceAmount,
        advanceDate
      ];
    });

    downloadCSV(headers, rows, `servicios_taller_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportCosts = () => {
    const headers = ['ID Gasto', 'Fecha', 'Descripción', 'Categoría', 'Monto ($)'];
    const categoryLabels: Record<string, string> = { parts: 'Repuestos', labor: 'Mano de Obra', utilities: 'Servicios', other: 'Otros' };
    
    const rows = costs.map(c => [
      c.id,
      new Date(c.date).toLocaleDateString(),
      c.description,
      categoryLabels[c.category] || c.category,
      c.amount
    ]);

    downloadCSV(headers, rows, `gastos_taller_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportQuotes = () => {
    const headers = [
      'ID Cotización', 'Fecha Emisión', 'Cliente', 'Teléfono', 'Vehículo', 
      'Detalle Items', 'Notas', 'Validez (Días)', 'Total ($)'
    ];

    const rows = quotes.map(q => {
      const allItems = [...(q.laborItems || []), ...(q.expenseItems || []), ...(q.items || [])];
      const details = allItems.map(i => `(${i.quantity}) ${i.description} $${i.unitPrice}`).join(' | ');

      return [
        q.id,
        new Date(q.date).toLocaleDateString(),
        q.clientName,
        q.phone,
        q.vehicle,
        details,
        q.notes || '',
        q.validityDays,
        q.total
      ];
    });

    downloadCSV(headers, rows, `cotizaciones_taller_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // --- IMPORT FUNCTIONS ---

  const handleImportServices = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
        const rows = await readCSV(e.target.files[0]);
        // Remove Header
        const dataRows = rows.slice(1);
        
        const newServices: Service[] = dataRows.map(row => {
            if (row.length < 5) return null; // Skip invalid rows

            // Helper to parse "Item ($100) | Item 2 ($200)" string back to array
            const parseItems = (str: string): ServiceExpense[] => {
                if (!str) return [];
                return str.split(' | ').map(s => {
                    const match = s.match(/(.+?) \(\$(\d+)\)/);
                    if (match) {
                        return { 
                            id: createId(), 
                            description: match[1], 
                            amount: parseInt(match[2]) 
                        };
                    }
                    return null;
                }).filter(Boolean) as ServiceExpense[];
            };

            const statusMap: Record<string, Service['status']> = {
                'Completado': 'completed',
                'En Proceso': 'in-progress',
                'Cancelado': 'cancelled',
                'Pendiente': 'pending'
            };

            const laborItems = parseItems(row[9]);
            const expenses = parseItems(row[10]);
            
            // Reconstruct payments based on Amount and Date
            const payments: ServicePayment[] = [];
            const advance = parseInt(row[12]) || 0;
            const advanceDate = parseImportDate(row[13]);
            
            if (advance > 0) {
                payments.push({
                    id: createId(),
                    amount: advance,
                    date: advanceDate,
                    type: 'advance',
                    description: `Adelanto de Patente ${row[7] || 'X'}`
                });
            }

            // If completed, assume balance was paid on end date
            const endDate = parseImportDate(row[3]);
            const total = parseInt(row[11]) || 0;
            const status = statusMap[row[1]] || 'pending';
            
            if (status === 'completed' && total > advance) {
                payments.push({
                    id: createId(),
                    amount: total - advance,
                    date: endDate,
                    type: 'final',
                    description: `Saldo Final Patente ${row[7] || 'X'}`
                });
            }

            // Parse vehicle string "Brand Model"
            const vehicleParts = (row[6] || '').split(' ');
            const brand = vehicleParts[0] || '';
            const model = vehicleParts.slice(1).join(' ') || '';

            return {
                id: row[0] || createId(),
                status: status,
                entryDate: parseImportDate(row[2]),
                clientName: row[4] || 'Sin Nombre',
                phone: row[5] || '',
                brand,
                model,
                plate: row[7] || '',
                reason: row[8] || '',
                laborItems,
                expenses,
                price: 0, // Legacy fallback
                advance,
                payments
            };
        }).filter(Boolean) as Service[];

        if (newServices.length > 0) {
            setServices(prev => {
                // Merge strategies: Replace if ID exists, else add
                const map = new Map(prev.map(s => [s.id, s]));
                newServices.forEach(s => map.set(s.id, s));
                return Array.from(map.values());
            });
            alert(`Se importaron ${newServices.length} servicios correctamente.`);
        }
    } catch (err) {
        console.error(err);
        alert('Error al importar el archivo. Verifica el formato.');
    }
    if (serviceInputRef.current) serviceInputRef.current.value = '';
  };

  const handleImportCosts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
        const rows = await readCSV(e.target.files[0]);
        const dataRows = rows.slice(1);

        const categoryMap: Record<string, Cost['category']> = {
            'Repuestos': 'parts',
            'Mano de Obra': 'labor',
            'Servicios': 'utilities',
            'Otros': 'other'
        };

        const newCosts: Cost[] = dataRows.map(row => {
            if (row.length < 5) return null;
            return {
                id: row[0] || createId(),
                date: parseImportDate(row[1]),
                description: row[2] || '',
                category: categoryMap[row[3]] || 'other',
                amount: parseInt(row[4]) || 0
            };
        }).filter(Boolean) as Cost[];

        if (newCosts.length > 0) {
            setCosts(prev => {
                const map = new Map(prev.map(c => [c.id, c]));
                newCosts.forEach(c => map.set(c.id, c));
                return Array.from(map.values());
            });
            alert(`Se importaron ${newCosts.length} costos correctamente.`);
        }
    } catch (err) {
        alert('Error al importar costos.');
    }
    if (costInputRef.current) costInputRef.current.value = '';
  };

  const handleImportQuotes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
        const rows = await readCSV(e.target.files[0]);
        const dataRows = rows.slice(1);

        const newQuotes: Quote[] = dataRows.map(row => {
            if (row.length < 8) return null;

            // Parse items: "(1) Desc $1000 | (2) Desc2 $500"
            const parseQuoteItems = (str: string): QuoteItem[] => {
                if (!str) return [];
                return str.split(' | ').map(s => {
                    const match = s.match(/\((\d+)\) (.+?) \$(\d+)/);
                    if (match) {
                        return {
                            id: createId(),
                            quantity: parseInt(match[1]),
                            description: match[2],
                            unitPrice: parseInt(match[3])
                        };
                    }
                    return null;
                }).filter(Boolean) as QuoteItem[];
            };

            const items = parseQuoteItems(row[5]);

            return {
                id: row[0] || createId(),
                date: parseImportDate(row[1]),
                clientName: row[2] || '',
                phone: row[3] || '',
                vehicle: row[4] || '',
                // Since export merged all items, we put them back into labor or expense based on simple heuristic or just 'items' (legacy fallback)
                // Here we put everything in items for safety, or expenseItems
                expenseItems: items, 
                laborItems: [],
                items: [],
                notes: row[6] || '',
                validityDays: parseInt(row[7]) || 15,
                total: parseInt(row[8]) || 0
            };
        }).filter(Boolean) as Quote[];

        if (newQuotes.length > 0) {
            setQuotes(prev => {
                const map = new Map(prev.map(q => [q.id, q]));
                newQuotes.forEach(q => map.set(q.id, q));
                return Array.from(map.values());
            });
            alert(`Se importaron ${newQuotes.length} cotizaciones correctamente.`);
        }
    } catch (err) {
        alert('Error al importar cotizaciones.');
    }
    if (quoteInputRef.current) quoteInputRef.current.value = '';
  };

  const VariableChip = ({ label, code }: { label: string, code: string }) => (
    <button 
      onClick={() => setTempTemplateValue(prev => prev + ' ' + code)}
      className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-all border border-slate-700 shadow-sm active:scale-95"
    >
      <span className="font-mono text-blue-400 font-bold">{code}</span>
      <span className="opacity-60 text-xs uppercase tracking-wide">{label}</span>
    </button>
  );

  const getAuthErrorMessage = (code?: string) => {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Intenta ingresar.',
      'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
      'auth/invalid-email': 'Escribe un correo válido.',
      'auth/missing-password': 'Escribe tu contraseña.',
      'auth/too-many-requests': 'Se realizaron demasiados intentos. Espera unos minutos y vuelve a probar.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/network-request-failed': 'No pudimos conectarnos. Revisa Internet e inténtalo nuevamente.',
      'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a ingresar y repite la eliminación.',
    };
    return messages[code || ''] || 'No fue posible completar la operación. Inténtalo nuevamente.';
  };

  const handleSignIn = async (providerOverride?: GoogleAuthProvider) => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, providerOverride || googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setIsAuthLoading(false);
        return;
      }
      setAuthError('Error al iniciar sesión con Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        setAuthNotice('Cuenta creada. Revisa tu correo y presiona el enlace de verificación para continuar.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (error: any) {
        console.error(error);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          setIsAuthLoading(false);
          return;
        }
        setAuthError(getAuthErrorMessage(error.code));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setAuthError('Escribe tu correo arriba y luego presiona “Recuperar contraseña”.');
      return;
    }
    setIsAuthLoading(true);
    setAuthError('');
    setAuthNotice('');
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthNotice('Te enviamos un correo para crear una nueva contraseña. Revisa también la carpeta de spam.');
    } catch (error: any) {
      setAuthError(getAuthErrorMessage(error.code));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      await sendEmailVerification(user);
      setAuthNotice('Correo de verificación enviado nuevamente.');
    } catch (error: any) {
      setAuthError(getAuthErrorMessage(error.code));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    setIsAuthLoading(true);
    await reload(user);
    setIsAuthLoading(false);
    if (auth.currentUser?.emailVerified) window.location.reload();
    else setAuthError('El correo todavía no aparece verificado. Abre el enlace recibido y vuelve a intentarlo.');
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeletingAccount) return;
    const confirmed = window.confirm('Esta acción eliminará tu cuenta y todos los datos del taller de forma permanente. ¿Deseas continuar?');
    if (!confirmed) return;
    const finalConfirmation = window.prompt('Para confirmar, escribe ELIMINAR MI CUENTA');
    if (finalConfirmation !== 'ELIMINAR MI CUENTA') return;
    setIsDeletingAccount(true);
    try {
      await deleteAllAccountData(user.uid);
      await deleteUser(user);
      ['taller_services', 'taller_costs', 'taller_quotes', 'taller_settings', 'taller_owner_uid', 'service_draft']
        .forEach((key) => localStorage.removeItem(key));
      window.location.reload();
    } catch (error: any) {
      setAuthError(getAuthErrorMessage(error.code));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // --- RENDERIZADO DEL MENÚ PRINCIPAL ---
  if (activeSection === 'menu') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Configuración</h2>
          <p className="text-slate-400 text-sm">Selecciona una categoría para editar.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Tarjeta de Autenticación */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
            {user ? (
              <>
               <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                 {user.photoURL ? (
                   <img src={user.photoURL} alt={user.email || 'User'} className="w-12 h-12 rounded-full border-2 border-blue-500/50" />
                 ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border-2 border-blue-500/50">
                        {user.email?.charAt(0).toUpperCase()}
                    </div>
                 )}
                 <div className="flex-1 text-center sm:text-left overflow-hidden">
                    <p className="text-white font-bold truncate">{user.displayName || 'Usuario Activo'}</p>
                    <p className="text-slate-400 text-xs truncate italic">{user.email}</p>
                    <p className={`text-xs mt-1 ${syncStatus === 'error' ? 'text-red-400' : syncStatus === 'synced' ? 'text-green-400' : 'text-amber-400'}`}>
                      {!user.emailVerified && 'Correo pendiente de verificación'}
                      {user.emailVerified && syncStatus === 'synced' && 'Datos sincronizados en la nube'}
                      {user.emailVerified && syncStatus === 'syncing' && 'Sincronizando cambios...'}
                      {user.emailVerified && syncStatus === 'error' && 'Sin conexión con la nube; se conserva copia local'}
                      {user.emailVerified && syncStatus === 'local' && 'Datos guardados solo en este dispositivo'}
                    </p>
                 </div>
                 <div className="flex gap-2">
                   <button 
                     onClick={() => {
                       const provider = new GoogleAuthProvider();
                       provider.setCustomParameters({ prompt: 'select_account' });
                       handleSignIn(provider);
                     }}
                     disabled={isAuthLoading}
                     className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:text-white hover:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Cambiar
                   </button>
                   <button 
                     onClick={() => signOut(auth)} 
                     disabled={isAuthLoading}
                     className="px-3 py-2 bg-red-900/20 border border-red-500/30 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Cerrar Sesión
                   </button>
                 </div>
               </div>
               {!user.emailVerified && (
                 <div className="w-full mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                   <p className="text-sm font-bold text-amber-200">Verifica tu correo para activar la prueba</p>
                   <p className="text-xs text-amber-100/70 mt-1">Abre el enlace que enviamos a {user.email}. Después vuelve aquí y comprueba la verificación.</p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                     <button onClick={handleResendVerification} disabled={isAuthLoading} className="py-2 rounded-lg border border-amber-500/30 text-amber-100 text-sm font-bold">Reenviar correo</button>
                     <button onClick={handleCheckVerification} disabled={isAuthLoading} className="py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-bold">Ya verifiqué</button>
                   </div>
                 </div>
               )}
               {authNotice && <p className="w-full mt-3 text-emerald-400 text-xs">{authNotice}</p>}
               {authError && <p className="w-full mt-3 text-red-400 text-xs">{authError}</p>}
              </>
            ) : (
                <div className="space-y-6">
                    <button 
                      onClick={() => handleSignIn()} 
                      disabled={isAuthLoading}
                      className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {isAuthLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                            Iniciando sesión...
                          </span>
                        ) : (
                          <>
                            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                            Acceder con Google
                          </>
                        )}
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase font-bold tracking-widest">O con Correo</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                disabled={isAuthLoading}
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="password" placeholder="Contraseña" required value={password} onChange={(e) => setPassword(e.target.value)}
                                disabled={isAuthLoading}
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                            />
                        </div>
                        {authError && <p className="text-red-400 text-xs px-1">{authError}</p>}
                        {authNotice && <p className="text-emerald-400 text-xs px-1">{authNotice}</p>}
                        <button 
                          type="submit" 
                          disabled={isAuthLoading}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAuthLoading ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Cargando...
                              </span>
                            ) : (
                              isRegistering ? 'Registrarse' : 'Ingresar'
                            )}
                        </button>
                    </form>
                    <button 
                      onClick={() => setIsRegistering(!isRegistering)} 
                      disabled={isAuthLoading}
                      className="w-full text-sm text-slate-500 hover:text-blue-400 disabled:opacity-50"
                    >
                        {isRegistering ? '¿Ya tienes cuenta? Ingresa' : '¿No tienes cuenta? Regístrate'}
                    </button>
                    {!isRegistering && (
                      <button type="button" onClick={handlePasswordReset} disabled={isAuthLoading} className="w-full text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50">
                        ¿Olvidaste tu contraseña? Recuperarla
                      </button>
                    )}
                </div>
            )}
          </div>

          {user?.emailVerified && account && (
            <div className="bg-slate-800 p-6 rounded-2xl border border-blue-500/30 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-blue-400 font-bold">Mi plan</p>
                  <h3 className="text-xl font-bold text-white mt-1">{account.plan === 'founder' ? 'Plan Fundador' : 'Prueba gratuita'}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Estado: {getEffectiveAccountStatus(account) === 'expired' ? 'Vencido · modo lectura' : getEffectiveAccountStatus(account) === 'active' ? 'Activo' : 'En prueba'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${canWrite ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>
                  {canWrite ? 'Habilitado' : 'Renovación pendiente'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">Fecha de inicio</p>
                  <p className="text-white mt-1">{account.trialStartedAt ? new Date(account.trialStartedAt).toLocaleDateString('es-CL') : 'Preparando cuenta'}</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">Fecha de vencimiento</p>
                  <p className="text-white mt-1">{(account.plan === 'founder' ? account.paidThrough : account.trialEndsAt) ? new Date((account.plan === 'founder' ? account.paidThrough : account.trialEndsAt)!).toLocaleDateString('es-CL') : 'Sin vencimiento registrado'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button onClick={() => window.alert('El WhatsApp de soporte se incorporará antes de abrir el piloto comercial.')} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">{canWrite ? 'Contactar soporte' : 'Renovar Plan Fundador'}</button>
                <button onClick={() => setActiveSection('data')} className="py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-bold">Respaldar mis datos</button>
              </div>
            </div>
          )}

          <button onClick={() => setActiveSection('legal')} className="group bg-slate-800 hover:bg-slate-750 p-6 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-all shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Lock size={24} /></div>
              <div className="text-left"><h3 className="text-lg font-bold text-white">Privacidad y condiciones</h3><p className="text-sm text-slate-400">Consulta cómo protegemos y utilizamos los datos.</p></div>
            </div>
            <ChevronRight className="text-slate-500" />
          </button>

          {/* Tarjeta 1: Información */}
          <button 
            onClick={() => setActiveSection('company')}
            className="group bg-slate-800 hover:bg-slate-750 p-6 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                <Building2 size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Información del Taller</h3>
                <p className="text-sm text-slate-400">Nombre, logo, dirección y teléfono.</p>
              </div>
            </div>
            <ChevronRight className="text-slate-500 group-hover:text-white" />
          </button>

          {/* Tarjeta 2: Plantillas */}
          <button 
            onClick={() => setActiveSection('templates')}
            className="group bg-slate-800 hover:bg-slate-750 p-6 rounded-2xl border border-slate-700 hover:border-green-500/50 transition-all shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl text-green-400 group-hover:scale-110 transition-transform">
                <MessageSquare size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors">Plantillas de WhatsApp</h3>
                <p className="text-sm text-slate-400">Personaliza los mensajes automáticos.</p>
              </div>
            </div>
            <ChevronRight className="text-slate-500 group-hover:text-white" />
          </button>

          {/* Tarjeta 3: Tema */}
          <button 
            onClick={() => setActiveSection('theme')}
            className="group bg-slate-800 hover:bg-slate-750 p-6 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-all shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                <Palette size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">Apariencia y Tema</h3>
                <p className="text-sm text-slate-400">Colores y estilo visual.</p>
              </div>
            </div>
            <ChevronRight className="text-slate-500 group-hover:text-white" />
          </button>

          {/* Tarjeta 4: Gestión de Datos */}
          <button 
            onClick={() => setActiveSection('data')}
            className="group bg-slate-800 hover:bg-slate-750 p-6 rounded-2xl border border-slate-700 hover:border-yellow-500/50 transition-all shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 group-hover:scale-110 transition-transform">
                <Database size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Gestión de Datos</h3>
                <p className="text-sm text-slate-400">Exportar e Importar respaldos.</p>
              </div>
            </div>
            <ChevronRight className="text-slate-500 group-hover:text-white" />
          </button>
        </div>
      </div>
    );
  }

  // --- SUB-SECCIÓN: GESTIÓN DE DATOS ---
  if (activeSection === 'data') {
    const stats = getStorageBreakdown();
    const usedMB = stats.total / (1024 * 1024);
    const limitMB = stats.limit / (1024 * 1024);
    const freeMB = stats.free / (1024 * 1024);

    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver
        </button>
        
        {/* Hidden Inputs */}
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={serviceInputRef} className="hidden" onChange={handleImportServices} />
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={costInputRef} className="hidden" onChange={handleImportCosts} />
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={quoteInputRef} className="hidden" onChange={handleImportQuotes} />
        <input type="file" accept=".json,application/json" ref={fullBackupInputRef} className="hidden" onChange={handleImportFullBackupJSON} />

        {/* INDICADORES DE ALMACENAMIENTO (TELEMETRÍA) */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <HardDrive className="text-blue-400 shrink-0" size={22} /> Telemetría de Almacenamiento
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            La aplicación conserva una copia local para trabajar sin conexión. Cuando inicias sesión, también sincroniza la información con tu cuenta en la nube.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
              <span className="text-xs text-slate-500 uppercase font-bold block">Espacio Ocupado</span>
              <span className="text-lg font-extrabold text-blue-405 font-mono">{usedMB.toFixed(3)} MB</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Límite local estimado: {limitMB.toFixed(1)} MB</span>
            </div>
            
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
              <span className="text-xs text-slate-500 uppercase font-bold block">Espacio Disponible</span>
              <span className="text-lg font-extrabold text-emerald-400 font-mono">{freeMB.toFixed(3)} MB</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Espacio local estimado</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
              <span className="text-xs text-slate-500 uppercase font-bold block">Uso del Límite</span>
              <span className="text-lg font-extrabold text-orange-400 font-mono">{stats.percent.toFixed(2)}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Consumo total estimado</span>
            </div>
          </div>

          {/* Gráfico de Barra de Progreso */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Capacidad local estimada (puede variar por navegador)</span>
              <span>{stats.percent.toFixed(1)}% Usado</span>
            </div>
            <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden border border-slate-750 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.percent > 85 ? 'bg-red-500' : stats.percent > 50 ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            {stats.percent > 80 && (
              <p className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> ¡Atención! Has consumido la mayor parte del almacenamiento de tu navegador. Considera comprimir tu logo o depurar registros antiguos.
              </p>
            )}
          </div>

          {/* Desglose detallado */}
          <div className="border-t border-slate-700/50 pt-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Distribución del espacio ocupado</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Base de Servicios:
                </span>
                <span className="text-slate-200 font-mono font-medium">{(stats.services / 1024).toFixed(3)} KB ({services.length} registros)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Gastos y Finanzas:
                </span>
                <span className="text-slate-200 font-mono font-medium">{(stats.costs / 1024).toFixed(3)} KB ({costs.length} registros)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span> Cartera de Cotizaciones:
                </span>
                <span className="text-slate-200 font-mono font-medium">{(stats.quotes / 1024).toFixed(3)} KB ({quotes.length} registros)</span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Imagen del Logotipo:
                </span>
                <span className="text-slate-200 font-mono font-medium font-bold">
                  {settings.logoUrl ? `${(stats.logo / 1024).toFixed(1)} KB` : 'No configurado (0 KB)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> Ajustes del Sistema y Plantillas:
                </span>
                <span className="text-slate-200 font-mono font-medium">{(stats.settings / 1024).toFixed(3)} KB</span>
              </div>
            </div>
          </div>
        </div>

        {/* RESPALDO TOTAL DE SEGURIDAD (CONTRAPÉRDIDA) */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Download className="text-emerald-400" size={22} /> Respaldos de Seguridad Totales (.JSON)
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            ¡Descarga un respaldo completo con un solo clic! Guarda tu archivo <strong>JSON</strong> fuera del navegador para evitar pérdida accidental de información al formatear el equipo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={exportFullBackupJSON}
              className="px-5 py-4 bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-550 hover:bg-emerald-900/15 text-emerald-400 hover:text-white rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-2 justify-center shadow-md active:scale-95 group"
            >
              <Download size={24} className="group-hover:translate-y-0.5 transition-transform" />
              <span>Descargar Respaldo Completo (.JSON)</span>
              <span className="text-[10px] text-emerald-500/80 font-normal">Un solo archivo; guárdalo en un lugar protegido</span>
            </button>
            
            <button 
              onClick={() => fullBackupInputRef.current?.click()}
              className="px-5 py-4 bg-blue-950/30 border border-blue-500/30 hover:border-blue-550 hover:bg-blue-900/15 text-blue-400 hover:text-white rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-2 justify-center shadow-md active:scale-95 group"
            >
              <Upload size={24} className="group-hover:-translate-y-0.5 transition-transform" />
              <span>Cargar Respaldo Completo (.JSON)</span>
              <span className="text-[10px] text-blue-500/80 font-normal">Restaura toda tu base de datos al instante</span>
            </button>
          </div>
        </div>

        {/* EXPORTACIÓN DE TABLAS EXCEL/CSV */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Database className="text-yellow-500"/> Exportar / Importar por Tablas (Excel/CSV)
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Descarga individual de tablas en formato Excel (CSV) o importar de forma granular por cada módulo. Muy útil para análisis externo.
          </p>
          
          <div className="space-y-4">
            {/* Servicios */}
            <div className="flex gap-2">
                <button 
                  onClick={exportServices}
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><LayoutTemplate size={20} /></div>
                    <div className="text-left">
                      <span className="block font-bold text-white text-sm">Servicios</span>
                      <span className="text-[10px] text-slate-400">{services.length} regs</span>
                    </div>
                  </div>
                  <Download size={20} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                </button>
                <button 
                  onClick={() => serviceInputRef.current?.click()}
                  className="px-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-blue-500/50 transition-all group flex flex-col items-center justify-center gap-1"
                  title="Subir Archivo de Servicios"
                >
                   <Upload size={20} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                   <span className="text-[10px] text-slate-400 uppercase font-bold">Subir</span>
                </button>
            </div>

            {/* Costos */}
            <div className="flex gap-2">
                <button 
                  onClick={exportCosts}
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-red-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><LayoutTemplate size={20} /></div>
                    <div className="text-left">
                      <span className="block font-bold text-white text-sm">Costos / Gastos</span>
                      <span className="text-[10px] text-slate-400">{costs.length} regs</span>
                    </div>
                  </div>
                  <Download size={20} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                </button>
                <button 
                  onClick={() => costInputRef.current?.click()}
                  className="px-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-red-500/50 transition-all group flex flex-col items-center justify-center gap-1"
                  title="Subir Archivo de Costos"
                >
                   <Upload size={20} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                   <span className="text-[10px] text-slate-400 uppercase font-bold">Subir</span>
                </button>
            </div>

            {/* Cotizaciones */}
            <div className="flex gap-2">
                <button 
                  onClick={exportQuotes}
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-green-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><LayoutTemplate size={20} /></div>
                    <div className="text-left">
                      <span className="block font-bold text-white text-sm">Cotizaciones</span>
                      <span className="text-[10px] text-slate-400">{quotes.length} regs</span>
                    </div>
                  </div>
                  <Download size={20} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                </button>
                <button 
                  onClick={() => quoteInputRef.current?.click()}
                  className="px-4 bg-slate-900 border border-slate-650 rounded-xl hover:bg-slate-700 hover:border-green-500/50 transition-all group flex flex-col items-center justify-center gap-1"
                  title="Subir Archivo de Cotizaciones"
                >
                   <Upload size={20} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                   <span className="text-[10px] text-slate-400 uppercase font-bold">Subir</span>
                </button>
            </div>
          </div>
        </div>

        {/* ZONA DE PELIGRO: REINICIO COMPLETO (Soporte seguro en Sandbox Iframe sin modals bloqueados) */}
        <div className="p-5 bg-red-950/20 border border-red-500/35 rounded-2xl">
          <h3 className="text-red-400 font-extrabold text-sm mb-1.5 flex items-center gap-2">
            <AlertTriangle size={16} /> Zona de Peligro: Restablecer de Fábrica
          </h3>
          
          {resetConfirmStep === 0 && (
            <>
              <p className="text-slate-450 text-xs mb-4 leading-relaxed">
                Esta acción borrará permanentemente de tu navegador toda la información del taller, incluyendo todas las órdenes de servicios, gastos, presupuestos y configuraciones de marca. Dejará la app 100% nueva y vacía.
              </p>
              <button 
                onClick={() => {
                  setResetConfirmStep(1);
                  setResetInputWord('');
                }}
                className="w-full py-3.5 bg-red-900 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-red-900/30"
              >
                <RotateCcw size={18} /> Restablecer y Dejar en Blanco de Fábrica
              </button>
            </>
          )}

          {resetConfirmStep === 1 && (
            <div className="space-y-3 bg-red-950/40 p-4 rounded-xl border border-red-500/20 animate-fade-in">
              <span className="text-red-400 text-xs font-bold block uppercase tracking-wider">⚠️ PASO 1/2: CONFIRMACIÓN DE SEGURIDAD</span>
              <p className="text-slate-200 text-xs leading-relaxed">
                ¿Estás completamente seguro de que deseas eliminar TODOS los datos de la aplicación? Se borrarán de forma inmediata y definitiva:
              </p>
              <ul className="text-slate-300 text-xs space-y-1 list-disc list-inside bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                <li>Órdenes de Servicio: <span className="font-bold text-red-400 font-mono">{services.length}</span> registros</li>
                <li>Módulo de Gastos: <span className="font-bold text-red-400 font-mono">{costs.length}</span> registros</li>
                <li>Cotizaciones/Presupuestos: <span className="font-bold text-red-400 font-mono">{quotes.length}</span> registros</li>
                <li>Color de tema, nombre, dirección, teléfono y logotipo de la empresa</li>
              </ul>
              <p className="text-orange-400 font-bold text-[11px]">
                🚨 Esta acción NO se puede deshacer. Se recomienda descargar un Respaldo Completo (.JSON) de seguridad más arriba si deseas conservar tu información.
              </p>
              <div className="grid grid-cols-2 gap-3.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => setResetConfirmStep(0)}
                  className="py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold rounded-lg text-xs transition-colors"
                >
                  Cancelar / Volver
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirmStep(2)}
                  className="py-2.5 bg-red-800 hover:bg-red-700 text-white font-extrabold rounded-lg text-xs transition-colors"
                >
                  Sí, continuar al paso final
                </button>
              </div>
            </div>
          )}

          {resetConfirmStep === 2 && (
            <div className="space-y-3 bg-red-950/40 p-4 rounded-xl border border-red-500/20 animate-fade-in">
              <span className="text-red-400 text-xs font-bold block uppercase tracking-wider">🚨 PASO 2/2: PALABRA DE CONFIRMACIÓN CLAVE</span>
              <p className="text-slate-200 text-xs leading-relaxed">
                Para evitar un borrado accidental o clics erróneos, escribe por favor la palabra <strong className="text-red-400 font-bold font-mono tracking-wider bg-slate-900 px-1 py-0.5 rounded border border-red-500/10">BORRAR</strong> en mayúsculas a continuación para habilitar la destrucción de fábrica:
              </p>
              
              <input
                type="text"
                placeholder="Escribe BORRAR aquí"
                value={resetInputWord}
                onChange={(e) => setResetInputWord(e.target.value)}
                className="w-full bg-slate-900 border border-red-500/40 rounded-lg py-2.5 px-4 text-sm text-center font-black text-red-400 focus:border-red-500 focus:outline-none tracking-widest uppercase placeholder-slate-600 focus:ring-1 focus:ring-red-500"
              />

              <div className="grid grid-cols-2 gap-3.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmStep(0);
                    setResetInputWord('');
                  }}
                  className="py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold rounded-lg text-xs transition-colors"
                >
                  Volver al inicio
                </button>
                <button
                  type="button"
                  disabled={resetInputWord !== 'BORRAR'}
                  onClick={() => {
                    // Eliminar solo los datos propios de Gestión Taller.
                    ['taller_services', 'taller_costs', 'taller_quotes', 'taller_settings', 'service_draft']
                      .forEach(key => localStorage.removeItem(key));
                    
                    // Resetear de inmediato los estados cargados en esta sesión
                    setServices([]);
                    setCosts([]);
                    setQuotes([]);
                    setSettings({
                      themeColor: 'blue',
                      companyName: '',
                      companyAddress: '',
                      companyPhone: '',
                      mechanicName: '',
                      logoUrl: undefined,
                      whatsappServiceTemplate: '🛠️\n\nTALLER: {taller}\n\nHola {cliente},\nTu vehículo 🚗: {marca_modelo}\n🪪 Patente: {patente}\n📅 Fecha: {fecha}\n📌 Estado actual: *{estado}*\n\n🔧 Detalle del Servicio\n{detalle}\n\n💰 Resumen de Pago\nTotal: ${total}\nAbono: ${abono}\nPendiente: ${saldo}\n\n📲 Ante cualquier duda o consulta, no dudes en contactarnos.\nGracias por confiar en {taller}',
                      whatsappQuoteTemplate: '*COTIZACIÓN #{id}*\n🔧 {taller}\n\nHola {cliente}, aquí tienes el presupuesto para tu {vehiculo}.\n\n📋 *Detalle:*\n{detalle}\n\n💰 *TOTAL: ${total}*\n\n_Válido por {dias} días._'
                    });
                    
                    // Forzar recarga limpia
                    window.location.reload();
                  }}
                  className="py-2.5 bg-red-650 hover:bg-red-750 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} /> ¡SÍ, BORRAR TODO YA!
                </button>
              </div>
            </div>
          )}
        </div>

        {user && (
          <div className="p-5 bg-slate-900 border border-red-500/35 rounded-2xl">
            <h3 className="text-red-400 font-extrabold text-sm flex items-center gap-2"><Trash2 size={16} /> Eliminar mi cuenta</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">Elimina la cuenta, los servicios, gastos, cotizaciones, actividad y configuración asociados. Descarga un respaldo antes de continuar.</p>
            <button type="button" onClick={handleDeleteAccount} disabled={isDeletingAccount} className="w-full mt-4 py-3 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 font-bold disabled:opacity-50">
              {isDeletingAccount ? 'Eliminando cuenta…' : 'Eliminar cuenta y todos mis datos'}
            </button>
            {authError && <p className="text-red-400 text-xs mt-3">{authError}</p>}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'legal') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 group"><ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver</button>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg space-y-6">
          <section><h2 className="text-xl font-bold text-white mb-3">Política de privacidad</h2><div className="space-y-3 text-sm text-slate-300 leading-relaxed"><p>Gestión Taller almacena los datos de la cuenta, configuración del taller, clientes, vehículos, servicios, cotizaciones, gastos y pagos que el usuario registra. Estos datos se utilizan para entregar el servicio, sincronizar la información y prestar soporte.</p><p>Cada cuenta puede acceder únicamente a la información de su propio taller. El usuario puede descargar un respaldo y eliminar su cuenta y datos desde Configuración. Gestión Taller no vende la información registrada.</p><p>El taller es responsable de contar con autorización para registrar información de sus clientes. Las fotografías en la nube se mantienen desactivadas durante esta etapa.</p></div></section>
          <section className="border-t border-slate-700 pt-6"><h2 className="text-xl font-bold text-white mb-3">Términos del servicio</h2><div className="space-y-3 text-sm text-slate-300 leading-relaxed"><p>La prueba gratuita general dura 15 días. Los primeros 10 talleres colaboradores podrán recibir 30 días a cambio de utilizar la aplicación y entregar comentarios reales.</p><p>Al finalizar la prueba, la cuenta pasa a modo lectura y conserva sus datos. El Plan Fundador tiene un precio inicial de $10.000 CLP mensuales y se activa manualmente después de confirmar el pago.</p><p>Gestión Taller es una herramienta de administración y no sustituye sistemas contables, tributarios ni documentos legales obligatorios. El responsable comercial y el canal de contacto definitivo se incorporarán antes del lanzamiento.</p></div></section>
        </div>
      </div>
    );
  }

  // --- SUB-SECCIÓN: INFORMACIÓN DE LA EMPRESA (COMPANY) ---
  if (activeSection === 'company') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver
        </button>
        
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Building2 className="text-blue-500"/> Datos del Taller</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Logo del Taller</label>
              <div className="flex items-start gap-4">
                 <div className="w-24 h-24 bg-slate-900 border border-slate-600 rounded-xl flex flex-col items-center justify-center overflow-hidden shrink-0 group hover:border-blue-500/50 transition-colors">
                    {settings.logoUrl ? (
                       <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                       <>
                        <ImageIcon className="text-slate-600 group-hover:text-blue-500/50 transition-colors" size={32} />
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Sube tu Logo</span>
                       </>
                    )}
                 </div>
                 <div className="flex flex-col gap-2">
                    <input 
                       type="file" 
                       accept="image/*" 
                       ref={logoInputRef} 
                       className="hidden" 
                       onChange={handleLogoUpload} 
                    />
                    <button 
                       onClick={() => logoInputRef.current?.click()} 
                       className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                       <Upload size={16} /> Subir Imagen
                    </button>
                    {settings.logoUrl && (
                       <div className="flex flex-col gap-1">
                          <button 
                             onClick={removeLogo} 
                             className="px-4 py-2 bg-slate-900 hover:bg-red-900/30 text-red-400 hover:text-red-300 border border-slate-700 hover:border-red-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 self-start"
                          >
                             <Trash2 size={16} /> Eliminar
                          </button>
                          
                          <div className="text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50 max-w-[240px]">
                            <span className="text-slate-400 block font-medium">Peso de la foto original:</span>
                            <span className="text-blue-400 font-bold font-mono">
                              {(getLogoOriginalSize() / 1024).toFixed(1)} KB
                            </span>
                            <span className="text-[9px] text-slate-500 block mt-0.5">
                              (Equivale a ~{( (getLogoOriginalSize() * 2.66) / 1024).toFixed(1)} KB de almacenamiento local)
                            </span>
                            {(getLogoOriginalSize() > 200 * 1024) && (
                              <div className="mt-1 text-orange-400 text-[10px] font-bold">
                                ⚠️ Imagen muy pesada. Recomendamos menos de 150 KB para no saturar tu espacio.
                              </div>
                            )}
                          </div>
                       </div>
                    )}
                    <p className="text-xs text-slate-500 mt-1">Se mostrará en los PDF generados. 💡 Recomendamos usar imágenes comprimidas y livianas para ahorrar memoria.</p>
                 </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Nombre del Taller</label>
              <input type="text" value={settings.companyName} onChange={(e) => handleChange('companyName', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Ej: Mecánica Fast" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Dirección</label>
              <input type="text" value={settings.companyAddress} onChange={(e) => handleChange('companyAddress', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Calle 123, Ciudad" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Teléfono</label>
              <input type="text" value={settings.companyPhone} onChange={(e) => handleChange('companyPhone', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="+56 9 ..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Mecánico responsable predeterminado</label>
              <input type="text" value={settings.mechanicName || ''} onChange={(e) => handleChange('mechanicName', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Nombre que aparecerá en los PDF" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ... (Rest of sections remain similar)
  if (activeSection === 'theme') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver
        </button>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Palette className="text-purple-500"/> Color del Sistema</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themes.map((theme) => (
              <button key={theme.id} onClick={() => handleChange('themeColor', theme.id)} className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${settings.themeColor === theme.id ? 'border-white bg-slate-700 shadow-md transform scale-105' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
                <div className={`w-12 h-12 rounded-full ${theme.color} shadow-lg border-2 border-slate-800 flex items-center justify-center`}>
                  {settings.themeColor === theme.id && <Check className="text-white" size={20} />}
                </div>
                <span className={`font-bold text-lg ${settings.themeColor === theme.id ? 'text-white' : 'text-slate-400'}`}>{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'templates') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver
          </button>
          <button onClick={resetTemplates} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
            <RotateCcw size={12} /> Restaurar Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta Servicio */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4 shadow-lg hover:border-blue-500/50 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><LayoutTemplate size={20} /></div>
              <h3 className="font-bold text-white text-lg">Servicio / Orden</h3>
            </div>
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 min-h-[120px]">
              <p className="text-xs text-slate-400 font-mono line-clamp-4 leading-relaxed opacity-80">{settings.whatsappServiceTemplate}</p>
            </div>
            <button onClick={() => openEditor('service')} className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 active:scale-95">
              <Maximize2 size={18} /> Editar Plantilla
            </button>
          </div>

          {/* Tarjeta Cotización */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4 shadow-lg hover:border-orange-500/50 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><LayoutTemplate size={20} /></div>
              <h3 className="font-bold text-white text-lg">Cotización</h3>
            </div>
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 min-h-[120px]">
              <p className="text-xs text-slate-400 font-mono line-clamp-4 leading-relaxed opacity-80">{settings.whatsappQuoteTemplate}</p>
            </div>
            <button onClick={() => openEditor('quote')} className="mt-auto w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/20 active:scale-95">
              <Maximize2 size={18} /> Editar Plantilla
            </button>
          </div>
        </div>

        {/* --- EDITOR FULL SCREEN (Z-INDEX 9999) --- */}
        {editingTemplate && (
          <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom duration-300">
            
            {/* Header Fijo */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex justify-between items-center shrink-0 shadow-lg z-50">
               <div className="flex items-center gap-3">
                  <button onClick={() => setEditingTemplate(null)} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                     <X size={24} />
                  </button>
                  <div>
                     <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Editando</span>
                     <h3 className="text-base font-bold text-white leading-none">
                       {editingTemplate === 'service' ? 'Servicio / Orden' : 'Cotización'}
                     </h3>
                  </div>
               </div>
               <button 
                  onClick={saveEditor}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
               >
                  <Check size={18} /> Guardar
               </button>
            </div>

            {/* Barra de Variables (Sticky) */}
            <div className="bg-slate-900 border-b border-slate-800 shrink-0 z-40">
               <div className="px-4 py-3">
                 <div className="flex items-center gap-2 mb-2">
                   <Smartphone size={14} className="text-slate-500" />
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Variables (Toca para insertar)</span>
                 </div>
                 <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                    <VariableChip label="Cliente" code="{cliente}" />
                    <VariableChip label="Marca/Modelo" code="{marca_modelo}" />
                    <VariableChip label="Patente" code="{patente}" />
                    <VariableChip label="Fecha" code="{fecha}" />
                    <VariableChip label="Taller" code="{taller}" />
                    <VariableChip label="Total" code="{total}" />
                    <VariableChip label="Detalle" code="{detalle}" />
                    {editingTemplate === 'service' ? (
                       <>
                          <VariableChip label="Estado" code="{estado}" />
                          <VariableChip label="Abono" code="{abono}" />
                          <VariableChip label="Saldo" code="{saldo}" />
                       </>
                    ) : (
                       <>
                          <VariableChip label="ID" code="{id}" />
                          <VariableChip label="Días" code="{dias}" />
                          <VariableChip label="Vehículo Completo" code="{vehiculo}" />
                       </>
                    )}
                 </div>
               </div>
            </div>

            {/* Área de Texto (Scrollable) */}
            <div className="flex-1 bg-slate-950 relative">
               <textarea 
                  autoFocus
                  value={tempTemplateValue}
                  onChange={(e) => setTempTemplateValue(e.target.value)}
                  className="w-full h-full bg-slate-950 text-white font-mono text-base sm:text-lg p-6 focus:outline-none resize-none leading-relaxed"
                  placeholder="Escribe tu mensaje aquí..."
               />
            </div>
            
            {/* Safe Area Bottom (para móviles) */}
            <div className="h-safe-area-bottom bg-slate-950 shrink-0" />
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Settings;
