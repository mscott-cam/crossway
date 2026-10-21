# Crossway Bible Church website

Astro (static-first) site for crosswaysa.org, deployed on Vercel. Content lives in Sanity (sermons, series, speakers, leaders, site settings), events come from Planning Center and sermon audio from the Spreaker feed. The Studio is in `studio/` (see [studio/README.md](studio/README.md)). Product and design intent: `PRODUCT.md` and `docs/2026-10-20-crossway-site-design.md`.

## Setup

1. Clone the repo. Node 22 or newer.
2. `npm install`
3. `cp .env.example .env` and fill in what you have. Every variable is documented in [Environment variables](#environment-variables). With nothing set, a local build or `npm run dev` runs with empty content and default settings (it logs warnings). `astro.config.mjs` reads the Sanity variables from `.env` too, so the legacy sermon redirects are built with the same project the pages use.
4. `npm run dev` serves the site at http://localhost:4321. To work with bundled fixture content and no network access, start it with `SANITY_FIXTURES=1 npm run dev`.
5. The Studio is a separate package: `cd studio`, `npm install`, `cp .env.example .env`, `npm run dev` (details in [studio/README.md](studio/README.md)).

| Script                                                                 | What it does                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                                          | Astro dev server.                                                                                                                                            |
| `npm run build`                                                        | Production build (Vercel adapter, output in `.vercel/output`). Then runs `postbuild`, which prints the [audio report](#audio-report). Never fails the build. |
| `npm run build:e2e`                                                    | Fixtures build with the Node adapter (`SANITY_FIXTURES=1 E2E=1`). Used by the e2e and perf scripts.                                                          |
| `npm run preview`                                                      | Serves a build locally.                                                                                                                                      |
| `npm test`                                                             | Unit tests (Vitest).                                                                                                                                         |
| `npm run test:e2e`                                                     | Builds the fixtures builds, then runs Playwright against them.                                                                                               |
| `npm run perf`                                                         | Lighthouse CI against the fixtures build (run `npm run build:e2e` first).                                                                                    |
| `npm run format`                                                       | Prettier on the whole repo.                                                                                                                                  |
| `npx astro check`                                                      | Type check.                                                                                                                                                  |
| `scripts/import-webflow.ts`                                            | One-time Webflow sermon and series import into Sanity: [scripts/README-import.md](scripts/README-import.md).                                                 |
| `scripts/scrape-pages.ts`                                              | Drafts Markdown from a live crosswaysa.org page (used to copy page content; `--base` sets the origin).                                                       |
| `scripts/make-leaders-seed.ts`                                         | Regenerates `scripts/leaders-seed.json` from the `/who-we-are` frontmatter. See [Seeding leaders](#seeding-leaders).                                         |
| `scripts/encode-hero-video.sh`, `make-poster.mjs`, `make-og-image.mjs` | Asset generators for the hero video, its poster and the default share image. Outputs are committed in `public/`.                                             |

## Environment variables

Set these in Vercel under Project, Settings, Environment Variables. BUILD variables are read while the site builds, so changing one needs a new deploy. RUNTIME variables are read by server routes on each request. Production-only variables (cron, form delivery) only matter for the Production environment; set the content variables for Preview too, or preview deploys have no content.

"Required" means required for a working production site. Most variables degrade rather than crash, but a few do not:

- Production builds fail without `SANITY_PROJECT_ID` ([build guard](#production-build-guard)).
- The contact form answers 503 in any environment unless `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are set. In production it also answers 503 unless `CONTACT_FROM_EMAIL` and `TURNSTILE_SECRET_KEY` are set.
- The cron endpoint answers 503 unless `CRON_SECRET` and `VERCEL_DEPLOY_HOOK_URL` are set.

| Variable                   | When    | Required in production                     | Used by                                                                                                                                      |
| -------------------------- | ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SANITY_PROJECT_ID`        | BUILD   | Yes (build fails)                          | `src/lib/sanity/client.ts`, `scripts/require-content.mjs`. Also read by `scripts/import-webflow.ts`.                                         |
| `SANITY_DATASET`           | BUILD   | No, default `production`                   | `src/lib/sanity/client.ts`. Also the import script.                                                                                          |
| `SANITY_API_READ_TOKEN`    | BUILD   | Only for a private dataset                 | `src/lib/sanity/client.ts`.                                                                                                                  |
| `PCO_APP_ID`, `PCO_SECRET` | BUILD   | No (events page shows its empty state)     | `src/lib/events/pco.ts`. Planning Center personal access token.                                                                              |
| `RESEND_API_KEY`           | RUNTIME | Yes                                        | `src/lib/contact/email.ts`, `src/lib/contact/handle.ts`.                                                                                     |
| `CONTACT_TO_EMAIL`         | RUNTIME | Yes                                        | Recipient(s) of form messages, comma-separated allowed.                                                                                      |
| `CONTACT_FROM_EMAIL`       | RUNTIME | Yes                                        | Sender on the verified Resend domain. Outside production, unset falls back to Resend's shared `onboarding@resend.dev`.                       |
| `CONTACT_PUBLIC_EMAIL`     | BUILD   | No (a visible placeholder shows until set) | `src/components/questions-form.astro`, `contact-fallback.astro`. Public address in the form's failure and no-JavaScript text. Not secret.    |
| `TURNSTILE_SITE_KEY`       | BUILD   | Yes                                        | `src/components/questions-form.astro`. Without it no widget mounts.                                                                          |
| `TURNSTILE_SECRET_KEY`     | RUNTIME | Yes                                        | `src/lib/contact/handle.ts`. Checked on submit.                                                                                              |
| `VERCEL_DEPLOY_HOOK_URL`   | RUNTIME | Yes, for the daily rebuild                 | `src/lib/ops/rebuild.ts`. Deploy Hook URL the cron POSTs. Secret.                                                                            |
| `CRON_SECRET`              | RUNTIME | Yes, for the daily rebuild                 | `src/lib/ops/rebuild.ts`. Bearer token Vercel Cron sends to `/api/cron/rebuild`. Secret.                                                     |
| `VERCEL_ENV`               | both    | Set by Vercel                              | `production`, `preview` or `development`. Never set it by hand. Drives the build guard, the fixtures block and the form's production checks. |

Other variables, none of which belong in Vercel:

| Variable                                            | Where                 | Purpose                                                                                                  |
| --------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `SANITY_API_WRITE_TOKEN`                            | Local shell           | Editor token for `scripts/import-webflow.ts`. Never put it in Vercel or `.env` files that get committed. |
| `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` | `studio/.env`         | The Studio's project and dataset (dataset defaults to `production`). Build-time for the Studio.          |
| `ALLOW_EMPTY_CONTENT`                               | Vercel (escape hatch) | `1` downgrades the production no-content build failure to a warning. Leave unset.                        |

### Test-only

Set by the npm scripts, never by hand and never in Vercel. `SANITY_FIXTURES` is ignored when `VERCEL_ENV=production`: the build logs an error and uses Sanity.

| Variable                                                            | Purpose                                                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E=1`                                                             | Node adapter build for Playwright and Lighthouse; disables the build guard and dev-page pruning. Setting it in Vercel would bypass the guard, so never do. |
| `SANITY_FIXTURES=1`                                                 | Read content from `tests/fixtures` instead of Sanity. Not honored when `VERCEL_ENV=production`.                                                            |
| `SANITY_FIXTURE_SETTINGS`, `SANITY_FIXTURE_DIR`, `PCO_FIXTURE_FILE` | Pick alternate fixture files (announcement bar, empty states).                                                                                             |
| `CROSSWAY_CACHE_DIR`                                                | Moves the build cache (audio report) for hermetic tests.                                                                                                   |
| `RESEND_API_KEY=e2e-fake`                                           | With `E2E=1` and a non-production `VERCEL_ENV`, the form uses a stub transport instead of Resend.                                                          |

### Production build guard

A production deploy (`VERCEL_ENV=production`) with no real `SANITY_PROJECT_ID` would ship an empty site: no sermons, no series, default settings. `scripts/require-content.mjs` (logic in `src/lib/ops/build-guard.ts`) fails that build before anything is built, with a message naming what to set. Unset, blank and placeholder ids all count as missing. Preview, development and local builds are never blocked, and `E2E=1` builds are exempt.

Troubleshooting a deploy that fails with `[build-guard] Refusing to build a production deploy with no content`:

1. Set `SANITY_PROJECT_ID` (and `SANITY_DATASET` if not `production`) for the Production environment in Vercel, then redeploy. Environment variable changes do not apply to existing deployments.
2. `SANITY_FIXTURES=1` does not help; fixtures are ignored in production.
3. To deploy an empty site deliberately (for example to check hosting before Sanity exists), set `ALLOW_EMPTY_CONTENT=1`. The build then only prints a warning. Remove it afterwards.

Other missing sources stay warnings by design: Planning Center and Spreaker outages or missing credentials log `[events]` and `[audio]` lines and the site builds without them.

## Content freshness and rebuilds

Pages are generated at build time. Content only changes on the live site after a new deploy. There are two triggers.

### 1. Sanity publish webhook (owner step)

Editors' changes go live when Sanity calls a Vercel Deploy Hook.

1. Vercel: in the project settings, look for Git and Deploy Hooks (wording may have changed). Create a hook named "Sanity publish" for the production branch and copy its URL.
2. sanity.io/manage: in the project, look for API and Webhooks and create a webhook.
   - Dataset: `production`
   - Trigger on: create, update and delete
   - Filter (document types): `_type in ["sermon", "series", "speaker", "leader", "siteSettings"]`
   - URL: the Deploy Hook URL
   - Method: POST, no body required
3. Publish a test change and confirm a new deployment starts.

### 2. Daily cron

`vercel.json` declares a Vercel Cron that calls `GET /api/cron/rebuild` every day at `0 11 * * *` (UTC). The daily run picks up new Planning Center events and Spreaker episodes, which do not notify the site.

On Vercel's Hobby plan a cron fires anywhere within the scheduled hour (precision of plus or minus 59 minutes), so the run lands between 11:00 and 11:59 UTC: 6:00 to 6:59 am Central Daylight Time, or 5:00 to 5:59 am Central Standard Time. The project is meant to run on the Pro plan (see the checklist), which does not have that limit.

The endpoint checks `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header automatically when `CRON_SECRET` is set), then POSTs `VERCEL_DEPLOY_HOOK_URL`. It fails closed: it answers 503 if either variable is unset or if the hook URL is not an `https://api.vercel.com/v1/integrations/deploy/...` URL, and 401 for a missing or wrong token. It never logs the secret or the hook URL.

Setup: set `CRON_SECRET` (any long random string) and `VERCEL_DEPLOY_HOOK_URL` in the Vercel Production environment, then redeploy. The cron runs on production deployments only. To check it, look for Cron Jobs in the project settings and use its run button (wording may have changed).

How the cron is wired: `@astrojs/vercel` writes `.vercel/output/config.json` without a `crons` key and does not read `crons` from `vercel.json`. Vercel's own build step merges `vercel.json` `crons` into the output config. This was checked by running `vercel build` locally on this repo: the resulting `config.json` contains the cron.

### Build time, Vimeo thumbnails and the Sanity CDN

- Build-time Sanity reads use the live API, not the API CDN (`useCdn: false` in `src/lib/sanity/client.ts`). A build starts seconds after an editor publishes through the webhook, and a CDN read can still return the previous copy. A build makes about six queries, so the CDN saves nothing.
- The first production build with about 600 sermons may take several minutes because it fetches a Vimeo thumbnail for every sermon (Vimeo oEmbed, 4 second timeout, 4 at a time, `build.concurrency: 4`). Thumbnails are cached in `node_modules/.cache`, and Vercel restores that cache between builds, so later builds only look up new videos. Each video is looked up at most once per build.
- If Vimeo is down or throttling, a circuit breaker stops the lookups after 5 failures in a row (network errors, timeouts, 429 or 5xx responses), logs one line, `Vimeo thumbnails unavailable; building without thumbnails`, and the build carries on without thumbnails. The most time Vimeo can cost a build is therefore about 5 x 4 seconds. Sermon pages then use the default social image and the video facade without a poster until the next build.

### Audio report

After every `npm run build`, the `postbuild` script (`scripts/audio-report.ts`) prints the result of the last sermon-to-Spreaker matching run, read from `node_modules/.cache/crossway/audio-report.json`. It never fails the build.

The Vercel project's Build Command must stay the framework default (leave the override off) so Vercel runs `npm run build` and therefore `postbuild`. Overriding it to `astro build` silently drops the report. Confirm the audio report line appears in the first production build log.

"Unmatched sermons" are sermons in Sanity that were not paired with a Spreaker episode, so they have no audio. "Unmatched episodes" are Spreaker episodes that no sermon claimed. The report shows the first 20 of each.

To fix a pairing, open the sermon in the Studio and either fill in "Audio file link" (a direct MP3 link) or set "Spreaker episode ID" to the episode's id from the report, then publish.

No report is written when the Spreaker feed is empty or unavailable, when there are no sermons, or in fixtures mode; the script then prints "No audio report". A report older than 36 hours is flagged STALE.

### Outages at build time

A Sanity or Spreaker outage during a build does not fail it. The affected source logs a warning and the site ships with empty or limited content (no sermons, no audio, default settings). The exception is a production build with no Sanity project configured at all, which fails ([Production build guard](#production-build-guard)); an outage with a configured project still degrades silently. Check the Vercel build log after each deploy for `[sanity]`, `[audio]` and `[events]` warnings, and redeploy if any appear.

Unknown URLs get the branded 404 page (`src/pages/404.astro`): it is prerendered, the Vercel adapter serves it as a static `404.html` with a 404 status without invoking the server function, and it is `noindex` and left out of the sitemap. `/sermons/archive` redirects to `/sermons/archive/1`.

Legacy sermon redirects (old Webflow `/sermons/{slug}` URLs to the new dated slugs) are computed at build time from Sanity. If Sanity is down during a build, those 301s are missing from that deployment. Redeploy once Sanity is back.

### Seeding leaders

`scripts/leaders-seed.json` holds the 19 leader documents (regenerate with `npx tsx scripts/make-leaders-seed.ts`). This is a developer-level step (command line, needs `jq`): ask whoever maintains the site to run it. Sanity's importer wants NDJSON, so convert and import into the `production` dataset:

```
jq -c '.[]' scripts/leaders-seed.json > /tmp/leaders.ndjson
cd studio && npx sanity dataset import /tmp/leaders.ndjson production --missing
```

`--missing` skips documents whose ids already exist, so it is safe to rerun. Once Sanity has any leaders the site shows them instead of the built-in roster, so seed all of them before editing.

### Importing sermons

See [scripts/README-import.md](scripts/README-import.md) for the Webflow sermon and series import.

## Quality gates

| Command            | Checks                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`         | Vitest unit tests: data transforms, Sanity and Planning Center parsing, forms, redirects, SEO output, the rebuild endpoint and the build guard. The whole suite takes about 7 seconds on a laptop (Vitest reports the duration). It includes a few hermetic temp-root production builds (redirects, SEO, guard) that run in parallel and take about 2 seconds each because they use fixture data. |
| `npm run test:e2e` | Builds the fixtures builds (including the announcement-bar variant), then Playwright on Chromium: navigation, every page, sermon media, events, the contact form, motion and reduced motion, axe accessibility, and the responsive gate (every route at 320, 390, 768, 1024, 1280 and 1600 px, plus enlarged text, with screenshots in `test-results/responsive/`). No retries.                   |
| `npm run perf`     | Lighthouse CI, run `npm run build:e2e` first. Mobile emulation (slow 4G), 3 runs per URL, median. Asserts performance, accessibility, best practices and SEO at least 0.9, LCP at most 2500 ms, CLS at most 0.1, TBT at most 300 ms, on `/`, `/sermons`, one sermon detail, `/visit` and `/entrusted`. Thresholds are in `lighthouserc.json`.                                                     |

Run `npm test` and `npx astro check` before every commit. Run `npm run test:e2e` before a deploy. `npm run perf` binds ports 4410 and 4411.

Last measured: `npm test` and `npm run test:e2e` all green; Lighthouse mobile median across the five URLs: performance 98 to 99, accessibility 100, best practices 100, SEO 100; worst LCP about 2.1 s (limit 2.5 s), CLS 0, TBT 0.

What that measurement is: the fixtures build served locally with `scripts/lhci-server.mjs`, which fronts the Node adapter with brotli so text transfer matches Vercel (the Node adapter alone serves uncompressed, which overstated LCP at 3.0 to 3.3 s). Real Sanity, Planning Center, Vimeo and Spreaker traffic is not included. A Lighthouse run against the first Vercel preview URL is a launch step (see the checklist).

## Launch checklist

Owner-dependent steps, in order. Nothing here has been done yet. Tick items as they are completed.

### 1. Accounts and projects

- [ ] Sanity (owner): create a project at sanity.io/manage with a `production` dataset (or run `npx sanity init` inside `studio/`). Note the project ID.
- [ ] Put the ID in `studio/.env` as `SANITY_STUDIO_PROJECT_ID`, run `npm --prefix studio run dev`, create one test sermon with the six required fields, then delete it.
- [ ] Deploy the Studio: `npm --prefix studio run deploy` (run `npx sanity login` in `studio/` first if needed).
- [ ] Invite the sermon editor: in the project's settings at sanity.io/manage, look for the members or invite section and give them the Editor role. (Menu wording may have changed.)

### 2. Import content

- [ ] In Webflow, export the CMS collections "Sermons" and "Series" as CSV into `scripts/data/` (gitignored).
- [ ] `npx tsx scripts/import-webflow.ts --sermons scripts/data/sermons.csv --series scripts/data/series.csv --dry-run`. Read every line under `problems`: unknown books (add aliases, see [scripts/README-import.md](scripts/README-import.md)), sermons with no speaker, series that did not resolve, column headers that were not matched (use `--map`). The real Webflow column names have never been seen; expect to adjust.
- [ ] Create a Sanity token with Editor access (look for API and Tokens in the project settings at sanity.io/manage; wording may have changed). Run the import for real (default mode never overwrites existing documents): `SANITY_PROJECT_ID=... SANITY_API_WRITE_TOKEN=... npx tsx scripts/import-webflow.ts --sermons ... --series ...`. Open a few sermons in the Studio.
- [ ] Seed the leaders. This is a developer-level step (command line): ask whoever maintains the site to run the commands in [Seeding leaders](#seeding-leaders).

### 3. Contact form email (Resend)

Steps 3 to 5 produce values (keys, tokens). Collect them now and enter them in Vercel once step 6 has created the project.

- [ ] Create a Resend account and add the sending domain crosswaysa.org.
- [ ] Add the SPF and DKIM DNS records Resend shows, at the place the domain's DNS is managed now. Do this before the DNS cutover, not at it. Wait for Resend to show the domain as verified.
- [ ] **A domain can have only one SPF record** (a TXT record starting with `v=spf1`). If one already exists (for example for the church's email), do not add a second one: edit the existing record and merge in the `include:` part Resend gives you. Two SPF records break email delivery.
- [ ] Set `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (the church inbox) and `CONTACT_FROM_EMAIL` (an address on the verified domain) in Vercel.

### 4. Spam protection (Cloudflare Turnstile)

- [ ] Create a Turnstile widget. Restrict it to the production hostnames (and the preview hostname while testing).
- [ ] Set `TURNSTILE_SITE_KEY` (BUILD) and `TURNSTILE_SECRET_KEY` (RUNTIME) in Vercel (once step 6 exists), then redeploy so the site key is baked in.

### 5. Events (Planning Center)

- [ ] Create a personal access token in Planning Center (the Calendar product's API or personal access token settings; wording may have changed) and set `PCO_APP_ID` and `PCO_SECRET` in Vercel once step 6 exists.
- [ ] Confirm each event the church wants listed is marked visible in Church Center.
- [ ] After the first build, check `/events`. The live API response shape and pagination were never verified against a real account. A `[events]` warning in the build log means the page fell back to a Church Center link.

### 6. Vercel

- [ ] Create the project on the Kordial team (Pro plan; Hobby is for non-commercial use and limits crons). Framework preset Astro, Node 22.
- [ ] Leave the Build Command and Output Directory at the framework defaults (no override), so `npm run build` runs and prints the audio report.
- [ ] Keep "Automatically expose System Environment Variables" enabled (look for it under the project's Environment Variables settings). The production build guard relies on `VERCEL_ENV`; without it the guard silently does nothing.
- [ ] Set every [environment variable](#environment-variables) for Production, and the content ones (Sanity, PCO, Turnstile site key, Resend) for Preview too.
- [ ] Create the Deploy Hook and set `VERCEL_DEPLOY_HOOK_URL` and `CRON_SECRET` ([Content freshness](#content-freshness-and-rebuilds)). Create the Sanity webhook and publish a test edit.
- [ ] First preview deploy. Read the build log: warnings from `[sanity]`, `[audio]`, `[events]`; the redirects warnings for unusual Webflow slugs; and the audio report line.
- [ ] Check that `/culture`, `/who-we-are`, `/what-we-believe` and the other no-slash pages load on Vercel. With `trailingSlash: 'never'` Vercel serves `x/index.html`; that was only verified locally.
- [ ] Run Lighthouse (mobile) on the preview URL for `/`, `/sermons`, one sermon, `/visit` and `/entrusted`. Targets: all four categories at least 90, LCP under 2.5 s, CLS under 0.1. If Deployment Protection blocks PageSpeed Insights, use Chrome DevTools.
- [ ] Production deploy from the production branch. Confirm the guard did not fire and the cron is listed (look for Cron Jobs in the project settings).

### 7. Content the church must supply

- [ ] The `/visit` page has three placeholders: parking and arrival details, the kids check-in process, and how long a service lasts (`src/pages/visit.astro`). Required before launch.
- [ ] `CONTACT_PUBLIC_EMAIL`: a public address for the form's failure text. Until it is set, a hidden "public contact email" placeholder is present in the HTML of every page that has the form (checked: 17 pages in a production build).
- [ ] Before launch this must return nothing: `grep -r data-placeholder .vercel/output/static` after a production build. With `CONTACT_PUBLIC_EMAIL` set, only `/visit` matches (until its three placeholders are filled).
- [ ] Optional: logo vector files and official colors, the original hero video file for a higher-quality encode (`scripts/encode-hero-video.sh`), better photography.

### 8. Owner review of wording

These descriptions and names are summaries or inferences written during the build. None should state anything the live site does not, but they need an owner glance.

- [ ] Page titles and descriptions: `description` in every file in `src/content/pages/*.md`, and the descriptions in `src/pages/index.astro`, `src/pages/events.astro`, `src/pages/sermons/index.astro` and `src/pages/series/index.astro`.
- [ ] `/networks`: the live site shows only logos, so the link names are inferred: Southern Baptist Theological Seminary, 9Marks, The Gospel Coalition, Great Commission Collective (`src/content/pages/networks.md`).
- [ ] `/entrusted`: the Gift Chart alt text and "Gift chart as text" table (checked against the image; the Totals column sums to $6,500,000), in `src/content/pages/entrusted.md`.
- [ ] The Entrusted paragraph on the home page (`src/components/entrusted-feature.astro`).
- [ ] Podcast: add the show's Spotify URL (not supplied) to `site.links`/podcast links if the church wants a Spotify button (the spec mentions Apple Podcasts / Spotify; the site currently links Apple Podcasts and Spreaker).
- [ ] Naming: the site says "Students" (nav, `/visit`, page title "Crossway Students"). Confirm the church does not prefer "Student Ministry".

### 9. Known issue: Entrusted worksheet graphic

- [ ] `public/documents/entrusted-worksheet.svg` (and partly `entrusted-giving-split.svg`) uses Adobe fonts that do not load when an SVG is used as an `<img>`, so its text overlaps (for example "YEARCOMMITMENT"). The file is byte-identical to the live site's, so the live page has the same problem. Fix: ask the church's designer for an outlined-text export, or approve an HTML rebuild of the worksheet's equation. The alt text carries the verified transcription.

### 10. DNS cutover

**WARNING: the website and the church's email share the same domain settings. Change only the records that point the website. Deleting or replacing the wrong record can stop the church's email from working, and the contact form's email too.**

- [ ] A day or more ahead, lower the TTL on the crosswaysa.org records (a short TTL makes a mistake quick to undo).
- [ ] Write down or screenshot every existing DNS record before touching anything.
- [ ] Change only the website records: the A record or CNAME for `crosswaysa.org` (the bare domain) and for `www`, to the values Vercel shows. **Never delete or replace MX records (they receive email) or TXT records (SPF, DKIM, DMARC, and the verification records for Google Workspace or Microsoft 365), and leave the Resend records alone.**
- [ ] Do not move the domain's nameservers to Vercel. It is safer to keep DNS where it is and edit only the A/CNAME records. If nameservers are moved anyway, first recreate every existing record (MX, TXT, CNAME, all of them) at Vercel, and compare against the list from the step above before switching.
- [ ] Pick one main address. The site treats `crosswaysa.org` (no `www`) as the main one (its canonical tags and sitemap use it). Add both `crosswaysa.org` and `www.crosswaysa.org` in the Vercel project and set `www` to redirect to the bare domain there.
- [ ] Keep Webflow running until everything below is verified.
- [ ] Confirm the church's email still sends and receives after the switch (send one message each way).
- [ ] Confirm the Español link (`crossway-espanol.webflow.io`) still works after the cutover.
- [ ] Spot-check 10 old sermon URLs. The legacy-slug 301s only exist for sermons whose slug differs from the Webflow path; the rest keep the same path.
- [ ] Open every preserved path: `/culture`, `/who-we-are`, `/what-we-believe`, `/child-safety`, `/networks`, `/small-groups`, `/students`, `/crossway-kids`, `/biblical-counseling`, `/christian-stewardship`, `/entrusted`, `/sermons`, and a few `/series/...`.
- [ ] Send a real test message through the production contact form and confirm it reaches the church inbox.

### 11. After launch

- [ ] Submit `https://crosswaysa.org/sitemap-index.xml` in Google Search Console.
- [ ] Confirm the Spreaker and Apple Podcasts links work and new episodes appear on the next daily rebuild.
- [ ] Send a real message through the production form and confirm it arrives at the church inbox.

## Known limitations and decisions

- The contact form has no rate limiting and no Origin check beyond Turnstile, the honeypot and a 20 KB body cap.
- Lighthouse numbers come from the fixtures build, not real services. See [Quality gates](#quality-gates).
- GSAP is on the critical path (about 300 ms of lab LCP). Deliberate: it powers the reveal mechanism that keeps content hidden until it animates in without a flash.
- The hero video has a pause control (WCAG 2.2.2); under reduced motion or data saver it is a still poster.
- Data freshness: sermons, series and settings update on Sanity publish (webhook); events and new Spreaker episodes on the daily cron. A Planning Center edit can take up to a day to appear.
- A Sanity, Spreaker or Planning Center outage at build time degrades with warnings, not a failed build. Production without any Sanity project now fails by the build guard.
- Legacy sermon redirects are computed at build time from Sanity.
- Playwright runs Chromium only. The real-Chrome default-font-size test skips if Chrome is not installed.
- Lighthouse CLS depends on lab fonts. The fallback fonts are metric-matched, so web font swaps do not shift layout.
- `npm audit` reports 20 advisories (14 high). Three high ones are in production dependencies: `path-to-regexp` through `@astrojs/vercel` and `@vercel/routing-utils`, used at build time to generate routes. The rest are in the `@lhci/cli` tree and the Studio's transitive dependencies (dev and build time only). They are left unfixed because the suggested fixes downgrade the adapter or Lighthouse CI to ancient versions.
- `package.json` `engines` is `node >=22`; set the Vercel project's Node version to 22.x explicitly.
