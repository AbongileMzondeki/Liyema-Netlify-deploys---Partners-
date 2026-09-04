const { requireAdmin } = require('./_shared/auth');
const { readJSON, writeJSON } = require('./_shared/blobStore');
const { hashPassword } = require('./_shared/staffAuth');

/* Admin creates a real partner or staff account.

   Partners: two modes --
   - Password provided: the account is created ready-to-use immediately with
     that password and email pre-confirmed, so the admin can hand the login
     straight to the partner (e.g. verbally, over WhatsApp — the admin's call,
     not this app's).
   - Password left blank: falls back to Netlify Identity's email-invite flow
     (email_confirm: false), so the partner sets their own password on first
     login. If no invite email arrives, use the Netlify dashboard's Identity
     tab > "Invite users" as a guaranteed fallback (same underlying account).

   Staff ("Liyema Team"): password is REQUIRED, not optional. Netlify's hosted
   Identity blocks login on an unconfirmed email with no available fix (no
   SMTP on file -- see _shared/staffAuth.js), so the email-invite fallback
   above genuinely does not work for staff. Instead, staff log in through the
   separate staff-login.js endpoint using a password we hash and store
   ourselves in the "staffCredentials" blob, entirely independent of whatever
   Netlify Identity thinks that account's password is. */
exports.handler = async (event, context) => {
  try {
    requireAdmin(event, context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { email, name, password, role, company } = JSON.parse(event.body || '{}');
    if (!email || !name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email and name are required' }) };
    }
    // Only 'partner' (external recruiting partner) or 'staff' (internal Liyema
    // team -- same data visibility as admin, no management rights) are allowed.
    // Defaults to 'partner' to preserve existing behaviour for older callers.
    const assignedRole = role === 'staff' ? 'staff' : 'partner';
    if (assignedRole === 'staff' && !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A password is required for Liyema Team accounts — the email-invite flow does not work for them.' }) };
    }
    if (password && password.length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters.' }) };
    }
    const identity = context.clientContext && context.clientContext.identity;
    if (!identity) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Identity is not enabled on this site yet.' }) };
    }

    const userMetadata = company ? { full_name: name, company } : { full_name: name };
    const body = password
      ? { email, password, email_confirm: true, user_metadata: userMetadata, app_metadata: { roles: [assignedRole] } }
      : { email, email_confirm: false, user_metadata: userMetadata, app_metadata: { roles: [assignedRole] } };

    const res = await fetch(`${identity.url}/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${identity.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Could not create partner account', detail: data }) };
    }

    // Guard against the observed "Roles: Not set" bug: re-assert app_metadata.roles
    // with an explicit follow-up PUT. Best-effort -- creation already succeeded
    // above, so a failure here does not fail the overall request.
    if (data && data.id) {
      try {
        await fetch(`${identity.url}/admin/users/${data.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${identity.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ app_metadata: { roles: [assignedRole] } }),
        });
      } catch (rolesErr) {
        console.warn('create-partner: follow-up roles PUT failed', rolesErr);
      }
    }

    // Staff-only: also register the password in our own credential store so
    // staff-login.js can authenticate them without relying on Netlify
    // Identity's (blocked) password grant. Best-effort -- account creation
    // already succeeded above either way.
    if (assignedRole === 'staff' && password && data && data.id) {
      try {
        const creds = await readJSON('staffCredentials', {});
        creds[String(email).trim().toLowerCase()] = {
          id: data.id,
          email: String(email).trim().toLowerCase(),
          name,
          hash: hashPassword(password),
        };
        await writeJSON('staffCredentials', creds);
      } catch (credErr) {
        console.warn('create-partner: staff credential store failed', credErr);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, user: data, passwordSet: !!password }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
