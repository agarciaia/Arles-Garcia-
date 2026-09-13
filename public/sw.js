const CACHE_NAME = 'gestion-taller-v4';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json', '/app_icon.png'];
const OPTIONAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const asset of CORE_ASSETS) {
      try {
        const response = await fetch(asset, { cache: 'reload' });
        if (response.ok) await cache.put(asset, response);
      } catch {
        // La instalación puede continuar con los recursos disponibles.
      }
    }
    await Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isFirebaseRequest = requestUrl.hostname.includes('firebase')
    || requestUrl.hostname.includes('googleapis');
  if (isFirebaseRequest) return;

  // Para navegación siempre intentamos primero la versión publicada más reciente.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', response.clone());
        return response;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Los assets versionados de Vite pueden usar caché, pero se revalidan en segundo plano.
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      event.waitUntil(fetch(event.request, { cache: 'no-cache' }).then(async (response) => {
        if (response.ok || response.type === 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response);
        }
      }).catch(() => undefined));
      return cached;
    }

    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
