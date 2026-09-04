const { requireAdmin } = require('./_shared/auth');
const { readJSON, writeJSON } = require('./_shared/blobStore');

/* Admin removes a partner's Identity account entirely (revokes access immediately).
   Cannot be used to remove your own admin account, to avoid accidental lockout. */
exports.handler = async (event, context) => {
  try {
    const admin = requireAdmin(event, context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { userId } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    }
    if (userId === admin.sub) {
      return { statusCode: 400, body: JSON.stringify({ error: 'You cannot remove your own admin account from here.' }) };
    }
    const identity = context.clientContext && context.clientContext.identity;
    if (!identity) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Identity is not enabled on this site yet.' }) };
    }

    // Best-effort: if this was a staff account, also revoke its custom login
    // credential (see staff-login.js) so a removed account can't still log in
    // through the bypass path even though it's gone from Netlify Identity.
    try {
      const lookupRes = await fetch(`${identity.url}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${identity.token}` },
      });
      if (lookupRes.ok) {
        const userData = await lookupRes.json();
        const email = userData && userData.email;
        if (email) {
          const creds = await readJSON('staffCredentials', {});
          const key = String(email).trim().toLowerCase();
          if (creds[key]) {
            delete creds[key];
            await writeJSON('staffCredentials', creds);
          }
        }
      }
    } catch (credErr) {
      console.warn('remove-partner: staff credential cleanup failed', credErr);
    }

    const res = await fetch(`${identity.url}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${identity.token}` },
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: 'Could not remove partner account', detail: text }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
