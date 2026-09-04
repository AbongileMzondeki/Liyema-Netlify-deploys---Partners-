const { writeJSON } = require('./_shared/blobStore');

/* Called by the scheduled Squarelink-scrape task (not by the browser app) to push
   freshly pulled Jobs data in. Protected by a shared secret header rather than an
   Identity login, since the scheduled task is an automated script, not a user.
   Set SYNC_SECRET in Site settings > Environment variables after deploying. */
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const provided = event.headers['x-sync-secret'] || event.headers['X-Sync-Secret'];
    if (!process.env.SYNC_SECRET || provided !== process.env.SYNC_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or missing sync secret' }) };
    }
    const body = JSON.parse(event.body || '{}');
    if (!Array.isArray(body.roles)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'roles array is required' }) };
    }
    await writeJSON('roles', body.roles);
    await writeJSON('meta', { dataPulledAt: body.dataPulledAt || new Date().toISOString() });
    return { statusCode: 200, body: JSON.stringify({ ok: true, count: body.roles.length }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
