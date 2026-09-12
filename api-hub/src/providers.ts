import { binaryFetch, env, jsonFetch, optionalEnv, withQuery } from './core.js';

// 1) LINKS / QR --------------------------------------------------------------
export async function bitlyShorten(longUrl: string) {
  return jsonFetch<{ link: string; id: string }>('Bitly', 'https://api-ssl.bitly.com/v4/shorten', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('BITLY_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ long_url: longUrl }),
  });
}

export async function clickMeterRequest<T = unknown>(path: string, init: RequestInit = {}) {
  const endpoint = env('CLICKMETER_ENDPOINT').replace(/\/$/, '');
  return jsonFetch<T>('ClickMeter', `${endpoint}/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': env('CLICKMETER_API_KEY'),
      ...(init.headers ?? {}),
    },
  });
}

// 2) GEOCODING / MAPS --------------------------------------------------------
export async function geoapifyGeocode(text: string, countryCode = 'cl') {
  const url = withQuery('https://api.geoapify.com/v1/geocode/search', {
    text,
    format: 'json',
    filter: countryCode ? `countrycode:${countryCode}` : undefined,
    apiKey: env('GEOAPIFY_API_KEY'),
  });
  return jsonFetch<unknown>('Geoapify', url);
}

export async function geoapifyAutocomplete(text: string, countryCode = 'cl', limit = 8) {
  const url = withQuery('https://api.geoapify.com/v1/geocode/autocomplete', {
    text,
    format: 'json',
    filter: countryCode ? `countrycode:${countryCode}` : undefined,
    limit,
    apiKey: env('GEOAPIFY_API_KEY'),
  });
  return jsonFetch<unknown>('Geoapify', url);
}

export async function mapboxGeocode(query: string, country = 'cl', limit = 5) {
  const url = withQuery('https://api.mapbox.com/search/geocode/v6/forward', {
    q: query,
    country,
    limit,
    access_token: env('MAPBOX_ACCESS_TOKEN'),
  });
  return jsonFetch<unknown>('Mapbox', url);
}

// 3) SCREENSHOTS -------------------------------------------------------------
export function apiFlashScreenshotUrl(targetUrl: string, options: Record<string, string | number | boolean> = {}) {
  return withQuery('https://api.apiflash.com/v1/urltoimage', {
    access_key: env('APIFLASH_ACCESS_KEY'),
    url: targetUrl,
    ...options,
  }).toString();
}

export function screenshotLayerUrl(targetUrl: string, options: Record<string, string | number | boolean> = {}) {
  return withQuery('https://api.screenshotlayer.com/api/capture', {
    access_key: env('SCREENSHOTLAYER_ACCESS_KEY'),
    url: targetUrl,
    ...options,
  }).toString();
}

// 4) IMAGE GENERATION / CLEANUP / OPTIMIZATION -------------------------------
export async function apiTemplateGenerate(templateId: string, data: unknown) {
  const url = withQuery('https://api.apitemplate.io/v1/create', { template_id: templateId });
  return jsonFetch<unknown>('APITemplate.io', url, {
    method: 'POST',
    headers: {
      'X-API-KEY': env('APITEMPLATE_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function photoRoomRemoveBackground(file: Blob, filename = 'image.jpg') {
  const endpoint = optionalEnv('PHOTOROOM_ENDPOINT') || 'https://sdk.photoroom.com/v1/segment';
  const form = new FormData();
  form.append('image_file', file, filename);
  return binaryFetch('PhotoRoom', endpoint, {
    method: 'POST',
    headers: { 'x-api-key': env('PHOTOROOM_API_KEY') },
    body: form,
  });
}

export async function tinifyCompress(image: Blob) {
  const key = env('TINIFY_API_KEY');
  const auth = btoa(`api:${key}`);
  const response = await fetch('https://api.tinify.com/shrink', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: image,
  });
  const body = (await response.json().catch(() => null)) as any;
  if (!response.ok) throw new Error(`Tinify failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

// 5) PDF GENERATION ----------------------------------------------------------
export async function craftMyPdfCreate(templateId: string, data: unknown, outputFile = 'output.pdf') {
  return jsonFetch<{ file?: string }>('CraftMyPDF', 'https://api.craftmypdf.com/v1/create', {
    method: 'POST',
    headers: {
      'X-API-KEY': env('CRAFTMYPDF_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      export_type: 'json',
      output_file: outputFile,
      data,
    }),
  });
}

export async function buildPdfRequest<T = unknown>(path: string, body?: unknown) {
  const endpoint = env('BUILDPDF_ENDPOINT').replace(/\/$/, '');
  return jsonFetch<T>('BuildPDF', `${endpoint}/${path.replace(/^\//, '')}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${env('BUILDPDF_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// 6) VEHICLES ---------------------------------------------------------------
export async function carVectorRequest<T = unknown>(path: string, params: Record<string, string | number> = {}) {
  const base = env('CARVECTOR_ENDPOINT').replace(/\/$/, '');
  const url = withQuery(`${base}/${path.replace(/^\//, '')}`, params);
  return jsonFetch<T>('CarVector', url, {
    headers: { Authorization: `Bearer ${env('CARVECTOR_API_KEY')}` },
  });
}

// 7) PHONE / EMAIL VALIDATION ------------------------------------------------
export async function numverifyCheck(phone: string, countryCode = 'CL') {
  const url = withQuery('https://apilayer.net/api/validate', {
    access_key: env('NUMVERIFY_ACCESS_KEY'),
    number: phone,
    country_code: countryCode,
    format: 1,
  });
  return jsonFetch<unknown>('Numverify', url);
}

export async function mailboxLayerCheck(email: string) {
  const url = withQuery('https://apilayer.net/api/check', {
    access_key: env('MAILBOXLAYER_ACCESS_KEY'),
    email,
    smtp: 1,
    format: 1,
  });
  return jsonFetch<unknown>('Mailboxlayer', url);
}

// 8) SOCIAL PUBLISHING -------------------------------------------------------
export async function ayrsharePost(post: string, platforms: string[], mediaUrls?: string[], scheduleDate?: string) {
  return jsonFetch<unknown>('Ayrshare', 'https://app.ayrshare.com/api/post', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('AYRSHARE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ post, platforms, mediaUrls, scheduleDate }),
  });
}

export async function postLakeRequest<T = unknown>(path: string, body?: unknown) {
  const endpoint = env('POSTLAKE_ENDPOINT').replace(/\/$/, '');
  return jsonFetch<T>('PostLake', `${endpoint}/${path.replace(/^\//, '')}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${env('POSTLAKE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// 9) WEATHER / EVENTS / TRAVEL ----------------------------------------------
export async function openMeteoForecast(latitude: number, longitude: number, timezone = 'America/Santiago') {
  const url = withQuery('https://api.open-meteo.com/v1/forecast', {
    latitude,
    longitude,
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone,
  });
  return jsonFetch<unknown>('Open-Meteo', url);
}

export async function ticketmasterEvents(params: {
  keyword?: string;
  city?: string;
  countryCode?: string;
  radius?: number;
  latlong?: string;
  size?: number;
} = {}) {
  const url = withQuery('https://app.ticketmaster.com/discovery/v2/events.json', {
    apikey: env('TICKETMASTER_API_KEY'),
    countryCode: params.countryCode ?? 'CL',
    keyword: params.keyword,
    city: params.city,
    radius: params.radius,
    latlong: params.latlong,
    size: params.size ?? 20,
  });
  return jsonFetch<unknown>('Ticketmaster', url);
}

export async function eventbriteEvent(eventId: string) {
  return jsonFetch<unknown>('Eventbrite', `https://www.eventbriteapi.com/v3/events/${encodeURIComponent(eventId)}/`, {
    headers: { Authorization: `Bearer ${env('EVENTBRITE_TOKEN')}` },
  });
}

export async function tripadvisorSearch(query: string, countryCode = 'CL', category?: 'RESTAURANT' | 'ATTRACTION' | 'HOTEL') {
  const url = withQuery('https://terra.tripadvisor.com/api/locations/search', {
    query,
    country_code: countryCode,
    category,
    size: 20,
  });
  return jsonFetch<unknown>('Tripadvisor Terra', url, {
    headers: {
      'X-API-Key': env('TRIPADVISOR_API_KEY'),
      Accept: 'application/json',
    },
  });
}

// 10) AI ---------------------------------------------------------------------
export async function geminiGenerate(prompt: string, model = optionalEnv('GEMINI_MODEL') || 'gemini-3.5-flash') {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const result = await jsonFetch<any>('Gemini', endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': env('GEMINI_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  return {
    raw: result,
    text: result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ?? '',
  };
}
