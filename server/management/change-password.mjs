import {
  readJson,
  requireMethod,
  sendJson,
  handleApiError,
} from "../../api/_lib/http.mjs";
import { requireFirebaseUser } from "../../api/_lib/auth.mjs";
import { adminServices } from "../../api/_lib/firebase-admin.mjs";
import { safeAdminError } from "../../api/_lib/superadmin.mjs";

export default async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    const user = await requireFirebaseUser(req);
    const { password } = await readJson(req, 10_000);
    if (
      typeof password !== "string" ||
      password.length < 10 ||
      !/[a-z]/i.test(password) ||
      !/\d/.test(password)
    ) {
      const error = new Error("Usa al menos 10 caracteres, letras y números.");
      error.statusCode = 400;
      error.code = "weak_password";
      throw error;
    }
    const { auth, db } = adminServices();
    const ref = db.doc(`accounts/${user.uid}`);
    const account = (await ref.get()).data();
    if (!account?.managed) {
      const error = new Error("Operación no disponible.");
      error.statusCode = 403;
      error.code = "forbidden";
      throw error;
    }
    await auth.updateUser(user.uid, { password });
    await ref.set(
      { mustChangePassword: false, credentialsUpdatedAt: new Date() },
      { merge: true },
    );
    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleApiError(res, safeAdminError(error));
  }
}
