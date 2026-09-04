const { getStore } = require('@netlify/blobs');

/* Single shared blob store for all app data. Small scale (a handful of partners,
   roles, submissions, feedback) so plain JSON blobs are plenty — no external DB.
   Explicit siteID + token (BLOBS_SITE_ID / BLOBS_TOKEN env vars) are used instead
   of relying on Netlify's automatic zero-config context, since that context was
   not being injected reliably for this site (manual drop deploys). Falls back to
   the automatic client if those env vars aren't set, in case that changes. */
function store() {
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({
      name: 'liyema-data',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
  }
  return getStore('liyema-data');
}

async function readJSON(key, fallback) {
  const s = store();
  const val = await s.get(key, { type: 'json' });
  return val === null || val === undefined ? fallback : val;
}

async function writeJSON(key, value) {
  const s = store();
  await s.setJSON(key, value);
}

module.exports = { readJSON, writeJSON };
