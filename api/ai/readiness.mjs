import { activeLlmProviders } from '../../api-hub/src/llm-router.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { handleApiError, requireMethod, sendJson } from '../_lib/http.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET');
    const configuredProviders = activeLlmProviders()
      .filter((item) => item.configured)
      .map((item) => item.name);

    sendJson(res, 200, {
      ok: true,
      aiConfigured: configuredProviders.length > 0,
      voiceConfigured: providerStatus('groq').configured,
      vinConfigured: providerStatus('carvector').configured && Boolean(process.env.CARVECTOR_VIN_PATH_TEMPLATE),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
