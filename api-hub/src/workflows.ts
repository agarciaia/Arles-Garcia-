import {
  apiFlashScreenshotUrl,
  bitlyShorten,
  geminiGenerate,
  geoapifyGeocode,
  openMeteoForecast,
} from './providers.js';

/**
 * Ejemplo real para tus prospectos QR:
 * 1) geocodifica un negocio,
 * 2) prepara una captura de su web,
 * 3) acorta el enlace de demo,
 * 4) pide a IA una mini auditoría.
 */
export async function buildProspectPack(input: {
  businessName: string;
  address: string;
  website?: string;
  demoUrl?: string;
}) {
  const geocode = await geoapifyGeocode(input.address);
  const screenshotUrl = input.website ? apiFlashScreenshotUrl(input.website, { full_page: true }) : undefined;
  const shortDemo = input.demoUrl ? await bitlyShorten(input.demoUrl) : undefined;

  const ai = await geminiGenerate(
    [
      'Analiza este prospecto para venderle una solución digital QR.',
      `Negocio: ${input.businessName}`,
      `Dirección: ${input.address}`,
      input.website ? `Web: ${input.website}` : '',
      'Devuelve: 3 oportunidades, producto recomendado y un mensaje WhatsApp breve. No inventes datos.',
    ].filter(Boolean).join('\n'),
  );

  return { geocode, screenshotUrl, shortDemo, ai: ai.text };
}

/** Ejemplo para QR Huésped: clima del lugar usando coordenadas ya conocidas. */
export async function buildGuestWeather(latitude: number, longitude: number) {
  return openMeteoForecast(latitude, longitude);
}
