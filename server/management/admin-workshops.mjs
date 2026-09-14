import { randomBytes } from "node:crypto";
import { readJson, sendJson, handleApiError } from "../../api/_lib/http.mjs";
import { adminServices } from "../../api/_lib/firebase-admin.mjs";
import { requireAdmin, requireSameOrigin, safeAdminError } from "../../api/_lib/superadmin.mjs";

const DAY = 24 * 60 * 60 * 1000;
function usernameOf(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function technicalEmail(username) {
  const domain =
    process.env.FIREBASE_AUTH_TENANT_DOMAIN ||
    "accounts.gestion-taller.invalid.cl";
  return `${username}.${randomBytes(6).toString("hex")}@${domain}`;
}
function iso(value) {
  return value?.toDate?.().toISOString?.() || null;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== "GET") requireSameOrigin(req);
    const { auth, db } = adminServices();
    if (req.method === "GET") {
      const rows = await db
        .collection("accounts")
        .orderBy("createdAt", "desc")
        .limit(500)
        .get();
      const workshops = rows.docs.map((doc) => {
        const x = doc.data();
        return {
          id: doc.id,
          businessName: x.businessName || "",
          username: x.username || "",
          status: x.status,
          plan: x.plan,
          expiresAt: iso(x.plan === "founder" ? x.paidThrough : x.trialEndsAt),
          lastAccessAt: iso(x.lastSeenAt),
        };
      });
      return sendJson(res, 200, { workshops });
    }
    const body = await readJson(req, 20_000);
    if (req.method === "POST") {
      const username = usernameOf(body.username);
      const businessName = String(body.businessName || "")
        .trim()
        .slice(0, 120);
      const password = String(body.password || "");
      const trialDays = body.trialDays === 30 ? 30 : 15;
      if (
        !/^[a-z0-9._-]{3,40}$/.test(username) ||
        businessName.length < 2 ||
        password.length < 8
      ) {
        const error = new Error(
          "Revisa el nombre, usuario y contraseña temporal (mínimo 8 caracteres).",
        );
        error.statusCode = 400;
        error.code = "invalid_input";
        throw error;
      }
      const mappingRef = db.doc(`workshopUsernames/${username}`);
      if ((await mappingRef.get()).exists) {
        const e = new Error("Ese usuario ya está ocupado.");
        e.statusCode = 409;
        e.code = "username_taken";
        throw e;
      }
      const emailInternal = technicalEmail(username);
      const user = await auth.createUser({
        email: emailInternal,
        password,
        emailVerified: true,
        displayName: businessName,
        disabled: false,
      });
      const now = Date.now();
      const batch = db.batch();
      batch.create(mappingRef, {
        uid: user.uid,
        emailInternal,
        createdAt: new Date(),
      });
      batch.create(db.doc(`accounts/${user.uid}`), {
        uid: user.uid,
        businessName,
        username,
        plan: "trial",
        status: "trialing",
        trialStartedAt: new Date(now),
        trialEndsAt: new Date(now + trialDays * DAY),
        onboardingCompleted: false,
        mustChangePassword: true,
        createdAt: new Date(now),
        lastSeenAt: null,
        schemaVersion: 2,
        managed: true,
      });
      batch.create(db.doc(`workshops/${user.uid}`), {
        ownerUid: user.uid,
        settings: { companyName: businessName },
        schemaVersion: 3,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
      try {
        await batch.commit();
      } catch (error) {
        await auth.deleteUser(user.uid).catch(() => undefined);
        throw error;
      }
      return sendJson(res, 201, { id: user.uid, username, businessName });
    }
    if (req.method === "PATCH") {
      const id = String(body.id || "");
      if (!id) {
        const e = new Error("Cuenta inválida.");
        e.statusCode = 400;
        e.code = "invalid_input";
        throw e;
      }
      const ref = db.doc(`accounts/${id}`);
      const current = (await ref.get()).data();
      if (!current) {
        const e = new Error("Cuenta no encontrada.");
        e.statusCode = 404;
        e.code = "not_found";
        throw e;
      }
      const update = { updatedAt: new Date() };
      if (["trialing", "active", "past_due", "suspended"].includes(body.status))
        update.status = body.status;
      if (body.status === "active") {
        update.plan = "founder";
        update.paidThrough = new Date(body.expiresAt || Date.now() + 30 * DAY);
      }
      if (body.expiresAt) {
        const date = new Date(body.expiresAt);
        if (Number.isNaN(date.getTime())) {
          const e = new Error("Fecha inválida.");
          e.statusCode = 400;
          throw e;
        }
        if ((body.plan || current.plan) === "founder")
          update.paidThrough = date;
        else update.trialEndsAt = date;
      }
      if (typeof body.password === "string" && body.password.length >= 8) {
        await auth.updateUser(id, { password: body.password });
        update.mustChangePassword = true;
      } else if (typeof body.password === "string") {
        const e = new Error("La contraseña temporal debe tener al menos 8 caracteres.");
        e.statusCode = 400;
        e.code = "weak_password";
        throw e;
      }
      if (update.status)
        await auth.updateUser(id, { disabled: update.status === "suspended" });
      await ref.set(update, { merge: true });
      return sendJson(res, 200, { ok: true });
    }
    const error = new Error("Método no permitido.");
    error.statusCode = 405;
    error.code = "method_not_allowed";
    throw error;
  } catch (error) {
    handleApiError(res, safeAdminError(error));
  }
}
