import React, { useState, useEffect, useRef } from 'react';
import { Quote, QuoteItem, AppSettings, Service, AppView } from '../types';
import { Plus, Search, FileText, Printer, MessageCircle, Trash2, X, DollarSign, Calendar, User, Car, Edit, ChevronRight, Hash, Download, Share2, Save, Hammer, Box, RotateCcw, ChevronDown, Wrench, CheckCircle, UserCog, ArrowRightCircle, Ban, Check, AlertTriangle, Percent } from 'lucide-react';

declare var html2pdf: any;

interface QuotesProps {
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  settings: AppSettings;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  onNavigate?: (view: AppView) => void;
}

const COMMON_BRANDS = [
  'Toyota', 'Chevrolet', 'Nissan', 'Kia', 'Hyundai', 'Suzuki', 
  'Ford', 'Peugeot', 'Mazda', 'Volkswagen', 'Honda', 'Mitsubishi', 
  'Subaru', 'Chery', 'MG', 'BMW', 'Mercedes-Benz', 'Audi', 
  'Jeep', 'Ram', 'Citroën', 'Renault', 'Fiat', 'Volvo'
];

const MECHANIC_NAME = "Freddy Rincón";

const Quotes: React.FC<QuotesProps> = ({ quotes, setQuotes, settings, services, setServices, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  
  // Custom Confirmation Modal State
  const [quoteToApprove, setQuoteToApprove] = useState<Quote | null>(null);

  const [scale, setScale] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Quote>>({
    clientName: '',
    phone: '+569',
    vehicle: '', 
    laborItems: [],
    expenseItems: [],
    validityDays: 15,
    notes: '',
    status: 'pending',
    laborDiscount: 0,
    laborDiscountType: 'percent',
    laborDiscountReason: ''
  });

  // Separate fields for easier editing
  const [plateInput, setPlateInput] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');

  // Autocomplete States
  const [plateSuggestions, setPlateSuggestions] = useState<Service[]>([]);
  const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [foundExistingCar, setFoundExistingCar] = useState(false);

  // Temp Inputs
  const [tempLabor, setTempLabor] = useState({ description: '', quantity: 1, unitPrice: '' });
  const [tempExpense, setTempExpense] = useState({ description: '', quantity: 1, unitPrice: '' });

  // Refs
  const plateDropdownRef = useRef<HTMLDivElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plateDropdownRef.current && !plateDropdownRef.current.contains(event.target as Node)) {
        setShowPlateSuggestions(false);
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setShowBrandSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Theme Helpers
  const getButtonColor = () => {
    switch(settings.themeColor) {
      case 'purple': return 'bg-purple-600 hover:bg-purple-700';
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'orange': return 'bg-orange-600 hover:bg-orange-700';
      case 'red': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (isPrintViewOpen && previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const a4Width = 794; 
        const newScale = Math.min(1, (containerWidth - 32) / a4Width); 
        setScale(newScale);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [isPrintViewOpen]);

  const formatCLP = (value: number) => value.toLocaleString('es-CL');

  // --- Handlers for Inputs ---

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setPlateInput(val);
    setFoundExistingCar(false);

    if (val.length > 0) {
      const matches = services
        .filter(s => s.plate.toUpperCase().includes(val))
        .reduce((acc, current) => {
          const x = acc.find(item => item.plate === current.plate);
          return !x ? acc.concat([current]) : acc;
        }, [] as Service[]);
      setPlateSuggestions(matches);
      setShowPlateSuggestions(matches.length > 0);
    } else {
      setShowPlateSuggestions(false);
    }
  };

  const selectPlateSuggestion = (s: Service) => {
    setPlateInput(s.plate);
    setBrandInput(s.brand);
    setModelInput(s.model);
    setFormData(prev => ({
        ...prev,
        clientName: s.clientName,
        phone: s.phone || '+569'
    }));
    setFoundExistingCar(true);
    setShowPlateSuggestions(false);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBrandInput(val);
    const matches = COMMON_BRANDS.filter(b => b.toLowerCase().includes(val.toLowerCase()));
    setBrandSuggestions(matches);
    setShowBrandSuggestions(true);
  };

  const selectBrand = (brand: string) => {
    setBrandInput(brand);
    setShowBrandSuggestions(false);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // --- Labor Handlers ---
  const handleAddLabor = () => {
    if (!tempLabor.description || !tempLabor.unitPrice) return;
    const price = parseInt(tempLabor.unitPrice.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: tempLabor.description,
      quantity: tempLabor.quantity,
      unitPrice: price
    };

    setFormData(prev => ({ ...prev, laborItems: [...(prev.laborItems || []), newItem] }));
    setTempLabor({ description: '', quantity: 1, unitPrice: '' });
  };

  const removeLabor = (id: string) => {
    setFormData(prev => ({ ...prev, laborItems: (prev.laborItems || []).filter(i => i.id !== id) }));
  };

  // --- Expense Handlers ---
  const handleAddExpense = () => {
    if (!tempExpense.description || !tempExpense.unitPrice) return;
    const price = parseInt(tempExpense.unitPrice.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: tempExpense.description,
      quantity: tempExpense.quantity,
      unitPrice: price
    };

    setFormData(prev => ({ ...prev, expenseItems: [...(prev.expenseItems || []), newItem] }));
    setTempExpense({ description: '', quantity: 1, unitPrice: '' });
  };

  const removeExpense = (id: string) => {
    setFormData(prev => ({ ...prev, expenseItems: (prev.expenseItems || []).filter(i => i.id !== id) }));
  };

  const calculateTotal = (quote: Partial<Quote>) => {
    const rawLabor = (quote.laborItems || []).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
    const discount = quote.laborDiscount || 0;
    
    let discountAmount = 0;
    if (quote.laborDiscountType === 'fixed') {
        discountAmount = discount;
    } else {
        discountAmount = Math.round(rawLabor * (discount / 100));
    }
    // Cap discount
    discountAmount = Math.min(discountAmount, rawLabor);
    
    const finalLabor = rawLabor - discountAmount;

    const expenses = (quote.expenseItems || []).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
    return finalLabor + expenses;
  };

  const generateQuoteId = (): string => {
    const existingIds = quotes.map(q => parseInt(q.id)).filter(n => !isNaN(n));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    let nextId = (maxId + 1).toString().padStart(3, '0');
    if (quotes.some(q => q.id === nextId)) {
        nextId = `${nextId}_1`;
    }
    return nextId;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = calculateTotal(formData);
    
    const vehicleStr = `${brandInput} ${modelInput} ${plateInput}`.trim();
    const quoteId = currentQuote ? currentQuote.id : generateQuoteId();

    const quoteData: Quote = {
      id: quoteId,
      clientName: formData.clientName || '',
      phone: formData.phone || '',
      vehicle: vehicleStr || formData.vehicle || '',
      date: currentQuote ? currentQuote.date : new Date().toISOString(),
      laborItems: formData.laborItems || [],
      expenseItems: formData.expenseItems || [],
      notes: formData.notes,
      validityDays: formData.validityDays || 15,
      total,
      status: (formData.status as any) || 'pending',
      laborDiscount: formData.laborDiscount || 0,
      laborDiscountType: formData.laborDiscountType || 'percent',
      laborDiscountReason: formData.laborDiscountReason || ''
    };

    if (currentQuote) {
      setQuotes(prev => prev.map(q => q.id === currentQuote.id ? quoteData : q));
    } else {
      setQuotes(prev => [quoteData, ...prev]);
    }
    closeModal();
  };

  const handleRejectQuote = (quote: Quote) => {
    if(!confirm('¿Estás seguro de rechazar esta cotización?')) return;
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'rejected' } : q));
  };

  // Logic executed when confirming the custom modal
  const executeApprove = () => {
    if (!quoteToApprove) return;
    const quote = quoteToApprove;

    // 1. PARSEAR VEHICULO (Marca Modelo Patente)
    const parts = quote.vehicle.trim().split(/\s+/);
    let plate = 'S/P';
    let brand = 'Vehículo';
    let model = '';

    if (parts.length >= 2) {
         const lastPart = parts[parts.length - 1];
         if (/\d/.test(lastPart) || lastPart.length === 6 || lastPart.includes('-')) {
             plate = lastPart.toUpperCase();
             brand = parts[0];
             model = parts.slice(1, parts.length - 1).join(' ');
         } else {
             brand = parts[0];
             model = parts.slice(1).join(' ');
             plate = 'S/P';
         }
    } else if (parts.length === 1) {
         brand = parts[0];
         plate = 'S/P';
    }

    // 2. MAPEAR ITEMS
    const laborItems = (quote.laborItems || []).map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        description: item.quantity > 1 ? `(${item.quantity}) ${item.description}` : item.description,
        amount: item.unitPrice * item.quantity
    }));

    const expenses = [...(quote.expenseItems || []), ...(quote.items || [])].map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        description: item.quantity > 1 ? `(${item.quantity}) ${item.description}` : item.description,
        amount: item.unitPrice * item.quantity
    }));

    // 3. CREAR SERVICIO
    const newService: Service = {
        id: Math.random().toString(36).substr(2, 9),
        clientName: quote.clientName,
        phone: quote.phone || '',
        plate: plate,
        brand: brand,
        model: model,
        reason: quote.notes ? `Cotización #${quote.id}: ${quote.notes}` : `Cotización #${quote.id} Aprobada`,
        price: 0,
        laborItems: laborItems,
        expenses: expenses,
        advance: 0,
        payments: [],
        entryDate: new Date().toISOString(),
        status: 'pending',
        laborDiscount: quote.laborDiscount || 0, // Pass discount to service
        laborDiscountType: quote.laborDiscountType || 'percent',
        laborDiscountReason: quote.laborDiscountReason || ''
    };

    // 4. ACTUALIZAR ESTADO COTIZACIÓN
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'accepted' } : q));

    // 5. AGREGAR SERVICIO
    setServices(prev => [newService, ...prev]);
    
    // Close modal
    setQuoteToApprove(null);

    // 6. REDIRECCIONAR (Con pequeño delay para asegurar propagación de estado)
    setTimeout(() => {
        if (onNavigate) {
            onNavigate(AppView.SERVICES);
        } else {
            alert('Servicio creado exitosamente. Ve a la pestaña Servicios.');
        }
    }, 100);
  };

  const openModal = (quote?: Quote) => {
    if (quote) {
      const laborItems = quote.laborItems || [];
      const expenseItems = quote.expenseItems || [];
      if (quote.items && quote.items.length > 0 && laborItems.length === 0 && expenseItems.length === 0) {
          expenseItems.push(...quote.items);
      }
      setPlateInput('');
      setBrandInput('');
      setModelInput('');
      const parts = quote.vehicle.split(' ');
      if (parts.length >= 3) {
          setPlateInput(parts[parts.length-1]);
          setBrandInput(parts[0]);
          setModelInput(parts.slice(1, parts.length-1).join(' '));
      } else {
          setPlateInput(quote.vehicle);
      }
      setCurrentQuote(quote);
      setFormData({ 
          ...quote, 
          laborItems, 
          expenseItems, 
          laborDiscount: quote.laborDiscount || 0, 
          laborDiscountType: quote.laborDiscountType || 'percent',
          laborDiscountReason: quote.laborDiscountReason || '' 
      });
    } else {
      setCurrentQuote(null);
      setPlateInput('');
      setBrandInput('');
      setModelInput('');
      setFormData({ 
          clientName: '', 
          phone: '+569', 
          vehicle: '', 
          laborItems: [], 
          expenseItems: [], 
          validityDays: 15, 
          notes: '', 
          status: 'pending', 
          laborDiscount: 0,
          laborDiscountType: 'percent', 
          laborDiscountReason: '' 
      });
    }
    setFoundExistingCar(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentQuote(null);
  };

  const deleteQuote = (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta cotización?')) {
      setQuotes(prev => prev.filter(q => q.id !== id));
    }
  };

  const generateWhatsAppText = (quote: Quote) => {
    const cleanPhone = quote.phone?.replace(/[^0-9]/g, '') || '';
    let detailStr = '';
    let rawLabor = 0;

    if (quote.laborItems && quote.laborItems.length > 0) {
        detailStr += `🔧 *Mano de Obra:*\n`;
        quote.laborItems.forEach(i => {
            const amount = i.unitPrice * i.quantity;
            rawLabor += amount;
            detailStr += `- ${i.quantity}x ${i.description}: $${formatCLP(amount)}\n`;
        });
    }

    const items = quote.expenseItems || quote.items || [];
    if (items.length > 0) {
        detailStr += `\n⚙️ *Repuestos/Insumos:*\n`;
        items.forEach(i => {
            detailStr += `- ${i.quantity}x ${i.description}: $${formatCLP(i.unitPrice * i.quantity)}\n`;
        });
    }

    // --- Discount Logic for WhatsApp ---
    const expensesTotal = items.reduce((a,c)=>a + c.unitPrice*c.quantity, 0);
    const subtotal = rawLabor + expensesTotal;
    
    let discountAmount = 0;
    let discountText = '';
    if (quote.laborDiscount && quote.laborDiscount > 0) {
        if (quote.laborDiscountType === 'fixed') {
            discountAmount = quote.laborDiscount;
            discountText = `$${discountAmount.toLocaleString('es-CL')}`;
        } else {
            discountAmount = Math.round(rawLabor * (quote.laborDiscount / 100));
            discountText = `${quote.laborDiscount}%`;
        }
        discountAmount = Math.min(discountAmount, rawLabor);
    }

    const finalTotal = subtotal - discountAmount;
    let totalString = `$${finalTotal.toLocaleString('es-CL')}`;

    if (discountAmount > 0) {
        totalString = `\n   Subtotal: $${subtotal.toLocaleString('es-CL')}\n   Descuento (${discountText}): -$${discountAmount.toLocaleString('es-CL')}`;
        if (quote.laborDiscountReason) totalString += ` (${quote.laborDiscountReason})`;
        totalString += `\n   Total a Pagar: $${finalTotal.toLocaleString('es-CL')}`;
    }

    const parts = quote.vehicle.split(' ');
    const plate = parts.length > 0 ? parts[parts.length - 1] : 'S/P';
    const brandModel = parts.slice(0, parts.length - 1).join(' ');
    const vehicleInfo = `🚗 ${brandModel || quote.vehicle}\n🔢 Patente: ${plate}\n📅 Fecha: ${new Date(quote.date).toLocaleDateString()}`;

    let msg = settings.whatsappQuoteTemplate;
    msg = msg.replace('{id}', quote.id.toUpperCase());
    msg = msg.replace('{taller}', settings.companyName);
    msg = msg.replace('{cliente}', quote.clientName);
    msg = msg.replace('{vehiculo}', vehicleInfo);
    msg = msg.replace('{detalle}', detailStr);
    msg = msg.replace('{total}', totalString);
    msg = msg.replace('{dias}', quote.validityDays.toString());

    return { text: msg, phone: cleanPhone };
  };

  const handleWhatsAppClick = (quote: Quote) => {
    const { text, phone } = generateWhatsAppText(quote);
    if (!phone) return alert('No hay teléfono registrado');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (typeof html2pdf === 'undefined') {
      alert('La librería PDF no se ha cargado. Por favor use el botón de Imprimir.');
      return;
    }
    const element = document.getElementById('printable-quote');
    if (!element) return;
    setIsGeneratingPdf(true);
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '0';
    container.appendChild(clone);
    document.body.appendChild(container);
    const parts = currentQuote?.vehicle.split(' ') || [];
    const plate = parts.length > 0 ? parts[parts.length - 1] : 'Vehiculo';
    const safePlate = plate.replace(/[^a-zA-Z0-9]/g, '');
    const opt = {
      margin: 0,
      filename: `Cotizacion_${safePlate}_${currentQuote?.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    try {
      await html2pdf().set(opt).from(clone).save();
    } catch (error) {
      console.error('PDF Generation Error', error);
      alert('Error al generar PDF.');
    } finally {
      document.body.removeChild(container);
      setIsGeneratingPdf(false);
    }
  };

  const openPrintView = (quote: Quote) => {
    const q = { ...quote };
    if ((!q.laborItems || q.laborItems.length === 0) && (!q.expenseItems || q.expenseItems.length === 0) && q.items) {
        q.expenseItems = q.items;
    }
    setCurrentQuote(q);
    setIsPrintViewOpen(true);
  };

  const filteredQuotes = quotes.filter(q => 
    q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col gap-4">
         <div className="flex justify-between items-center">
            <div>
               <h2 className="text-2xl font-bold text-white">Cotizaciones</h2>
               <p className="text-slate-400 text-sm hidden md:block">Gestiona y envía presupuestos detallados.</p>
            </div>
            <button 
              onClick={() => openModal()}
              className={`${getButtonColor()} text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg font-medium active:scale-95`}
            >
              <Plus size={20} /> <span className="hidden sm:inline">Nueva Cotización</span>
            </button>
         </div>

         <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center gap-2 shadow-sm focus-within:border-blue-500 transition-all">
            <Search size={20} className="text-slate-500 ml-2" />
            <input 
              type="text" 
              placeholder="Buscar cliente, patente..." 
              className="bg-transparent border-none focus:outline-none text-white w-full placeholder-slate-500 py-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredQuotes.map(quote => {
           const isRejected = quote.status === 'rejected';
           const isAccepted = quote.status === 'accepted';
           const isPending = !quote.status || quote.status === 'pending';
           
           const rawLabor = (quote.laborItems || []).reduce((a,c)=>a + c.unitPrice*c.quantity, 0);
           const discountVal = quote.laborDiscount || 0;
           let discountAmount = 0;
           if (quote.laborDiscountType === 'fixed') {
                discountAmount = discountVal;
           } else {
                discountAmount = Math.round(rawLabor * (discountVal / 100));
           }
           discountAmount = Math.min(discountAmount, rawLabor);

           return (
            <div key={quote.id} className={`bg-slate-900 border ${isRejected ? 'border-red-900/30' : isAccepted ? 'border-green-900/30' : 'border-slate-800'} rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all relative`}>
                
                {/* Status Badge Overlay */}
                {isRejected && <div className="absolute top-0 right-0 bg-red-900/80 text-white text-xs px-2 py-1 rounded-bl-xl font-bold border-l border-b border-red-700/50 z-10 flex items-center gap-1"><Ban size={10}/> RECHAZADA</div>}
                {isAccepted && <div className="absolute top-0 right-0 bg-green-900/80 text-white text-xs px-2 py-1 rounded-bl-xl font-bold border-l border-b border-green-700/50 z-10 flex items-center gap-1"><Check size={10}/> APROBADA</div>}

                <div className={`p-4 border-b ${isRejected ? 'border-red-900/20 bg-red-950/10' : isAccepted ? 'border-green-900/20 bg-green-950/10' : 'border-slate-800 bg-slate-900'} relative`}>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <span className="text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                        #{quote.id}
                        </span>
                        <h3 className={`font-bold text-lg mt-1 ${isRejected ? 'text-slate-400 line-through' : 'text-white'}`}>{quote.clientName}</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-slate-500 block mb-0.5">Total</span>
                        <span className={`text-xl font-bold ${isRejected ? 'text-slate-500' : 'text-white'}`}>${formatCLP(quote.total)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                        <Car size={14} /> {quote.vehicle}
                    </div>
                    <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                    <div className="flex items-center gap-1">
                        <Calendar size={14} /> {new Date(quote.date).toLocaleDateString()}
                    </div>
                </div>
                </div>
                
                <div className={`p-4 flex-1 text-sm ${isRejected ? 'opacity-50' : 'text-slate-400'}`}>
                <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                    <span>Mano de Obra:</span>
                    <span className="text-slate-200">
                        ${formatCLP(rawLabor - discountAmount)}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Repuestos/Otros:</span>
                    <span className="text-slate-200">${formatCLP((quote.expenseItems || quote.items || []).reduce((a,c)=>a + c.unitPrice*c.quantity, 0))}</span>
                </div>
                </div>
                
                <div className={`grid ${isPending ? 'grid-cols-6' : 'grid-cols-4'} border-t border-slate-800 divide-x divide-slate-800`}>
                    {isPending && (
                        <>
                            <button onClick={() => setQuoteToApprove(quote)} className="p-3 flex items-center justify-center text-green-500 hover:bg-green-600 hover:text-white transition-colors col-span-1 bg-slate-800/50" title="Aprobar (Crear Servicio)">
                                <CheckCircle size={20} />
                            </button>
                            <button onClick={() => handleRejectQuote(quote)} className="p-3 flex items-center justify-center text-red-500 hover:bg-red-600 hover:text-white transition-colors col-span-1 bg-slate-800/50" title="Rechazar">
                                <Ban size={20} />
                            </button>
                        </>
                    )}
                    
                    <button onClick={() => handleWhatsAppClick(quote)} className="p-3 flex items-center justify-center text-green-500 hover:bg-green-600 hover:text-white transition-colors" title="Enviar WhatsApp"><MessageCircle size={20} /></button>
                    <button onClick={() => openPrintView(quote)} className="p-3 flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors" title="PDF"><FileText size={20} /></button>
                    <button onClick={() => openModal(quote)} className="p-3 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors" title="Editar"><Edit size={20} /></button>
                    <button onClick={() => deleteQuote(quote.id)} className="p-3 flex items-center justify-center text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={20} /></button>
                </div>
            </div>
           );
        })}
      </div>

      {isModalOpen && (
        // ... (Modal Content - Unchanged) ...
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <div className="relative transform rounded-2xl bg-slate-900 text-left shadow-xl transition-all sm:my-8 w-full max-w-3xl border border-slate-700 flex flex-col">
                
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
                  <h3 className="text-lg font-bold text-white">{currentQuote ? 'Editar Cotización' : 'Nueva Cotización'}</h3>
                  <button onClick={closeModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                
                <div className="p-4 space-y-6">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                        <div className="relative space-y-1" ref={plateDropdownRef}>
                           <div className="flex justify-between">
                             <label className="text-xs font-bold text-slate-400 uppercase">Patente (Buscar)</label>
                             {foundExistingCar && (<span className="text-xs text-green-500 flex items-center gap-1"><RotateCcw size={10}/> Encontrado</span>)}
                           </div>
                           <input required type="text" className={`w-full bg-slate-950 border ${foundExistingCar ? 'border-green-500/50' : 'border-slate-700'} rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm uppercase font-mono tracking-wider`} placeholder="XX XX 00" value={plateInput} onChange={handlePlateChange} onFocus={handleInputFocus} autoComplete="off" />
                           {showPlateSuggestions && (
                              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {plateSuggestions.map((s, idx) => (
                                  <button key={idx} type="button" onClick={() => selectPlateSuggestion(s)} className="w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0">
                                    <div className="flex justify-between items-center"><span className="font-mono font-bold text-white">{s.plate}</span><span className="text-xs text-slate-400">{s.clientName}</span></div>
                                    <div className="text-xs text-slate-500">{s.brand} {s.model}</div>
                                  </button>
                                ))}
                              </div>
                           )}
                        </div>
                        <div className="relative space-y-1" ref={brandDropdownRef}>
                           <label className="text-xs font-bold text-slate-400 uppercase">Marca</label>
                           <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm" placeholder="Ej: Toyota" value={brandInput} onChange={handleBrandChange} onFocus={handleInputFocus} autoComplete="off" />
                           {showBrandSuggestions && (
                              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {brandSuggestions.map((b, idx) => (
                                  <button key={idx} type="button" onClick={() => selectBrand(b)} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 border-b border-slate-700/50 last:border-0">{b}</button>
                                ))}
                              </div>
                           )}
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-400 uppercase">Modelo</label>
                           <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm" placeholder="Ej: Yaris" value={modelInput} onChange={e => setModelInput(e.target.value)} onFocus={handleInputFocus} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">Cliente</label>
                          <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm" placeholder="Nombre completo" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} onFocus={handleInputFocus} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">WhatsApp</label>
                          <input type="tel" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} onFocus={handleInputFocus} />
                        </div>
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                          <label className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide"><Hammer size={16} /> Mano de Obra (Ganancia)</label>
                          <div className="flex items-center gap-2">
                              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                  <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, laborDiscountType: 'percent', laborDiscount: 0})}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${formData.laborDiscountType !== 'fixed' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                  >%</button>
                                  <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, laborDiscountType: 'fixed', laborDiscount: 0})}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${formData.laborDiscountType === 'fixed' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                  >$</button>
                              </div>
                              <label className="text-xs text-slate-400">Descuento</label>
                              <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg p-1 text-white text-center text-sm focus:border-green-500 outline-none" 
                                    placeholder="0" 
                                    value={formData.laborDiscount === 0 ? '' : (formData.laborDiscountType === 'fixed' ? formatCLP(formData.laborDiscount || 0) : formData.laborDiscount)} 
                                    onChange={e => {
                                        let val = parseInt(e.target.value.replace(/\./g, '').replace(/\D/g, '')) || 0;
                                        if (formData.laborDiscountType !== 'fixed') {
                                            val = Math.min(100, Math.max(0, val));
                                        }
                                        setFormData({...formData, laborDiscount: val === 0 ? undefined : val});
                                    }} 
                                />
                                {formData.laborDiscount && formData.laborDiscount > 0 ? (
                                    <input 
                                        type="text" 
                                        className="w-32 bg-slate-800 border border-slate-700 rounded-lg p-1 text-white text-sm focus:border-green-500 outline-none placeholder-slate-500" 
                                        placeholder="Razón..." 
                                        value={formData.laborDiscountReason || ''} 
                                        onChange={e => setFormData({...formData, laborDiscountReason: e.target.value})} 
                                    />
                                ) : null}
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                         <div className="flex gap-2">
                            <input type="number" min="1" className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center text-sm" placeholder="Cant." value={tempLabor.quantity} onChange={e => setTempLabor({...tempLabor, quantity: parseInt(e.target.value) || 1})} onFocus={handleInputFocus} />
                            <input type="text" inputMode="numeric" placeholder="$ Precio Unit." className="w-28 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={tempLabor.unitPrice === '' ? '' : formatCLP(Number(tempLabor.unitPrice.toString().replace(/\./g, '')))} onChange={e => setTempLabor({...tempLabor, unitPrice: e.target.value.replace(/\D/g, '')})} onFocus={handleInputFocus} />
                         </div>
                         <input type="text" placeholder="Descripción" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={tempLabor.description} onChange={e => setTempLabor({...tempLabor, description: e.target.value})} onFocus={handleInputFocus} />
                         <button type="button" onClick={handleAddLabor} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg flex items-center justify-center shrink-0"><Plus size={20} /></button>
                      </div>
                      {formData.laborItems && formData.laborItems.length > 0 && (
                         <div className="space-y-1 bg-slate-950/30 p-2 rounded-xl border border-slate-800">
                            {formData.laborItems.map((item) => (
                               <div key={item.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                  <span className="text-slate-300 text-sm">{item.quantity}x {item.description}</span>
                                  <div className="flex items-center gap-3"><span className="text-blue-300 font-mono text-sm">${formatCLP(item.unitPrice * item.quantity)}</span><button type="button" onClick={() => removeLabor(item.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>

                   <div className="space-y-3 pt-2 border-t border-slate-800">
                      <label className="text-sm font-bold text-orange-400 flex items-center gap-2 uppercase tracking-wide"><Box size={16} /> Repuestos / Terceros (Costo)</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                         <div className="flex gap-2">
                            <input type="number" min="1" className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-center text-sm" placeholder="Cant." value={tempExpense.quantity} onChange={e => setTempExpense({...tempExpense, quantity: parseInt(e.target.value) || 1})} onFocus={handleInputFocus} />
                            <input type="text" inputMode="numeric" placeholder="$ Precio Unit." className="w-28 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={tempExpense.unitPrice === '' ? '' : formatCLP(Number(tempExpense.unitPrice.toString().replace(/\./g, '')))} onChange={e => setTempExpense({...tempExpense, unitPrice: e.target.value.replace(/\D/g, '')})} onFocus={handleInputFocus} />
                         </div>
                         <input type="text" placeholder="Descripción" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" value={tempExpense.description} onChange={e => setTempExpense({...tempExpense, description: e.target.value})} onFocus={handleInputFocus} />
                         <button type="button" onClick={handleAddExpense} className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded-lg flex items-center justify-center shrink-0"><Plus size={20} /></button>
                      </div>
                      {formData.expenseItems && formData.expenseItems.length > 0 && (
                         <div className="space-y-1 bg-slate-950/30 p-2 rounded-xl border border-slate-800">
                            {formData.expenseItems.map((item) => (
                               <div key={item.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                  <span className="text-slate-300 text-sm">{item.quantity}x {item.description}</span>
                                  <div className="flex items-center gap-3"><span className="text-orange-300 font-mono text-sm">${formatCLP(item.unitPrice * item.quantity)}</span><button type="button" onClick={() => removeExpense(item.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>

                   <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Total Cotización</span>
                      <div className="flex flex-col items-end">
                          <span className="text-xl font-bold text-white">${formatCLP(calculateTotal(formData))}</span>
                          {formData.laborDiscount && formData.laborDiscount > 0 ? (
                              <span className="text-xs text-green-400">Incluye descuento M.O del {formData.laborDiscountType === 'fixed' ? `$${formatCLP(formData.laborDiscount)}` : `${formData.laborDiscount}%`}</span>
                          ) : null}
                      </div>
                   </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl shrink-0 flex gap-3">
                   <button onClick={closeModal} className="flex-1 py-3 rounded-xl text-slate-400 hover:bg-slate-800 font-medium transition-colors">Cancelar</button>
                   <button onClick={handleSubmit} className={`flex-1 py-3 rounded-xl ${getButtonColor()} text-white font-bold shadow-lg flex items-center justify-center gap-2`}><Save size={18} /> Guardar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Approval */}
      {quoteToApprove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden">
              <div className="p-6">
                 <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                    <CheckCircle className="text-blue-500" size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-white text-center mb-2">¿Aprobar Cotización?</h3>
                 <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
                    Se creará un nuevo servicio en estado <strong>Pendiente</strong> para <span className="text-white font-bold">{quoteToApprove.clientName}</span>. 
                    <br/><br/>
                    La cotización quedará marcada como aprobada y te llevaremos a la sección de Servicios.
                 </p>
                 
                 <div className="flex gap-3">
                    <button 
                       onClick={() => setQuoteToApprove(null)}
                       className="flex-1 py-3 rounded-xl text-slate-400 hover:bg-slate-800 font-medium transition-colors"
                    >
                       Cancelar
                    </button>
                    <button 
                       onClick={executeApprove}
                       className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg flex items-center justify-center gap-2"
                    >
                       <Check size={18} /> Confirmar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isPrintViewOpen && currentQuote && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col print-modal">
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center shrink-0 print:hidden z-50">
             <div className="flex items-center gap-3">
               <button onClick={() => setIsPrintViewOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button>
               <span className="text-white font-bold">Vista Previa</span>
             </div>
             <div className="flex gap-2">
                <button onClick={() => handleWhatsAppClick(currentQuote)} className="px-3 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center gap-2"><MessageCircle size={18} /> WhatsApp</button>
                <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                   {isGeneratingPdf ? 'Generando...' : <><Download size={18} /> Descargar PDF</>}
                </button>
                <button onClick={() => window.print()} className={`px-4 py-2 ${getButtonColor()} text-white rounded-lg font-bold flex items-center gap-2`}><Printer size={18} /> Imprimir</button>
             </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-950 p-4 flex justify-center items-start print:p-0 print:overflow-visible print:block" ref={previewContainerRef}>
             <div id="printable-quote" className="bg-white text-slate-900 shadow-2xl origin-top print:shadow-none print:transform-none"
                style={{ width: '210mm', minHeight: '297mm', transform: `scale(${scale})`, marginBottom: `${(297 * scale) - 297}mm` }}>
                <div className="p-12 h-full flex flex-col relative box-border print:p-0 print:m-12">
                   
                   {/* Header */}
                   <div className="flex justify-between items-center border-b-4 border-blue-600 pb-8 mb-8">
                      <div className="flex items-center gap-6">
                         {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 object-contain rounded-lg" />
                         ) : (
                            <div className="w-20 h-20 bg-blue-600 text-white flex items-center justify-center rounded-lg"><Car size={40} /></div>
                         )}
                         <div>
                            <h1 className="text-3xl font-black text-slate-950 tracking-tighter uppercase">{settings.companyName}</h1>
                            <div className="mt-2 text-sm text-slate-600 space-y-0.5 font-medium"><p>{settings.companyAddress}</p><p>{settings.companyPhone}</p></div>
                         </div>
                      </div>
                      <div className="text-right">
                         <h2 className="text-4xl font-black text-blue-600 uppercase tracking-tighter">Cotización</h2>
                         <p className="font-mono text-xl font-bold text-slate-900 mt-1">Nº {currentQuote.id.toUpperCase()}</p>
                      </div>
                   </div>
                   
                   {/* Client & Vehicle Info */}
                   <div className="grid grid-cols-2 gap-8 mb-10">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-blue-700 border-b border-blue-200 pb-2 mb-3 text-xs uppercase tracking-widest">Datos del Cliente</h3>
                            <div className="text-sm space-y-1.5">
                                <p><span className="font-bold text-slate-700">Nombre:</span> {currentQuote.clientName}</p>
                                <p><span className="font-bold text-slate-700">Teléfono:</span> {currentQuote.phone}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-blue-700 border-b border-blue-200 pb-2 mb-3 text-xs uppercase tracking-widest">Datos del Vehículo</h3>
                            <div className="text-sm space-y-1.5">
                                <p><span className="font-bold text-slate-700">Vehículo:</span> <span className="uppercase">{currentQuote.vehicle}</span></p>
                                <p><span className="font-bold text-slate-700">Fecha:</span> {new Date(currentQuote.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                   </div>

                   {/* Items Table */}
                   <div className="flex-1">
                     <table className="w-full mb-10 border-collapse">
                        <thead>
                           <tr className="bg-blue-600 text-white">
                              <th className="py-3 px-4 text-center font-bold text-sm w-16 rounded-tl-lg">Cant.</th>
                              <th className="py-3 px-4 text-left font-bold text-sm">Descripción</th>
                              <th className="py-3 px-4 text-right font-bold text-sm w-32">P. Unit</th>
                              <th className="py-3 px-4 text-right font-bold text-sm w-32 rounded-tr-lg">Total</th>
                           </tr>
                        </thead>
                        <tbody className="text-sm">
                           {currentQuote.laborItems && currentQuote.laborItems.length > 0 && (
                             <>
                               <tr className="bg-slate-100 font-bold text-slate-700 uppercase text-xs"><td colSpan={4} className="py-2 px-4">Servicios / Mano de Obra</td></tr>
                               {currentQuote.laborItems.map((item, idx) => (
                                  <tr key={`l-${idx}`} className="border-b border-slate-200"><td className="py-3 px-4 text-center text-slate-700">{item.quantity}</td><td className="py-3 px-4 text-slate-900 font-medium">{item.description}</td><td className="py-3 px-4 text-right text-slate-700">${formatCLP(item.unitPrice)}</td><td className="py-3 px-4 text-right font-bold text-slate-950">${formatCLP(item.unitPrice * item.quantity)}</td></tr>
                               ))}
                             </>
                           )}
                           
                           {/* Discount row */}
                           {currentQuote.laborDiscount && currentQuote.laborDiscount > 0 ? (
                                <tr className="border-b border-slate-200 bg-red-50">
                                    <td colSpan={2}></td>
                                    <td className="py-3 px-4 text-right font-bold text-red-700">
                                        Descuento ({currentQuote.laborDiscountType === 'fixed' ? `$${formatCLP(currentQuote.laborDiscount)}` : `${currentQuote.laborDiscount}%`})
                                        {currentQuote.laborDiscountReason && <span className="font-normal text-xs ml-1 italic">- {currentQuote.laborDiscountReason}</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-red-700">
                                        -${formatCLP(
                                            currentQuote.laborDiscountType === 'fixed'
                                            ? Math.min(currentQuote.laborDiscount, (currentQuote.laborItems || []).reduce((a,c)=>a + c.unitPrice*c.quantity, 0))
                                            : Math.round(((currentQuote.laborItems || []).reduce((a,c) => a + c.unitPrice*c.quantity, 0)) * (currentQuote.laborDiscount/100))
                                        )}
                                    </td>
                                </tr>
                           ) : null}

                           {(currentQuote.expenseItems || []).length > 0 && (
                             <>
                               <tr className="bg-slate-100 font-bold text-slate-700 uppercase text-xs"><td colSpan={4} className="py-2 px-4">Repuestos / Otros</td></tr>
                               {(currentQuote.expenseItems || []).map((item, idx) => (
                                  <tr key={`e-${idx}`} className="border-b border-slate-200"><td className="py-3 px-4 text-center text-slate-700">{item.quantity}</td><td className="py-3 px-4 text-slate-900 font-medium">{item.description}</td><td className="py-3 px-4 text-right text-slate-700">${formatCLP(item.unitPrice)}</td><td className="py-3 px-4 text-right font-bold text-slate-950">${formatCLP(item.unitPrice * item.quantity)}</td></tr>
                               ))}
                             </>
                           )}
                        </tbody>
                     </table>
                   </div>
                   
                   {/* Totals & Footer */}
                   <div className="flex flex-row justify-end items-start mb-16 break-inside-avoid">
                      <div className="w-72 bg-slate-50 p-6 rounded-xl border border-slate-200">
                         {/* Calculations for PDF */}
                         {(() => {
                             const rawLabor = (currentQuote.laborItems || []).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
                             const expensesTotal = (currentQuote.expenseItems || []).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
                             const subtotal = rawLabor + expensesTotal;
                             
                             let discountAmount = 0;
                             let discountText = '';
                             if (currentQuote.laborDiscount && currentQuote.laborDiscount > 0) {
                                 if (currentQuote.laborDiscountType === 'fixed') {
                                     discountAmount = currentQuote.laborDiscount;
                                     discountText = `$${formatCLP(discountAmount)}`;
                                 } else {
                                     discountAmount = Math.round(rawLabor * (currentQuote.laborDiscount / 100));
                                     discountText = `${currentQuote.laborDiscount}%`;
                                 }
                                 discountAmount = Math.min(discountAmount, rawLabor);
                             }
                             const finalTotal = subtotal - discountAmount;

                             if (discountAmount > 0) {
                                 return (
                                     <>
                                         <div className="flex justify-between py-1 text-sm text-slate-600"><span>Subtotal</span><span>${formatCLP(subtotal)}</span></div>
                                         <div className="flex justify-between py-1 text-sm text-red-600"><span>Descuento ({discountText})</span><span>-${formatCLP(discountAmount)}</span></div>
                                         <div className="flex justify-between py-3 border-t-2 border-slate-300 text-slate-950 mt-2"><span className="font-bold text-lg">Total a Pagar</span><span className="font-bold text-lg">${formatCLP(finalTotal)}</span></div>
                                     </>
                                 );
                             } else {
                                 return (
                                     <div className="flex justify-between py-3 border-t-2 border-slate-300 text-slate-950"><span className="font-bold text-lg">TOTAL</span><span className="font-bold text-lg">${formatCLP(finalTotal)}</span></div>
                                 );
                             }
                         })()}
                         <p className="text-[10px] text-slate-500 text-right mt-2">* Válido por {currentQuote.validityDays} días</p>
                      </div>
                   </div>
                   
                   <div className="mt-auto pt-10 break-inside-avoid">
                      <div className="mb-12 text-right pr-4">
                         <p className="text-sm font-bold text-slate-900 uppercase flex items-center justify-end gap-2"><UserCog size={16}/> Mecánico Responsable: {MECHANIC_NAME}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-20 mb-10"><div className="text-center"><div className="border-b-2 border-slate-800 mb-2 h-16"></div><p className="text-sm font-bold text-slate-900">Firma Taller</p></div><div className="text-center"><div className="border-b-2 border-slate-800 mb-2 h-16"></div><p className="text-sm font-bold text-slate-900">Firma Cliente</p></div></div>
                      <div className="border-t-2 border-slate-200 pt-4 flex justify-between text-[10px] text-slate-500"><p>Gracias por su preferencia.</p><p>Generado por TallerManager</p></div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotes;