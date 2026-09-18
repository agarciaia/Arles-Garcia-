import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { adminServices } from "./firebase-admin.mjs";

const COOKIE = "__Host-gestion_superadmin";
const SESSION_SECONDS = 8 * 60 * 60;

function required(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error("Configuración segura incompleta.");
    error.statusCode = 503;
    error.code = "admin_not_configured";
    throw error;
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function sign(value) {
  return createHmac("sha256", required("SUPERADMIN_SESSION_SECRET"))
    .update(value)
    .digest("base64url");
}
function equalText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function setAdminCookie(res, stage, authVersion = 0) {
  const body = encode({
    stage,
    authVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  });
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
  );
}

export function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

function sessionFrom(req) {
  const raw = String(req.headers?.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature || !equalText(signature, sign(body))) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return value.exp > Date.now() / 1000 ? value : null;
  } catch {
    return null;
  }
}

export async function requireAdmin(req, { allowBootstrap = false } = {}) {
  const session = sessionFrom(req);
  if (!session || (!allowBootstrap && session.stage !== "active"))
    unauthorized();
  const { db } = adminServices();
  const snapshot = await db.doc("system/superadminAuth").get();
  const authVersion = snapshot.data()?.authVersion || 0;
  if (session.authVersion !== authVersion) unauthorized();
  return session;
}

function unauthorized() {
  const error = new Error("No fue posible completar la autenticación.");
  error.statusCode = 401;
  error.code = "unauthorized";
  throw error;
}

export function passwordHash(
  password,
  salt = randomBytes(16).toString("base64url"),
) {
  return { salt, hash: scryptSync(password, salt, 64).toString("base64url") };
}

export function passwordMatches(password, record) {
  if (!record?.salt || !record?.hash) return false;
  return equalText(passwordHash(password, record.salt).hash, record.hash);
}

export async function checkRateLimit(req, key) {
  const { db } = adminServices();
  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
  )
    .split(",")[0]
    .trim();
  const id = createHmac("sha256", required("SUPERADMIN_SESSION_SECRET"))
    .update(`${ip}:${key}`)
    .digest("hex");
  const ref = db.doc(`securityRateLimits/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const now = Date.now();
    const start = Number(data.windowStart || now);
    const attempts =
      now - start > 15 * 60 * 1000 ? 0 : Number(data.attempts || 0);
    if (attempts >= 8) {
      const error = new Error("No fue posible completar la autenticación.");
      error.statusCode = 429;
      error.code = "try_later";
      throw error;
    }
    tx.set(
      ref,
      {
        attempts: attempts + 1,
        windowStart: attempts ? start : now,
        expiresAt: new Date(now + 24 * 60 * 60 * 1000),
      },
      { merge: true },
    );
  });
  return ref;
}

export async function clearRateLimit(ref) {
  await ref.delete().catch(() => undefined);
}

export function requireSameOrigin(req) {
  const site = String(req.headers["sec-fetch-site"] || "same-origin");
  const origin = String(req.headers.origin || "");
  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "",
  );
  if (site === "cross-site" || (origin && new URL(origin).host !== host)) {
    const error = new Error("Solicitud no autorizada.");
    error.statusCode = 403;
    error.code = "forbidden";
    throw error;
  }
}

export function verifyBootstrap(username, pin) {
  return (
    equalText(
      String(username).toUpperCase(),
      required("SUPERADMIN_USERNAME").toUpperCase(),
    ) && equalText(pin, required("SUPERADMIN_BOOTSTRAP_PIN"))
  );
}

export function safeAdminError(error) {
  if (error?.statusCode) return error;
  const safe = new Error("No fue posible completar la operación.");
  safe.statusCode = 500;
  safe.code = "server_error";
  return safe;
}
