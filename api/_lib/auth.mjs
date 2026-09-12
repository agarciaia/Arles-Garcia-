import { createVerify } from 'node:crypto';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedCerts = null;
let certsExpireAt = 0;

function apiError(message, statusCode = 401, code = 'unauthorized') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function decodeJsonSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw apiError('Token de autenticación inválido.');
  }
}

async function getFirebaseCerts() {
  if (cachedCerts && Date.now() < certsExpireAt) return cachedCerts;
  const response = await fetch(CERT_URL);
  if (!response.ok) throw apiError('No fue posible validar la sesión.', 503, 'auth_validation_unavailable');
  cachedCerts = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  certsExpireAt = Date.now() + Math.max(60, maxAge - 30) * 1000;
  return cachedCerts;
}

export async function requireFirebaseUser(req) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw apiError('La autenticación del backend aún no está configurada.', 503, 'firebase_project_not_configured');
  }

  const authorization = req.headers?.authorization || req.headers?.Authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    throw apiError('Debes iniciar sesión para usar el asistente.');
  }

  const token = authorization.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) throw apiError('Token de autenticación inválido.');

  const header = decodeJsonSegment(parts[0]);
  const payload = decodeJsonSegment(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw apiError('Token de autenticación inválido.');

  const certs = await getFirebaseCerts();
  const certificate = certs?.[header.kid];
  if (!certificate) throw apiError('No fue posible validar la sesión.');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const validSignature = verifier.verify(certificate, Buffer.from(parts[2], 'base64url'));
  if (!validSignature) throw apiError('Token de autenticación inválido.');

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw apiError('Token emitido para otro proyecto.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw apiError('Emisor de token inválido.');
  if (!payload.sub || typeof payload.sub !== 'string') throw apiError('Token sin usuario válido.');
  if (payload.exp && payload.exp < now) throw apiError('La sesión expiró. Vuelve a iniciar sesión.');
  if (payload.iat && payload.iat > now + 60) throw apiError('Token con fecha inválida.');

  return {
    uid: payload.sub,
    email: payload.email || '',
    emailVerified: Boolean(payload.email_verified),
  };
}
