const { readJSON, writeJSON } = require('./_shared/blobStore');
const { requireAuth, requireAdmin, hasFullVisibility } = require('./_shared/auth');

exports.handler = async (event, context) => {
  try {
    const user = requireAuth(event, context);
    const all = await readJSON('feedback', []);

    if (event.httpMethod === 'GET') {
      const data = hasFullVisibility(user) ? all : all.filter((f) => f.partnerId === user.sub);
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.text) return { statusCode: 400, body: JSON.stringify({ error: 'text is required' }) };
      const entry = {
        id: 'fb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        partnerId: user.sub,
        partnerName: (user.user_metadata && user.user_metadata.full_name) || user.email,
        roleId: body.roleId || null,
        text: body.text,
        date: new Date().toISOString().slice(0, 10),
        resolved: false,
      };
      all.push(entry);
      await writeJSON('feedback', all);
      return { statusCode: 200, body: JSON.stringify(entry) };
    }

    if (event.httpMethod === 'PATCH') {
      requireAdmin(event, context);
      const body = JSON.parse(event.body || '{}');
      const item = all.find((f) => f.id === body.id);
      if (!item) return { statusCode: 404, body: JSON.stringify({ error: 'Feedback item not found' }) };
      item.resolved = true;
      await writeJSON('feedback', all);
      return { statusCode: 200, body: JSON.stringify(item) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
