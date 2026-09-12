import { activeLlmProviders } from '../../api-hub/src/llm-router.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { handleApiError, requireMethod, sendJson } from '../_lib/http.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET');
    await requireFirebaseUser(req);
    const providers = activeLlmProviders();
    const configuredProviders = providers.filter((item) => item.configured).map((item) => item.name);
    sendJson(res, 200, {
      aiConfigured: configuredProviders.length > 0,
      voiceConfigured: providerStatus('groq').configured,
      vinConfigured: providerStatus('carvector').configured && Boolean(process.env.CARVECTOR_VIN_PATH_TEMPLATE),
      configuredProviders,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
