import { chatAuto } from '../../api-hub/src/llm-router.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, parseJsonObject, readJson, requireMethod, sendJson } from '../_lib/http.mjs';
import { normalizeServiceAnalysis, WORKSHOP_SYSTEM } from '../_lib/workshop-ai.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);
    const body = await readJson(req);
    const notes = cleanString(body.notes, 12000);
    const service = body.service && typeof body.service === 'object' ? body.service : null;
    if (!notes && !service) {
      const error = new Error('Agrega notas o selecciona un servicio para analizar.');
      error.statusCode = 400;
      error.code = 'service_notes_required';
      throw error;
    }

    const serviceContext = service ? JSON.stringify({
      clientName: cleanString(service.clientName, 200),
      plate: cleanString(service.plate, 30),
      brand: cleanString(service.brand, 100),
      model: cleanString(service.model, 120),
      year: service.year ?? null,
      vin: cleanString(service.vin, 40),
      mileage: service.mileage ?? null,
      reason: cleanString(service.reason, 2000),
      laborItems: Array.isArray(service.laborItems) ? service.laborItems.slice(0, 30) : [],
      expenses: Array.isArray(service.expenses) ? service.expenses.slice(0, 30) : [],
      observations: cleanString(service.observations, 3000),
    }) : '{}';

    const prompt = `Analiza esta información de un servicio de taller como apoyo administrativo. Devuelve JSON estricto y nada más con este formato:\n{"summary":"","detectedWork":[],"mentionedParts":[],"missingInformation":[],"suggestedQuestions":[],"customerMessage":"","disclaimer":""}\n\nReglas: detectedWork y mentionedParts solo deben contener elementos presentes en la información entregada. missingInformation y suggestedQuestions son sugerencias. customerMessage debe ser breve, prudente y entendible. No confirmes fallas mecánicas como hechos si no fueron verificadas.\n\nServicio: ${serviceContext}\n\nNotas adicionales: ${notes}`;

    const result = await chatAuto({ prompt, system: WORKSHOP_SYSTEM, temperature: 0.1, maxTokens: 1800 });
    const analysis = normalizeServiceAnalysis(parseJsonObject(result.text));
    sendJson(res, 200, { analysis, provider: result.provider, model: result.model });
  } catch (error) {
    if (error?.message?.includes('Ningún proveedor')) {
      error.statusCode = 503;
      error.code = 'ai_not_configured';
      error.message = 'No hay un proveedor de IA disponible para analizar el servicio.';
    }
    handleApiError(res, error);
  }
}
