import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SuperAdmin from './components/SuperAdmin';
import './index.css';

// Mantener la PWA instalada alineada con la última versión publicada.
// El navegador normalmente limita la frecuencia de comprobación del Service Worker;
// aquí pedimos una revisión explícita al abrir/volver a la app y recargamos una sola
// vez cuando el nuevo worker toma el control.
if ('serviceWorker' in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });

      const activateWaitingWorker = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      activateWaitingWorker();
      await registration.update().catch(() => undefined);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => undefined);
        }
      });

      console.log('Gestión Taller PWA actualizada y disponible sin conexión:', registration.scope);
    } catch (error) {
      console.warn('⚠️ No se pudo registrar/actualizar el Service Worker:', error);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode>{window.location.pathname === '/superadmin' ? <SuperAdmin /> : <App />}</React.StrictMode>);
