import { transcribeWithGroq } from '../../api-hub/src/llm-router.mjs';
import { providerStatus } from '../../api-hub/src/providers.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, readJson, requireMethod, sendJson } from '../_lib/http.mjs';

const MAX_BASE64_LENGTH = 4_000_000;

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);
    if (!providerStatus('groq').configured) {
      const error = new Error('La función de voz aún no está disponible. Falta configurar Groq.');
      error.statusCode = 503;
      error.code = 'groq_not_configured';
      throw error;
    }

    const body = await readJson(req, 4_500_000);
    const audioBase64 = cleanString(body.audioBase64, MAX_BASE64_LENGTH + 1);
    if (!audioBase64) {
      const error = new Error('No se recibió audio para transcribir.');
      error.statusCode = 400;
      error.code = 'audio_required';
      throw error;
    }
    if (audioBase64.length > MAX_BASE64_LENGTH) {
      const error = new Error('El audio es demasiado largo. Graba una nota más breve e inténtalo nuevamente.');
      error.statusCode = 413;
      error.code = 'audio_too_large';
      throw error;
    }

    const mimeType = cleanString(body.mimeType, 100) || 'audio/webm';
    if (!mimeType.startsWith('audio/')) {
      const error = new Error('El formato del audio no es válido.');
      error.statusCode = 400;
      error.code = 'invalid_audio_type';
      throw error;
    }

    const bytes = Buffer.from(audioBase64, 'base64');
    if (!bytes.length) {
      const error = new Error('El audio recibido está vacío.');
      error.statusCode = 400;
      error.code = 'empty_audio';
      throw error;
    }

    const safeFilename = cleanString(body.filename, 120).replace(/[^a-zA-Z0-9._-]/g, '_') || 'audio.webm';
    const blob = new Blob([bytes], { type: mimeType });
    const result = await transcribeWithGroq(blob, { filename: safeFilename, language: 'es' });
    sendJson(res, 200, { text: result.text || '', provider: 'groq', model: result.model });
  } catch (error) {
    handleApiError(res, error);
  }
}
