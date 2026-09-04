const { readJSON } = require('./_shared/blobStore');
const { requireAuth, apiError } = require('./_shared/auth');

exports.handler = async (event, context) => {
  try {
    requireAuth(event, context);
    const roles = await readJSON('roles', []);
    const meta = await readJSON('meta', {});
    return {
      statusCode: 200,
      body: JSON.stringify({ roles, dataPulledAt: meta.dataPulledAt || null }),
    };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
