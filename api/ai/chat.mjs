import { chatAuto } from '../../api-hub/src/llm-router.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, readJson, requireMethod, sendJson } from '../_lib/http.mjs';
import { WORKSHOP_SYSTEM } from '../_lib/workshop-ai.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);
    const body = await readJson(req);
    const message = cleanString(body.message, 8000);
    if (!message) {
      const error = new Error('Escribe un mensaje para el asistente.');
      error.statusCode = 400;
      error.code = 'message_required';
      throw error;
    }

    const history = Array.isArray(body.history)
      ? body.history.slice(-20).map((item) => ({
          role: item?.role === 'model' || item?.role === 'assistant' ? 'assistant' : 'user',
          content: cleanString(item?.content, 5000),
        })).filter((item) => item.content)
      : [];

    const result = await chatAuto({
      messages: [...history, { role: 'user', content: message }],
      system: cleanString(body.system, 3000) || WORKSHOP_SYSTEM,
      temperature: body.useThinking ? 0.25 : 0.15,
      maxTokens: body.useThinking ? 1800 : 1000,
    });

    sendJson(res, 200, { text: result.text || '', provider: result.provider, model: result.model });
  } catch (error) {
    if (error?.message?.includes('Ningún proveedor')) {
      error.statusCode = 503;
      error.code = 'ai_not_configured';
      error.message = 'El asistente IA aún no tiene un proveedor disponible.';
    }
    handleApiError(res, error);
  }
}
