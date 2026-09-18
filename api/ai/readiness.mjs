import { activeLlmProviders } from '../../api-hub/src/llm-router.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { handleApiError, requireMethod, sendJson } from '../_lib/http.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET');
    const configuredProviders = activeLlmProviders()
      .filter((item) => item.configured)
      .map((item) => item.name);

    const carVectorReady = providerStatus('carvector').configured
      && Boolean(process.env.CARVECTOR_VIN_PATH_TEMPLATE);

    sendJson(res, 200, {
      ok: true,
      aiConfigured: configuredProviders.length > 0,
      voiceConfigured: providerStatus('groq').configured,
      vinConfigured: true,
      vinProvider: carVectorReady ? 'carvector+nhtsa-fallback' : 'nhtsa-vpic',
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
