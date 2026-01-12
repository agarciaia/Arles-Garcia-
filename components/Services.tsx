import React, { useState, useRef, useEffect } from 'react';
import { Service, ServiceExpense, AppSettings, ServicePayment } from '../types';
import { Plus, Search, Calendar, User, Car, FileText, DollarSign, X, Phone, MessageCircle, ChevronDown, ChevronUp, RotateCcw, Hammer, Box, Trash2, Edit, Ban, Filter, CheckCircle, Clock, ArrowRight, Tag, LayoutGrid, Rows, Printer, RefreshCw, History, Download, UserCog, FilePenLine, Eraser, Camera, Image as ImageIcon, Share2 } from 'lucide-react';

declare var html2pdf: any;

interface ServicesProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  settings: AppSettings;
}

const COMMON_BRANDS = [
  'Toyota', 'Chevrolet', 'Nissan', 'Kia', 'Hyundai', 'Suzuki', 
  'Ford', 'Peugeot', 'Mazda', 'Volkswagen', 'Honda', 'Mitsubishi', 
  'Subaru', 'Chery', 'MG', 'BMW', 'Mercedes-Benz', 'Audi', 
  'Jeep', 'Ram', 'Citroën', 'Renault', 'Fiat', 'Volvo'
];

const MECHANIC_NAME = "Freddy Rincón";

