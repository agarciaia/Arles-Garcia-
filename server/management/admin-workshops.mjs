import { readJson, sendJson, handleApiError } from "../../api/_lib/http.mjs";
import { adminServices } from "../../api/_lib/firebase-admin.mjs";
import { requireAdmin, requireSameOrigin, safeAdminError } from "../../api/_lib/superadmin.mjs";

const DAY = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
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
      const rows = await db.collection("accounts").orderBy("createdAt", "desc").limit(500).get();
      const workshops = rows.docs.map((doc) => {
        const x = doc.data();
        return {
          id: doc.id,
          businessName: x.businessName || "",
          ownerName: x.ownerName || "",
          email: x.email || x.username || "",
          phone: x.phone || "",
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
      const email = normalizeEmail(body.email || body.username);
      const businessName = cleanText(body.businessName);
      const ownerName = cleanText(body.ownerName, 100);
      const phone = cleanText(body.phone, 40);
      const password = String(body.password || "");
      const plan = body.plan === "founder" ? "founder" : "trial";
      const trialDays = body.trialDays === 30 ? 30 : 15;

      if (!validEmail(email) || businessName.length < 2 || password.length < 8) {
        const error = new Error("Revisa el nombre, correo y contraseña temporal (mínimo 8 caracteres).");
        error.statusCode = 400;
        error.code = "invalid_input";
        throw error;
      }

      try {
        await auth.getUserByEmail(email);
        const e = new Error("Ese correo ya tiene una cuenta.");
        e.statusCode = 409;
        e.code = "email_taken";
        throw e;
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      const user = await auth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: ownerName || businessName,
        disabled: false,
      });

      const now = Date.now();
      const isFounder = plan === "founder";
      const account = {
        uid: user.uid,
        email,
        businessName,
        ownerName,
        phone,
        plan,
        status: isFounder ? "active" : "trialing",
        onboardingCompleted: false,
        mustChangePassword: true,
        createdAt: new Date(now),
        lastSeenAt: null,
        schemaVersion: 2,
        managed: true,
      };

      if (isFounder) {
        account.subscriptionStartedAt = new Date(now);
        account.paidThrough = new Date(now + 30 * DAY);
      } else {
        account.trialStartedAt = new Date(now);
        account.trialEndsAt = new Date(now + trialDays * DAY);
      }

      const batch = db.batch();
      batch.create(db.doc(`accounts/${user.uid}`), account);
      batch.create(db.doc(`workshops/${user.uid}`), {
        ownerUid: user.uid,
        settings: { companyName: businessName, mechanicName: ownerName || "", companyPhone: phone || "" },
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

      return sendJson(res, 201, {
        id: user.uid,
        email,
        businessName,
        ownerName,
        phone,
        plan,
      });
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

      if (typeof body.businessName === "string" && cleanText(body.businessName).length >= 2)
        update.businessName = cleanText(body.businessName);
      if (typeof body.ownerName === "string") update.ownerName = cleanText(body.ownerName, 100);
      if (typeof body.phone === "string") update.phone = cleanText(body.phone, 40);

      if (typeof body.email === "string") {
        const email = normalizeEmail(body.email);
        if (!validEmail(email)) {
          const e = new Error("Correo inválido.");
          e.statusCode = 400;
          e.code = "invalid_email";
          throw e;
        }
        if (email !== current.email) {
          await auth.updateUser(id, { email, emailVerified: true });
          update.email = email;
        }
      }

      if (["trialing", "active", "past_due", "suspended"].includes(body.status)) update.status = body.status;

      if (body.status === "active") {
        update.plan = "founder";
        update.subscriptionStartedAt = current.subscriptionStartedAt || new Date();
        update.paidThrough = new Date(body.expiresAt || Date.now() + 30 * DAY);
      }

      if (body.expiresAt) {
        const date = new Date(body.expiresAt);
        if (Number.isNaN(date.getTime())) {
          const e = new Error("Fecha inválida.");
          e.statusCode = 400;
          e.code = "invalid_date";
          throw e;
        }
        if ((body.plan || current.plan) === "founder") update.paidThrough = date;
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

      if (update.status) await auth.updateUser(id, { disabled: update.status === "suspended" });
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
