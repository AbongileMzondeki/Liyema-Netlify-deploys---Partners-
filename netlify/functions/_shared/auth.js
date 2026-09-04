const { verifyStaffToken } = require('./staffAuth');

/* Netlify automatically decodes the Identity JWT sent in the Authorization header
   and injects it as context.clientContext.user on every Function invocation —
   as long as the frontend attaches `Authorization: Bearer <token>` to the request.

   Second path, added for the 5 internal "Liyema Team" (staff) accounts only:
   Netlify's hosted Identity refuses the password grant on an unconfirmed email
   with no available fix (no SMTP on file, admin API doesn't honour confirmed_at
   on the hosted tier — see staffAuth.js for the full story), so those 5
   accounts log in through a separate custom endpoint (staff-login.js) that
   issues our own HMAC-signed session token instead of a Netlify Identity JWT.
   Netlify doesn't recognise that token, so clientContext.user stays empty for
   staff requests — but the raw Authorization header is still on event.headers,
   so getUser() checks there as a fallback. Partner and admin accounts are
   unaffected; they only ever hit the first path. */

function apiError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.body = JSON.stringify({ error: message });
  return err;
}

function extractBearerToken(event) {
  const headers = (event && event.headers) || {};
  const header = headers.authorization || headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? m[1] : null;
}

// Accepts either (event, context) — the current call style everywhere in this
// app — or a lone (context), so nothing breaks if some future caller forgets
// the event. The event is only needed to reach the staff-token fallback.
//
// Order matters here: the explicit staff token is checked FIRST, before
// falling back to Netlify's own context.clientContext.user. Verified live:
// Netlify populates clientContext.user from an ambient nf_jwt-style cookie
// on the browser even when the Authorization header sent by the app is our
// own (non-Netlify) staff token -- so on any browser that also happens to
// hold a leftover Netlify Identity cookie (e.g. an admin who tests a staff
// account in the same browser), the cookie's identity was silently winning
// over the staff member's own explicit, HMAC-verified token. A verified
// staff token is a deliberate, cryptographically-checked assertion of
// identity from the app itself, so it should always take precedence over
// ambient cookie state the app never asked Netlify to use. This doesn't
// reopen the earlier "unauthenticated request looks admin" issue -- that
// was about requests with NO real token at all; when there's no staff-token
// present, behaviour is unchanged and still falls back to nativeUser.
function getUser(eventOrContext, maybeContext) {
  const hasBoth = maybeContext !== undefined;
  const event = hasBoth ? eventOrContext : null;
  const context = hasBoth ? maybeContext : eventOrContext;

  const token = extractBearerToken(event);
  if (token) {
    const payload = verifyStaffToken(token);
    if (payload) {
      return {
        sub: payload.sub,
        email: payload.email,
        user_metadata: { full_name: payload.name },
        app_metadata: { roles: payload.roles || ['staff'] },
      };
    }
  }

  const nativeUser = (context && context.clientContext && context.clientContext.user) || null;
  return nativeUser;
}

function requireAuth(eventOrContext, maybeContext) {
  const user = getUser(eventOrContext, maybeContext);
  if (!user) throw apiError(401, 'Not authenticated — please log in again.');
  return user;
}

function isAdmin(user) {
  const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  return roles.includes('admin');
}

// Internal Liyema team member: same data visibility as admin, but no
// management/mutation rights (can't add/remove accounts, resolve feedback, etc).
function isStaff(user) {
  const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  return roles.includes('staff');
}

function hasFullVisibility(user) {
  return isAdmin(user) || isStaff(user);
}

function requireAdmin(eventOrContext, maybeContext) {
  const user = requireAuth(eventOrContext, maybeContext);
  if (!isAdmin(user)) throw apiError(403, 'Admin access required.');
  return user;
}

function requireFullVisibility(eventOrContext, maybeContext) {
  const user = requireAuth(eventOrContext, maybeContext);
  if (!hasFullVisibility(user)) throw apiError(403, 'Access required.');
  return user;
}

module.exports = { apiError, getUser, requireAuth, isAdmin, requireAdmin, isStaff, hasFullVisibility, requireFullVisibility };
