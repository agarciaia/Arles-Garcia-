import adminPassword from "../server/management/admin-password.mjs";
import adminSession from "../server/management/admin-session.mjs";
import adminWorkshops from "../server/management/admin-workshops.mjs";
import changePassword from "../server/management/change-password.mjs";
import workshopLogin from "../server/management/workshop-login.mjs";
import { sendJson } from "./_lib/http.mjs";

const handlers = {
  "admin-password": adminPassword,
  "admin-session": adminSession,
  "admin-workshops": adminWorkshops,
  "change-password": changePassword,
  "workshop-login": workshopLogin,
};

export default async function handler(req, res) {
  const action = String(req.query?.action || "");
  const route = handlers[action];
  if (!route) {
    return sendJson(res, 404, {
      error: true,
      code: "not_found",
      message: "Ruta no encontrada.",
    });
  }
  return route(req, res);
}
