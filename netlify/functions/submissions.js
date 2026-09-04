const { readJSON, writeJSON } = require('./_shared/blobStore');
const { requireAuth, isAdmin, hasFullVisibility } = require('./_shared/auth');

exports.handler = async (event, context) => {
  try {
    const user = requireAuth(event, context);
    const all = await readJSON('submissions', []);

    if (event.httpMethod === 'GET') {
      const data = hasFullVisibility(user) ? all : all.filter((s) => s.partnerId === user.sub);
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.roleId || !body.candidate) {
        return { statusCode: 400, body: JSON.stringify({ error: 'roleId and candidate are required' }) };
      }
      // Admins may backfill a historical entry on behalf of a partner (e.g. importing
      // past Squarelink activity) by passing partnerId + partnerName explicitly, plus
      // an optional historical date. Non-admin callers always log as themselves, and
      // the date is always "today" for real-time self-logged submissions.
      const backfill = isAdmin(user) && body.partnerId;
      const entry = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        roleId: body.roleId,
        partnerId: backfill ? body.partnerId : user.sub,
        partnerName: backfill ? (body.partnerName || 'Unknown partner') : ((user.user_metadata && user.user_metadata.full_name) || user.email),
        candidate: body.candidate,
        date: (backfill && body.date) ? body.date : new Date().toISOString().slice(0, 10),
        status: body.status || 'Submitted',
        count: body.count || 1,
        source: backfill ? 'squarelink-backfill' : 'log-a-submission',
      };
      all.push(entry);
      await writeJSON('submissions', all);
      return { statusCode: 200, body: JSON.stringify(entry) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
