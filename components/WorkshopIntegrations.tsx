import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, Loader2, Phone, PlugZap, ShieldCheck, X } from 'lucide-react';
import { Quote, Service } from '../types';
import { lookupVin } from '../services/ai';
import {
  getWorkshopIntegrationStatus,
  PhoneValidationResult,
  validateWorkshopPhone,
  WorkshopIntegrationStatus,
} from '../services/integrations';

interface WorkshopIntegrationsProps {
  mode: 'services' | 'quotes';
  services: Service[];
  quotes: Quote[];
  setServices?: React.Dispatch<React.SetStateAction<Service[]>>;
}

type VinPreview = {
  vin: string;
  serviceId: string;
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fieldsFound: string[];
};

const statusItems: { key: keyof Pick<WorkshopIntegrationStatus, 'ai' | 'voice' | 'vin' | 'phoneValidation' | 'imageOptimization' | 'cloudPdf'>; label: string }[] = [
  { key: 'ai', label: 'IA' },
  { key: 'voice', label: 'Voz' },
  { key: 'vin', label: 'VIN' },
  { key: 'phoneValidation', label: 'Teléfono' },
  { key: 'imageOptimization', label: 'Fotos' },
  { key: 'cloudPdf', label: 'PDF nube' },
];

export default function WorkshopIntegrations({ mode, services, quotes, setServices }: WorkshopIntegrationsProps) {
  const [status, setStatus] = useState<WorkshopIntegrationStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneTargetId, setPhoneTargetId] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneResult, setPhoneResult] = useState<PhoneValidationResult | null>(null);

  const [vinOpen, setVinOpen] = useState(false);
  const [vinServiceId, setVinServiceId] = useState('');
  const [vin, setVin] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinPreview, setVinPreview] = useState<VinPreview | null>(null);

  useEffect(() => {
    let active = true;
    getWorkshopIntegrationStatus()
      .then((next) => { if (active) setStatus(next); })
      .catch((err) => { if (active) setStatusError(err instanceof Error ? err.message : 'No fue posible revisar las integraciones.'); });
    return () => { active = false; };
  }, []);

  const targets = mode === 'services' ? services : quotes;
  const selectedPhoneTarget = useMemo(
    () => targets.find((item) => item.id === phoneTargetId) || null,
    [targets, phoneTargetId],
  );

  const openPhoneValidation = () => {
    setError('');
    setPhoneResult(null);
    const firstWithPhone = targets.find((item) => item.phone?.trim());
    if (!firstWithPhone) {
      setError('No hay registros con teléfono para validar.');
      return;
    }
    setPhoneTargetId(firstWithPhone.id);
    setPhoneOpen(true);
  };

  const runPhoneValidation = async () => {
    const phone = selectedPhoneTarget?.phone?.trim() || '';
    if (!phone) return;
    try {
      setPhoneLoading(true);
      setPhoneResult(await validateWorkshopPhone(phone));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible validar el teléfono.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const openVinLookup = () => {
    setError('');
    setVinPreview(null);
    const first = services[0];
    if (!first) {
      setError('No hay servicios para completar por VIN.');
      return;
    }
    setVinServiceId(first.id);
    setVin(first.vin || '');
    setVinOpen(true);
  };

  const changeVinService = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    setVinServiceId(serviceId);
    setVin(service?.vin || '');
    setVinPreview(null);
  };

  const runVinLookup = async () => {
    const cleanVin = vin.trim().toUpperCase();
    if (!cleanVin) return;
    try {
      setVinLoading(true);
      setVinPreview(null);
      const result = await lookupVin(cleanVin);
      setVinPreview({
        vin: cleanVin,
        serviceId: vinServiceId,
        ...result.vehicle,
        fieldsFound: result.fieldsFound || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible consultar el VIN.');
    } finally {
      setVinLoading(false);
    }
  };

  const applyVinData = () => {
    if (!vinPreview || !setServices) return;
    setServices((current) => current.map((service) => service.id === vinPreview.serviceId
      ? {
          ...service,
          vin: vinPreview.vin,
          brand: vinPreview.brand || service.brand,
          model: vinPreview.model || service.model,
          year: vinPreview.year || service.year,
          mileage: vinPreview.mileage || service.mileage,
        }
      : service));
    setVinOpen(false);
    setVinPreview(null);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 sm:p-4 shadow-sm">
        <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-600 text-white"><PlugZap size={18} /></div>
            <div className="min-w-0">
              <p className="font-bold text-white">Herramientas del API Hub</p>
              <p className="text-xs text-slate-400 truncate">Vehículo, contacto y estado de integraciones del taller.</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">{open ? 'Ocultar' : 'Ver herramientas'}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {statusItems.map((item) => {
                const enabled = Boolean(status?.[item.key]);
                return (
                  <span key={item.key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                    {enabled ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{item.label}
                  </span>
                );
              })}
            </div>

            {statusError && <p className="text-xs text-amber-300">{statusError}</p>}
            {error && <p className="text-sm text-amber-300">{error}</p>}

            <div className={`grid gap-2 ${mode === 'services' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={openPhoneValidation}
                disabled={status !== null && !status.phoneValidation}
                className="min-h-12 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-white font-semibold flex items-center justify-center gap-2 px-4"
              >
                <ShieldCheck size={19} /> Validar teléfono
              </button>
              {mode === 'services' && (
                <button
                  type="button"
                  onClick={openVinLookup}
                  disabled={status !== null && !status.vin}
                  className="min-h-12 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-white font-semibold flex items-center justify-center gap-2 px-4"
                >
                  <CarFront size={19} /> Completar por VIN
                </button>
              )}
            </div>

            {status && (!status.phoneValidation || (mode === 'services' && !status.vin)) && (
              <p className="text-xs text-slate-500">Las herramientas sin credencial quedan desactivadas sin afectar el resto de Gestión Taller.</p>
            )}
          </div>
        )}
      </section>

      {phoneOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h3 className="text-lg font-bold text-white">Validar teléfono</h3><p className="text-xs text-slate-400">Consulta revisable. No modifica el registro.</p></div>
              <button type="button" onClick={() => setPhoneOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            <label className="block text-xs font-semibold text-slate-400 mb-2">Cliente / registro</label>
            <select value={phoneTargetId} onChange={(e) => { setPhoneTargetId(e.target.value); setPhoneResult(null); }} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
              {targets.filter((item) => item.phone?.trim()).map((item) => <option key={item.id} value={item.id}>{item.clientName || 'Sin nombre'} · {item.phone}</option>)}
            </select>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex items-center gap-2 text-slate-200"><Phone size={17} />{selectedPhoneTarget?.phone || 'Sin teléfono'}</div>

            {phoneResult && (
              <div className={`mt-3 rounded-xl border p-3 ${phoneResult.valid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                <p className={`font-bold ${phoneResult.valid ? 'text-emerald-300' : 'text-amber-300'}`}>{phoneResult.valid ? 'Teléfono válido según proveedor' : 'El proveedor no pudo validar el teléfono'}</p>
                <div className="mt-2 text-sm text-slate-300 space-y-1">
                  {phoneResult.internationalFormat && <p>Formato internacional: {phoneResult.internationalFormat}</p>}
                  {phoneResult.carrier && <p>Operador: {phoneResult.carrier}</p>}
                  {phoneResult.lineType && <p>Tipo de línea: {phoneResult.lineType}</p>}
                </div>
              </div>
            )}

            <button type="button" onClick={runPhoneValidation} disabled={phoneLoading || !selectedPhoneTarget?.phone} className="mt-4 w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
              {phoneLoading ? <Loader2 className="animate-spin" size={19} /> : <ShieldCheck size={19} />} Revisar teléfono
            </button>
          </div>
        </div>
      )}

      {vinOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h3 className="text-lg font-bold text-white">Completar vehículo por VIN</h3><p className="text-xs text-slate-400">Primero revisa el resultado y luego decide si aplicarlo.</p></div>
              <button type="button" onClick={() => setVinOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            <label className="block text-xs font-semibold text-slate-400 mb-2">Servicio</label>
            <select value={vinServiceId} onChange={(e) => changeVinService(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
              {services.map((service) => <option key={service.id} value={service.id}>{service.plate} · {service.clientName || 'Sin nombre'}</option>)}
            </select>

            <label className="block text-xs font-semibold text-slate-400 mt-3 mb-2">VIN (17 caracteres)</label>
            <input value={vin} onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinPreview(null); }} maxLength={17} placeholder="Ej: KMH..." className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white uppercase" />

            <button type="button" onClick={runVinLookup} disabled={vinLoading || vin.trim().length !== 17} className="mt-4 w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
              {vinLoading ? <Loader2 className="animate-spin" size={19} /> : <CarFront size={19} />} Consultar VIN
            </button>

            {vinPreview && (
              <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="font-bold text-blue-200">Vista previa del proveedor</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-200">
                  <p>Marca: {vinPreview.brand || 'Sin dato'}</p>
                  <p>Modelo: {vinPreview.model || 'Sin dato'}</p>
                  <p>Año: {vinPreview.year || 'Sin dato'}</p>
                  <p>Kilometraje: {vinPreview.mileage ?? 'Sin dato'}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">Solo se reemplazan campos cuando el proveedor entrega un valor.</p>
                <button type="button" onClick={applyVinData} className="mt-3 w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Aplicar al servicio</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
