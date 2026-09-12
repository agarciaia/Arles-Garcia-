import { chatAuto } from '../../api-hub/src/llm-router.mjs';
import { requireFirebaseUser } from '../_lib/auth.mjs';
import { cleanString, handleApiError, readJson, requireMethod, sendJson } from '../_lib/http.mjs';
import { WORKSHOP_SYSTEM } from '../_lib/workshop-ai.mjs';

const MESSAGE_TYPES = {
  reception: 'confirmar la recepción del vehículo',
  quote_ready: 'avisar que la cotización está lista para revisión',
  completed: 'avisar que el trabajo está terminado',
  balance_due: 'recordar de forma cordial que existe un saldo pendiente',
};

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    await requireFirebaseUser(req);
    const body = await readJson(req);
    const messageType = cleanString(body.messageType, 40);
    if (!MESSAGE_TYPES[messageType]) {
      const error = new Error('Selecciona un tipo de mensaje válido.');
      error.statusCode = 400;
      error.code = 'invalid_message_type';
      throw error;
    }

    const contextType = body.contextType === 'quote' ? 'quote' : 'service';
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const safeContext = {
      id: cleanString(data.id, 100),
      clientName: cleanString(data.clientName, 200),
      phone: cleanString(data.phone, 80),
      plate: cleanString(data.plate, 30),
      brand: cleanString(data.brand, 100),
      model: cleanString(data.model, 120),
      vehicle: cleanString(data.vehicle, 250),
      reason: cleanString(data.reason, 1500),
      notes: cleanString(data.notes, 1500),
      status: cleanString(data.status, 80),
      total: Number.isFinite(Number(data.total)) ? Number(data.total) : null,
      paid: Number.isFinite(Number(data.paid)) ? Number(data.paid) : null,
      balance: Number.isFinite(Number(data.balance)) ? Number(data.balance) : null,
      companyName: cleanString(data.companyName, 200),
      laborItems: Array.isArray(data.laborItems) ? data.laborItems.slice(0, 25) : [],
      expenses: Array.isArray(data.expenses) ? data.expenses.slice(0, 25) : [],
    };

    const prompt = `Redacta un único mensaje breve de WhatsApp para ${MESSAGE_TYPES[messageType]}. Contexto: ${contextType}. Usa exclusivamente los datos reales del JSON. Si falta un dato, omítelo; no lo inventes. Tono profesional, cercano y chileno neutro. No incluyas explicación, asunto ni comillas.\n\nDatos: ${JSON.stringify(safeContext)}`;
    const result = await chatAuto({ prompt, system: WORKSHOP_SYSTEM, temperature: 0.25, maxTokens: 600 });
    sendJson(res, 200, { text: cleanString(result.text, 2000), provider: result.provider, model: result.model });
  } catch (error) {
    if (error?.message?.includes('Ningún proveedor')) {
      error.statusCode = 503;
      error.code = 'ai_not_configured';
      error.message = 'No hay un proveedor de IA disponible para generar el mensaje.';
    }
    handleApiError(res, error);
  }
}
