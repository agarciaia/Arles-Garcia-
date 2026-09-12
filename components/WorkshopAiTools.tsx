import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Check, Clipboard, Loader2, MessageCircle, Mic, Pencil, Search, Sparkles, Square, Trash2, X } from 'lucide-react';
import { AppSettings, Quote, Service } from '../types';
import { createId } from '../services/id';
import { calculateServiceBalance, calculateServicePaid, calculateServiceTotal } from '../services/financials';
import {
  AiStatus,
  CustomerMessageType,
  analyzeService,
  buildWorkshopIntake,
  generateCustomerMessage,
  getAiStatus,
  lookupVin,
  quoteMessageContext,
  serviceMessageContext,
  transcribeAudio,
} from '../services/ai';
import { ServiceAnalysis, WorkshopIntakeDraft, emptyWorkshopIntake, serviceFromIntake } from '../services/aiData';

interface WorkshopAiToolsProps {
  mode: 'services' | 'quotes';
  services: Service[];
  quotes: Quote[];
  settings: AppSettings;
  setServices?: React.Dispatch<React.SetStateAction<Service[]>>;
}

type VoiceStage = 'idle' | 'recording' | 'transcribing' | 'preparing' | 'review';

const messageOptions: { value: CustomerMessageType; label: string }[] = [
  { value: 'reception', label: 'Recepción del vehículo' },
  { value: 'quote_ready', label: 'Cotización lista' },
  { value: 'completed', label: 'Trabajo terminado' },
  { value: 'balance_due', label: 'Saldo pendiente' },
];

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const numberOrNull = (value: string) => value.trim() ? Math.max(0, Math.round(Number(value.replace(/[^0-9]/g, '')) || 0)) || null : null;

