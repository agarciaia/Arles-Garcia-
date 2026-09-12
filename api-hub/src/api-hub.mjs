import { providers, providerStatus, allProviderStatus } from './providers.mjs';

function requireKey(providerName) {
  const p = providers[providerName];
  if (!p) throw new Error(`Proveedor desconocido: ${providerName}`);
  if (!p.env) return null;
  const key = process.env[p.env];
  if (!key) throw new Error(`${providerName} no está activado. Falta ${p.env}.`);
  return key;
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function binaryFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = text;
    throw err;
  }
  return res.arrayBuffer();
}

function cleanObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export { providers, providerStatus, allProviderStatus };

// 1) ENLACES / QR ------------------------------------------------------------
export async function shortenWithBitly(longUrl) {
  const token = requireKey('bitly');
  return jsonFetch(`${providers.bitly.baseUrl}/shorten`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ long_url: longUrl })
  });
}

export async function clickMeterRequest(path, { method = 'GET', query = {}, body, headers = {} } = {}) {
  const key = requireKey('clickmeter');
  const q = new URLSearchParams(cleanObject(query));
  const url = `${providers.clickmeter.baseUrl}/${String(path).replace(/^\//, '')}${q.toString() ? `?${q}` : ''}`;
  return jsonFetch(url, {
    method,
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

// 2) MAPAS / UBICACIÓN -------------------------------------------------------
export async function geocodeWithGeoapify(text, { limit = 5, lang = 'es', countryCode = 'cl' } = {}) {
  const key = requireKey('geoapify');
  const q = new URLSearchParams({ text, format: 'json', limit: String(limit), lang, apiKey: key });
  if (countryCode) q.set('filter', `countrycode:${countryCode}`);
  return jsonFetch(`${providers.geoapify.baseUrl}/geocode/search?${q}`);
}

export async function autocompleteWithGeoapify(text, { limit = 8, lang = 'es', countryCode = 'cl' } = {}) {
  const key = requireKey('geoapify');
  const q = new URLSearchParams({ text, format: 'json', limit: String(limit), lang, apiKey: key });
  if (countryCode) q.set('filter', `countrycode:${countryCode}`);
  return jsonFetch(`${providers.geoapify.baseUrl}/geocode/autocomplete?${q}`);
}

export async function geocodeWithMapbox(text, { country = 'cl', language = 'es', limit = 5 } = {}) {
  const token = requireKey('mapbox');
  const q = new URLSearchParams({ q: text, country, language, limit: String(limit), access_token: token });
  return jsonFetch(`${providers.mapbox.baseUrl}/search/geocode/v6/forward?${q}`);
}

// 3) CAPTURAS WEB ------------------------------------------------------------
export function screenshotlayerUrl(targetUrl, options = {}) {
  const key = requireKey('screenshotlayer');
  const q = new URLSearchParams({ access_key: key, url: targetUrl, viewport: '1440x900', ...options });
  return `${providers.screenshotlayer.baseUrl}/capture?${q}`;
}

export function apiFlashUrl(targetUrl, options = {}) {
  const key = requireKey('apiflash');
  const q = new URLSearchParams({ access_key: key, url: targetUrl, format: 'jpeg', full_page: 'true', ...options });
  return `${providers.apiflash.baseUrl}/urltoimage?${q}`;
}

// 4) IMÁGENES ---------------------------------------------------------------
export async function generateWithApiTemplate(templateId, data) {
  const key = requireKey('apitemplate');
  const q = new URLSearchParams({ template_id: templateId });
  return jsonFetch(`${providers.apitemplate.baseUrl}/create?${q}`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function removeBackgroundWithPhotoRoom(imageBlob, filename = 'image.jpg') {
  const key = requireKey('photoroom');
  const form = new FormData();
  form.append('image_file', imageBlob, filename);
  return binaryFetch(`${providers.photoroom.baseUrl}/segment`, {
    method: 'POST',
    headers: { 'x-api-key': key },
    body: form
  });
}

export async function compressWithTinify(imageBlob) {
  const key = requireKey('tinify');
  const auth = Buffer.from(`api:${key}`).toString('base64');
  return jsonFetch(`${providers.tinify.baseUrl}/shrink`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: imageBlob
  });
}

// 5) PDF --------------------------------------------------------------------
export async function createCraftMyPdf(payload) {
  const key = requireKey('craftmypdf');
  return jsonFetch(`${providers.craftmypdf.baseUrl}/create`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function buildPdfRequest(path, { method = 'POST', body, query = {}, headers = {} } = {}) {
  return providerRequest('buildpdf', path, { method, body, query, headers });
}

// 6) VEHÍCULOS --------------------------------------------------------------
export async function carVectorRequest(path, { method = 'GET', body, query = {}, headers = {} } = {}) {
  return providerRequest('carvector', path, { method, body, query, headers });
}

// 7) VALIDACIÓN -------------------------------------------------------------
export async function validatePhone(number, countryCode = 'CL') {
  const key = requireKey('numverify');
  const q = new URLSearchParams({ number, country_code: countryCode });
  return jsonFetch(`${providers.numverify.baseUrl}/validate?${q}`, { headers: { apikey: key } });
}

export async function validateEmail(email) {
  const key = requireKey('mailboxlayer');
  const q = new URLSearchParams({ email });
  return jsonFetch(`${providers.mailboxlayer.baseUrl}/check?${q}`, { headers: { apikey: key } });
}

// 8) REDES SOCIALES ---------------------------------------------------------
export async function publishWithAyrshare({ post, platforms, mediaUrls = [], scheduleDate }) {
  const key = requireKey('ayrshare');
  const body = { post, platforms };
  if (mediaUrls.length) body.mediaUrls = mediaUrls;
  if (scheduleDate) body.scheduleDate = scheduleDate;
  return jsonFetch(`${providers.ayrshare.baseUrl}/post`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function postLakeRequest(path, { method = 'GET', body, query = {}, headers = {} } = {}) {
  return providerRequest('postlake', path, { method, body, query, headers });
}

// 9) TURISMO / HUÉSPED ------------------------------------------------------
export async function getWeather({ latitude, longitude, timezone = 'America/Santiago', forecastDays = 7 }) {
  const q = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone,
    forecast_days: String(forecastDays),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  });
  return jsonFetch(`${providers.openmeteo.baseUrl}/forecast?${q}`);
}

export async function searchTicketmasterEvents({ city, countryCode = 'CL', size = 20, startDateTime, keyword, latlong, radius } = {}) {
  const key = requireKey('ticketmaster');
  const params = cleanObject({ apikey: key, countryCode, size: String(size), city, startDateTime, keyword, latlong, radius });
  return jsonFetch(`${providers.ticketmaster.baseUrl}/events.json?${new URLSearchParams(params)}`);
}

export async function getEventbriteEvent(eventId) {
  const token = requireKey('eventbrite');
  return jsonFetch(`${providers.eventbrite.baseUrl}/events/${encodeURIComponent(eventId)}/`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function searchTripadvisorLocations(query, { countryCode = 'CL', category, language = 'es', size = 20 } = {}) {
  const key = requireKey('tripadvisor');
  const params = cleanObject({ query, country_code: countryCode, category, language, size: String(size) });
  return jsonFetch(`${providers.tripadvisor.baseUrl}/locations/search?${new URLSearchParams(params)}`, {
    headers: { 'X-API-Key': key, Accept: 'application/json' }
  });
}

// 10) IA --------------------------------------------------------------------
export async function askGemini(prompt, { model = 'gemini-3.8-flash', previousInteractionId } = {}) {
  const key = requireKey('gemini');
  const body = { model, input: prompt };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;
  return jsonFetch(`${providers.gemini.baseUrl}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Cliente genérico para proveedores/endpoints variables según plan.
export async function providerRequest(providerName, path, { method = 'GET', headers = {}, query = {}, body } = {}) {
  const p = providers[providerName];
  if (!p) throw new Error(`Proveedor desconocido: ${providerName}`);
  const key = p.env ? requireKey(providerName) : null;
  const q = new URLSearchParams(cleanObject(query));
  const url = `${p.baseUrl}${path.startsWith('/') ? path : `/${path}`}${q.toString() ? `?${q}` : ''}`;
  const finalHeaders = { ...headers };
  if (key && !finalHeaders.Authorization && !finalHeaders.apikey && !finalHeaders['X-API-KEY'] && !finalHeaders['X-Api-Key']) {
    finalHeaders.Authorization = `Bearer ${key}`;
  }
  if (body !== undefined && !finalHeaders['Content-Type'] && !(body instanceof FormData)) finalHeaders['Content-Type'] = 'application/json';
  return jsonFetch(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : (typeof body === 'string' || body instanceof Blob || body instanceof FormData ? body : JSON.stringify(body))
  });
}
