const { requireAdmin } = require('./_shared/auth');
const { readJSON, writeJSON } = require('./_shared/blobStore');
const { hashPassword, normalizeAnswer } = require('./_shared/staffAuth');

/* Admin sets or resets the custom login password for an existing staff
   account (used for the staff-login.js bypass -- see _shared/staffAuth.js).
   Does NOT touch the account's Netlify Identity password at all; this is a
   completely separate credential store. Needed for staff accounts created
   before this feature existed, and for ordinary password resets afterwards.

   Optionally also (re)sets that account's self-service recovery question --
   useful for bootstrapping the security-question-based "Forgot password"
   flow (staff-forgot-password.js) for accounts that predate it, without
   waiting for the staff member to set one up themselves via Settings. When
   securityQuestion/securityAnswer are omitted, any existing recovery
   question is left untouched (this only ever merges into the record, never
   overwrites it wholesale). */
exports.handler = async (event, context) => {
  try {
    requireAdmin(event, context);
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { id, email, name, password, securityQuestion, securityAnswer } = JSON.parse(event.body || '{}');
    if (!id || !email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'id, email and password are required' }) };
    }
    if (password.length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters.' }) };
    }
    const creds = await readJSON('staffCredentials', {});
    const key = String(email).trim().toLowerCase();
    const existing = creds[key] || {};
    const updated = { ...existing, id, email: key, name: name || existing.name || key, hash: hashPassword(password) };
    if (securityQuestion && securityAnswer) {
      updated.securityQuestion = String(securityQuestion).trim().slice(0, 200);
      updated.securityAnswerHash = hashPassword(normalizeAnswer(securityAnswer));
    }
    creds[key] = updated;
    await writeJSON('staffCredentials', creds);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
