# Crossway Bible Church website

Astro (static-first) site for crosswaysa.org, deployed on Vercel. Content lives in Sanity (sermons, series, speakers, leaders, site settings), events come from Planning Center and sermon audio from the Spreaker feed. The Studio is in `studio/` (see `studio/README.md`).

## Setup

```
npm install
cp .env.example .env   # fill in what you have; every variable has a safe fallback
npm run dev
npm test               # unit tests
npm run test:e2e       # builds with fixtures and runs Playwright
```

Node 22 or newer. Setting `SANITY_FIXTURES=1` builds against bundled fixture content with no network access.

The launch checklist will be added here.

## Content freshness and rebuilds

Pages are generated at build time. Content only changes on the live site after a new deploy. There are two triggers.

### 1. Sanity publish webhook (owner step)

Editors' changes go live when Sanity calls a Vercel Deploy Hook.

1. Vercel: Project, Settings, Git, Deploy Hooks. Create a hook named "Sanity publish" for the production branch and copy its URL.
2. sanity.io/manage: the project, API, Webhooks, Create webhook.
   - Dataset: `production`
   - Trigger on: create, update and delete
   - Filter (document types): `_type in ["sermon", "series", "speaker", "leader", "siteSettings"]`
   - URL: the Deploy Hook URL
   - Method: POST, no body required
3. Publish a test change and confirm a new deployment starts.

### 2. Daily cron

`vercel.json` declares a Vercel Cron that calls `GET /api/cron/rebuild` every day at `0 11 * * *` (UTC). That is 6 am in Central Daylight Time and 5 am in Central Standard Time. The daily run picks up new Planning Center events and Spreaker episodes, which do not notify the site.

The endpoint checks `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header automatically when `CRON_SECRET` is set), then POSTs `VERCEL_DEPLOY_HOOK_URL`. It fails closed: it answers 503 if either variable is unset or if the hook URL is not an `https://api.vercel.com/v1/integrations/deploy/...` URL, and 401 for a missing or wrong token. It never logs the secret or the hook URL.

Setup: set `CRON_SECRET` (any long random string) and `VERCEL_DEPLOY_HOOK_URL` in the Vercel Production environment, then redeploy. Hobby plans only allow daily crons, which is all this needs; Pro is also fine. The cron runs on production deployments only. To check it, open Project, Settings, Cron Jobs, and press Run.

How the cron is wired: `@astrojs/vercel` writes `.vercel/output/config.json` without a `crons` key and does not read `crons` from `vercel.json`. Vercel's own build step merges `vercel.json` `crons` into the output config. This was checked by running `vercel build` locally on this repo: the resulting `config.json` contains the cron.

### Environment variables

Set these in Vercel for the Production environment. BUILD variables are read while the site builds, so changing one needs a new deploy. RUNTIME variables are read by server routes on each request.

| Variable                 | Build | Runtime | Purpose                                                                                     |
| ------------------------ | ----- | ------- | ------------------------------------------------------------------------------------------- |
| `SANITY_PROJECT_ID`      | yes   |         | Sanity project. Unset: the site builds with empty content and default settings.             |
| `SANITY_DATASET`         | yes   |         | Defaults to `production`.                                                                   |
| `SANITY_API_READ_TOKEN`  | yes   |         | Read token, only needed if the dataset is private.                                          |
| `PCO_APP_ID`             | yes   |         | Planning Center personal access token app id. Unset: the events page shows its empty state. |
| `PCO_SECRET`             | yes   |         | Planning Center personal access token secret.                                               |
| `RESEND_API_KEY`         |       | yes     | Contact form email delivery.                                                                |
| `CONTACT_TO_EMAIL`       |       | yes     | Recipient(s) of contact form messages.                                                      |
| `CONTACT_FROM_EMAIL`     |       | yes     | Sender on the verified Resend domain. Required in production.                               |
| `CONTACT_PUBLIC_EMAIL`   | yes   |         | Public address shown in the form's failure and no-JavaScript text. Not secret.              |
| `TURNSTILE_SITE_KEY`     | yes   |         | Cloudflare Turnstile site key. Without it the widget does not mount.                        |
| `TURNSTILE_SECRET_KEY`   |       | yes     | Turnstile secret, checked on submit.                                                        |
| `VERCEL_DEPLOY_HOOK_URL` |       | yes     | Deploy Hook URL the cron POSTs. Secret.                                                     |
| `CRON_SECRET`            |       | yes     | Bearer token Vercel Cron sends to `/api/cron/rebuild`. Secret.                              |

### Audio report

After every `npm run build`, the `postbuild` script (`scripts/audio-report.ts`) prints the result of the last sermon-to-Spreaker matching run, read from `node_modules/.cache/crossway/audio-report.json`. It never fails the build.

"Unmatched sermons" are sermons in Sanity that were not paired with a Spreaker episode, so they have no audio. "Unmatched episodes" are Spreaker episodes that no sermon claimed. The report shows the first 20 of each.

To fix a pairing, open the sermon in the Studio and either fill in "Audio file link" (a direct MP3 link) or set "Spreaker episode ID" to the episode's id from the report, then publish.

No report is written when the Spreaker feed is empty or unavailable, when there are no sermons, or in fixtures mode; the script then prints "No audio report". A report older than 36 hours is flagged STALE.

### Outages at build time

A Sanity or Spreaker outage during a build does not fail it. The affected source logs a warning and the site ships with empty or limited content (no sermons, no audio, default settings). Check the Vercel build log after each deploy for `[sanity]`, `[audio]` and `[events]` warnings, and redeploy if any appear.

Legacy sermon redirects (old Webflow `/sermons/{slug}` URLs to the new dated slugs) are computed at build time from Sanity. If Sanity is down during a build, those 301s are missing from that deployment. Redeploy once Sanity is back.

### Seeding leaders

`scripts/leaders-seed.json` holds the 19 leader documents (regenerate with `npx tsx scripts/make-leaders-seed.ts`). Sanity's importer wants NDJSON, so convert and import into the `production` dataset:

```
jq -c '.[]' scripts/leaders-seed.json > /tmp/leaders.ndjson
cd studio && npx sanity dataset import /tmp/leaders.ndjson production --missing
```

`--missing` skips documents whose ids already exist, so it is safe to rerun. Once Sanity has any leaders the site shows them instead of the built-in roster, so seed all of them before editing.

### Importing sermons

See [scripts/README-import.md](scripts/README-import.md) for the Webflow sermon and series import.

## Performance gate

`npm run build:e2e && npm run perf` runs Lighthouse CI (mobile emulation, slow 4G, 3 runs, median) against the fixtures build served locally on port 4410. `scripts/lhci-server.mjs` fronts the node adapter with brotli so the lab matches Vercel, which compresses text. Thresholds are in `lighthouserc.json`: all four categories at least 0.9, LCP at most 2500 ms, CLS at most 0.1, TBT at most 300 ms. Real Sanity, Planning Center, Vimeo and Spreaker network behavior is not part of this measurement.
