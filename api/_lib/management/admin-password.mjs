import {
  readJson,
  requireMethod,
  sendJson,
  handleApiError,
} from "../http.mjs";
import { adminServices } from "../firebase-admin.mjs";
import {
  passwordHash,
  requireAdmin,
  requireSameOrigin,
  safeAdminError,
  setAdminCookie,
} from "../superadmin.mjs";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    requireSameOrigin(req);
    await requireAdmin(req, { allowBootstrap: true });
    const { password } = await readJson(req, 10_000);
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      !/[a-z]/i.test(password) ||
      !/\d/.test(password)
    ) {
      const error = new Error(
        "La nueva clave debe tener al menos 12 caracteres, letras y números.",
      );
      error.statusCode = 400;
      error.code = "weak_password";
      throw error;
    }
    const { db } = adminServices();
    const ref = db.doc("system/superadminAuth");
    const previous = (await ref.get()).data() || {};
    const authVersion = Number(previous.authVersion || 0) + 1;
    await ref.set(
      { ...passwordHash(password), authVersion, changedAt: new Date() },
      { merge: true },
    );
    setAdminCookie(res, "active", authVersion);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleApiError(res, safeAdminError(error));
  }
}
