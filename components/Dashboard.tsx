import React, { useState, useMemo } from 'react';
import { Service, Cost, ServicePayment } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Users, CheckCircle, ArrowLeft, Calendar, Activity, Wallet, FileText, Trophy, Car, Filter, Clock, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

interface DashboardProps {
  services: Service[];
  costs: Cost[];
}

type TimeFilter = 'week' | 'month' | 'all' | 'specific-month';
type DetailViewType = 'income' | 'costs' | null;

const Dashboard: React.FC<DashboardProps> = ({ services, costs }) => {
  const [detailView, setDetailView] = useState<DetailViewType>(null);
  
  // Drilldown Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  // --- CHART FILTERS STATE ---
  const [chartMode, setChartMode] = useState<'last_6_months' | 'year' | 'month'>('last_6_months');
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState(new Date().getMonth());

  // --- Helpers for Selectors ---
  const availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const shortMonthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Helper to safely format dates avoiding timezone shifts
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '-';
    // If it's a full ISO string (has time), use locale string
    if (dateStr.includes('T')) {
       return new Date(dateStr).toLocaleDateString('es-CL');
    }
    // If it is YYYY-MM-DD, parse manually to avoid UTC offset issues
    const parts = dateStr.split('-');
    if (parts.length === 3) {
       return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('es-CL');
  };

  // --- Helper to calculate total service cost for legacy support ---
  const calculateServiceTotal = (s: Service) => {
    const labor = (s.laborItems || []).reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = (s.expenses || []).reduce((acc, curr) => acc + curr.amount, 0);
    // Fallback if no labor items but price exists
    const baseLabor = labor === 0 && s.price > 0 ? s.price : labor; 
    return baseLabor + expenses;
  };

  // --- Generate Financial Events (Income) ---
  // This flattens services into individual payment events for the dashboard
  const incomeEvents = useMemo(() => {
    const events: { id: string, date: string, amount: number, description: string, brand?: string, model?: string }[] = [];

    services.forEach(service => {
      // 1. Priority: Explicit Payments Array (New Logic)
      if (service.payments && service.payments.length > 0) {
        service.payments.forEach(p => {
          events.push({
            id: p.id,
            date: p.date, // This is the specific date (entry date or completion date)
            amount: p.amount,
            description: p.description,
            brand: service.brand,
            model: service.model
          });
        });
      } 
      // 2. Fallback: Legacy Logic (No payments array)
      else {
        // A. Always count the Advance (Abono)
        // We assume the advance was paid on the entry date
        if (service.advance && service.advance > 0) {
          events.push({
            id: `${service.id}-advance`,
            date: service.entryDate,
            amount: service.advance,
            description: `Adelanto ${service.plate}`,
            brand: service.brand,
            model: service.model
          });
        }

        // B. Only count the Balance if the service is COMPLETED
        if (service.status === 'completed') {
          const total = calculateServiceTotal(service);
          const balance = total - (service.advance || 0);
          
          if (balance > 0) {
            // For legacy items without specific payment dates, we default to entryDate
            // (or ideally a completion date if we had tracked it historically)
            events.push({
              id: `${service.id}-final`,
              date: service.entryDate, // Using entry date as fallback for legacy completion
              amount: balance,
              description: `Saldo Final ${service.plate}`,
              brand: service.brand,
              model: service.model
            });
          }
        }
      }
    });
    return events;
  }, [services]);

  // --- Generate Last 12 Months (for Drilldown) ---
  const last12Months = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(d);
    }
    return months;
  }, []);

  // --- Summary Calculations (Global) ---
  const totalIncome = incomeEvents.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCosts = costs.reduce((acc, curr) => acc + curr.amount, 0);

  // --- CHART DATA LOGIC ---
  const trendData = useMemo(() => {
    const dataMap = new Map<string, { date: string, sortKey: number, income: number, expense: number }>();
    const now = new Date();
    
    let startDate: Date;
    let endDate: Date;
    let groupBy: 'day' | 'month' = 'day';

    // 1. Determine Date Range
    if (chartMode === 'last_6_months') {
        // From 6 months ago to today
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        startDate.setHours(0,0,0,0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
        endDate.setHours(23,59,59,999);
        groupBy = 'day';
    } else if (chartMode === 'year') {
        startDate = new Date(chartYear, 0, 1);
        endDate = new Date(chartYear, 11, 31, 23, 59, 59);
        groupBy = 'month';
    } else { // month
        startDate = new Date(chartYear, chartMonth, 1);
        endDate = new Date(chartYear, chartMonth + 1, 0, 23, 59, 59);
        groupBy = 'day';
    }

    // 2. Pre-fill for Year mode (ensure all months exist)
    if (groupBy === 'month') {
        for(let i=0; i<12; i++) {
             dataMap.set(i.toString(), { 
                 date: shortMonthNames[i], 
                 sortKey: i, 
                 income: 0, 
                 expense: 0 
             });
        }
    }

    // 3. Process Data
    const processItem = (dateStr: string, amount: number, type: 'income' | 'expense') => {
        const d = new Date(dateStr);
        // Fix for timezone issues when date string doesn't have time
        // If dateStr is YYYY-MM-DD, parsing it might default to UTC midnight, 
        // which could be prev day in local time. 
        // We will treat the date as local noon to be safe.
        if (dateStr.length === 10) { 
           d.setHours(12,0,0,0);
        }

        if (d < startDate || d > endDate) return;

        let key: string;
        let label: string;
        let sortKey: number;

        if (groupBy === 'month') {
            const m = d.getMonth();
            key = m.toString();
            label = shortMonthNames[m];
            sortKey = m;
        } else {
            // Group by day - use unique ISO string for key
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            key = day.toISOString();
            label = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
            sortKey = day.getTime();
        }

        if (!dataMap.has(key)) {
            dataMap.set(key, { date: label, sortKey, income: 0, expense: 0 });
        }
        
        const entry = dataMap.get(key)!;
        if (type === 'income') entry.income += amount;
        else entry.expense += amount;
    };

    incomeEvents.forEach(evt => processItem(evt.date, evt.amount, 'income'));
    costs.forEach(c => processItem(c.date, c.amount, 'expense'));

    return Array.from(dataMap.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [incomeEvents, costs, chartMode, chartYear, chartMonth]);

  // --- Top 3 Brands Logic ---
  const topBrands = useMemo(() => {
    const counts = services.reduce((acc, curr) => {
      acc[curr.brand] = (acc[curr.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([name, count], index) => ({ name, count, rank: index + 1 }));
  }, [services]);

  // --- Drilldown Filtering Logic ---
  const getFilteredData = () => {
    const now = new Date();
    // Reset hours to compare dates properly
    now.setHours(23, 59, 59, 999);
    
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isWithinFilter = (dateStr: string) => {
      const d = new Date(dateStr);
      // Fix timezone parsing for YYYY-MM-DD
      if(dateStr.length === 10) d.setHours(12,0,0,0);
      else d.setHours(12,0,0,0);

      if (timeFilter === 'all') return true;
      if (timeFilter === 'week') return d >= oneWeekAgo && d <= now;
      if (timeFilter === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      if (timeFilter === 'specific-month') {
        return d.getMonth() === selectedMonthDate.getMonth() && d.getFullYear() === selectedMonthDate.getFullYear();
      }
      return true;
    };

    if (detailView === 'income') {
      const filteredIncome = incomeEvents.filter(e => isWithinFilter(e.date));
      // Sort by date desc
      filteredIncome.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const total = filteredIncome.reduce((acc, s) => acc + s.amount, 0);
      return { items: filteredIncome, total, type: 'income' };
    } else {
      const filteredCosts = costs.filter(c => isWithinFilter(c.date));
      // Sort by date desc
      filteredCosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const total = filteredCosts.reduce((acc, c) => acc + c.amount, 0);
      return { items: filteredCosts, total, type: 'costs' };
    }
  };

  const filteredData = getFilteredData();

  const handleMonthSelect = (date: Date) => {
    setSelectedMonthDate(date);
    setTimeFilter('specific-month');
    setIsMonthDropdownOpen(false);
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // --- Card Component ---
  const StatCard = ({ title, value, icon: Icon, variant, onClick, isClickable }: any) => {
    const variants = {
      success: {
        wrapper: 'from-emerald-900/40 to-slate-900',
        border: 'border-emerald-500/30',
        iconBox: 'bg-emerald-500/20 text-emerald-400',
        text: 'text-white',
        subText: 'text-emerald-400/80',
        glow: 'group-hover:shadow-emerald-500/10'
      },
      danger: {
        wrapper: 'from-rose-900/40 to-slate-900',
        border: 'border-rose-500/30',
        iconBox: 'bg-rose-500/20 text-rose-400',
        text: 'text-white',
        subText: 'text-rose-400/80',
        glow: 'group-hover:shadow-rose-500/10'
      },
      info: {
        wrapper: 'from-blue-900/40 to-slate-900',
        border: 'border-blue-500/30',
        iconBox: 'bg-blue-500/20 text-blue-400',
        text: 'text-white',
        subText: 'text-blue-400/80',
        glow: 'group-hover:shadow-blue-500/10'
      },
      purple: {
        wrapper: 'from-violet-900/40 to-slate-900',
        border: 'border-violet-500/30',
        iconBox: 'bg-violet-500/20 text-violet-400',
        text: 'text-white',
        subText: 'text-violet-400/80',
        glow: 'group-hover:shadow-violet-500/10'
      }
    };

    const styles = variants[variant as 'success' | 'danger' | 'info' | 'purple'] || variants.info;

    return (
      <div 
        onClick={onClick}
        className={`relative overflow-hidden p-4 rounded-xl border ${styles.border} bg-gradient-to-br ${styles.wrapper} shadow-lg transition-all duration-300 group ${isClickable ? `cursor-pointer hover:scale-[1.01] ${styles.glow}` : ''}`}
      >
        <div className={`absolute -right-4 -bottom-4 opacity-10 transform -rotate-12 transition-transform duration-500 group-hover:scale-110 pointer-events-none ${styles.text}`}>
          <Icon size={80} />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
          </div>
          <div className={`p-2.5 rounded-lg ${styles.iconBox} shadow-inner`}>
            <Icon size={20} />
          </div>
        </div>
      </div>
    );
  };

  // --- Render Detail View (Drilldown) ---
  if (detailView) {
     const isIncome = detailView === 'income';
     const themeColor = isIncome ? 'emerald' : 'rose';
     
     // Determine filter label
     let filterLabel = 'Histórico Total';
     if (timeFilter === 'week') filterLabel = 'Última Semana';
     if (timeFilter === 'month') filterLabel = 'Este Mes';
     if (timeFilter === 'specific-month') filterLabel = capitalize(selectedMonthDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }));

     return (
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setDetailView(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
            <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></div>
            <span className="font-medium">Volver al Dashboard</span>
          </button>
        </div>
        
        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Summary Column */}
          <div className="lg:col-span-1 space-y-4">
             <div className={`p-6 rounded-2xl bg-gradient-to-br from-${themeColor}-900/40 to-slate-900 border border-${themeColor}-500/30 shadow-lg`}>
                <h3 className={`text-${themeColor}-400 font-bold uppercase tracking-wider text-sm mb-2`}>
                  {isIncome ? 'Total Ingresos' : 'Total Gastos'}
                </h3>
                <div className="text-4xl font-bold text-white mb-2">
                   ${filteredData.total.toLocaleString('es-CL')}
                </div>
                <div className="text-slate-400 text-sm flex items-center gap-2">
                   <Filter size={14} /> 
                   Filtro: {filterLabel}
                </div>
             </div>

             {/* Date Filters */}
             <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex flex-col gap-1 relative z-20">
                <button 
                  onClick={() => { setTimeFilter('week'); setIsMonthDropdownOpen(false); }}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${timeFilter === 'week' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                   <Clock size={16} /> Última Semana
                </button>
                <button 
                  onClick={() => { setTimeFilter('month'); setIsMonthDropdownOpen(false); }}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${timeFilter === 'month' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                   <Activity size={16} /> Este Mes (Actual)
                </button>

                {/* Dropdown for specific months */}
                <div className="relative">
                   <button 
                     onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                     className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between gap-3 ${timeFilter === 'specific-month' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                   >
                     <div className="flex items-center gap-3">
                       <Calendar size={16} /> 
                       {timeFilter === 'specific-month' ? capitalize(selectedMonthDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })) : 'Por Mes...'}
                     </div>
                     {isMonthDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                   </button>
                   
                   {isMonthDropdownOpen && (
                     <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 animate-fade-in">
                       {last12Months.map((date, idx) => (
                         <button
                           key={idx}
                           onClick={() => handleMonthSelect(date)}
                           className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0 ${
                             timeFilter === 'specific-month' && 
                             date.getMonth() === selectedMonthDate.getMonth() && 
                             date.getFullYear() === selectedMonthDate.getFullYear() 
                               ? 'text-blue-400 font-bold bg-slate-700/50' 
                               : 'text-slate-300'
                           }`}
                         >
                           {capitalize(date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))}
                         </button>
                       ))}
                     </div>
                   )}
                </div>

                <div className="border-t border-slate-700 my-1"></div>

                <button 
                  onClick={() => { setTimeFilter('all'); setIsMonthDropdownOpen(false); }}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${timeFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                   <TrendingUp size={16} /> Todo el Historial
                </button>
             </div>
          </div>

          {/* List Column */}
          <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {isIncome ? <Wallet size={20} className="text-emerald-500" /> : <TrendingDown size={20} className="text-rose-500" />}
                  Detalle de Movimientos
                </h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
                   {filteredData.items.length} registros
                </span>
             </div>
             
             <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-2">
               {filteredData.items.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p>No hay registros para este periodo.</p>
                 </div>
               ) : (
                 filteredData.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-900/30 hover:bg-slate-700/30 rounded-xl border border-slate-700/50 transition-colors group">
                       <div className={`p-3 rounded-full shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {isIncome ? <Users size={18} /> : <DollarSign size={18} />}
                       </div>
                       
                       <div className="flex-1 min-h-0">
                          <div className="font-medium text-white truncate">
                             {isIncome ? item.clientName || item.description : item.description}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                             {/* Fix: use formatDateSafe to prevent day shift */}
                             <span>{formatDateSafe(isIncome ? item.date : item.date)}</span>
                             {isIncome && item.brand && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                  <span className="uppercase">{item.brand} {item.model}</span>
                                </>
                             )}
                          </div>
                       </div>
                       
                       <div className="text-right">
                          <div className={`font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {isIncome ? '+' : '-'}${isIncome ? item.amount.toLocaleString('es-CL') : item.amount.toLocaleString('es-CL')}
                          </div>
                          {isIncome && (
                             <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pago Recibido</div>
                          )}
                       </div>
                    </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>
     );
  }

  // --- Render Default Dashboard ---
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white">Resumen General</h2>
        <p className="text-slate-400 text-sm">Vista rápida del estado de tu taller.</p>
      </div>

      {/* 2x2 Stats Grid (Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Row 1 */}
        <StatCard 
          title="Ingresos Totales" 
          value={`$${totalIncome.toLocaleString('es-CL')}`} 
          icon={Wallet} 
          variant="success"
          isClickable={true}
          onClick={() => { setDetailView('income'); setTimeFilter('month'); }}
        />
        <StatCard 
          title="Gastos Totales" 
          value={`$${totalCosts.toLocaleString('es-CL')}`} 
          icon={TrendingDown} 
          variant="danger"
          isClickable={true}
          onClick={() => { setDetailView('costs'); setTimeFilter('month'); }}
        />
        
        {/* Row 2 */}
        <StatCard 
          title="Clientes Activos" 
          value={services.length.toString()} 
          icon={Users} 
          variant="info"
        />
        <StatCard 
          title="Servicios Listos" 
          value={services.filter(s => s.status === 'completed').length.toString()} 
          icon={CheckCircle} 
          variant="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Financial Trends */}
        <div className="lg:col-span-2 bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
               <Activity className="text-blue-500" size={20} /> Tendencia Financiera
            </h3>
            
            {/* Chart Filters Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select 
                  value={chartMode} 
                  onChange={(e) => setChartMode(e.target.value as any)}
                  className="bg-slate-900 border border-slate-600 rounded-lg py-1.5 pl-3 pr-8 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="last_6_months">Últimos 6 Meses</option>
                  <option value="year">Por Año</option>
                  <option value="month">Por Mes</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>

              {chartMode !== 'last_6_months' && (
                <div className="relative">
                  <select
                    value={chartYear}
                    onChange={(e) => setChartYear(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded-lg py-1.5 pl-3 pr-8 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              )}

              {chartMode === 'month' && (
                <div className="relative">
                   <select
                    value={chartMonth}
                    onChange={(e) => setChartMonth(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded-lg py-1.5 pl-3 pr-8 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer w-24"
                   >
                     {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                   </select>
                   <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={14} />
                   </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} minTickGap={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                  formatter={(value: number) => [`$${value.toLocaleString('es-CL')}`, '']}
                />
                <Area type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" animationDuration={500} />
                <Area type="monotone" dataKey="expense" name="Gastos" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" animationDuration={500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 3 Brands List */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
             <Trophy className="text-yellow-500" size={20} /> Top 3 Marcas
          </h3>
          
          <div className="flex-1 space-y-5">
             {topBrands.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">Sin datos suficientes</div>
             ) : (
                topBrands.map((brand) => (
                   <div key={brand.name} className="relative group">
                      <div className="flex justify-between items-center mb-1 relative z-10">
                         <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold 
                               ${brand.rank === 1 ? 'bg-yellow-500 text-black shadow-yellow-500/50 shadow-sm' : 
                                 brand.rank === 2 ? 'bg-slate-300 text-black' : 'bg-orange-700 text-white'}`}>
                               {brand.rank}
                            </div>
                            <span className="text-slate-200 font-medium">{brand.name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <Car size={14} className="text-slate-500" />
                            <span className="text-white font-bold">{brand.count}</span>
                         </div>
                      </div>
                      
                      {/* Progress Bar Background */}
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-1000 ease-out ${
                             brand.rank === 1 ? 'bg-yellow-500' : brand.rank === 2 ? 'bg-slate-400' : 'bg-orange-600'
                           }`}
                           style={{ width: `${(brand.count / (topBrands[0].count || 1)) * 100}%` }}
                         ></div>
                      </div>
                   </div>
                ))
             )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-slate-700/50 text-center">
             <p className="text-xs text-slate-500">Basado en el historial de revisiones</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;