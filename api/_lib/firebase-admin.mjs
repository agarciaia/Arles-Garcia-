import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

export function adminServices() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY").replace(
          /\\n/g,
          "\n",
        ),
      }),
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}
