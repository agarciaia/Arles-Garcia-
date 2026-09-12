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

export { providers, providerStatus, allProviderStatus };

export async function shortenWithBitly(longUrl) {
  const token = requireKey('bitly');
  return jsonFetch(`${providers.bitly.baseUrl}/shorten`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ long_url: longUrl })
  });
}

export async function geocodeWithGeoapify(text, { limit = 5, lang = 'es' } = {}) {
  const key = requireKey('geoapify');
  const q = new URLSearchParams({ text, format: 'json', limit: String(limit), lang, apiKey: key });
  return jsonFetch(`${providers.geoapify.baseUrl}/geocode/search?${q}`);
}

export async function geocodeWithMapbox(text, { country = 'cl', language = 'es', limit = 5 } = {}) {
  const token = requireKey('mapbox');
  const q = new URLSearchParams({ q: text, country, language, limit: String(limit), access_token: token });
  return jsonFetch(`${providers.mapbox.baseUrl}/search/geocode/v6/forward?${q}`);
}

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

export async function createCraftMyPdf(payload) {
  const key = requireKey('craftmypdf');
  return jsonFetch(`${providers.craftmypdf.baseUrl}/create`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

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

export async function getWeather({ latitude, longitude, timezone = 'America/Santiago', forecastDays = 7 }) {
  const q = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone,
    forecast_days: String(forecastDays),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  });
  return jsonFetch(`${providers.openmeteo.baseUrl}/forecast?${q}`);
}

export async function searchTicketmasterEvents({ city, countryCode = 'CL', size = 20, startDateTime }) {
  const key = requireKey('ticketmaster');
  const params = { apikey: key, countryCode, size: String(size) };
  if (city) params.city = city;
  if (startDateTime) params.startDateTime = startDateTime;
  return jsonFetch(`${providers.ticketmaster.baseUrl}/events.json?${new URLSearchParams(params)}`);
}

export async function searchTripadvisorLocations(searchQuery, { latLong, language = 'es' } = {}) {
  const key = requireKey('tripadvisor');
  const params = { key, searchQuery, language };
  if (latLong) params.latLong = latLong;
  return jsonFetch(`${providers.tripadvisor.baseUrl}/location/search?${new URLSearchParams(params)}`);
}

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

// Para proveedores con flujos de archivo/OAuth o endpoints variables según plan,
// este helper permite integrarlos sin exponer claves al frontend.
export async function providerRequest(providerName, path, { method = 'GET', headers = {}, query = {}, body } = {}) {
  const p = providers[providerName];
  if (!p) throw new Error(`Proveedor desconocido: ${providerName}`);
  const key = p.env ? requireKey(providerName) : null;
  const q = new URLSearchParams(query);
  const url = `${p.baseUrl}${path}${q.toString() ? `?${q}` : ''}`;
  const finalHeaders = { ...headers };
  if (key && !finalHeaders.Authorization && !finalHeaders.apikey && !finalHeaders['X-API-KEY']) {
    finalHeaders.Authorization = `Bearer ${key}`;
  }
  if (body !== undefined && !finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
  return jsonFetch(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  });
}
