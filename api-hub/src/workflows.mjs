import {
  apiFlashUrl,
  askGemini,
  geocodeWithGeoapify,
  getWeather,
  searchTicketmasterEvents,
  searchTripadvisorLocations,
  shortenWithBitly,
  validateEmail,
  validatePhone
} from './api-hub.mjs';

// Flujo comercial: combina varias APIs en una sola llamada.
export async function buildProspectPack({
  businessName,
  address,
  website,
  demoUrl,
  phone,
  email
}) {
  const tasks = {
    location: address ? geocodeWithGeoapify(address) : Promise.resolve(null),
    phone: phone ? validatePhone(phone, 'CL') : Promise.resolve(null),
    email: email ? validateEmail(email) : Promise.resolve(null),
    shortDemo: demoUrl ? shortenWithBitly(demoUrl) : Promise.resolve(null)
  };

  const settled = await Promise.allSettled(Object.values(tasks));
  const keys = Object.keys(tasks);
  const results = Object.fromEntries(settled.map((item, index) => [
    keys[index],
    item.status === 'fulfilled' ? item.value : { error: item.reason?.message || String(item.reason) }
  ]));

  const screenshotUrl = website ? apiFlashUrl(website) : null;
  let analysis = null;
  try {
    analysis = await askGemini([
      'Analiza este prospecto para venderle una solución digital QR o presencia digital.',
      `Negocio: ${businessName}`,
      address ? `Dirección: ${address}` : '',
      website ? `Sitio: ${website}` : '',
      'Devuelve: 3 oportunidades, producto recomendado y un WhatsApp breve. No inventes información.'
    ].filter(Boolean).join('\n'));
  } catch (error) {
    analysis = { error: error?.message || String(error) };
  }

  return { ...results, screenshotUrl, analysis };
}

// Flujo QR Huésped: clima + eventos + lugares cercanos.
export async function buildGuestPack({
  latitude,
  longitude,
  city,
  placeQuery,
  countryCode = 'CL'
}) {
  const [weather, events, places] = await Promise.allSettled([
    getWeather({ latitude, longitude }),
    searchTicketmasterEvents({ city, countryCode, latlong: `${latitude},${longitude}` }),
    placeQuery ? searchTripadvisorLocations(placeQuery, { countryCode }) : Promise.resolve(null)
  ]);

  const value = result => result.status === 'fulfilled'
    ? result.value
    : { error: result.reason?.message || String(result.reason) };

  return {
    weather: value(weather),
    events: value(events),
    places: value(places)
  };
}
