export type ProviderStatus = 'ready' | 'ready-needs-key' | 'configurable';

export interface ProviderInfo {
  group: number;
  provider: string;
  purpose: string;
  status: ProviderStatus;
  env: string[];
  notes?: string;
}

export const providers: ProviderInfo[] = [
  { group: 1, provider: 'Bitly', purpose: 'Acortar y medir enlaces/QR', status: 'ready-needs-key', env: ['BITLY_TOKEN'] },
  { group: 1, provider: 'ClickMeter', purpose: 'Tracking de enlaces', status: 'configurable', env: ['CLICKMETER_API_KEY', 'CLICKMETER_ENDPOINT'], notes: 'Endpoint configurable para evitar acoplarse a cambios de versión.' },
  { group: 2, provider: 'Geoapify', purpose: 'Geocodificación y autocompletado', status: 'ready-needs-key', env: ['GEOAPIFY_API_KEY'] },
  { group: 2, provider: 'Mapbox', purpose: 'Geocodificación y mapas', status: 'ready-needs-key', env: ['MAPBOX_ACCESS_TOKEN'] },
  { group: 3, provider: 'ApiFlash', purpose: 'Capturas de sitios web', status: 'ready-needs-key', env: ['APIFLASH_ACCESS_KEY'] },
  { group: 3, provider: 'Screenshotlayer', purpose: 'Capturas de sitios web', status: 'ready-needs-key', env: ['SCREENSHOTLAYER_ACCESS_KEY'] },
  { group: 4, provider: 'APITemplate.io', purpose: 'Generar imágenes desde plantillas', status: 'ready-needs-key', env: ['APITEMPLATE_API_KEY'] },
  { group: 4, provider: 'PhotoRoom', purpose: 'Quitar/editar fondos', status: 'ready-needs-key', env: ['PHOTOROOM_API_KEY', 'PHOTOROOM_ENDPOINT'], notes: 'PHOTOROOM_ENDPOINT puede sobrescribirse si cambia la versión del servicio.' },
  { group: 4, provider: 'Tinify', purpose: 'Comprimir imágenes', status: 'ready-needs-key', env: ['TINIFY_API_KEY'] },
  { group: 5, provider: 'CraftMyPDF', purpose: 'Generar PDFs', status: 'ready-needs-key', env: ['CRAFTMYPDF_API_KEY'] },
  { group: 5, provider: 'BuildPDF', purpose: 'Generar PDFs alternativo', status: 'configurable', env: ['BUILDPDF_API_KEY', 'BUILDPDF_ENDPOINT'] },
  { group: 6, provider: 'CarVector', purpose: 'Datos de vehículos', status: 'configurable', env: ['CARVECTOR_API_KEY', 'CARVECTOR_ENDPOINT'] },
  { group: 7, provider: 'Numverify', purpose: 'Validar teléfonos', status: 'ready-needs-key', env: ['NUMVERIFY_ACCESS_KEY'] },
  { group: 7, provider: 'Mailboxlayer', purpose: 'Validar emails', status: 'ready-needs-key', env: ['MAILBOXLAYER_ACCESS_KEY'] },
  { group: 8, provider: 'Ayrshare', purpose: 'Publicar en redes sociales', status: 'ready-needs-key', env: ['AYRSHARE_API_KEY'] },
  { group: 8, provider: 'PostLake', purpose: 'Automatización social alternativa', status: 'configurable', env: ['POSTLAKE_API_KEY', 'POSTLAKE_ENDPOINT'] },
  { group: 9, provider: 'Open-Meteo', purpose: 'Clima', status: 'ready', env: [] },
  { group: 9, provider: 'Ticketmaster', purpose: 'Buscar eventos', status: 'ready-needs-key', env: ['TICKETMASTER_API_KEY'] },
  { group: 9, provider: 'Eventbrite', purpose: 'Consultar eventos conocidos/propios', status: 'ready-needs-key', env: ['EVENTBRITE_TOKEN'], notes: 'La búsqueda pública general de Eventbrite está deprecada; se integra consulta por ID.' },
  { group: 9, provider: 'Tripadvisor Terra', purpose: 'Hoteles, restaurantes y atracciones', status: 'ready-needs-key', env: ['TRIPADVISOR_API_KEY'], notes: 'Requiere plan/licencia Terra con acceso a los endpoints usados.' },
  { group: 10, provider: 'Gemini', purpose: 'IA multimodal y análisis', status: 'ready-needs-key', env: ['GEMINI_API_KEY', 'GEMINI_MODEL'] },
];

export function providerSummary() {
  return providers.map(({ group, provider, purpose, status }) => ({ group, provider, purpose, status }));
}
