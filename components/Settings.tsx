import React, { useState, useRef } from 'react';
import { AppSettings, Service, Cost, Quote, ServiceExpense, ServicePayment, QuoteItem } from '../types';
import { Building2, Palette, MessageSquare, LayoutTemplate, RotateCcw, Maximize2, X, Check, ChevronRight, ArrowLeft, Smartphone, Database, Download, Upload, AlertTriangle, Image as ImageIcon, Trash2 } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  costs: Cost[];
  setCosts: React.Dispatch<React.SetStateAction<Cost[]>>;
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
}

type SettingsSection = 'menu' | 'company' | 'templates' | 'theme' | 'data';

const Settings: React.FC<SettingsProps> = ({ 
  settings, setSettings, 
  services, setServices, 
  costs, setCosts, 
  quotes, setQuotes 
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('menu');
  const [editingTemplate, setEditingTemplate] = useState<'service' | 'quote' | null>(null);
  const [tempTemplateValue, setTempTemplateValue] = useState('');

  // Refs for file inputs
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const quoteInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
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
            whatsappServiceTemplate: '🛠️\n\nTALLER: {taller}\n\nHola {cliente},\nTu vehículo 🚗: {marca_modelo}\n🪪 Patente: {patente}\n📅 Fecha: {fecha}\n📌 Estado actual: *{estado}*\n\n🔧 Detalle del Servicio\n{detalle}\n\n💰 Resumen de Pago\nTotal: ${total}\nAbono: ${abono}\nPendiente: ${saldo}\n\n📲 Ante cualquier duda o consulta, no dudes en contactarnos.\nGracias por confiar en Taller {taller}',
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
                            id: Math.random().toString(36).substr(2, 9), 
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
                    id: Math.random().toString(36).substr(2, 9),
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
                    id: Math.random().toString(36).substr(2, 9),
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
                id: row[0] || Math.random().toString(36).substr(2, 9),
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
                id: row[0] || Math.random().toString(36).substr(2, 9),
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
                            id: Math.random().toString(36).substr(2, 9),
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
                id: row[0] || Math.random().toString(36).substr(2, 9),
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

  // --- RENDERIZADO DEL MENÚ PRINCIPAL ---
  if (activeSection === 'menu') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Configuración</h2>
          <p className="text-slate-400 text-sm">Selecciona una categoría para editar.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
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
    // ... (Keep existing code for data export/import)
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setActiveSection('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver
        </button>
        
        {/* Hidden Inputs */}
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={serviceInputRef} className="hidden" onChange={handleImportServices} />
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={costInputRef} className="hidden" onChange={handleImportCosts} />
        <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/csv,text/x-csv,application/x-csv,text/comma-separated-values,text/x-comma-separated-values" ref={quoteInputRef} className="hidden" onChange={handleImportQuotes} />

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Database className="text-yellow-500"/> Gestión de Datos</h2>
          <p className="text-slate-400 text-sm mb-6">
            Descarga tus datos en Excel (CSV) para respaldo o súbelos para restaurar información. 
            <span className="block mt-2 text-yellow-500/80 flex items-center gap-1 text-xs"><AlertTriangle size={12}/> Al importar, los registros con el mismo ID serán actualizados.</span>
          </p>
          
          <div className="space-y-4">
            {/* Servicios */}
            <div className="flex gap-2">
                <button 
                  onClick={exportServices}
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-blue-500/50 transition-all group"
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
                  className="px-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-blue-500/50 transition-all group flex flex-col items-center justify-center gap-1"
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
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-red-500/50 transition-all group"
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
                  className="px-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-red-500/50 transition-all group flex flex-col items-center justify-center gap-1"
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
                  className="flex-1 flex items-center justify-between p-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-green-500/50 transition-all group"
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
                  className="px-4 bg-slate-900 border border-slate-600 rounded-xl hover:bg-slate-700 hover:border-green-500/50 transition-all group flex flex-col items-center justify-center gap-1"
                  title="Subir Archivo de Cotizaciones"
                >
                   <Upload size={20} className="text-slate-500 group-hover:text-green-400 transition-colors" />
                   <span className="text-[10px] text-slate-400 uppercase font-bold">Subir</span>
                </button>
            </div>
          </div>
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
                 <div className="w-24 h-24 bg-slate-900 border border-slate-600 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                    {settings.logoUrl ? (
                       <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                       <ImageIcon className="text-slate-600" size={32} />
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
                       <button 
                          onClick={removeLogo} 
                          className="px-4 py-2 bg-slate-900 hover:bg-red-900/30 text-red-400 hover:text-red-300 border border-slate-700 hover:border-red-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                       >
                          <Trash2 size={16} /> Eliminar
                       </button>
                    )}
                    <p className="text-xs text-slate-500 mt-1">Se mostrará en los PDF generados.</p>
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