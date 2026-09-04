const { readJSON } = require('./_shared/blobStore');
const { verifyPassword, signStaffToken } = require('./_shared/staffAuth');

/* Login endpoint for the 5 internal "Liyema Team" (staff) accounts ONLY.
   Partners and admins never call this -- they use the normal Netlify Identity
   widget. This exists because Netlify's hosted Identity blocks the password
   grant with "Email not confirmed" for these accounts and there is no
   available fix (see _shared/staffAuth.js for the full story). Credentials
   here are entirely separate from Netlify Identity's own password field --
   they live in the "staffCredentials" blob, set via create-partner.js (on
   account creation) or set-staff-password.js (admin resets it later). */
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required.' }) };
    }
    const creds = await readJSON('staffCredentials', {});
    const record = creds[String(email).trim().toLowerCase()];
    if (!record || !verifyPassword(password, record.hash)) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect email or password.' }) };
    }
    const token = signStaffToken({ sub: record.id, email: record.email, name: record.name, roles: ['staff'] });
    return {
      statusCode: 200,
      body: JSON.stringify({
        token,
        user: { id: record.id, email: record.email, name: record.name },
      }),
    };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
