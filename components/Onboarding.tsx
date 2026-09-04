import React, { useState } from 'react';
import { Building2, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { AppSettings } from '../types';

interface OnboardingProps {
  settings: AppSettings;
  onComplete: (settings: AppSettings) => Promise<void>;
}

const Onboarding: React.FC<OnboardingProps> = ({ settings, onComplete }) => {
  const [companyName, setCompanyName] = useState(settings.companyName || '');
  const [mechanicName, setMechanicName] = useState(settings.mechanicName || '');
  const [companyPhone, setCompanyPhone] = useState(settings.companyPhone || '+56 9 ');
  const [companyAddress, setCompanyAddress] = useState(settings.companyAddress || '');
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName.trim() || !mechanicName.trim() || !companyPhone.trim() || !accepted) {
      setError('Completa los datos obligatorios y acepta las condiciones para continuar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onComplete({
        ...settings,
        companyName: companyName.trim(),
        mechanicName: mechanicName.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
      });
    } catch {
      setError('No pudimos guardar la configuración. Revisa tu conexión e inténtalo nuevamente.');
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center"><Wrench size={25} /></div>
          <div><p className="text-sm text-blue-400 font-bold">Gestión Taller</p><h1 className="text-2xl font-black">Configura tu taller</h1></div>
        </div>

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 flex gap-3">
            <CheckCircle2 className="text-blue-400 shrink-0" size={22} />
            <div><p className="font-bold">Tu prueba gratuita comienza ahora</p><p className="text-sm text-slate-400 mt-1">Tendrás 15 días para utilizar las funciones principales. Tus datos siempre estarán separados de otros talleres.</p></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2"><span className="text-sm font-bold text-slate-300">Nombre del taller *</span><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" placeholder="Ej. Taller Los Motores" /></label>
            <label className="space-y-2"><span className="text-sm font-bold text-slate-300">Responsable *</span><input value={mechanicName} onChange={(e) => setMechanicName(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" placeholder="Nombre y apellido" /></label>
            <label className="space-y-2"><span className="text-sm font-bold text-slate-300">Teléfono *</span><input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} inputMode="tel" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" /></label>
            <label className="space-y-2"><span className="text-sm font-bold text-slate-300">Dirección o comuna</span><input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" placeholder="Ej. Buin, Región Metropolitana" /></label>
          </div>

          <div className="rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-400" size={20} /><p className="font-bold">Privacidad y condiciones</p></div>
            <details className="text-sm text-slate-400"><summary className="cursor-pointer text-blue-400 font-bold">Política de privacidad</summary><div className="mt-2 space-y-2 leading-relaxed"><p>Gestión Taller almacena los datos de la cuenta, configuración del taller, clientes, vehículos, servicios, cotizaciones, gastos y pagos que el usuario registre. Se utilizan exclusivamente para prestar el servicio, sincronizar la información y dar soporte.</p><p>Cada cuenta puede acceder únicamente a su propio taller. El usuario puede descargar un respaldo y solicitar o ejecutar la eliminación de su cuenta y datos desde Configuración. No vendemos la información registrada.</p><p>El taller es responsable de contar con autorización para registrar información de sus clientes. Las fotografías en la nube permanecen desactivadas en esta etapa.</p></div></details>
            <details className="text-sm text-slate-400"><summary className="cursor-pointer text-blue-400 font-bold">Términos del servicio</summary><div className="mt-2 space-y-2 leading-relaxed"><p>Gestión Taller se ofrece inicialmente como versión piloto. La prueba general dura 15 días; al finalizar, la cuenta pasa a modo lectura y conserva la información para que el usuario pueda revisar, respaldar o renovar.</p><p>El Plan Fundador tiene un valor inicial de $10.000 CLP mensuales y se activa manualmente después de confirmar el pago. La aplicación ayuda a administrar el taller, pero no sustituye sistemas contables, tributarios ni documentos legales obligatorios.</p><p>Las condiciones y el canal de soporte definitivo se informarán antes de la publicación comercial.</p></div></details>
            <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-600" /><span className="text-sm text-slate-300">Acepto la política de privacidad y los términos del servicio.</span></label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3.5 font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"><Building2 size={20} />{saving ? 'Guardando…' : 'Crear mi taller'}</button>
        </form>
      </div>
    </main>
  );
};

export default Onboarding;
