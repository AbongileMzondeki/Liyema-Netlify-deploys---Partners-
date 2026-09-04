const { requireAdmin } = require('./_shared/auth');

/* Admin utility to edit a partner/staff account's profile fields (name,
   company) after creation, without touching their password or role. Merges
   into existing user_metadata rather than overwriting it wholesale. */
exports.handler = async (event, context) => {
  try {
    requireAdmin(event, context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { userId, name, company } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    }
    const identity = context.clientContext && context.clientContext.identity;
    if (!identity) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Identity is not enabled on this site yet.' }) };
    }

    const lookupRes = await fetch(`${identity.url}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${identity.token}` },
    });
    if (!lookupRes.ok) {
      const text = await lookupRes.text();
      return { statusCode: lookupRes.status, body: JSON.stringify({ error: 'Could not look up account', detail: text }) };
    }
    const existing = await lookupRes.json();
    const mergedMetadata = { ...(existing.user_metadata || {}) };
    if (name !== undefined) mergedMetadata.full_name = name;
    if (company !== undefined) mergedMetadata.company = company;

    const res = await fetch(`${identity.url}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_metadata: mergedMetadata }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: 'Could not update account', detail: text }) };
    }
    const user = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, user }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
