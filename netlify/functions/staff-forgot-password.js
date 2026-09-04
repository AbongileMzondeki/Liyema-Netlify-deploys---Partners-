const { readJSON, writeJSON } = require('./_shared/blobStore');
const { hashPassword, verifyPassword, normalizeAnswer } = require('./_shared/staffAuth');

/* Self-service "Forgot password" for the 5 internal "Liyema Team" (staff)
   accounts -- deliberately has NO email step anywhere in it. The whole reason
   this exists is that Netlify's hosted Identity mailer is unreliable on the
   free plan (see _shared/staffAuth.js), so a reset flow that depends on an
   email arriving would just reintroduce the same failure mode. Instead this
   uses a security question the staff member sets up themselves (via
   set-my-recovery.js, reachable from Settings once logged in): to reset,
   they answer their own question and pick a new password immediately, all
   in one page, nothing to wait for or go missing.

   Two-step flow, both POSTed to this same endpoint:
   Step 1 { email }                              -> { question }
   Step 2 { email, step:'answer', answer, newPassword } -> { ok:true }

   Brute-force protection: 5 wrong answers for the same email locks that
   email out for 15 minutes (tracked in the "staffRecoveryAttempts" blob).
   This only ever touches the separate staffCredentials store -- it has no
   access to and cannot affect Netlify Identity or partner/admin accounts. */

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

async function getLockState(email) {
  const attempts = await readJSON('staffRecoveryAttempts', {});
  const rec = attempts[email];
  if (!rec) return { locked: false, attempts };
  const elapsed = Date.now() - rec.firstAttempt;
  if (elapsed > LOCKOUT_WINDOW_MS) return { locked: false, attempts };
  if (rec.count >= LOCKOUT_THRESHOLD) {
    return { locked: true, retryAfterSeconds: Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 1000), attempts };
  }
  return { locked: false, attempts };
}

async function recordAttempt(email, attempts, success) {
  if (success) {
    delete attempts[email];
  } else {
    const now = Date.now();
    const rec = attempts[email];
    if (!rec || now - rec.firstAttempt > LOCKOUT_WINDOW_MS) {
      attempts[email] = { count: 1, firstAttempt: now };
    } else {
      rec.count += 1;
    }
  }
  await writeJSON('staffRecoveryAttempts', attempts);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required.' }) };
    }

    const creds = await readJSON('staffCredentials', {});
    const record = creds[email];

    if (body.step === 'answer') {
      const { answer, newPassword } = body;
      if (!answer || !newPassword) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Answer and new password are required.' }) };
      }
      if (newPassword.length < 8) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters.' }) };
      }
      const { locked, retryAfterSeconds, attempts } = await getLockState(email);
      if (locked) {
        return { statusCode: 429, body: JSON.stringify({ error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).` }) };
      }
      if (!record || !record.securityAnswerHash) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No recovery question is set up for this account yet. Ask your admin to reset your password.' }) };
      }
      const correct = verifyPassword(normalizeAnswer(answer), record.securityAnswerHash);
      await recordAttempt(email, attempts, correct);
      if (!correct) {
        return { statusCode: 401, body: JSON.stringify({ error: "That answer doesn't match what's on file." }) };
      }
      record.hash = hashPassword(newPassword);
      creds[email] = record;
      await writeJSON('staffCredentials', creds);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // Step 1: hand back the question only (never the answer), and never
    // reveal whether the email itself exists beyond this -- same "no
    // recovery set up" message whether the account is missing or just
    // hasn't configured a question yet, so this can't be used to enumerate
    // staff email addresses.
    const { locked, retryAfterSeconds } = await getLockState(email);
    if (locked) {
      return { statusCode: 429, body: JSON.stringify({ error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).` }) };
    }
    if (!record || !record.securityQuestion) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No recovery question is set up for this account yet. Ask your admin to reset your password, or set one up next time you log in.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ question: record.securityQuestion }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