export default function WorkshopAiTools({ mode, services, quotes, settings, setServices }: WorkshopAiToolsProps) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [error, setError] = useState('');

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<WorkshopIntakeDraft>(emptyWorkshopIntake());
  const [editingDraft, setEditingDraft] = useState(false);
  const [vinMessage, setVinMessage] = useState('');
  const [vinLoading, setVinLoading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisServiceId, setAnalysisServiceId] = useState('');
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [analysis, setAnalysis] = useState<ServiceAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageTargetId, setMessageTargetId] = useState('');
  const [messageType, setMessageType] = useState<CustomerMessageType>(mode === 'quotes' ? 'quote_ready' : 'reception');
  const [messagePreview, setMessagePreview] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getAiStatus()
      .then((next) => { if (active) setStatus(next); })
      .catch((err) => { if (active) setStatusError(err instanceof Error ? err.message : 'No fue posible comprobar la configuración de IA.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!voiceOpen || voiceStage !== 'recording') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceOpen, voiceStage]);

  useEffect(() => () => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const closeVoice = () => {
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setVoiceOpen(false);
    setVoiceStage('idle');
    setElapsed(0);
    setTranscript('');
    setDraft(emptyWorkshopIntake());
    setEditingDraft(false);
    setVinMessage('');
  };

  const processRecording = async (blob: Blob) => {
    try {
      setVoiceStage('transcribing');
      const transcription = await transcribeAudio(blob);
      if (!transcription.text.trim()) throw new Error('No se detectó voz en la grabación.');
      setTranscript(transcription.text.trim());
      setVoiceStage('preparing');
      const intake = await buildWorkshopIntake(transcription.text.trim());
      setDraft(intake.draft);
      setEditingDraft(false);
      setVoiceStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible preparar la orden por voz.');
      setVoiceStage('idle');
    }
  };

  const startRecording = async () => {
    setError('');
    setVinMessage('');
    if (status && !status.voiceConfigured) {
      setError('La función de voz aún no está disponible. Falta configurar GROQ_API_KEY en el backend.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio. Puedes usar la creación normal de servicios.');
      return;
    }

    try {
      cancelledRef.current = false;
      chunksRef.current = [];
      setElapsed(0);
      setDraft(emptyWorkshopIntake());
      setTranscript('');
      setVoiceOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        void processRecording(blob);
      };
      recorder.start(500);
      setVoiceStage('recording');
    } catch (err) {
      setVoiceOpen(false);
      setVoiceStage('idle');
      setError(err instanceof Error ? err.message : 'No fue posible acceder al micrófono.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const updateDraft = <K extends keyof WorkshopIntakeDraft>(key: K, value: WorkshopIntakeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateLine = (kind: 'laborItems' | 'expenses', index: number, key: 'description' | 'amount', value: string) => {
    setDraft((current) => ({
      ...current,
      [kind]: current[kind].map((item, itemIndex) => itemIndex === index
        ? { ...item, [key]: key === 'amount' ? Math.max(0, Number(value.replace(/[^0-9]/g, '')) || 0) : value }
        : item),
    }));
  };

  const addLine = (kind: 'laborItems' | 'expenses') => {
    setDraft((current) => ({ ...current, [kind]: [...current[kind], { description: '', amount: 0 }] }));
  };

  const removeLine = (kind: 'laborItems' | 'expenses', index: number) => {
    setDraft((current) => ({ ...current, [kind]: current[kind].filter((_, itemIndex) => itemIndex !== index) }));
  };

  const confirmVoiceOrder = () => {
    if (!setServices) return;
    if (!draft.plate.trim()) {
      setError('Completa la patente antes de crear la orden.');
      setEditingDraft(true);
      return;
    }
    const service = serviceFromIntake(draft, createId());
    setServices((current) => [service, ...current]);
    closeVoice();
  };

  const handleVinLookup = async () => {
    setVinMessage('');
    if (!draft.vin.trim()) return;
    if (!status?.vinConfigured) {
      setVinMessage('Consulta VIN no disponible: falta configurar CarVector o su ruta oficial.');
      return;
    }
    try {
      setVinLoading(true);
      const result = await lookupVin(draft.vin.trim());
      const vehicle = result.vehicle || {};
      setDraft((current) => ({
        ...current,
        brand: vehicle.brand || current.brand,
        model: vehicle.model || current.model,
        year: vehicle.year || current.year,
        mileage: vehicle.mileage || current.mileage,
      }));
      setVinMessage(result.fieldsFound?.length
        ? `Datos entregados por el proveedor: ${result.fieldsFound.join(', ')}.`
        : 'El proveedor no entregó datos adicionales para completar.');
    } catch (err) {
      setVinMessage(err instanceof Error ? err.message : 'No fue posible consultar el VIN.');
    } finally {
      setVinLoading(false);
    }
  };

  const openAnalysis = () => {
    if (!services.length) {
      setError('No hay servicios para analizar.');
      return;
    }
    setError('');
    setAnalysisServiceId(services[0].id);
    setAnalysisNotes('');
    setAnalysis(null);
    setAnalysisOpen(true);
  };

  const runAnalysis = async () => {
    const service = services.find((item) => item.id === analysisServiceId) || null;
    if (!service) return;
    try {
      setAnalysisLoading(true);
      setAnalysis(await analyzeService(service, analysisNotes));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible analizar el servicio.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const openMessageGenerator = () => {
    const targets = mode === 'services' ? services : quotes;
    if (!targets.length) {
      setError(mode === 'services' ? 'No hay servicios para generar un mensaje.' : 'No hay cotizaciones para generar un mensaje.');
      return;
    }
    setError('');
    setMessageTargetId(targets[0].id);
    setMessageType(mode === 'quotes' ? 'quote_ready' : 'reception');
    setMessagePreview('');
    setCopied(false);
    setMessageOpen(true);
  };

  const runMessageGeneration = async () => {
    try {
      setMessageLoading(true);
      let payload: Record<string, unknown>;
      if (mode === 'services') {
        const service = services.find((item) => item.id === messageTargetId);
        if (!service) return;
        payload = serviceMessageContext(
          service,
          settings.companyName,
          calculateServiceTotal(service),
          calculateServicePaid(service),
          calculateServiceBalance(service),
        );
      } else {
        const quote = quotes.find((item) => item.id === messageTargetId);
        if (!quote) return;
        payload = quoteMessageContext(quote, settings.companyName);
      }
      const result = await generateCustomerMessage(mode === 'services' ? 'service' : 'quote', messageType, payload);
      setMessagePreview(result.text || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible generar el mensaje.');
    } finally {
      setMessageLoading(false);
    }
  };

  const copyMessage = async () => {
    if (!messagePreview) return;
    await navigator.clipboard.writeText(messagePreview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const renderList = (title: string, values: string[]) => values.length > 0 && (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</p>
      <ul className="space-y-1 text-sm text-slate-200 list-disc pl-5">{values.map((value, index) => <li key={`${title}-${index}`}>{value}</li>)}</ul>
    </div>
  );

  return (
    <>
      <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600 text-white"><Bot size={18} /></div>
            <div className="min-w-0">
              <p className="font-bold text-white">Asistente IA</p>
              <p className="text-xs text-slate-400 truncate">Sugerencias revisables. Nada se guarda ni envía automáticamente.</p>
            </div>
          </div>
          {status && <span className={`hidden sm:inline-flex text-[10px] px-2 py-1 rounded-full border ${status.aiConfigured ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>{status.aiConfigured ? 'IA disponible' : 'Configurar IA'}</span>}
        </div>

        <div className={`grid gap-2 ${mode === 'services' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
          {mode === 'services' && (
            <button
              type="button"
              onClick={startRecording}
              disabled={status !== null && !status.voiceConfigured}
              className="min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold flex items-center justify-center gap-2 px-4 transition-colors"
            >
              <Mic size={20} /> 🎙️ Crear por voz
            </button>
          )}
          {mode === 'services' && (
            <button type="button" onClick={openAnalysis} className="min-h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold flex items-center justify-center gap-2 px-4">
              <Sparkles size={19} /> Analizar servicio
            </button>
          )}
          <button type="button" onClick={openMessageGenerator} className="min-h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold flex items-center justify-center gap-2 px-4">
            <MessageCircle size={19} /> Generar mensaje
          </button>
        </div>

        {mode === 'services' && status !== null && !status.voiceConfigured && <p className="mt-2 text-xs text-amber-400">Voz desactivada de forma segura: falta GROQ_API_KEY. El resto de la app sigue funcionando.</p>}
        {statusError && <p className="mt-2 text-xs text-amber-400">{statusError}</p>}
        {error && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-sm text-red-300"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      </section>

      {voiceOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-3 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 p-4">
              <div><h3 className="font-bold text-white">{voiceStage === 'review' ? 'Revisar orden generada' : 'Crear orden por voz'}</h3><p className="text-xs text-slate-400">La orden solo se crea cuando confirmas.</p></div>
              <button onClick={closeVoice} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-5">
              {voiceStage === 'recording' && (
                <div className="py-8 text-center space-y-6">
                  <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"><Mic className="text-red-400 animate-pulse" size={34} /></div>
                  <div><p className="text-red-400 font-bold text-lg">● Grabando {formatTime(elapsed)}</p><p className="text-sm text-slate-400 mt-2">Describe cliente, vehículo, trabajos, repuestos, valores y observaciones.</p></div>
                  <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                    <button onClick={stopRecording} className="min-h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2"><Square size={17} /> Detener</button>
                    <button onClick={closeVoice} className="min-h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold">Cancelar</button>
                  </div>
                </div>
              )}

              {(voiceStage === 'transcribing' || voiceStage === 'preparing') && (
                <div className="py-12 flex flex-col items-center gap-4 text-center"><Loader2 size={34} className="animate-spin text-blue-400" /><p className="font-bold text-white">{voiceStage === 'transcribing' ? 'Transcribiendo audio…' : 'Preparando orden…'}</p><p className="text-sm text-slate-400">No se guardará nada sin tu confirmación.</p></div>
              )}

              {voiceStage === 'idle' && (
                <div className="py-8 text-center space-y-4"><AlertCircle className="mx-auto text-amber-400" /><p className="text-slate-300">La grabación no pudo completarse.</p><button onClick={startRecording} className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Intentar nuevamente</button></div>
              )}

              {voiceStage === 'review' && (
                <div className="space-y-5">
                  {transcript && <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-xs font-bold uppercase text-slate-400">Transcripción</summary><p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{transcript}</p></details>}
                  {draft.confidenceNotes.length > 0 && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200"><strong>Revisar:</strong> {draft.confidenceNotes.join(' · ')}</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ['clientName', 'Cliente'], ['phone', 'Teléfono'], ['plate', 'Patente'], ['brand', 'Marca'], ['model', 'Modelo'], ['vin', 'VIN'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="space-y-1"><span className="text-xs font-bold text-slate-400">{label}</span><input disabled={!editingDraft} value={draft[key]} onChange={(event) => updateDraft(key, event.target.value as never)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-70 focus:border-blue-500 outline-none" /></label>
                    ))}
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-400">Año</span><input disabled={!editingDraft} inputMode="numeric" value={draft.year ?? ''} onChange={(event) => updateDraft('year', numberOrNull(event.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-70 focus:border-blue-500 outline-none" /></label>
                    <label className="space-y-1"><span className="text-xs font-bold text-slate-400">Kilometraje</span><input disabled={!editingDraft} inputMode="numeric" value={draft.mileage ?? ''} onChange={(event) => updateDraft('mileage', numberOrNull(event.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-70 focus:border-blue-500 outline-none" /></label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!draft.vin || vinLoading || !status?.vinConfigured} onClick={handleVinLookup} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white disabled:opacity-40 flex items-center gap-2"><Search size={15} /> {vinLoading ? 'Consultando…' : 'Consultar VIN'}</button>
                    {!status?.vinConfigured && <span className="text-xs text-slate-500">Disponible al configurar CarVector.</span>}
                    {vinMessage && <span className="text-xs text-slate-400">{vinMessage}</span>}
                  </div>

                  <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Motivo de ingreso</span><textarea disabled={!editingDraft} rows={3} value={draft.reason} onChange={(event) => updateDraft('reason', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-70 focus:border-blue-500 outline-none resize-y" /></label>
                  <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Observaciones</span><textarea disabled={!editingDraft} rows={3} value={draft.observations} onChange={(event) => updateDraft('observations', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white disabled:opacity-70 focus:border-blue-500 outline-none resize-y" /></label>

                  {(['laborItems', 'expenses'] as const).map((kind) => (
                    <div key={kind} className="rounded-xl border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between"><p className="text-sm font-bold text-white">{kind === 'laborItems' ? 'Trabajos / Mano de obra' : 'Repuestos / Gastos'}</p>{editingDraft && <button onClick={() => addLine(kind)} className="text-xs text-blue-400 hover:text-blue-300">+ Agregar</button>}</div>
                      {draft[kind].length === 0 && <p className="text-xs text-slate-500">Sin elementos detectados.</p>}
                      {draft[kind].map((item, index) => (
                        <div key={`${kind}-${index}`} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                          <input disabled={!editingDraft} value={item.description} onChange={(event) => updateLine(kind, index, 'description', event.target.value)} className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white disabled:opacity-70" placeholder="Descripción" />
                          <input disabled={!editingDraft} inputMode="numeric" value={item.amount || ''} onChange={(event) => updateLine(kind, index, 'amount', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white disabled:opacity-70" placeholder="$" />
                          {editingDraft && <button onClick={() => removeLine(kind, index)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-1 bg-slate-900 border-t border-slate-800 grid grid-cols-3 gap-2">
                    <button onClick={closeVoice} className="min-h-12 rounded-xl bg-slate-800 text-slate-200 font-semibold">CANCELAR</button>
                    <button onClick={() => setEditingDraft(true)} className={`min-h-12 rounded-xl border font-semibold flex items-center justify-center gap-2 ${editingDraft ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-slate-700 bg-slate-800 text-white'}`}><Pencil size={16} /> EDITAR</button>
                    <button onClick={confirmVoiceOrder} className="min-h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold">CREAR ORDEN</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {analysisOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-3 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h3 className="font-bold text-white">Análisis de servicio</h3><p className="text-xs text-slate-400">Siempre se presenta como sugerencia del asistente.</p></div><button onClick={() => setAnalysisOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Servicio</span><select value={analysisServiceId} onChange={(event) => { setAnalysisServiceId(event.target.value); setAnalysis(null); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white">{services.map((service) => <option key={service.id} value={service.id}>{service.plate} · {service.brand} {service.model} · {service.clientName}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Notas adicionales (opcional)</span><textarea rows={3} value={analysisNotes} onChange={(event) => setAnalysisNotes(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white resize-y" placeholder="Agrega síntomas, observaciones o preguntas..." /></label>
              <button disabled={analysisLoading} onClick={runAnalysis} className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">{analysisLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} Analizar</button>
              {analysis && <div className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"><p className="text-xs font-bold uppercase text-blue-300">Sugerencia del asistente</p><div><p className="text-xs font-bold uppercase text-slate-400 mb-1">Resumen</p><p className="text-sm text-slate-200 whitespace-pre-wrap">{analysis.summary || 'Sin resumen.'}</p></div>{renderList('Trabajos detectados', analysis.detectedWork)}{renderList('Repuestos mencionados', analysis.mentionedParts)}{renderList('Información faltante', analysis.missingInformation)}{renderList('Preguntas sugeridas al cliente', analysis.suggestedQuestions)}{analysis.customerMessage && <div><p className="text-xs font-bold uppercase text-slate-400 mb-1">Mensaje breve sugerido</p><p className="text-sm text-slate-200 whitespace-pre-wrap">{analysis.customerMessage}</p></div>}<p className="text-xs text-amber-300 border-t border-slate-800 pt-3">{analysis.disclaimer}</p></div>}
            </div>
          </div>
        </div>
      )}

      {messageOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-3 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h3 className="font-bold text-white">Generar mensaje</h3><p className="text-xs text-slate-400">La vista previa es editable y no se envía automáticamente.</p></div><button onClick={() => setMessageOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">{mode === 'services' ? 'Servicio' : 'Cotización'}</span><select value={messageTargetId} onChange={(event) => { setMessageTargetId(event.target.value); setMessagePreview(''); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white">{mode === 'services' ? services.map((service) => <option key={service.id} value={service.id}>{service.plate} · {service.clientName}</option>) : quotes.map((quote) => <option key={quote.id} value={quote.id}>#{quote.id} · {quote.clientName} · {quote.vehicle}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Tipo de mensaje</span><select value={messageType} onChange={(event) => { setMessageType(event.target.value as CustomerMessageType); setMessagePreview(''); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white">{messageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <button disabled={messageLoading} onClick={runMessageGeneration} className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">{messageLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} Generar mensaje</button>
              <label className="block space-y-1"><span className="text-xs font-bold text-slate-400">Vista previa editable</span><textarea rows={7} value={messagePreview} onChange={(event) => setMessagePreview(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white resize-y" placeholder="El mensaje aparecerá aquí…" /></label>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => setMessageOpen(false)} className="min-h-11 rounded-xl bg-slate-800 text-white font-semibold">Cerrar</button><button disabled={!messagePreview} onClick={copyMessage} className="min-h-11 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2">{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? 'Copiado' : 'Copiar'}</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
