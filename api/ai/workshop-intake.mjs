import { chatAuto } from '../../api-hub/src/llm-router.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, parseJsonObject, readJson, requireMethod, sendJson } from '../_lib/http.mjs';
import { normalizeWorkshopIntake, WORKSHOP_SYSTEM } from '../_lib/workshop-ai.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);
    const body = await readJson(req);
    const transcript = cleanString(body.transcript, 12000);
    if (!transcript) {
      const error = new Error('No hay transcripción para preparar la orden.');
      error.statusCode = 400;
      error.code = 'transcript_required';
      throw error;
    }

    const prompt = `Convierte la siguiente nota de voz de recepción de taller en JSON estricto y nada más. Extrae únicamente información explícita. Si un dato no fue mencionado, usa cadena vacía, null o arreglo vacío. Si se menciona un trabajo o repuesto sin valor, usa amount 0. No confundas patente con VIN y no inventes datos.\n\nFormato exacto:\n{"clientName":"","phone":"","plate":"","brand":"","model":"","year":null,"vin":"","mileage":null,"reason":"","laborItems":[{"description":"","amount":0}],"expenses":[{"description":"","amount":0}],"observations":"","confidenceNotes":[]}\n\nTranscripción:\n${transcript}`;

    const result = await chatAuto({
      prompt,
      system: WORKSHOP_SYSTEM,
      temperature: 0,
      maxTokens: 1800,
    });
    const draft = normalizeWorkshopIntake(parseJsonObject(result.text));
    sendJson(res, 200, {
      draft,
      transcript,
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    if (error?.message?.includes('Ningún proveedor')) {
      error.statusCode = 503;
      error.code = 'ai_not_configured';
      error.message = 'No hay un proveedor de IA configurado para preparar la orden.';
    }
    handleApiError(res, error);
  }
}
