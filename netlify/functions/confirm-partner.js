const { requireAdmin } = require('./_shared/auth');

/* Admin utility for partner accounts stuck in an incomplete state.
   Two things happen here, best-effort:
   1. Attempts to force-confirm the email directly (email_confirm / confirmed_at
      fields). NOTE: in practice, Netlify's hosted Identity admin API does NOT
      honor these fields on a PUT (confirmed via live testing 2026-07-28) --
      confirmation genuinely only happens when the partner clicks the real
      confirmation/invite link in their email. This attempt is kept in case
      that ever changes, but admins should not rely on it alone.
   2. Re-asserts app_metadata.roles=['partner'] and user_metadata.full_name
      (if a name is passed in) -- this IS reliably supported by the admin API
      and is needed after using the Netlify dashboard's own "Invite users"
      flow, which creates the account with no role/name set at all. */
exports.handler = async (event, context) => {
  try {
    requireAdmin(event, context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { userId, fullName } = JSON.parse(event.body || '{}');
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId is required' }) };
    }
    const identity = context.clientContext && context.clientContext.identity;
    if (!identity) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Identity is not enabled on this site yet.' }) };
    }
    const nowIso = new Date().toISOString();
    const body = { email_confirm: true, confirmed_at: nowIso, confirmation_sent_at: nowIso, app_metadata: { roles: ['partner'] } };
    if (fullName) body.user_metadata = { full_name: fullName };
    const res = await fetch(`${identity.url}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: 'Could not update partner account', detail: text }) };
    }
    const user = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, confirmed: !!user.confirmed_at, raw: user }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
