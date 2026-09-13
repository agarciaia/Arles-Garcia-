import { providerStatus } from '../../api-hub/src/providers.mjs';
import { activeLlmProviders } from '../../api-hub/src/llm-router.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { handleApiError, requireMethod, sendJson } from '../_lib/http.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET');
    await requireFirebaseUser(req);

    const llmProviders = activeLlmProviders();
    const configuredLlmProviders = llmProviders
      .filter((item) => item.configured)
      .map((item) => item.name);

    sendJson(res, 200, {
      ai: configuredLlmProviders.length > 0,
      voice: providerStatus('groq').configured,
      vin: providerStatus('carvector').configured && Boolean(process.env.CARVECTOR_VIN_PATH_TEMPLATE),
      phoneValidation: providerStatus('numverify').configured,
      imageOptimization: providerStatus('tinify').configured,
      cloudPdf: providerStatus('craftmypdf').configured || providerStatus('buildpdf').configured,
      configuredLlmProviders,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
