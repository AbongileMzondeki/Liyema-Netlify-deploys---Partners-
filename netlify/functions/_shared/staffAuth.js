const crypto = require('crypto');

/* Self-hosted credential + session mechanism for the 5 internal "Liyema Team"
   (staff) accounts ONLY. Exists because Netlify's hosted Identity blocks the
   password grant with "Email not confirmed" for any account whose email was
   never actually clicked-through -- confirmed via live testing to be a hard
   platform limitation, not fixable via the admin API, the Console UI, or the
   "allow sign up without verifying email" setting, and there's no SMTP on file
   to replace Netlify's rate-limited default mailer. Partner and admin accounts
   are completely unaffected -- they still use real Netlify Identity, unchanged.

   Design: passwords are hashed with scrypt and stored in a Blobs-backed
   "staffCredentials" map (see staff-login.js / set-staff-password.js). A
   successful login mints a short, HMAC-signed token (NOT a Netlify Identity
   JWT -- Netlify won't let us mint one of those ourselves) that this app's own
   functions verify directly. See auth.js's getUser() for how the two auth
   paths (real Netlify JWT vs. this token) are merged transparently so every
   existing endpoint keeps working unchanged for both partners and staff. */

const SECRET = process.env.STAFF_SESSION_SECRET || 'liyema-staff-session-fallback-secret-change-me';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const hash = crypto.scryptSync(String(password), salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (hash.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(hash, storedBuf);
}

function b64url(input) {
  return Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(input) {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function signStaffToken(payload) {
  const body = { ...payload, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS };
  const encoded = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('hex');
  return `liyemastaff.${encoded}.${sig}`;
}

function verifyStaffToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('liyemastaff.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  // Strict format + length check before touching Buffer.from(sig, 'hex') --
  // that call silently truncates at the first non-hex character instead of
  // throwing, so a loosely-validated signature could decode to the same
  // bytes as a valid one even after being altered. Reject anything that
  // isn't exactly a well-formed lowercase-or-uppercase hex string of the
  // expected length first.
  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('hex');
  if (typeof sig !== 'string' || sig.length !== expectedSig.length || !/^[0-9a-f]+$/i.test(sig)) return null;
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(encoded));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Normalizes a security-question answer before hashing/comparing, so casing
// and stray whitespace don't cause legitimate resets to fail.
function normalizeAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}

module.exports = { hashPassword, verifyPassword, signStaffToken, verifyStaffToken, normalizeAnswer };
