import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registrar el Service Worker para soporte PWA avanzado fuera de línea
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('🛡️ TallerManager Service Worker registrado de fábrica:', registration.scope);
      })
      .catch((error) => {
        console.warn('⚠️ No se pudo registrar el Service Worker (esperado en algunos navegadores de prueba):', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);