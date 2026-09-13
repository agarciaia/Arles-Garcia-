import { validatePhone } from '../../api-hub/src/api-hub.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, readJson, requireMethod, sendJson } from '../_lib/http.mjs';

function normalizePhone(value) {
  return cleanString(value, 40).replace(/[\s()-]/g, '');
}

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);

    if (!providerStatus('numverify').configured) {
      const error = new Error('La validación de teléfonos aún no está configurada. Falta NUMVERIFY_API_KEY en el backend.');
      error.statusCode = 503;
      error.code = 'phone_validation_not_configured';
      throw error;
    }

    const body = await readJson(req, 20_000);
    const phone = normalizePhone(body?.phone);
    if (!phone || phone.length < 7) {
      const error = new Error('Ingresa un número de teléfono válido para revisar.');
      error.statusCode = 400;
      error.code = 'invalid_phone';
      throw error;
    }

    const result = await validatePhone(phone, 'CL');
    sendJson(res, 200, {
      valid: Boolean(result?.valid),
      number: result?.number || phone,
      localFormat: result?.local_format || result?.localFormat || null,
      internationalFormat: result?.international_format || result?.internationalFormat || null,
      countryName: result?.country_name || result?.countryName || null,
      carrier: result?.carrier || null,
      lineType: result?.line_type || result?.lineType || null,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
