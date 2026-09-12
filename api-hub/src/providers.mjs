export const providers = {
  bitly: { group: 1, env: 'BITLY_TOKEN', baseUrl: 'https://api-ssl.bitly.com/v4', purpose: 'Acortar y medir enlaces/QR' },
  clickmeter: { group: 1, env: 'CLICKMETER_API_KEY', baseUrl: process.env.CLICKMETER_BASE_URL || 'https://apiv2.clickmeter.com', purpose: 'Tracking de enlaces y conversiones' },

  geoapify: { group: 2, env: 'GEOAPIFY_API_KEY', baseUrl: 'https://api.geoapify.com/v1', purpose: 'Geocodificación, lugares y mapas' },
  mapbox: { group: 2, env: 'MAPBOX_ACCESS_TOKEN', baseUrl: 'https://api.mapbox.com', purpose: 'Mapas y geocodificación' },

  screenshotlayer: { group: 3, env: 'SCREENSHOTLAYER_ACCESS_KEY', baseUrl: 'https://api.screenshotlayer.com/api', purpose: 'Capturas automáticas de sitios' },
  apiflash: { group: 3, env: 'APIFLASH_ACCESS_KEY', baseUrl: 'https://api.apiflash.com/v1', purpose: 'Capturas automáticas de sitios' },

  apitemplate: { group: 4, env: 'APITEMPLATE_API_KEY', baseUrl: 'https://api.apitemplate.io/v1', purpose: 'Generación de imágenes/PDF desde plantillas' },
  photoroom: { group: 4, env: 'PHOTOROOM_API_KEY', baseUrl: process.env.PHOTOROOM_BASE_URL || 'https://sdk.photoroom.com/v1', purpose: 'Edición y eliminación de fondos' },
  tinify: { group: 4, env: 'TINIFY_API_KEY', baseUrl: 'https://api.tinify.com', purpose: 'Compresión y optimización de imágenes' },

  craftmypdf: { group: 5, env: 'CRAFTMYPDF_API_KEY', baseUrl: 'https://api.craftmypdf.com/v1', purpose: 'Generación automática de PDFs' },
  buildpdf: { group: 5, env: 'BUILDPDF_API_KEY', baseUrl: process.env.BUILDPDF_BASE_URL || 'https://api.buildpdf.com', purpose: 'Generación de PDFs' },

  carvector: { group: 6, env: 'CARVECTOR_API_KEY', baseUrl: process.env.CARVECTOR_BASE_URL || 'https://api.carvector.com', purpose: 'Datos y especificaciones de vehículos' },

  numverify: { group: 7, env: 'NUMVERIFY_API_KEY', baseUrl: 'https://api.apilayer.com/number_verification', purpose: 'Validación de teléfonos' },
  mailboxlayer: { group: 7, env: 'MAILBOXLAYER_API_KEY', baseUrl: 'https://api.apilayer.com/email_verification', purpose: 'Validación de emails' },

  ayrshare: { group: 8, env: 'AYRSHARE_API_KEY', baseUrl: 'https://app.ayrshare.com/api', purpose: 'Publicación y analítica social' },
  postlake: { group: 8, env: 'POSTLAKE_API_KEY', baseUrl: process.env.POSTLAKE_BASE_URL || 'https://api.postlake.ai', purpose: 'Automatización de contenido social' },

  openmeteo: { group: 9, env: null, baseUrl: 'https://api.open-meteo.com/v1', purpose: 'Clima y pronóstico sin API key' },
  ticketmaster: { group: 9, env: 'TICKETMASTER_API_KEY', baseUrl: 'https://app.ticketmaster.com/discovery/v2', purpose: 'Eventos cercanos' },
  eventbrite: { group: 9, env: 'EVENTBRITE_TOKEN', baseUrl: 'https://www.eventbriteapi.com/v3', purpose: 'Consultar eventos de Eventbrite por ID/organización; búsqueda pública general no disponible' },
  tripadvisor: { group: 9, env: 'TRIPADVISOR_API_KEY', baseUrl: 'https://terra.tripadvisor.com/api', purpose: 'Lugares, hoteles, restaurantes y turismo' },

  gemini: { group: 10, env: 'GEMINI_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', purpose: 'IA multimodal y generación de contenido' }
};

export function providerStatus(name) {
  const p = providers[name];
  if (!p) throw new Error(`Proveedor desconocido: ${name}`);
  return {
    ...p,
    configured: p.env ? Boolean(process.env[p.env]) : true,
    requiresKey: Boolean(p.env)
  };
}

export function allProviderStatus() {
  return Object.entries(providers).map(([name]) => ({ name, ...providerStatus(name) }));
}
