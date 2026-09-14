import {
  readJson,
  requireMethod,
  sendJson,
  handleApiError,
} from "../_lib/http.mjs";
import { adminServices } from "../_lib/firebase-admin.mjs";
import {
  checkRateLimit,
  clearAdminCookie,
  clearRateLimit,
  passwordMatches,
  requireAdmin,
  requireSameOrigin,
  safeAdminError,
  setAdminCookie,
  verifyBootstrap,
} from "../_lib/superadmin.mjs";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const session = await requireAdmin(req, { allowBootstrap: true });
      return sendJson(res, 200, {
        authenticated: true,
        mustChangePassword: session.stage === "bootstrap",
      });
    }
    if (req.method === "DELETE") {
      requireSameOrigin(req);
      clearAdminCookie(res);
      return sendJson(res, 200, { ok: true });
    }
    requireMethod(req, "POST");
    requireSameOrigin(req);
    const body = await readJson(req, 10_000);
    const rateRef = await checkRateLimit(
      req,
      String(body.username || "").toLowerCase(),
    );
    const { db } = adminServices();
    const auth = await db.doc("system/superadminAuth").get();
    const record = auth.data();
    const usernameOk =
      String(body.username || "").toUpperCase() ===
      String(process.env.SUPERADMIN_USERNAME || "").toUpperCase();
    if (record?.hash) {
      if (!usernameOk || !passwordMatches(String(body.password || ""), record))
        throw new Error("invalid");
      setAdminCookie(res, "active", record.authVersion || 1);
    } else {
      if (!verifyBootstrap(body.username, String(body.password || "")))
        throw new Error("invalid");
      setAdminCookie(res, "bootstrap", 0);
    }
    await clearRateLimit(rateRef);
    sendJson(res, 200, {
      authenticated: true,
      mustChangePassword: !record?.hash,
    });
  } catch (error) {
    if (error?.message === "invalid") {
      error.statusCode = 401;
      error.code = "invalid_credentials";
      error.message = "No fue posible completar la autenticación.";
    }
    handleApiError(res, safeAdminError(error));
  }
}