export default function Services({ services, setServices, settings }: ServicesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // PDF / Print Preview State
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [printService, setPrintService] = useState<Service | null>(null);
  const [scale, setScale] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // History Filter State
  const [historyFilter, setHistoryFilter] = useState<'completed' | 'cancelled'>('completed');
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  
  // View Controls
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Card Expansion State
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // State for managing the Status Dropdown
  const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(null);

  // --- COMPLETION MODAL STATE ---
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [serviceToComplete, setServiceToComplete] = useState<Service | null>(null);
  const [completionDate, setCompletionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // --- PHOTO GALLERY STATE ---
  const [photoServiceId, setPhotoServiceId] = useState<string | null>(null); // To know which service is uploading
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false); // For History/Modal view
  const [viewingPhotoService, setViewingPhotoService] = useState<Service | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // --- DRAFT STATE ---
  const [hasDraft, setHasDraft] = useState(false);

  // New Service Form State
  const [newService, setNewService] = useState<Partial<Service>>({
    status: 'pending',
    entryDate: new Date().toISOString().split('T')[0],
    price: 0,
    advance: 0,
    phone: '+569',
    laborItems: [],
    expenses: [],
    payments: [],
    photos: []
  });

  // State for adding specific items inside the modal
  const [tempLabor, setTempLabor] = useState({ description: '', amount: '' });
  const [tempExpense, setTempExpense] = useState({ description: '', amount: '' });

  const [foundExistingCar, setFoundExistingCar] = useState(false);
  
  // Autocomplete states
  const [suggestions, setSuggestions] = useState<Service[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Get Button Color based on Theme
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
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Check for existing draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('service_draft');
    if (draft) {
      setHasDraft(true);
    }
  }, []);

  // Auto-save draft effect
  useEffect(() => {
    if (isModalOpen && !isEditing) {
      // Only save if there is significant data
      if (newService.plate || newService.clientName || newService.brand || (newService.laborItems && newService.laborItems.length > 0)) {
        localStorage.setItem('service_draft', JSON.stringify(newService));
        setHasDraft(true);
      }
    }
  }, [newService, isModalOpen, isEditing]);

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
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, [isPrintViewOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setShowBrandSuggestions(false);
      }
      if (activeStatusDropdown && !(event.target as Element).closest('.status-dropdown-container')) {
        setActiveStatusDropdown(null);
      }
      if (isHistoryFilterOpen && !(event.target as Element).closest('.history-filter-container')) {
        setIsHistoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeStatusDropdown, isHistoryFilterOpen]);

  // --- PHOTO HANDLING LOGIC ---
  const triggerCamera = (serviceId: string) => {
    setPhotoServiceId(serviceId);
    if (cameraInputRef.current) {
        cameraInputRef.current.click();
    }
  };

  const triggerGallery = (serviceId: string) => {
    setPhotoServiceId(serviceId);
    if (galleryInputRef.current) {
        galleryInputRef.current.click();
    }
  };

  const compressImage = (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality JPEG
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && photoServiceId) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onloadend = async () => {
            const rawBase64 = reader.result as string;
            const compressedBase64 = await compressImage(rawBase64);
            
            setServices(prev => prev.map(s => {
                if (s.id === photoServiceId) {
                    const currentPhotos = s.photos || [];
                    const updated = { ...s, photos: [...currentPhotos, compressedBase64] };
                    if (viewingPhotoService && viewingPhotoService.id === s.id) {
                        setViewingPhotoService(updated);
                    }
                    return updated;
                }
                return s;
            }));
            
            // Clear inputs
            if (cameraInputRef.current) cameraInputRef.current.value = '';
            if (galleryInputRef.current) galleryInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    }
  };

  const deletePhoto = (serviceId: string, photoIndex: number) => {
    if (!confirm('¿Borrar esta foto?')) return;
    
    setServices(prev => prev.map(s => {
        if (s.id === serviceId && s.photos) {
            const newPhotos = [...s.photos];
            newPhotos.splice(photoIndex, 1);
            const updated = { ...s, photos: newPhotos };
            if (viewingPhotoService && viewingPhotoService.id === s.id) {
                setViewingPhotoService(updated);
            }
            return updated;
        }
        return s;
    }));
  };

  const sharePhoto = async (base64: string, index: number) => {
    try {
        // Convert base64 to blob
        const res = await fetch(base64);
        const blob = await res.blob();
        const file = new File([blob], `foto_taller_${index}.jpg`, { type: blob.type });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Foto del Servicio',
                text: 'Adjunto evidencia fotográfica del taller.'
            });
        } else {
            alert('Tu navegador no soporta la función de compartir archivos directamente.');
        }
    } catch (e) {
        console.error('Error sharing photo:', e);
        alert('Error al intentar compartir la imagen.');
    }
  };

  const openPhotoGallery = (service: Service) => {
    setViewingPhotoService(service);
    setIsPhotoModalOpen(true);
  };
  // ---------------------------

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    if (e.target.name === 'plate' && suggestions.length > 0) setShowSuggestions(true);
    if (e.target.name === 'brand') filterBrands(newService.brand || '');
  };

  const calculateServiceTotalLabor = (service: Partial<Service>) => {
    if (!service.laborItems || service.laborItems.length === 0) return service.price || 0;
    return service.laborItems.reduce((acc, curr) => acc + curr.amount, 0);
  };

  const calculateTotal = (service: Service | Partial<Service>) => {
    const labor = (service.laborItems || []).reduce((acc, curr) => acc + curr.amount, 0);
    const effectiveLabor = labor === 0 && (service.price || 0) > 0 ? (service.price || 0) : labor;
    const expensesTotal = (service.expenses || []).reduce((acc, curr) => acc + curr.amount, 0);
    return effectiveLabor + expensesTotal;
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.plate) return;

    const totalLabor = calculateServiceTotalLabor(newService);
    const advanceAmount = Number(newService.advance) || 0;
    const entryDate = newService.entryDate || new Date().toISOString();

    let currentPayments = newService.payments ? [...newService.payments] : [];
    
    currentPayments = currentPayments.filter(p => p.type !== 'advance');

    if (advanceAmount > 0) {
      currentPayments.push({
        id: Math.random().toString(36).substr(2, 9),
        amount: advanceAmount,
        date: entryDate,
        type: 'advance',
        description: `Adelanto de Patente ${newService.plate.toUpperCase()}`
      });
    }

    const serviceData: Service = {
      id: newService.id || Math.random().toString(36).substr(2, 9),
      clientName: newService.clientName || '',
      phone: newService.phone || '',
      plate: newService.plate || '',
      brand: newService.brand || '',
      model: newService.model || '',
      reason: newService.reason || '',
      laborItems: newService.laborItems || [],
      expenses: newService.expenses || [],
      price: totalLabor,
      advance: advanceAmount,
      payments: currentPayments,
      photos: newService.photos || [],
      entryDate: entryDate,
      status: (newService.status as any) || 'pending',
    };

    if (isEditing && newService.id) {
      setServices(prev => prev.map(s => s.id === newService.id ? serviceData : s));
    } else {
      setServices(prev => [serviceData, ...prev]);
      localStorage.removeItem('service_draft');
      setHasDraft(false);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleAddLabor = () => {
    if (!tempLabor.description || !tempLabor.amount) return;
    const amount = parseInt(tempLabor.amount.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    
    const newItem: ServiceExpense = {
      id: Math.random().toString(36).substr(2, 9),
      description: tempLabor.description,
      amount: amount
    };

    setNewService(prev => ({
      ...prev,
      laborItems: [...(prev.laborItems || []), newItem]
    }));
    setTempLabor({ description: '', amount: '' });
  };

  const removeLabor = (itemId: string) => {
    setNewService(prev => ({
      ...prev,
      laborItems: (prev.laborItems || []).filter(e => e.id !== itemId)
    }));
  };

  const handleAddExpense = () => {
    if (!tempExpense.description || !tempExpense.amount) return;
    const amount = parseInt(tempExpense.amount.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    
    const newItem: ServiceExpense = {
      id: Math.random().toString(36).substr(2, 9),
      description: tempExpense.description,
      amount: amount
    };

    setNewService(prev => ({
      ...prev,
      expenses: [...(prev.expenses || []), newItem]
    }));
    setTempExpense({ description: '', amount: '' });
  };

  const removeExpense = (expenseId: string) => {
    setNewService(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter(e => e.id !== expenseId)
    }));
  };

  const handleStatusChange = (serviceId: string, newStatus: Service['status']) => {
    if (newStatus === 'completed') {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        setServiceToComplete(service);
        setCompletionDate(new Date().toISOString().split('T')[0]);
        setIsCompletionModalOpen(true);
        setActiveStatusDropdown(null);
      }
      return;
    }

    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, status: newStatus } : s));
    setActiveStatusDropdown(null);
  };

  const confirmCompletion = () => {
    if (!serviceToComplete) return;

    const total = calculateTotal(serviceToComplete);
    const paid = (serviceToComplete.payments || [])
        .filter(p => p.type === 'advance')
        .reduce((acc, curr) => acc + curr.amount, 0);
        
    const legacyPaid = (!serviceToComplete.payments || serviceToComplete.payments.length === 0) ? (serviceToComplete.advance || 0) : 0;
    
    const finalPaid = paid > 0 ? paid : legacyPaid;
    const remainder = total - finalPaid;

    const newPayment: ServicePayment = {
        id: Math.random().toString(36).substr(2, 9),
        amount: remainder,
        date: completionDate,
        type: 'final',
        description: `Saldo Final Patente ${serviceToComplete.plate.toUpperCase()}`
    };

    const updatedPayments = [...(serviceToComplete.payments || [])];
    if (remainder > 0) {
        updatedPayments.push(newPayment);
    }

    setServices(prev => prev.map(s => 
        s.id === serviceToComplete.id 
            ? { ...s, status: 'completed', payments: updatedPayments } 
            : s
    ));

    setIsCompletionModalOpen(false);
    setServiceToComplete(null);
  };

  const toggleExpandCard = (serviceId: string) => {
    if (expandedServiceId === serviceId) {
      setExpandedServiceId(null);
    } else {
      setExpandedServiceId(serviceId);
    }
  };

  const handleEditClick = (service: Service) => {
    let laborItems = service.laborItems || [];
    if (laborItems.length === 0 && service.price > 0) {
      laborItems = [{
        id: 'default-labor',
        description: 'Mano de Obra Base',
        amount: service.price
      }];
    }

    setNewService({ 
      ...service, 
      laborItems: laborItems,
      expenses: service.expenses || [],
      payments: service.payments || [],
      photos: service.photos || []
    });
    setIsEditing(true);
    setFoundExistingCar(true);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setNewService({ 
      status: 'pending', 
      entryDate: new Date().toISOString().split('T')[0],
      price: 0,
      advance: 0,
      phone: '+569',
      laborItems: [],
      expenses: [],
      payments: [],
      photos: []
    });
    setTempLabor({ description: '', amount: '' });
    setTempExpense({ description: '', amount: '' });
    setFoundExistingCar(false);
    setIsEditing(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setBrandSuggestions([]);
    setShowBrandSuggestions(false);
  };

  const loadDraft = () => {
    const draft = localStorage.getItem('service_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setNewService(parsed);
        setIsEditing(false);
        setIsModalOpen(true);
      } catch (e) {
        console.error("Error loading draft", e);
      }
    }
  };

  const discardDraft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('¿Estás seguro de eliminar el borrador?')) {
      localStorage.removeItem('service_draft');
      setHasDraft(false);
    }
  };

  const clearAutoFill = () => {
    setNewService(prev => ({
      ...prev,
      clientName: '',
      brand: '',
      model: '',
      phone: '+569',
      price: 0,
      advance: 0,
      reason: '',
      laborItems: [],
      expenses: [],
      payments: [],
      photos: []
    }));
    setFoundExistingCar(false);
    setIsEditing(false);
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.toUpperCase();
    setNewService(prev => ({ ...prev, plate: rawValue }));
    
    if (foundExistingCar && rawValue !== newService.plate) {
       setFoundExistingCar(false);
       setIsEditing(false);
    }

    if (rawValue.length > 0) {
      const matches = services
        .filter(s => s.plate.replace(/\s/g, '').toUpperCase().startsWith(rawValue.replace(/\s/g, '')))
        .reduce((acc, current) => {
          const x = acc.find(item => item.plate === current.plate);
          return !x ? acc.concat([current]) : acc;
        }, [] as Service[]);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (service: Service) => {
    setNewService(prev => ({
      ...prev,
      plate: service.plate,
      clientName: service.clientName,
      brand: service.brand,
      model: service.model,
      phone: service.phone || '+569',
    }));
    setSuggestions([]);
    setShowSuggestions(false);
    setFoundExistingCar(true);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewService(prev => ({ ...prev, brand: value }));
    filterBrands(value);
  };

  const filterBrands = (input: string) => {
    const existingBrands = Array.from(new Set(services.map(s => s.brand)));
    const allBrands = Array.from(new Set([...COMMON_BRANDS, ...existingBrands]));
    const matches = (allBrands as string[]).filter(brand => brand.toLowerCase().includes(input.toLowerCase())).sort();
    setBrandSuggestions(matches);
    setShowBrandSuggestions(true);
  };

  const selectBrand = (brand: string) => {
    setNewService(prev => ({ ...prev, brand }));
    setShowBrandSuggestions(false);
  };

  const formatCLP = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('es-CL');
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'advance') => {
    const rawValue = e.target.value.replace(/\./g, '').replace(/\D/g, '');
    const numValue = rawValue === '' ? 0 : parseInt(rawValue, 10);
    setNewService(prev => ({ ...prev, [field]: numValue }));
  };

  const displayedServices = services
    .filter(s => {
      const matchesSearch = 
        s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.brand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isActive = s.status === 'pending' || s.status === 'in-progress';
      
      if (showHistory) {
        return matchesSearch && s.status === historyFilter;
      } else {
        return matchesSearch && isActive;
      }
    })
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'in-progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'completed': return 'Completado';
      case 'in-progress': return 'En Proceso';
      case 'cancelled': return 'Cancelado';
      default: return 'Pendiente';
    }
  };

  const generateWhatsAppText = (service: Service) => {
    if (!service.phone) return { text: '', phone: '' };
    const cleanPhone = service.phone.replace(/[^0-9]/g, '');
    
    const labor = service.laborItems || [];
    const expenses = service.expenses || [];
    const total = calculateTotal(service);
    const remaining = total - (service.advance || 0);

    let detailStr = '';
    const legacyLaborAmount = service.price;
    const hasDetailedLabor = labor.length > 0;
    
    detailStr += `👷 *Mano de Obra:*\n`;
    if (hasDetailedLabor) {
       labor.forEach(item => {
          detailStr += `${item.description}: $${item.amount.toLocaleString('es-CL')}\n`;
       });
    } else {
       detailStr += `Mano de Obra Base: $${legacyLaborAmount.toLocaleString('es-CL')}\n`;
    }

    if (expenses.length > 0) {
      detailStr += `\n🔩 *Repuestos / Insumos:*\n`;
      expenses.forEach(exp => {
        detailStr += `${exp.description}: $${exp.amount.toLocaleString('es-CL')}\n`;
      });
    }

    // New specific variables
    const marcaModelo = `${service.brand} ${service.model}`;
    const fechaActual = new Date().toLocaleDateString('es-CL');

    const vehicleInfo = `🚗 ${service.brand} ${service.model}\n🔢 Patente: ${service.plate}\n📅 Fecha: ${new Date(service.entryDate).toLocaleDateString()}`;

    let msg = settings.whatsappServiceTemplate;
    msg = msg.replace(/{taller}/g, settings.companyName);
    msg = msg.replace(/{cliente}/g, service.clientName);
    
    // New placeholders
    msg = msg.replace(/{marca_modelo}/g, marcaModelo);
    msg = msg.replace(/{patente}/g, service.plate);
    msg = msg.replace(/{fecha}/g, fechaActual);

    // Legacy fallback
    msg = msg.replace(/{vehiculo}/g, vehicleInfo);
    
    msg = msg.replace(/{estado}/g, getStatusLabel(service.status).toUpperCase());
    msg = msg.replace(/{total}/g, total.toLocaleString('es-CL'));
    msg = msg.replace(/{abono}/g, (service.advance || 0).toLocaleString('es-CL'));
    msg = msg.replace(/{saldo}/g, remaining.toLocaleString('es-CL'));
    msg = msg.replace(/{detalle}/g, detailStr);

    return { text: msg, phone: cleanPhone };
  };

  const openPrintPreview = (service: Service) => {
    setPrintService(service);
    setIsPrintViewOpen(true);
  };

  const handleWhatsAppClick = (service: Service) => {
    const { text, phone } = generateWhatsAppText(service);
    if (!phone) return alert("No hay teléfono registrado.");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (typeof html2pdf === 'undefined') {
      alert('La librería PDF no se ha cargado. Por favor use el botón de Imprimir.');
      return;
    }
    
    const element = document.getElementById('printable-service');
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

    const opt = {
      margin: 0,
      filename: `Orden_${printService?.plate}_${printService?.id}.pdf`,
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

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for photo uploads */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={cameraInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />
      <input 
        type="file" 
        accept="image/*" 
        ref={galleryInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />

      <div className="flex flex-col gap-4">
        {/* ... (Existing view header, no changes) ... */}
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-3">
             <h2 className="text-2xl font-bold text-white">{showHistory ? 'Historial' : 'Activos'}</h2>
             {showHistory && (
               <div className="relative history-filter-container">
                 <button onClick={() => setIsHistoryFilterOpen(!isHistoryFilterOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 transition-colors text-sm font-medium text-slate-300">
                   <Filter size={14} />{historyFilter === 'completed' ? 'Completados' : 'Cancelados'}<ChevronDown size={14} className={`transition-transform duration-200 ${isHistoryFilterOpen ? 'rotate-180' : ''}`} />
                 </button>
                 {isHistoryFilterOpen && (
                   <div className="absolute top-full left-0 mt-2 w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
                      <button onClick={() => { setHistoryFilter('completed'); setIsHistoryFilterOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-700 ${historyFilter === 'completed' ? 'text-green-500 font-bold bg-slate-700/50' : 'text-slate-300'}`}><CheckCircle size={14} /> Completados</button>
                      <button onClick={() => { setHistoryFilter('cancelled'); setIsHistoryFilterOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-700 ${historyFilter === 'cancelled' ? 'text-red-400 font-bold bg-slate-700/50' : 'text-slate-300'}`}><Ban size={14} /> Cancelados</button>
                   </div>
                 )}
               </div>
             )}
           </div>
           <div className="flex items-center gap-2">
             <div className={`flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all duration-300 ease-in-out ${searchOpen ? 'w-48 sm:w-64' : 'w-10'}`}>
                <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchTerm(''); }} className="p-2 text-slate-400 hover:text-white shrink-0">{searchOpen ? <X size={20} /> : <Search size={20} />}</button>
                <input ref={searchInputRef} type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`bg-transparent border-none outline-none text-white text-sm w-full pr-3 ${!searchOpen && 'hidden'}`} />
             </div>
             {!showHistory && (
               <div className="bg-slate-800 rounded-lg p-1 border border-slate-700 flex">
                 <button onClick={() => setIsCompact(false)} className={`p-1.5 rounded transition-colors ${!isCompact ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Vista Expandida"><LayoutGrid size={18} /></button>
                 <button onClick={() => setIsCompact(true)} className={`p-1.5 rounded transition-colors ${isCompact ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Vista Compacta"><Rows size={18} /></button>
               </div>
             )}
           </div>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => setShowHistory(!showHistory)} className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors border ${showHistory ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}>
            {showHistory ? <ArrowRight size={18} /> : <History size={18} />}{showHistory ? 'Volver a Activos' : 'Ver Historial'}
          </button>
          {!showHistory && (
            <div className="flex-1 flex gap-2">
                {hasDraft && (
                  <button onClick={loadDraft} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg animate-fade-in" title="Recuperar trabajo no guardado">
                    <FilePenLine size={20} /> <span className="hidden sm:inline">Continuar Borrador</span>
                    <div onClick={discardDraft} className="p-1 hover:bg-yellow-800 rounded-full ml-1" title="Descartar borrador"><X size={14}/></div>
                  </button>
                )}
                <button onClick={() => { setIsModalOpen(true); resetForm(); }} className={`flex-1 ${getButtonColor()} text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg`}><Plus size={20} />Crear</button>
            </div>
          )}
        </div>
      </div>

      {/* ... (Existing services lists) ... */}
      
      {!showHistory && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {displayedServices.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">No hay servicios activos.</div>
          ) : (
            displayedServices.map((service) => {
              const isExpanded = expandedServiceId === service.id;
              const total = calculateTotal(service);
              const remaining = total - (service.advance || 0);
              return (
                <div key={service.id} onClick={() => toggleExpandCard(service.id)} className={`bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-300 group relative flex flex-col cursor-pointer overflow-hidden z-10 shadow-lg shadow-slate-900/20 ${isExpanded ? 'row-span-2' : ''}`}>
                  <div className="p-4 flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1"><h3 className="text-lg font-bold text-white truncate">{service.brand} {service.model}</h3>{!isExpanded && (<div className={`w-2 h-2 rounded-full ${service.status === 'completed' ? 'bg-green-500' : service.status === 'in-progress' ? 'bg-blue-500' : service.status === 'cancelled' ? 'bg-slate-500' : 'bg-yellow-500'}`} />)}</div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-sm"><User size={14} className="shrink-0" /><span className="truncate">{service.clientName}</span></div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 font-mono"><Tag size={12} className="shrink-0" /><span>{service.plate}</span></div>
                    </div>
                    <div className="relative status-dropdown-container shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setActiveStatusDropdown(activeStatusDropdown === service.id ? null : service.id); }} className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${getStatusColor(service.status)}`}>{getStatusLabel(service.status)}<ChevronDown size={12} /></button>
                      {activeStatusDropdown === service.id && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(service.id, 'pending'); }} className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-slate-700 flex items-center gap-2"><Clock size={14} /> Pendiente</button>
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(service.id, 'in-progress'); }} className="w-full text-left px-4 py-2 text-sm text-blue-500 hover:bg-slate-700 flex items-center gap-2"><RotateCcw size={14} /> En Proceso</button>
                          <div className="border-t border-slate-700 my-1"></div>
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(service.id, 'completed'); }} className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-slate-700 flex items-center gap-2"><CheckCircle size={14} /> Completado</button>
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(service.id, 'cancelled'); }} className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center gap-2"><Ban size={14} /> Cancelado</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in space-y-4 border-t border-slate-700/50 pt-4 cursor-default" onClick={(e) => e.stopPropagation()}>
                      <div><span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Motivo del trabajo</span><div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-slate-300 text-sm leading-relaxed">{service.reason}</div></div>
                      
                      {/* Photo Section for Active Services */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Evidencia Fotográfica</span>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <button onClick={(e) => { e.stopPropagation(); triggerCamera(service.id); }} className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                <Camera size={16} /> <span className="text-xs font-bold">Cámara</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); triggerGallery(service.id); }} className="flex-1 bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 border border-slate-600/30 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                <ImageIcon size={16} /> <span className="text-xs font-bold">Galería</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {service.photos && service.photos.length > 0 ? (
                                service.photos.map((photo, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 group/photo bg-slate-900">
                                        <img src={photo} alt="Evidencia" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); openPhotoGallery(service); }}/>
                                        <button onClick={(e) => { e.stopPropagation(); deletePhoto(service.id, idx); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover/photo:opacity-100 hover:bg-red-600 hover:text-white transition-all"><X size={12}/></button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-3 sm:col-span-4 text-xs text-slate-500 italic bg-slate-900/30 p-4 rounded-lg border border-dashed border-slate-800 text-center">Sin fotos adjuntas</div>
                            )}
                        </div>
                      </div>

                      <div>
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Desglose Financiero</span>
                         <div className="bg-slate-900/30 rounded-lg border border-slate-700/30 overflow-hidden text-sm">
                            <div className="bg-blue-500/5 p-2 border-b border-slate-700/30 flex justify-between items-center"><span className="text-blue-400 font-bold text-xs uppercase flex items-center gap-1"><Hammer size={12}/> Mano de Obra</span></div>
                            {service.laborItems && service.laborItems.length > 0 ? (
                               service.laborItems.map((item, idx) => (
                                 <div key={idx} className="flex justify-between p-2 border-b border-slate-700/30 text-xs"><span className="text-slate-300 pl-2">{item.description}</span><span className="text-slate-200">${formatCLP(item.amount)}</span></div>
                               ))
                            ) : (
                               <div className="flex justify-between p-2 border-b border-slate-700/30 text-xs"><span className="text-slate-300 pl-2">Mano de Obra Base</span><span className="text-slate-200">${formatCLP(service.price)}</span></div>
                            )}
                            {service.expenses && service.expenses.length > 0 && (
                               <>
                                 <div className="bg-orange-500/5 p-2 border-b border-slate-700/30 border-t border-slate-700/30 flex justify-between items-center"><span className="text-orange-400 font-bold text-xs uppercase flex items-center gap-1"><Box size={12}/> Repuestos y Terceros</span></div>
                                 {service.expenses.map((exp, idx) => (
                                    <div key={idx} className="flex justify-between p-2 border-b border-slate-700/30 last:border-0 text-xs"><span className="text-slate-300 pl-2">{exp.description}</span><span className="text-slate-200">${formatCLP(exp.amount)}</span></div>
                                 ))}
                               </>
                            )}
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50"><span className="text-xs text-slate-500 block">Total Final</span><span className="text-base font-bold text-white">${formatCLP(total)}</span></div>
                         <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50"><span className="text-xs text-slate-500 block">Saldo Pendiente</span><span className={`text-base font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-500'}`}>${formatCLP(remaining)}</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/50">
                         <button onClick={(e) => { e.stopPropagation(); handleEditClick(service); }} className={`${getButtonColor()} text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2`}><Edit size={16} /> Editar</button>
                         <button onClick={(e) => { e.stopPropagation(); if(window.confirm('¿Cancelar servicio?')) { handleStatusChange(service.id, 'cancelled'); } }} className="bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-red-500/20 hover:border-red-600"><Ban size={16} /> Cancelar</button>
                         <button onClick={(e) => { e.stopPropagation(); toggleExpandCard(service.id); }} className="col-span-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center"><ChevronUp size={20} /></button>
                      </div>
                    </div>
                  )}
                  {!isExpanded && (
                    <div className="px-4 py-3 mt-auto border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                       <div className="flex flex-col"><span className="text-xs text-slate-500">Total</span><span className="text-lg font-bold text-white tracking-tight">${formatCLP(total)}</span></div>
                       <div className="flex gap-2">
                         <button onClick={(e) => { e.stopPropagation(); openPrintPreview(service); }} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><FileText size={20} /></button>
                         <button onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(service); }} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-600 hover:text-white rounded-lg transition-colors border border-green-500/20"><MessageCircle size={20} /></button>
                       </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showHistory && (
        <div className="space-y-4">
          {displayedServices.length === 0 ? (
             <div className="py-12 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">No hay servicios en el historial.</div>
          ) : (
             <div className="space-y-3">
               {displayedServices.map((service) => (
                 <div key={service.id} className={`bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-500 hover:shadow-lg transition-all flex flex-col md:flex-row md:items-center gap-4 group ${service.status === 'cancelled' ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <div className="flex items-start gap-4 flex-1 cursor-pointer" onClick={() => handleEditClick(service)}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${service.status === 'cancelled' ? 'bg-slate-700 text-slate-500' : 'bg-slate-700 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}>{service.status === 'cancelled' ? <Ban size={24} /> : <Car size={24} />}</div>
                      <div className="space-y-1">
                         <div className="flex items-center gap-2 flex-wrap"><h3 className={`font-bold text-lg ${service.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-white'}`}>{service.brand} {service.model}</h3><span className="text-xs bg-slate-900 border border-slate-600 px-2 py-0.5 rounded text-slate-300 font-mono">{service.plate}</span></div>
                         <div className="text-sm text-slate-400 flex items-center gap-1.5"><User size={14} /> {service.clientName}</div>
                      </div>
                    </div>
                    <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 text-right shrink-0">
                       <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-lg"><Calendar size={12} />{new Date(service.entryDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                       <div className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${service.status === 'cancelled' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>{service.status === 'cancelled' ? <Ban size={10} /> : <CheckCircle size={10} />}{service.status === 'cancelled' ? 'Cancelado' : 'Completado'}</div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-4 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-slate-700 w-full md:w-auto">
                       <div className="text-right"><div className="text-xs text-slate-500 uppercase tracking-wider">Total</div><div className="text-xl font-bold text-white">${calculateTotal(service).toLocaleString('es-CL')}</div></div>
                       <div className="flex gap-2">
                          {service.status === 'cancelled' && (<button onClick={() => { if(window.confirm('¿Deseas reactivar este servicio?')) { handleStatusChange(service.id, 'pending'); } }} className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white border border-slate-600" title="Reactivar"><RefreshCw size={20} /></button>)}
                          <button onClick={(e) => { e.stopPropagation(); openPhotoGallery(service); }} className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-orange-400 hover:bg-orange-600 hover:text-white border border-slate-600 relative" title="Fotos">
                              <ImageIcon size={20} />
                              {service.photos && service.photos.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{service.photos.length}</span>}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(service); }} className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-green-500 hover:bg-green-600 hover:text-white border border-slate-600" title="Enviar WhatsApp"><MessageCircle size={20} /></button>
                          <button onClick={() => openPrintPreview(service)} className={`w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600 ${service.status !== 'cancelled' ? 'hover:bg-blue-600 hover:text-white' : ''}`} title="Ver PDF"><FileText size={20} /></button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      {/* Completion Modal */}
      {isCompletionModalOpen && serviceToComplete && (
        <div className="relative z-50">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsCompletionModalOpen(false)} />
          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
             <div className="bg-slate-900 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-6">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">Confirmar Término</h3>
                      <button onClick={() => setIsCompletionModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                   </div>
                   
                   <p className="text-slate-400 text-sm mb-4">
                      Estás finalizando el servicio para <span className="font-bold text-white">{serviceToComplete.brand} {serviceToComplete.model}</span>. 
                      Confirma la fecha de pago del saldo restante.
                   </p>

                   <div className="space-y-4 mb-6">
                      <div>
                         <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fecha de Término (Saldo)</label>
                         <input 
                            type="date" 
                            value={completionDate} 
                            onChange={(e) => setCompletionDate(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none"
                         />
                      </div>
                      
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Total Servicio</span>
                            <span className="text-white font-medium">${calculateTotal(serviceToComplete).toLocaleString('es-CL')}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Abonado (Pagado)</span>
                            <span className="text-green-400 font-medium">-${(serviceToComplete.advance || 0).toLocaleString('es-CL')}</span>
                         </div>
                         <div className="border-t border-slate-700 my-1 pt-1 flex justify-between">
                            <span className="text-slate-300 font-bold">Saldo Final</span>
                            <span className="text-white font-bold text-lg">${(calculateTotal(serviceToComplete) - (serviceToComplete.advance || 0)).toLocaleString('es-CL')}</span>
                         </div>
                      </div>
                   </div>

                   <button 
                      onClick={confirmCompletion}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                   >
                      <CheckCircle size={18} /> Confirmar y Finalizar
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Modal (For History and Detail View) */}
      {isPhotoModalOpen && viewingPhotoService && (
        <div className="relative z-[60]">
           <div className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={() => setIsPhotoModalOpen(false)} />
           <div className="fixed inset-0 z-[70] flex flex-col p-4">
              <div className="flex justify-between items-center mb-4 shrink-0">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><ImageIcon size={24} className="text-blue-500"/> Galería: {viewingPhotoService.brand} {viewingPhotoService.plate}</h3>
                 <button onClick={() => setIsPhotoModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                  {(!viewingPhotoService.photos || viewingPhotoService.photos.length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                          <Camera size={48} className="opacity-20"/>
                          <p>No hay fotos registradas para este servicio.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {viewingPhotoService.photos.map((photo, idx) => (
                              <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-black border border-slate-800 shadow-xl">
                                  <img src={photo} className="w-full h-full object-contain" alt={`Foto ${idx+1}`} />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button onClick={() => sharePhoto(photo, idx)} className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500" title="Compartir"><Share2 size={20}/></button>
                                      <a href={photo} download={`evidencia_${viewingPhotoService.plate}_${idx}.jpg`} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500" title="Descargar"><Download size={20}/></a>
                                      <button onClick={() => deletePhoto(viewingPhotoService.id, idx)} className="p-2 bg-red-600 rounded-full text-white hover:bg-red-500" title="Borrar"><Trash2 size={20}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              <div className="mt-4 shrink-0 flex justify-center gap-4">
                   <button onClick={() => triggerCamera(viewingPhotoService.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/50 transition-all active:scale-95">
                       <Camera size={20} />
                       <span>Cámara</span>
                   </button>
                   <button onClick={() => triggerGallery(viewingPhotoService.id)} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                       <ImageIcon size={20} />
                       <span>Galería</span>
                   </button>
              </div>
           </div>
        </div>
      )}

      {isPrintViewOpen && printService && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col print-modal">
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center shrink-0 print:hidden z-50">
             <div className="flex items-center gap-3"><button onClick={() => setIsPrintViewOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button><span className="text-white font-bold">Vista Previa</span></div>
             <div className="flex gap-2">
                <button onClick={() => handleWhatsAppClick(printService)} className="px-3 py-2 bg-green-600 text-white rounded-lg border border-green-500 hover:bg-green-700 font-bold flex items-center gap-2 shadow-lg shadow-green-900/20"><MessageCircle size={18} /><span className="hidden sm:inline">Enviar WhatsApp</span></button>
                <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                   {isGeneratingPdf ? 'Generando...' : <><Download size={18} /> <span className="hidden sm:inline">Descargar PDF</span></>}
                </button>
                <button onClick={() => window.print()} className={`px-4 py-2 ${getButtonColor()} text-white rounded-lg font-bold flex items-center gap-2`}><Printer size={18} /> <span className="hidden sm:inline">Imprimir</span></button>
             </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-950 p-4 flex justify-center items-start print:p-0 print:overflow-visible print:block" ref={previewContainerRef}>
             <div id="printable-service" className="bg-white text-black shadow-2xl origin-top print:shadow-none print:transform-none" style={{ width: '210mm', minHeight: '297mm', transform: `scale(${scale})`, marginBottom: `${(297 * scale) - 297}mm` }}>
                <div className="p-12 h-full flex flex-col relative box-border print:p-0 print:m-12">
                   <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                      <div className="flex items-start gap-4">
                         {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg bg-white" />
                         ) : (
                            <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-lg print:border print:border-slate-900 print:text-slate-900 print:bg-white"><Car size={32} /></div>
                         )}
                         <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{settings.companyName}</h1>
                            <div className="mt-2 text-xs text-slate-500 space-y-0.5"><p>{settings.companyAddress}</p><p>{settings.companyPhone}</p></div>
                         </div>
                      </div>
                      <div className="text-right"><h2 className="text-3xl font-bold text-slate-800 uppercase tracking-wide">ORDEN DE TRABAJO</h2><div className="mt-2"><span className="inline-block px-3 py-1 rounded border border-slate-900 text-slate-900 text-sm font-bold uppercase">{getStatusLabel(printService.status)}</span></div><p className="text-slate-500 text-sm mt-2">Fecha: {new Date(printService.entryDate).toLocaleDateString()}</p></div>
                   </div>
                   
                   <div className="flex justify-between gap-10 mb-8 items-start">
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 border-b-2 border-slate-800 pb-1 mb-3 text-sm uppercase tracking-wide">Información del Cliente</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr>
                                        <td className="font-bold text-slate-600 py-1 w-24">Nombre:</td>
                                        <td className="text-slate-900 py-1">{printService.clientName}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-slate-600 py-1">Teléfono:</td>
                                        <td className="text-slate-900 py-1">{printService.phone}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 border-b-2 border-slate-800 pb-1 mb-3 text-sm uppercase tracking-wide">Información del Vehículo</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr>
                                        <td className="font-bold text-slate-600 py-1 w-24">Marca:</td>
                                        <td className="text-slate-900 py-1 uppercase">{printService.brand}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-slate-600 py-1">Modelo:</td>
                                        <td className="text-slate-900 py-1 uppercase">{printService.model}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-slate-600 py-1">Patente:</td>
                                        <td className="text-slate-900 py-1 font-mono uppercase">{printService.plate}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                   </div>

                   <div className="mb-8"><h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Trabajo Solicitado</h3><div className="p-4 bg-slate-50 border border-slate-200 rounded text-slate-800 print:bg-transparent print:border-slate-300">{printService.reason}</div></div>
                   <div className="flex-1">
                     <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider border-b border-slate-200 pb-1">Detalle de Costos</h3>
                     <table className="w-full mb-8 border-collapse">
                        <tbody className="text-sm">
                           {printService.laborItems && printService.laborItems.length > 0 ? (
                              <><tr className="bg-slate-100 print:bg-slate-100"><td colSpan={2} className="py-1 px-2 font-bold text-xs uppercase text-slate-500">Servicios / Mano de Obra</td></tr>{printService.laborItems.map((item, idx) => (<tr key={`l-${idx}`} className="border-b border-slate-200"><td className="py-2 px-2 text-slate-800 pl-4">{item.description}</td><td className="py-2 px-2 text-right font-medium text-slate-900">${formatCLP(item.amount)}</td></tr>))}</>
                           ) : (
                              <tr className="border-b border-slate-200"><td className="py-2 px-2 font-medium text-slate-800">Mano de Obra Base</td><td className="py-2 px-2 text-right font-bold text-slate-900">${formatCLP(printService.price)}</td></tr>
                           )}
                           {printService.expenses && printService.expenses.length > 0 && (
                              <><tr className="bg-slate-100 print:bg-slate-100"><td colSpan={2} className="py-1 px-2 font-bold text-xs uppercase text-slate-500 mt-2">Repuestos y Terceros</td></tr>{printService.expenses.map((exp, idx) => (<tr key={`e-${idx}`} className="border-b border-slate-200"><td className="py-2 px-2 text-slate-600 pl-4">{exp.description}</td><td className="py-2 px-2 text-right text-slate-900">${formatCLP(exp.amount)}</td></tr>))}</>
                           )}
                        </tbody>
                     </table>
                   </div>

                   {/* PDF Images Section */}
                   {printService.photos && printService.photos.length > 0 && (
                       <div className="mb-8 break-inside-avoid">
                           <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider border-b border-slate-200 pb-1">Evidencia Fotográfica</h3>
                           <div className="grid grid-cols-2 gap-4">
                               {printService.photos.map((photo, idx) => (
                                   <div key={idx} className="border border-slate-200 p-2 rounded-lg flex items-center justify-center h-64 bg-slate-50">
                                       <img 
                                           src={photo} 
                                           className="max-w-full max-h-full w-auto h-auto object-contain shadow-sm" 
                                           alt="Evidencia" 
                                       />
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   <div className="flex flex-row justify-end items-start mb-16 break-inside-avoid">
                      <div className="w-64">
                         <div className="flex justify-between py-2 text-sm text-slate-600"><span>Subtotal</span><span>${formatCLP(calculateTotal(printService))}</span></div>
                         {(printService.advance || 0) > 0 && (<div className="flex justify-between py-2 text-sm text-green-600 font-medium border-b border-slate-200"><span>Abono / Adelanto</span><span>-${formatCLP(printService.advance)}</span></div>)}
                         <div className="flex justify-between py-3 border-t-2 border-slate-800 text-slate-900 mt-2"><span className="font-bold text-xl">TOTAL A PAGAR</span><span className="font-bold text-xl">${formatCLP(calculateTotal(printService) - (printService.advance || 0))}</span></div>
                      </div>
                   </div>
                   <div className="mt-auto pt-10 break-inside-avoid">
                      <div className="mb-8 text-right pr-4">
                         <p className="text-sm font-bold text-slate-800 uppercase flex items-center justify-end gap-2"><UserCog size={16}/> Mecánico Responsable: {MECHANIC_NAME}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-20 mb-10"><div className="text-center"><div className="border-b border-slate-400 mb-2 h-10"></div><p className="text-sm font-bold text-slate-700">Firma Taller</p></div><div className="text-center"><div className="border-b border-slate-400 mb-2 h-10"></div><p className="text-sm font-bold text-slate-700">Firma Cliente</p></div></div>
                      <div className="border-t border-slate-200 pt-4 flex justify-between text-[10px] text-slate-400"><p>Gracias por su preferencia.</p><p>Generado por TallerManager</p></div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <div className="relative transform rounded-2xl bg-slate-900 text-left shadow-xl transition-all sm:my-8 w-full max-w-2xl border border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
                  <h3 className="text-xl font-bold text-white">{showHistory ? 'Detalles' : isEditing ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <form onSubmit={handleSaveService} className="p-6 space-y-6">
                  {/* ... (Existing form content) ... */}
                  <div className="space-y-4">
                    <div className="space-y-2 relative" ref={dropdownRef}>
                      <div className="flex justify-between items-center"><label className="text-sm font-medium text-slate-300 flex items-center gap-2"><FileText size={16} /> Patente <span className="text-red-500">*</span></label>{foundExistingCar && !isEditing && (<button type="button" onClick={clearAutoFill} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1"><RotateCcw size={12} /> Limpiar</button>)}</div>
                      <input required name="plate" type="text" className={`w-full bg-slate-900 border ${foundExistingCar ? 'border-green-500/50' : 'border-slate-700'} rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none uppercase font-mono tracking-wider`} placeholder="XX XX 00" value={newService.plate || ''} onChange={handlePlateChange} onFocus={handleInputFocus} autoComplete="off" />
                      {showSuggestions && !isEditing && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {suggestions.map((suggestion, idx) => (
                            <button key={idx} type="button" onClick={() => selectSuggestion(suggestion)} className="w-full text-left px-4 py-3 hover:bg-slate-700 flex justify-between items-center group transition-colors border-b border-slate-700/50 last:border-0">
                              <div><span className="font-mono font-bold text-white block">{suggestion.plate}</span><span className="text-xs text-slate-400 group-hover:text-slate-300">{suggestion.brand} {suggestion.model}</span></div><div className="text-right"><span className="text-xs text-blue-400 block">{suggestion.clientName}</span></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 relative" ref={brandDropdownRef}>
                        <label className="text-sm font-medium text-slate-300">Marca</label>
                        <input name="brand" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" value={newService.brand || ''} onChange={handleBrandChange} onFocus={handleInputFocus} autoComplete="off" />
                        {showBrandSuggestions && (
                          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {brandSuggestions.map((brand, idx) => (
                              <button key={idx} type="button" onClick={() => selectBrand(brand)} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 hover:text-white border-b border-slate-700/50">{brand}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Modelo</label><input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" value={newService.model || ''} onChange={e => setNewService({...newService, model: e.target.value})} onFocus={handleInputFocus} /></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Cliente</label><input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" value={newService.clientName || ''} onChange={e => setNewService({...newService, clientName: e.target.value})} onFocus={handleInputFocus} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium text-slate-300">WhatsApp</label><input type="tel" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" value={newService.phone || ''} onChange={e => setNewService({...newService, phone: e.target.value})} onFocus={handleInputFocus} /></div>
                     </div>
                     <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Motivo del trabajo</label><textarea rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none resize-none" value={newService.reason || ''} onChange={e => setNewService({...newService, reason: e.target.value})} onFocus={handleInputFocus} /></div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide"><Hammer size={16} /> Servicios / Mano de Obra</label>
                      <div className="flex gap-2">
                         <input type="text" placeholder="Ej: Cambio de aceite" className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none" value={tempLabor.description} onChange={(e) => setTempLabor({...tempLabor, description: e.target.value})} />
                         <input type="text" inputMode="numeric" placeholder="$ Monto" className="w-24 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none" value={tempLabor.amount === '' ? '' : formatCLP(parseInt(tempLabor.amount.replace(/\./g, '')))} onChange={(e) => { const val = e.target.value.replace(/\./g, '').replace(/\D/g, ''); setTempLabor({...tempLabor, amount: val}); }} />
                         <button type="button" onClick={handleAddLabor} className={`${getButtonColor()} text-white p-2 rounded-lg transition-colors`}><Plus size={18} /></button>
                      </div>
                      {newService.laborItems && newService.laborItems.length > 0 && (
                        <div className="space-y-2 bg-slate-800/50 p-2 rounded-lg max-h-32 overflow-y-auto border border-slate-700/30">
                          {newService.laborItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-sm p-1.5 bg-slate-700/30 rounded border border-slate-700/50"><div className="flex-1 truncate pr-2 text-slate-300">{item.description}</div><div className="flex items-center gap-3"><span className="text-blue-300 font-mono">${formatCLP(item.amount)}</span><button type="button" onClick={() => removeLabor(item.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></div></div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 pt-4 border-t border-slate-700/30">
                      <label className="text-sm font-bold text-orange-400 flex items-center gap-2 uppercase tracking-wide"><Box size={16} /> Repuestos / Terceros</label>
                      <div className="flex gap-2">
                         <input type="text" placeholder="Ej: Rectificadora, Repuestos..." className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white focus:border-orange-500 outline-none" value={tempExpense.description} onChange={(e) => setTempExpense({...tempExpense, description: e.target.value})} />
                         <input type="text" inputMode="numeric" placeholder="$ Monto" className="w-24 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white focus:border-orange-500 outline-none" value={tempExpense.amount === '' ? '' : formatCLP(parseInt(tempExpense.amount.replace(/\./g, '')))} onChange={(e) => { const val = e.target.value.replace(/\./g, '').replace(/\D/g, ''); setTempExpense({...tempExpense, amount: val}); }} />
                         <button type="button" onClick={handleAddExpense} className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded-lg transition-colors"><Plus size={18} /></button>
                      </div>
                      {newService.expenses && newService.expenses.length > 0 && (
                        <div className="space-y-2 bg-slate-800/50 p-2 rounded-lg max-h-32 overflow-y-auto border border-slate-700/30">
                          {newService.expenses.map((expense) => (
                            <div key={expense.id} className="flex justify-between items-center text-sm p-1.5 bg-slate-700/30 rounded border border-slate-700/50"><div className="flex-1 truncate pr-2 text-slate-300">{expense.description}</div><div className="flex items-center gap-3"><span className="text-orange-300 font-mono">${formatCLP(expense.amount)}</span><button type="button" onClick={() => removeExpense(expense.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></div></div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pt-4 border-t border-slate-700 flex justify-between items-center"><span className="text-sm text-slate-400">Total Final (Servicios + Repuestos)</span><span className="text-xl font-bold text-white">${formatCLP(calculateTotal(newService))}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Abono Cliente</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span><input type="text" inputMode="numeric" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-8 text-white focus:border-blue-500 focus:outline-none" value={newService.advance === 0 ? '' : formatCLP(newService.advance)} onChange={(e) => handleCurrencyChange(e, 'advance')} onFocus={handleInputFocus} /></div></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Fecha Ingreso</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" value={newService.entryDate ? new Date(newService.entryDate).toISOString().split('T')[0] : ''} onChange={e => setNewService({...newService, entryDate: e.target.value})} onFocus={handleInputFocus} /></div>
                  </div>
                  <div className="pt-4 flex gap-4 justify-end shrink-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">Cerrar</button>
                    <button type="submit" className={`px-6 py-2 rounded-lg ${getButtonColor()} text-white font-medium transition-colors shadow-lg`}>{isEditing || showHistory ? 'Guardar Cambios' : 'Guardar Servicio'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}