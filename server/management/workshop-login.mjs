import { createHmac } from "node:crypto";
import { readJson, requireMethod, sendJson, handleApiError } from "../../api/_lib/http.mjs";
import { adminServices } from "../../api/_lib/firebase-admin.mjs";
import { safeAdminError } from "../../api/_lib/superadmin.mjs";

function invalid() {
  const error = new Error("Correo o contraseña incorrectos.");
  error.statusCode = 401;
  error.code = "invalid_credentials";
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    const body = await readJson(req, 10_000);
    const email = normalizeEmail(body.email || body.username);
    const password = String(body.password || "");
    if (!validEmail(email) || password.length < 6) throw invalid();

    const { auth, db } = adminServices();
    const secret = process.env.SUPERADMIN_SESSION_SECRET || "";
    if (!secret) {
      const error = new Error("Configuración segura incompleta.");
      error.statusCode = 503;
      error.code = "auth_not_configured";
      throw error;
    }

    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0];
    const rateId = createHmac("sha256", secret).update(`${ip}:${email}`).digest("hex");
    const rateRef = db.doc(`securityRateLimits/client-${rateId}`);
    const rate = (await rateRef.get()).data() || {};
    if (Number(rate.blockedUntil || 0) > Date.now()) throw invalid();

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      const error = new Error("Configuración segura incompleta.");
      error.statusCode = 503;
      error.code = "auth_not_configured";
      throw error;
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );

    if (!response.ok) {
      const attempts = Number(rate.attempts || 0) + 1;
      await rateRef.set(
        {
          attempts,
          blockedUntil: attempts >= 8 ? Date.now() + 15 * 60 * 1000 : 0,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      throw invalid();
    }

    const verified = await response.json();
    const uid = String(verified.localId || "");
    if (!uid) throw invalid();

    const accountRef = db.doc(`accounts/${uid}`);
    const account = (await accountRef.get()).data();
    if (!account || account.managed !== true || normalizeEmail(account.email) !== email) throw invalid();
    if (account.status === "suspended") {
      const error = new Error("La cuenta no está disponible. Contacta al administrador.");
      error.statusCode = 403;
      error.code = "account_unavailable";
      throw error;
    }

    await rateRef.delete().catch(() => undefined);
    await accountRef.set({ lastSeenAt: new Date() }, { merge: true });
    const token = await auth.createCustomToken(uid, {
      workshopId: uid,
      managedAccount: true,
    });
    sendJson(res, 200, { token, email });
  } catch (error) {
    handleApiError(res, safeAdminError(error));
  }
}
