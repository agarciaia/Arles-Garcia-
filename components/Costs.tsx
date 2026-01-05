import React, { useState } from 'react';
import { Cost } from '../types';
import { Plus, DollarSign, Tag, Trash2, AlertTriangle, X, Save } from 'lucide-react';

interface CostsProps {
  costs: Cost[];
  setCosts: React.Dispatch<React.SetStateAction<Cost[]>>;
}

const Costs: React.FC<CostsProps> = ({ costs, setCosts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<Cost['category']>('parts');
  
  // Estado para controlar el modal de eliminación
  const [costToDelete, setCostToDelete] = useState<string | null>(null);

  // Helper para formato CLP
  const formatCLP = (value: number | '') => {
    if (value === '') return '';
    return value.toLocaleString('es-CL');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Eliminar puntos y caracteres no numéricos
    const rawValue = e.target.value.replace(/\./g, '').replace(/\D/g, '');
    const numValue = rawValue === '' ? '' : parseInt(rawValue, 10);
    setAmount(numValue);
  };

  const handleAddCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount === '') return;

    const newCost: Cost = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      amount: Number(amount),
      date: new Date().toISOString(),
      category
    };

    setCosts(prev => [newCost, ...prev]);
    setDescription('');
    setAmount('');
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (costToDelete) {
      setCosts(prev => prev.filter(c => c.id !== costToDelete));
      setCostToDelete(null);
    }
  };
  
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Pequeño delay para permitir que el teclado virtual suba antes de hacer scroll
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  };

  const categories = {
    parts: { label: 'Repuestos', color: 'text-blue-500 bg-blue-500/10' },
    labor: { label: 'Mano de Obra', color: 'text-green-500 bg-green-500/10' },
    utilities: { label: 'Servicios', color: 'text-yellow-500 bg-yellow-500/10' },
    other: { label: 'Otros', color: 'text-purple-500 bg-purple-500/10' },
  };

  return (
    <div className="space-y-6 relative pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white">Registro de Costos</h2>
           <p className="text-slate-400 text-sm">Administra los gastos operativos del taller.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 font-medium active:scale-95"
        >
          <Plus size={20} /> <span className="hidden sm:inline">Registrar Gasto</span>
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
          {costs.length === 0 ? (
            <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
              <p className="text-slate-500">No hay costos registrados aún.</p>
            </div>
          ) : (
            costs.map((cost) => (
              <div key={cost.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${categories[cost.category].color}`}>
                    <Tag size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{cost.description}</h4>
                    <p className="text-slate-500 text-sm">{new Date(cost.date).toLocaleDateString()} • {categories[cost.category].label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <span className="text-lg sm:text-xl font-bold text-white">-${cost.amount.toLocaleString('es-CL')}</span>
                  <button 
                    onClick={() => setCostToDelete(cost.id)}
                    className="text-slate-600 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
      </div>

      {/* Add Cost Modal - Optimized for Mobile Keyboard */}
      {isModalOpen && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />

          {/* Scrollable Container - This allows the modal to move up when keyboard appears */}
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              
              {/* Modal Panel */}
              <div className="relative transform overflow-hidden rounded-2xl bg-slate-900 text-left shadow-xl transition-all sm:my-8 w-full max-w-md border border-slate-700">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                  <h3 className="text-lg font-bold text-white">Nuevo Gasto</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleAddCost} className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Descripción</label>
                    <input 
                      type="text"
                      required
                      autoFocus
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Ej. Compra de aceite"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      onFocus={handleInputFocus}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Monto (CLP)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text"
                        inputMode="numeric"
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 pl-10 text-white focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                        value={formatCLP(amount)}
                        onChange={handleAmountChange}
                        onFocus={handleInputFocus}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Categoría</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(categories) as Array<keyof typeof categories>).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-2 rounded-lg text-sm font-medium border transition-all ${
                            category === cat 
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400' 
                              : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {categories[cat].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                     <button 
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                      <Save size={18} />
                      Guardar Gasto
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {costToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">¿Eliminar registro?</h3>
              <p className="text-slate-400 text-sm mb-6">
                ¿Estás seguro de que deseas eliminar este costo? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setCostToDelete(null)}
                  className="px-5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium border border-transparent hover:border-slate-600"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-900/20"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Costs;