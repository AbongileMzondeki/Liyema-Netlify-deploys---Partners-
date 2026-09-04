const { requireFullVisibility } = require('./_shared/auth');
const { readJSON } = require('./_shared/blobStore');

/* Small read-only status endpoint for the admin Settings tab — reports whether
   required environment configuration is present, without ever exposing the
   actual secret value, plus the last on-demand Squarelink refresh request.
   Readable by admins and internal staff (full visibility). */
exports.handler = async (event, context) => {
  try {
    requireFullVisibility(event, context);
    const refreshRequest = await readJSON('refreshRequest', null);
    return {
      statusCode: 200,
      body: JSON.stringify({
        syncSecretConfigured: !!process.env.SYNC_SECRET,
        refreshRequest,
      }),
    };
  } catch (e) {
    return { statusCode: e.statusCode || 500, body: e.body || JSON.stringify({ error: String(e) }) };
  }
};
