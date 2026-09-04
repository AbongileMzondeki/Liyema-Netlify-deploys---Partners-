const { requireFullVisibility } = require('./_shared/auth');

/* Lists all Identity users tagged with the "partner" or "staff" role. Uses the
   site-scoped Identity admin token Netlify injects into context.clientContext.identity
   for authenticated Function calls — no separate API key needs to be configured.
   Readable by admins and internal staff alike (full visibility), not just admins. */
exports.handler = async (event, context) => {
  try {
    requireFullVisibility(event, context);
    const identity = context.clientContext && context.clientContext.identity;
    if (!identity) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Identity is not enabled on this site yet.' }) };
    }
    const res = await fetch(`${identity.url}/admin/users?per_page=100`, {
      headers: { Authorization: `Bearer ${identity.token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: 'Identity admin call failed', detail: text }) };
    }
    const data = await res.json();
    const users = (data.users || [])
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: (u.user_metadata && u.user_metadata.full_name) || u.email,
        company: (u.user_metadata && u.user_metadata.company) || '',
        roles: (u.app_metadata && u.app_metadata.roles) || [],
        createdAt: u.created_at,
        lastLogin: u.last_sign_in_at || null,
        confirmed: !!u.confirmed_at,
      }))
      .filter((u) => u.roles.includes('partner') || u.roles.includes('staff'));
    return { statusCode: 200, body: JSON.stringify(users) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
