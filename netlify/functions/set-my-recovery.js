const { requireAuth, isStaff } = require('./_shared/auth');
const { readJSON, writeJSON } = require('./_shared/blobStore');
const { hashPassword, normalizeAnswer } = require('./_shared/staffAuth');

/* Lets a logged-in staff member set or update their OWN security question,
   used by staff-forgot-password.js's self-service reset. Staff-only (not
   partners/admin, who don't use this credential system at all) and can only
   ever touch the caller's own record -- there is no id/email parameter, the
   email comes from the caller's own verified session token. */
exports.handler = async (event, context) => {
  try {
    const user = requireAuth(event, context);
    if (!isStaff(user)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'This is only available to Liyema Team accounts.' }) };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const { question, answer } = JSON.parse(event.body || '{}');
    if (!question || !answer) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A question and answer are both required.' }) };
    }
    if (String(answer).trim().length < 2) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Answer is too short.' }) };
    }
    const email = String(user.email || '').trim().toLowerCase();
    const creds = await readJSON('staffCredentials', {});
    if (!creds[email]) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No login credential found for your account -- ask your admin to set your password first.' }) };
    }
    creds[email].securityQuestion = String(question).trim().slice(0, 200);
    creds[email].securityAnswerHash = hashPassword(normalizeAnswer(answer));
    await writeJSON('staffCredentials', creds);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
