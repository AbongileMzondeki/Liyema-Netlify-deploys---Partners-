# Liyema Partners Dashboard — Deployment Guide

Real, hosted version of the Partners Dashboard: genuine partner/admin accounts (own password, own login),
live data stored server-side (Netlify Blobs), and admin-created partner accounts — no more static file.

I can't create the Netlify account or run the deploy command myself (Claude is not allowed to create
third-party accounts or enter credentials on your behalf), so the steps below are split into **what you do**
and **what's already built**. None of it requires touching code.

Total hands-on time: roughly 15–20 minutes.

---

## 0. What's in this folder

```
liyema-partners-app/
  netlify.toml                 → build/redirect config (done)
  package.json                 → dependencies (done)
  public/index.html            → the actual dashboard app (done)
  netlify/functions/           → the backend API (done)
    roles.js                   → GET open/closed roles
    submissions.js             → GET/POST candidate submissions
    feedback.js                → GET/POST/PATCH partner feedback
    partners.js                → GET list of partner accounts (admin only)
    create-partner.js          → POST create a partner account (admin only)
    sync-roles.js               → POST endpoint for the scheduled Squarelink refresh
    seed.js                    → POST one-time loader for the initial 8 real roles
    _shared/auth.js            → login/role checks shared by every endpoint
    _shared/blobStore.js       → tiny data-storage helper (Netlify Blobs)
```

## 1. Create your Netlify account and site (you do this)

1. Go to netlify.com and sign up (free plan is enough to start).
2. From your Netlify dashboard, choose **"Deploy manually"** / **"Add new site" → "Deploy manually"**, then
   drag-and-drop this whole `liyema-partners-app` folder onto the upload area.
   - Alternative (recommended long-term): push this folder to a GitHub repo and connect it to Netlify instead,
     so future edits redeploy automatically. Either way works with everything below.
3. Wait for the first deploy to finish. Netlify gives you a URL like `https://random-name-123.netlify.app`
   — you can rename it later in Site settings → Domain management.

## 2. Turn on Identity (real login) — you do this

1. In your new site → **Site configuration → Identity → Enable Identity**.
2. Under **Identity → Settings → Registration**, set it to **"Invite only"**. This is important — it means
   nobody can sign themselves up; only admins (via the dashboard's "Add partner" form) can create accounts.
3. Under **Identity → Settings → Emails**, the default Netlify email templates are fine to start with.

## 3. Bootstrap the first admin account (you do this — one-time only)

Nobody exists yet to use the "Add partner" form, so the very first account has to be created by hand:

1. Identity → **Invite users** → enter your own email (payrolladmin@liyemagroup.com).
2. You'll get an email invite — click it, set your password.
3. Back in Identity → click on your new user → **edit** → add to the metadata:
   ```json
   { "roles": ["admin"] }
   ```
   (This is the `app_metadata` field in the user's detail panel — Netlify's UI has a specific box for it.)
4. Log into the deployed site with that email/password — you should land on the **admin** view (Overview,
   Partners, Roles, Feedback Inbox in the sidebar). From here on, you create every other partner account
   from inside the "Partners" tab — no more manual Identity edits needed.

## 4. Set the sync secret (you do this — 1 minute)

This protects the endpoint the scheduled Squarelink-refresh task will call.

1. Site configuration → **Environment variables** → add:
   - Key: `SYNC_SECRET`
   - Value: any long random string (e.g. generate one at random.org, or just mash the keyboard — 20+ characters)
2. Redeploy (Netlify → Deploys → **Trigger deploy**) so the function picks up the new variable.

## 5. Load the initial role data (you do this — one click, one time)

Once logged in as admin, open your browser's dev console on the deployed site and run:

```js
fetch('/api/seed', { method: 'POST', headers: { Authorization: 'Bearer ' + (await netlifyIdentity.currentUser().jwt()) } })
  .then(r => r.json()).then(console.log)
```

This loads the 8 real roles last pulled from Squarelink (21 Jul 2026) so the dashboard isn't empty on day
one, before the scheduled refresh has run against the new site. It only overwrites `roles` — it will not
touch submissions or feedback, and it's safe to run only once (running it again just resets the roles list
back to that same snapshot, not to live Squarelink data).

## 6. Point the scheduled refresh at the live site

Once you have the live URL and the `SYNC_SECRET` value, tell me both and I'll update the existing scheduled
task so it posts fresh Squarelink data straight into `/api/sync-roles` on your real site instead of editing
a static file. Until then, the scheduled task will keep failing gracefully (it does not fabricate data) and
the dashboard will run on the day-one snapshot from Step 5 plus whatever submissions/feedback partners log
live.

## 7. Add your real partners

Log in as admin → **Partners** tab → **Add a partner account** → name + email → Create. They'll get an
email invite to set their own password. If the invite email doesn't arrive (first-time Identity email
delivery can be flaky), use Identity → **Invite users** in the Netlify dashboard as a guaranteed fallback —
same account, just triggered manually.

---

## What partners and admin each see

- **Partners**: only their own submissions and feedback, plus every currently open role (any partner can
  submit against any open role). No visibility into other partners' activity.
- **Admin**: every partner account, every role (open and closed), every submission and feedback item across
  all partners, plus the "Add partner account" tool.

## Notes on how data is stored

There's no separate database to manage — everything (roles, submissions, feedback) lives in **Netlify
Blobs**, a built-in key-value store tied to your site. Partner *accounts* (email, password, admin/partner
role) live in **Netlify Identity**, Netlify's built-in auth service. Both are already wired up in the code
above; you don't need to provision anything beyond enabling Identity (Step 2).

_Deploy pipeline verified working via git push on 2026-09-04 — Claude can push updates directly going forward._
