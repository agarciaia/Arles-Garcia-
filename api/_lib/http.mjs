export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function requireMethod(req, method) {
  if (req.method !== method) {
    const error = new Error(`Método ${req.method || 'desconocido'} no permitido.`);
    error.statusCode = 405;
    error.code = 'method_not_allowed';
    throw error;
  }
}

export async function readJson(req, maxBytes = 1_000_000) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > maxBytes) throw payloadTooLarge();
    try { return JSON.parse(req.body); } catch { throw invalidJson(); }
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw payloadTooLarge();
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw invalidJson();
  }
}

function invalidJson() {
  const error = new Error('El cuerpo de la solicitud no contiene JSON válido.');
  error.statusCode = 400;
  error.code = 'invalid_json';
  return error;
}

function payloadTooLarge() {
  const error = new Error('La solicitud es demasiado grande.');
  error.statusCode = 413;
  error.code = 'payload_too_large';
  return error;
}

export function cleanString(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function cleanNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseJsonObject(text) {
  if (typeof text !== 'string') throw new Error('La IA no devolvió una respuesta utilizable.');
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed); } catch { /* fallback below */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* fall through */ }
  }
  const error = new Error('La IA no devolvió datos estructurados válidos.');
  error.statusCode = 502;
  error.code = 'invalid_ai_json';
  throw error;
}

export function handleApiError(res, error) {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  const safeStatus = statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
  const message = safeStatus >= 500 && !error?.code
    ? 'El servicio no está disponible en este momento.'
    : (error?.message || 'No fue posible completar la solicitud.');
  sendJson(res, safeStatus, {
    error: true,
    code: error?.code || (safeStatus >= 500 ? 'server_error' : 'request_error'),
    message,
  });
}
