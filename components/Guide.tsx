import React from 'react';
import { LayoutDashboard, Wrench, FileText, DollarSign, Settings, Info, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface GuideProps {
  onStart?: () => void;
}

const Guide: React.FC<GuideProps> = ({ onStart }) => {
  const sections = [
    {
      title: 'Dashboard (Panel de Control)',
      icon: LayoutDashboard,
      color: 'text-blue-500',
      description: 'Vista general del taller. Aquí verás las métricas más importantes de un vistazo.',
      items: [
        'Resumen de ingresos y gastos mensuales.',
        'Estado de los servicios (Pendientes, En Proceso, Completados).',
        'Gráficos interactivos de ganancias y flujos de caja.',
        'Acceso rápido a las tareas del día.'
      ]
    },
    {
      title: 'Servicios (Gestión de Ordenes)',
      icon: Wrench,
      color: 'text-emerald-500',
      description: 'El corazón del taller. Aquí gestionas el flujo de trabajo real.',
      items: [
        'Crear nuevas órdenes de trabajo con datos del cliente y vehículo.',
        'Detallar mano de obra y repuestos de forma separada.',
        'Registrar abonos y pagos finales (múltiples pagos permitidos).',
        'Enviar actualizaciones automáticas por WhatsApp al cliente.',
        'Generar comprobantes de servicio profesionales en PDF.'
      ]
    },
    {
      title: 'Cotizaciones (Presupuestos)',
      icon: FileText,
      color: 'text-orange-500',
      description: 'Herramienta para cerrar ventas y formalizar presupuestos.',
      items: [
        'Generar presupuestos detallados sin afectar el inventario o caja.',
        'Estructura clara de mano de obra v/s repuestos.',
        'Definir días de validez para cada cotización.',
        'Enviar cotizaciones digitales vía WhatsApp.',
        'Convertir una cotización aceptada en un servicio activo con un click.'
      ]
    },
    {
      title: 'Costos (Control de Gastos)',
      icon: DollarSign,
      color: 'text-red-500',
      description: 'Lleva un registro de los gastos operativos de tu negocio.',
      items: [
        'Categorizar gastos (Repuestos, Mano de Obra externa, Luz/Suministros, Otros).',
        'Mantener un histórico para calcular la utilidad real del taller.',
        'Visualizar el impacto de los gastos en el balance general.'
      ]
    },
    {
      title: 'Configuraciones',
      icon: Settings,
      color: 'text-slate-400',
      description: 'Personaliza la aplicación para que sea TUYA.',
      items: [
        'Datos del taller: Nombre, dirección, teléfono y logo para los PDF.',
        'Apariencia: Cambia el color principal de la interfaz.',
        'Plantillas: Personaliza los textos que se envían por WhatsApp.',
        'Gestión de Datos: Exporta e importa respaldos en formato CSV (Excel).'
      ]
    }
  ];

  return (
    <div className="space-y-8 pb-20 animate-fade-in max-w-4xl mx-auto">
      <div className="text-center space-y-3 py-6">
        <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl text-blue-400 mb-2">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Guía de Uso de TallerManager</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Bienvenido a la plataforma de gestión para talleres mecánicos. Aquí te explicamos cómo sacar el máximo provecho a cada módulo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 hover:border-slate-700 transition-all group shadow-xl">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className={`p-4 bg-slate-950 border border-slate-800 rounded-2xl ${section.color} group-hover:scale-110 transition-transform shadow-inner`}>
                <section.icon size={32} />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                    {section.title}
                  </h2>
                  <p className="text-slate-400 mt-1 leading-relaxed">{section.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {section.items.map((item, iidx) => (
                    <div key={iidx} className="flex items-start gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                      <CheckCircle2 size={16} className="text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-300 leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-600 rounded-3xl p-8 text-center space-y-4 shadow-2xl shadow-blue-900/20">
        <Info className="text-white mx-auto" size={40} />
        <h2 className="text-2xl font-bold text-white">¿Listo para empezar?</h2>
        <p className="text-blue-100 max-w-md mx-auto">
          Ve a la pestaña de "Configuración" para ingresar los datos de tu taller y subir tu logo personalizado. ¡Esto hará que tus órdenes y cotizaciones se vean profesionales!
        </p>
        {onStart && (
          <button 
            onClick={onStart}
            className="mt-4 px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95 shadow-xl flex items-center gap-2 mx-auto"
          >
             Comenzar / Iniciar Sesión <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Guide;
