import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_DATABASE_ID = "ai-studio-f186d355-2f6a-4225-846b-94e5e31a4134";

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
  const app = getApps()[0] || initializeApp({
    credential: cert({
      projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  const databaseId = process.env.FIREBASE_ADMIN_DATABASE_ID || DEFAULT_DATABASE_ID;
  return {
    auth: getAuth(app),
    db: getFirestore(app, databaseId),
  };
}
