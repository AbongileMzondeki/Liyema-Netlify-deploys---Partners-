const { requireAdmin } = require('./_shared/auth');
const { readJSON, writeJSON } = require('./_shared/blobStore');

/* Logs an on-demand request to re-pull Squarelink data. Squarelink has no public
   API and requires an authenticated browser session, so this cannot trigger a
   live scrape by itself — it timestamps the request so it's visible in the app,
   and the next time Claude runs the Squarelink refresh (scheduled, or asked to
   directly in chat) it will see this and prioritise it. */
exports.handler = async (event, context) => {
  try {
    const admin = requireAdmin(context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const record = {
      requestedAt: new Date().toISOString(),
      requestedBy: (admin.user_metadata && admin.user_metadata.full_name) || admin.email,
    };
    await writeJSON('refreshRequest', record);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...record }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
