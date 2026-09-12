import { handleApiError, requireMethod, sendJson } from './_lib/http.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET');
    sendJson(res, 200, {
      ok: true,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
