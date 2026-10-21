# Crossway Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Webflow crosswaysa.org with a fast, custom Astro site in the approved "Sanctuary" direction. Sermons are managed in Sanity, audio comes from Spreaker, events come from Planning Center, and the contact form sends through Resend.

**Architecture:**
- **Rendering:** a static-first Astro site on Vercel. The only on-demand routes are the contact endpoint and the rebuild cron.
- **Content:** a standalone Sanity Studio in `studio/` holds sermons, series, speakers, leaders and site settings. Long-form page copy lives in Astro content collections (Markdown).
- **External data:** Spreaker, Vimeo oEmbed and Planning Center are read at build time. Every external call degrades gracefully, so a failing service never fails a deploy.
- **Motion:** GSAP enhances markup that is fully visible without JavaScript.

**Tech Stack:** Astro 7.x, `@astrojs/vercel` 11.x, TypeScript, Sanity 6.x (`@sanity/client`), GSAP 3.15 (ScrollTrigger, SplitText), Resend, Cloudflare Turnstile, Fontsource, Vitest, Playwright, `@axe-core/playwright`, Lighthouse CI, ffmpeg. Node 22.

**Spec:** `docs/2026-10-20-crossway-site-design.md`. Read it first; this plan argues from it. Mockups: `docs/mockups/sanctuary-details.html` (option 1 = approved hero). Product facts: `PRODUCT.md`.

## Global Constraints

- Colors: Paper `#F3F0E8`, Navy `#1A374D`, Amber `#F5A707`, Amber-ink `#8F6000` (small amber text on Paper only), Mist `#A9B7C8`, Charcoal `#333333`. `#F5A707` is never used for text on Paper.
- Fonts: Libre Caslon Display (display), Libre Caslon Text italic (emphasis), Hanken Grotesk (UI/body). All self-hosted with Fontsource; no Google Fonts requests.
- Logo: use `design/assets/*.svg` as-is. Never redraw the wordmark.
- Performance: Lighthouse mobile ≥ 90 in all four categories on `/`, `/sermons`, and one sermon detail page; LCP < 2.5s; CLS < 0.1.
- Motion: GSAP only, with no Lenis or any smooth-scroll/scroll-jacking. Animate transform and opacity only. Honor `prefers-reduced-motion: reduce` by showing final state with no movement. Content must be visible with JS disabled.
- Accessibility: WCAG 2.2 AA, full keyboard navigation, visible focus states.
- Never fabricate church facts. Unknown content renders as a visible placeholder: the `<Placeholder>` component, an amber-ink dashed box reading "To be supplied by Crossway: …".
- Preserve existing URLs: `/sermons`, `/sermons/{webflow-slug}`, `/series/{slug}`, `/who-we-are`, `/what-we-believe`, `/culture`, `/small-groups`, `/students`, `/crossway-kids`, `/biblical-counseling`, `/child-safety`, `/networks`, `/entrusted`, `/christian-stewardship`. New: `/visit`, `/events`, `/sermons/book/{book}`, `/sermons/speaker/{slug}`, `/sermons/archive/{n}`.
- New sermon slugs follow Webflow's pattern: `{slugified-title}-{YYYY-MM-DD}`.
- Time zone for all date logic: `America/Chicago`.
- External links: Give `https://pushpay.com/g/crosswaysa?src=hpp`, Live `https://live.crosswaysa.org/`, Bookstore `https://us.10ofthose.com/partners/crosswaysa`, Español `https://crossway-espanol.webflow.io/`, Church Center `https://crosswaysa.churchcenter.com/home`, Registrations `https://crosswaysa.churchcenter.com/registrations`, Maps `https://maps.app.goo.gl/o7uWJUWy6KxYDraX7`, Facebook `https://www.facebook.com/CrosswayBibleChurchSA`, Instagram `https://www.instagram.com/crosswaybiblechurchsa/`, Apple Podcasts `https://podcasts.apple.com/us/podcast/crossway-bible-church-sermons/id1353947938`, Spreaker feed `https://www.spreaker.com/show/2817602/episodes/feed`.
- Component files are kebab-case (`sunday-card.astro`), and React components (Studio only) are named in PascalCase.
- Comments only where logic is non-obvious. Run Prettier after changes.
- Commits: single-line messages, no body, no Co-Authored-By. **Per the owner's preference, hold commits until a phase's deliverable works.** "Commit" steps below mark the phase boundary; don't push without asking.

## Review Focus

1. **A sermon with no Vimeo link, a bad link, or no matched audio:** the page renders and shows only the media that exists, with no empty player and no Watch/Listen toggle when only one medium exists. *(Task 10 test)*
2. **Planning Center unreachable or credentials missing at build:** the build succeeds, and event sections show a "See all events on Church Center" link instead of failing. *(Task 13 test)*
3. **Spreaker feed unreachable or malformed at build:** the build succeeds, audio falls back to imported episode URLs or is absent, and a warning is logged. *(Task 9 test)*
4. **Contact form abuse and failures:** an HTML/script message is escaped in the email; a 10,000-character message is rejected with a friendly error; when Resend fails, the user sees an error and keeps their typed text. *(Task 14 tests)*
5. **Narrow and zoomed viewports:** at 320px wide and at 200% text zoom there's no horizontal scroll, the hero headline wraps, and the Sunday card stacks below the hero instead of overlapping it. *(Task 15 test)*

---

## File Structure

```
crossway/
  astro.config.mjs  package.json  tsconfig.json  vercel.json  lighthouserc.json  .env.example
  src/
    lib/
      tokens.ts            colors + contrastRatio + tokensToCss
      site.ts              address, times fallback, external links, nav tree
      dates.ts             America/Chicago helpers
      books.ts             66 books, slugs, order
      slug.ts              sermonSlug()
      sanity/client.ts     getClient(), isSanityConfigured()
      sanity/queries.ts    typed fetchers (sermons, series, speakers, settings, leaders)
      sanity/types.ts      Sermon, Series, Speaker, SiteSettings, Leader
      audio/spreaker.ts    fetchSpreakerFeed(), parseSpreakerFeed()
      audio/match-audio.ts matchAudio()
      video/vimeo.ts       parseVimeoId(), getVimeoThumb()
      events/pco.ts        fetchUpcomingEvents(), mapPcoEvents()
      contact/validate.ts  validateContact()
      contact/email.ts     renderContactEmail(), sendContactEmail()
      cache.ts             readCache()/writeCache() under node_modules/.cache/crossway
    scripts/               client-side TS loaded by components
      motion.ts  hero-video.ts  nav.ts  audio-player.ts  vimeo-facade.ts  contact-form.ts
    styles/global.css
    components/  (kebab-case .astro files, listed per task)
    layouts/base-layout.astro  layouts/prose-layout.astro
    content/pages/*.md     long-form copy (content collection "pages")
    pages/ ... (per task)
  studio/                  standalone Sanity Studio (own package.json)
    sanity.config.ts  schemaTypes/{sermon,series,speaker,leader,site-settings,index}.ts
  scripts/
    encode-hero-video.sh  import-webflow.ts  audio-report.ts  scrape-pages.ts
  public/video/  public/images/
  tests/unit/*.test.ts  tests/e2e/*.spec.ts  tests/fixtures/*
```

---

## Phase 1 — Foundation

### Task 1: Scaffold project, tooling and fonts

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `.prettierrc`, `.env.example`, `vitest.config.ts`, `playwright.config.ts`, `src/pages/index.astro` (temporary), `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test` (vitest run), `test:e2e` (playwright against `astro preview` on port 4321), `format`.

- [ ] **Step 1:** `git init` in `~/code/crossway` (the existing `PRODUCT.md`, `design/`, `docs/` stay). Scaffold Astro (minimal template, strict TS) into the existing folder. Add `@astrojs/vercel`. Static output is the default; individual routes opt out with `export const prerender = false`.
- [ ] **Step 2:** Install `gsap@3.15`, `@fontsource/libre-caslon-display`, `@fontsource/libre-caslon-text`, `@fontsource/hanken-grotesk`, and dev deps `vitest`, `@playwright/test`, `@axe-core/playwright`, `prettier`, `prettier-plugin-astro`.
- [ ] **Step 3: Write the failing smoke test** `tests/e2e/smoke.spec.ts`: `GET /` returns 200 and `page.title()` contains `"Crossway Bible Church"`.
- [ ] **Step 4:** Run `npm run build && npm run test:e2e`. Expected: FAIL (the title is missing).
- [ ] **Step 5:** Give the temporary index page `<title>Crossway Bible Church</title>`. `.env.example` lists `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `PCO_APP_ID`, `PCO_SECRET`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `VERCEL_DEPLOY_HOOK_URL`, `CRON_SECRET`.
- [ ] **Step 6:** Run the tests. Expected: PASS.

### Task 2: Design tokens, global styles, base layout, brand primitives

**Files:**
- Create: `src/lib/tokens.ts`, `src/styles/global.css`, `src/layouts/base-layout.astro`, `src/layouts/prose-layout.astro`, `src/components/cross-mark.astro`, `src/components/logo-lockup.astro`, `src/components/eyebrow.astro`, `src/components/placeholder.astro`, `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces:
  - `colors` (the readonly record above, keys `paper | navy | amber | amberInk | mist | charcoal`)
  - `contrastRatio(fg: string, bg: string): number` (WCAG 2.x)
  - `tokensToCss(): string`, which returns `:root{--paper:#F3F0E8;…}`
  - `<BaseLayout title description ogImage? bodyClass?>`
  - `<ProseLayout title description eyebrow?>` (calm reading layout, max ~68ch)
  - `<CrossMark variant="amber|navy" draw?: boolean size?>`: inline SVG from `design/assets/crossway-mark-*.svg`. When `draw`, it adds a `data-draw` attribute that Task 4 animates with a clip-path wipe, not a stroke trace.
  - `<LogoLockup tone="light|dark">`
  - `<Eyebrow>`: small caps, wide tracking, leading rule
  - `<Placeholder label>`

- [ ] **Step 1: Write the failing tests** in `tokens.test.ts`:
  - `contrastRatio(colors.navy, colors.paper) >= 4.5`
  - `contrastRatio(colors.amberInk, colors.paper) >= 4.5`
  - `contrastRatio(colors.amber, colors.navy) >= 4.5`
  - `contrastRatio(colors.mist, colors.navy) >= 4.5`
  - `contrastRatio(colors.amber, colors.paper) < 3`, which documents why amber is never text on Paper
  - `tokensToCss()` contains `--amber-ink:#8F6000`
- [ ] **Step 2:** Run `npx vitest run tests/unit/tokens.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `tokens.ts`. `BaseLayout` inlines `tokensToCss()`, imports Fontsource CSS (Caslon Display 400; Caslon Text 400 and 400-italic; Hanken 400/500/600/700, latin subset), sets `<html lang="en">`, a skip link, and the meta and OG tags. `global.css` sets the type scale: hero display `clamp(4rem, 12.5vw, 13rem)` with line-height .86, a fluid section heading scale, and body at 1.125rem/1.6 Hanken. It also sets focus-visible rings (a 2px Navy outline offset 3px on Paper, an Amber outline on Navy) and `.eyebrow` styles (from the mockup).
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 3: Header, navigation, mobile menu, footer

**Files:**
- Create: `src/lib/site.ts`, `src/components/site-header.astro`, `src/components/mobile-menu.astro`, `src/components/site-footer.astro`, `src/scripts/nav.ts`, `tests/e2e/nav.spec.ts`
- Modify: `src/layouts/base-layout.astro` (render header and footer)

**Interfaces:**
- Produces:
  - `type NavItem = { label: string; href?: string; external?: boolean; children?: NavItem[] }`
  - `nav: NavItem[]`, in this order:
    - Connect `/visit`
    - Culture `/culture`
    - About Us: Our Leadership `/who-we-are`, Our Beliefs `/what-we-believe`, Child Safety `/child-safety`, Networks `/networks`
    - Church Life: Small Groups `/small-groups`, Students `/students`, Kids `/crossway-kids`, Biblical Counseling `/biblical-counseling`, Español (external)
    - Resources: Sermons `/sermons`, Sunday Live (external), Bookstore (external)
    - Events `/events`
    - Give (external)
  - `site` (address, mapsUrl, links from Global Constraints, `fallbackServiceTimes: ['9:00', '10:45']`)
  - `<SiteHeader overHero?: boolean>`

- [ ] **Step 1: Write the failing tests** in `nav.spec.ts`:
  - At 1440px: the header contains a link "Plan a Visit" with `href="/visit"`.
  - Pressing Enter on "About Us" opens its panel, and the "Our Beliefs" link becomes focusable. Escape closes it and focus returns to the trigger.
  - At 390px: a "Menu" button with `aria-expanded="false"`. Clicking it gives `aria-expanded="true"` and all top-level items are visible. Escape closes it.
  - axe finds no violations on the header.
- [ ] **Step 2:** Run `npm run test:e2e -- nav`. Expected: FAIL.
- [ ] **Step 3:** Implement the header as the frosted Paper pill from the mockup: Paper at 86% opacity, `backdrop-filter: blur(18px)`, a 1px Navy/12% border, and a neutral shadow. Dropdowns are disclosure buttons (not hover-only) with `aria-expanded`. Below 1100px it collapses into a full-screen Paper menu with large Caslon links and a focus trap. External links get `rel="noopener"` and a small ↗.
  - Footer: Navy, with the white lockup, "Meeting Sundays 9:00 & 10:45a", the address linking to `mapsUrl`, link columns mirroring the nav, Church Center, Facebook, Instagram and Watch Live, and `© {current year} Crossway Bible Church`.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 4: Motion system

**Files:**
- Create: `src/scripts/motion.ts`, `tests/e2e/motion.spec.ts`, `src/pages/dev/motion.astro` (a fixture page, excluded from the sitemap and set to `noindex`)
- Modify: `src/layouts/base-layout.astro` (load `motion.ts`, plus an inline head script that adds `html.js`)

**Interfaces:**
- Produces markup attributes any component can use:
  - `data-reveal="lines"`: SplitText lines rise from `yPercent: 110` inside masks, ease `expo.out`, 1.2s, stagger .12.
  - `data-reveal="fade"`: opacity 0→1 and y 14→0, 0.9s.
  - `data-reveal="up"`: y 80→0, 1.2s, `expo.out`.
  - `data-reveal-delay="<seconds>"`.
  - `data-draw`: cross-mark clip wipe.
  - `data-parallax="<0..0.3>"`: the element drifts by that fraction of scroll distance (ScrollTrigger scrub).
  - Reveals fire once at `top 85%`. Elements already in the first viewport play on load.

- [ ] **Step 1: Write the failing tests** in `motion.spec.ts` (against `/dev/motion`):
  - With `reducedMotion: 'reduce'`, every `[data-reveal]` has computed opacity `1` and transform `none` after load.
  - With `javaScriptEnabled: false`, every `[data-reveal]` has opacity `1`.
  - With motion allowed, after scrolling the last fixture into view and waiting 2s, its opacity is `1`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Hide reveal targets only under `html.js:not(.reduced)` and only from JS, at the moment a tween is created; never with CSS that blocks no-JS rendering. Register ScrollTrigger and SplitText. Re-split lines on resize (SplitText `autoSplit`).
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 5: Hero video pipeline and component

**Files:**
- Create: `scripts/encode-hero-video.sh`, `public/video/` outputs, `src/components/hero-video.astro`, `src/scripts/hero-video.ts`, `tests/unit/video-assets.test.ts`, `tests/e2e/hero-video.spec.ts`

**Interfaces:**
- Produces: `<HeroVideo poster="/video/lobby-poster" />`, which renders `<picture>` (AVIF + JPG poster) immediately and a `<video muted playsinline loop preload="none">` with `data-src` sources.
  - `hero-video.ts` attaches sources and plays only if all of these hold: `!matchMedia('(prefers-reduced-motion: reduce)').matches`, `!navigator.connection?.saveData`, and the document is visible.
  - Sources: `lobby-1280.webm`, `lobby-1280.mp4`, plus `lobby-720.*` for `(max-width: 800px)`.

- [ ] **Step 1:** `encode-hero-video.sh <input>`. The input defaults to the current Webflow file `https://cdn.prod.website-files.com/662a778edf0dbc5f95970240%2F669ad776baab0822e5c3a6af_C008_03221843_C012-transcode.mp4`; use the church's original if supplied.
  - Trim the first 2.5s (dark exterior).
  - Crop the letterbox bars (about 3% top and bottom).
  - Output: H.264 MP4 (CRF ~28, no audio) and VP9 WebM at 1280 and 720 widths, plus poster frames at the 3s mark as AVIF and JPG.
- [ ] **Step 2: Write the failing tests:**
  - `video-assets.test.ts`: every file in `public/video/` exists, each 1280 video is under 4 MB, each 720 video is under 2 MB, and the poster JPG is under 200 KB.
  - `hero-video.spec.ts`: with reduced motion the `<video>` has no `<source>` children; with defaults the video `paused === false` within 3s; the poster `<img>` has explicit width/height (no CLS).
- [ ] **Step 3:** Run them. Expected: FAIL. Run the script and implement the component.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit (phase 1):** `git add -A && git commit -m "Foundation: tokens, layout, nav, motion, hero video"`

---

## Phase 2 — Content backend

### Task 6: Sanity Studio and schemas

**Files:**
- Create: `studio/package.json`, `studio/sanity.config.ts`, `studio/sanity.cli.ts`, `studio/schemaTypes/{sermon,series,speaker,leader,site-settings,index}.ts`, `studio/schemaTypes/books.ts` (re-exports `src/lib/books.ts`), `src/lib/books.ts`, `tests/unit/books.test.ts`

**Interfaces:**
- Produces: `BOOKS: readonly { name: string; slug: string; testament: 'OT' | 'NT' }[]`, all 66 in canonical order with slugs like `1-timothy` and `song-of-songs`. Also `bookBySlug(slug): Book | undefined`.
- Schemas (field name: type):
  - `sermon`:
    - `title`: string (required)
    - `date`: date (required, default next/most-recent Sunday)
    - `slug`: slug (required; generated from title + date via `sermonSlug`)
    - `speaker`: ref speaker (required)
    - `series`: ref series (required)
    - `book`: string, options list from `BOOKS` (required)
    - `passage`: string
    - `vimeoUrl`: url
    - `description`: text (≤ 400 characters)
    - `audioOverrideUrl`: url (in a collapsed "Advanced" fieldset)
    - `spreakerEpisodeId`: string (readOnly; set by import)
    - `webflowPath`: string (readOnly; set by import)
  - `series`: `title`, `slug`, `artwork` (image, hotspot), `description`, `isStandalone` (boolean, true for "Stand Alone Messages")
  - `speaker`: `name`, `slug`, `role`
  - `leader`: `name`, `role`, `group` (`'Staff' | 'Elders' | 'Deacons' | 'Ministry Leaders'`), `order`, `photo` (optional)
  - `siteSettings` (singleton):
    - `serviceTimes`: string[], default `['9:00', '10:45']`
    - `sundayCardRows`: array of `{ label, value, href? }`, default the three rows from the spec
    - `announcement`: `{ enabled, text, href }`
    - `showEntrustedOnHome`: boolean, default true
- Studio structure: the desk shows "Sermons" first, ordered by date descending, with the preview showing title, date and speaker. "Site Settings" is a singleton. The editor must be able to create a sermon by filling only title, date, speaker, series, book and Vimeo link.

- [ ] **Step 1: Write the failing tests** in `books.test.ts`:
  - `BOOKS.length === 66`
  - `BOOKS[0].name === 'Genesis'` and `BOOKS[65].name === 'Revelation'`
  - `bookBySlug('1-timothy')?.name === '1 Timothy'`
  - Slugs are unique.
- [ ] **Step 2:** Run. Expected: FAIL. Implement `books.ts`. Run. Expected: PASS.
- [ ] **Step 3:** Create the Sanity project. **This needs the owner: run `npx sanity init` interactively in `studio/` with `! <command>`.** Add the schemas. Then `npm --prefix studio run build` succeeds, and `npx sanity schema validate` reports no errors.
- [ ] **Step 4:** Manual check in `npm --prefix studio run dev`: creating a sermon with only the six required fields publishes successfully.

### Task 7: Sanity client, typed queries, slugs and dates

**Files:**
- Create: `src/lib/sanity/{client,queries,types}.ts`, `src/lib/slug.ts`, `src/lib/dates.ts`, `tests/unit/slug.test.ts`, `tests/unit/dates.test.ts`, `tests/unit/queries.test.ts`, `tests/fixtures/sanity/*.json`

**Interfaces:**
- Produces:
  - `sermonSlug(title: string, date: string): string`
  - `toChicagoDate(d: Date | string): string` (`YYYY-MM-DD`)
  - `formatSermonDate(iso: string): string` (e.g. `"October 18, 2026"`)
  - `isSanityConfigured(): boolean`
  - `getSermons(): Promise<Sermon[]>` (all, date desc, with speaker, series and book expanded)
  - `getSeriesList(): Promise<Series[]>`
  - `getSpeakers(): Promise<Speaker[]>`
  - `getSiteSettings(): Promise<SiteSettings>` (returns spec defaults when unset or unconfigured)
  - `getLeaders(): Promise<Leader[]>`
  - The fetchers memoize per build. `Sermon` includes `audio?: { url: string; source: 'override' | 'spreaker-id' | 'date-match' }`, which Task 9 fills.

- [ ] **Step 1: Write the failing tests:**
  - `sermonSlug('Entrusted With Resources - Putting Money In its Place', '2026-10-18') === 'entrusted-with-resources-putting-money-in-its-place-2026-10-18'`
  - `sermonSlug("Faith That Doesn't Unravel", '2026-09-06') === 'faith-that-doesnt-unravel-2026-09-06'`
  - `toChicagoDate('2026-10-18T22:13:15Z') === '2026-10-18'`
  - `toChicagoDate('2026-10-19T04:30:00Z') === '2026-10-18'`
  - `getSiteSettings()` with Sanity unconfigured resolves `serviceTimes` to `['9:00', '10:45']`
  - `getSermons()` with a mocked client returns fixtures sorted by date descending
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 8: Webflow import (sermons, series, speakers)

**Files:**
- Create: `scripts/import-webflow.ts`, `tests/unit/import-webflow.test.ts`, `tests/fixtures/webflow/{sermons,series}.sample.csv`

**Interfaces:**
- Consumes: `BOOKS`, `bookBySlug`, `sermonSlug`.
- Produces:
  - CLI `npx tsx scripts/import-webflow.ts --sermons <csv> --series <csv> [--dry-run]`, which writes through `@sanity/client` with a write token from `SANITY_API_WRITE_TOKEN`.
  - `transformRows(sermonsCsv: Row[], seriesCsv: Row[]): { sermons: SermonDoc[]; series: SeriesDoc[]; speakers: SpeakerDoc[]; problems: string[] }` (pure).

- [ ] **Step 0:** **This needs the owner:** export the Webflow CMS "Sermons" and "Series" collections to CSV, and save them in `scripts/data/` (gitignored). Read the headers and adjust the column map at the top of the script. Webflow sermon pages hold a Vimeo URL (in an Embedly embed) and a Spreaker episode URL (`spreaker.com/episode/<slug>--<id>`); their paths are `/sermons/<slug>`.
- [ ] **Step 1: Write the failing tests** using the sample CSVs:
  - The Webflow slug is preserved as `slug.current`, and `webflowPath === '/sermons/' + slug`.
  - The Spreaker URL `…/entrusted-with-resources-putting-money-in-its-place--75851174` yields `spreakerEpisodeId === '75851174'`.
  - Book names normalize ("I Peter" → "1 Peter", "1 Thess." → "1 Thessalonians"). An unknown book goes to `problems`, not a crash.
  - Speakers are deduped by name into stable `_id`s (`speaker-josh-de-koning`).
  - The import is idempotent: document `_id`s are deterministic (`sermon-<slug>`), so a rerun uses `createOrReplace`.
- [ ] **Step 2:** Run. Expected: FAIL. Implement `transformRows`. Series artwork is uploaded as Sanity image assets from the Webflow CDN URL. Run. Expected: PASS.
- [ ] **Step 3:** Run with `--dry-run` against the real export. Expected: `problems` is printed and the count is about 600 sermons. Fix any mappings, then run for real. Verify in the Studio.
- [ ] **Step 4: Commit (phase 2):** `git commit -m "Sanity studio, schemas, and Webflow sermon import"`

---

## Phase 3 — Sermons

### Task 9: Spreaker feed and audio matching

**Files:**
- Create: `src/lib/audio/spreaker.ts`, `src/lib/audio/match-audio.ts`, `src/lib/cache.ts`, `tests/unit/match-audio.test.ts`, `tests/unit/spreaker.test.ts`, `tests/fixtures/spreaker-feed.xml` (trimmed real feed, about 5 items)

**Interfaces:**
- Produces:
  - `type Episode = { id: string; title: string; pubDate: string; mp3Url: string; durationSec?: number }`
  - `parseSpreakerFeed(xml: string): Episode[]`. The id is parsed from the enclosure `…/episode/<id>/…`.
  - `fetchSpreakerFeed(): Promise<Episode[]>`. On a network or parse error it returns the last cached feed (from `cache.ts`) and logs a warning, or `[]` if there's no cache.
  - `matchAudio(sermons: Sermon[], episodes: Episode[]): { sermons: Sermon[]; unmatchedSermons: Sermon[]; unmatchedEpisodes: Episode[] }`

**Matching algorithm (not determined by the signature):**
1. If `audioOverrideUrl` is set, use it (`source: 'override'`).
2. Otherwise, if `spreakerEpisodeId` matches an episode id, use that episode (`'spreaker-id'`).
3. Otherwise, the candidates are episodes whose `toChicagoDate(pubDate)` falls within `[sermon.date, sermon.date + 2 days]` and that aren't already claimed. Pick the one with the highest normalized-title token Jaccard similarity (lowercase, strip punctuation; ties go to the earliest pubDate) and claim it (`'date-match'`).
4. Each episode attaches to at most one sermon. Process sermons in date order, steps 1–2 before 3.

- [ ] **Step 1: Write the failing tests:**
  - The fixture parses to 5 episodes, the first with id `75851174` and mp3 `https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/75851174/sermon_audio.mp3`.
  - A sermon dated `2026-10-18` with no id matches the episode published `Sun, 18 Oct 2026 22:13:15 +0000`.
  - Two sermons on the same Sunday get distinct episodes by title similarity.
  - The override wins over an id match.
  - An episode with no sermon is listed in `unmatchedEpisodes`.
  - *(Review Focus 3)* With `fetch` rejecting, `fetchSpreakerFeed()` resolves to the cached episodes, or `[]` with no cache, and does not throw. Malformed XML also resolves rather than throws.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. `getSermons()` (Task 7) now runs `matchAudio` with the fetched feed. Run. Expected: PASS.

### Task 10: Media: Vimeo facade, audio player, Watch/Listen

**Files:**
- Create: `src/lib/video/vimeo.ts`, `src/components/vimeo-facade.astro`, `src/scripts/vimeo-facade.ts`, `src/components/audio-player.astro`, `src/scripts/audio-player.ts`, `src/components/sermon-media.astro`, `tests/unit/vimeo.test.ts`, `tests/e2e/sermon-media.spec.ts`, `src/pages/dev/media.astro` (fixture, `noindex`)

**Interfaces:**
- Produces:
  - `parseVimeoId(url: string): string | null`. It handles `vimeo.com/123`, `player.vimeo.com/video/123?…`, and `vimeo.com/123/abcdef` (private hash returned as `123?h=abcdef`).
  - `getVimeoThumb(id: string): Promise<string | null>`, using oEmbed `https://vimeo.com/api/oembed.json?url=…&width=1280`, results cached through `cache.ts`, concurrency 4, `null` on failure.
  - `<SermonMedia sermon={Sermon} />`: renders a Watch/Listen segmented toggle only when both media exist; otherwise just the one that exists; otherwise nothing.
  - `<VimeoFacade id title thumb />`: a poster image plus a play button that injects the iframe on click (autoplay=1, `dnt=1`).
  - `<AudioPlayer src title />`: a custom UI with play/pause, a scrubber (range input), elapsed/total time, speed control 1×/1.25×/1.5×/2×, and ±15s. It resumes from `localStorage['cw-audio:' + src]`, written every 5s and on pause. Storage access is wrapped in try/catch.

- [ ] **Step 1: Write the failing tests:**
  - The `parseVimeoId` cases above, plus `parseVimeoId('not a url') === null`.
  - e2e on `/dev/media`:
    - A fixture with both media shows a toggle. Clicking "Listen" shows the audio player and hides the video.
    - The facade has no `<iframe>` until clicked.
    - The audio speed button cycles to `1.25×`.
    - *(Review Focus 1)* Fixtures with no Vimeo, with an invalid Vimeo URL, and with no audio each render without a toggle and without an empty player, with no console errors.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 11: Sermon pages

**Files:**
- Create:
  - `src/pages/sermons/index.astro`
  - `src/pages/sermons/[slug].astro`
  - `src/pages/sermons/archive/[page].astro`
  - `src/pages/sermons/book/[book].astro`
  - `src/pages/sermons/speaker/[speaker].astro`
  - `src/pages/series/[slug].astro`
  - `src/pages/sermons/filter.ts` (`prerender = false`; 303 to the book or speaker page)
  - `src/components/sermon-card.astro`, `src/components/series-card.astro`, `src/components/sermon-filters.astro`, `src/components/podcast-links.astro`
  - `tests/e2e/sermons.spec.ts`

**Interfaces:**
- Consumes: `getSermons`, `getSeriesList`, `getSpeakers`, `BOOKS`, `<SermonMedia>`, `<ProseLayout>`.
- Produces routes:
  - `/sermons`:
    - a "Latest message" feature (largest `SermonMedia`, title in Caslon, speaker · passage · series · date)
    - a "Series" grid (the 8 most recent series with artwork, then "All series")
    - an "Archive" (the 12 most recent) with `<SermonFilters>`: book and speaker `<select>`s that navigate to `/sermons/book/{slug}` and `/sermons/speaker/{slug}`. They work without JS via a form GET to `/sermons/filter`, which redirects (an on-demand route).
  - `/sermons/archive/{n}`: 24 per page.
  - Book and speaker pages: 24 per page with `?page=` client pagination. Only books that have at least one sermon generate pages.
  - Sermon detail: media, title, meta, passage, description, "More from this series" (up to 3), and `<PodcastLinks>` (Apple Podcasts plus the Spreaker show).
  - Calm motion only (`data-reveal="fade"`).

- [ ] **Step 1: Write the failing tests** in `sermons.spec.ts`, against a build with fixture Sanity data (`SANITY_FIXTURES=1` makes `queries.ts` read `tests/fixtures/sanity`):
  - `/sermons`: the first heading under "Latest message" equals the newest fixture title.
  - Choosing "1 Timothy" in the book filter lands on `/sermons/book/1-timothy` and lists only 1 Timothy sermons.
  - The sermon detail at the fixture's Webflow slug returns 200.
  - `/series/{slug}` lists that series' sermons.
  - axe passes on `/sermons` and on the detail page.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 12: Redirects

**Files:**
- Create: `scripts/build-redirects.ts`, `tests/unit/redirects.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `buildRedirects(sermons: { webflowPath?: string; slug: string }[]): { source: string; destination: string; permanent: true }[]`. It only emits entries where `webflowPath !== '/sermons/' + slug`. It also always emits the static map: `/connect` → `/visit`, and the trailing-slash variants of every preserved path.

- [ ] **Step 1: Write the failing test:** an unchanged slug produces no entry, a changed one produces one 301, and `/connect` → `/visit` is present.
- [ ] **Step 2:** Run. Expected: FAIL. Implement it as a prebuild step that merges into `vercel.json` `redirects`. Run. Expected: PASS.
- [ ] **Step 3: Commit (phase 3):** `git commit -m "Sermons: pages, media, Spreaker matching, redirects"`

---

## Phase 4 — Events

### Task 13: Planning Center events

**Files:**
- Create: `src/lib/events/pco.ts`, `src/components/event-list.astro`, `src/pages/events.astro`, `tests/unit/pco.test.ts`, `tests/fixtures/pco/event_instances.json`

**Interfaces:**
- Produces:
  - `type ChurchEvent = { id: string; name: string; startsAt: string; endsAt?: string; allDay: boolean; location?: string; imageUrl?: string; url: string }`. `url` is `https://crosswaysa.churchcenter.com/calendar/event/<eventId>`.
  - `mapPcoEvents(json: unknown, now: Date): ChurchEvent[]` (pure)
  - `fetchUpcomingEvents(limit?: number): Promise<ChurchEvent[] | null>`, using the Calendar API `GET https://api.planningcenteronline.com/calendar/v2/event_instances?filter=future&include=event&order=starts_at` with Basic auth `PCO_APP_ID:PCO_SECRET`. It keeps only events where `visible_in_church_center === true`, dedupes recurring instances to the next occurrence per event, and returns `null` on any error or missing credentials. **Verify the endpoint and field names against the current Planning Center developer docs before implementing.**
  - `<EventList events limit variant="home|full" />`: when `events === null` or empty, it renders "See all upcoming events on Church Center →" linking to `https://crosswaysa.churchcenter.com/calendar?view=gallery`.

- [ ] **Step 1: Write the failing tests:**
  - A fixture with a hidden event, a past instance and two instances of one recurring event yields one entry per visible future event, sorted by start.
  - Dates are formatted in Chicago time ("Sun, Oct 25").
  - *(Review Focus 2)* With credentials unset, `fetchUpcomingEvents()` resolves `null` without a network call. With `fetch` returning 500 it resolves `null` and doesn't throw.
- [ ] **Step 2:** Run. Expected: FAIL. Implement and build `/events` (Paper, a list with Caslon dates, each row linking to Church Center, "Registrations" link at the top). Run. Expected: PASS.
- [ ] **Step 3: Commit (phase 4):** `git commit -m "Events from Planning Center"`

---

## Phase 5 — Contact form

### Task 14: Questions / Prayer form via Resend

**Files:**
- Create: `src/lib/contact/validate.ts`, `src/lib/contact/email.ts`, `src/pages/api/contact.ts` (`prerender = false`), `src/components/questions-form.astro`, `src/scripts/contact-form.ts`, `tests/unit/contact.test.ts`, `tests/e2e/contact.spec.ts`

**Interfaces:**
- Produces:
  - `type ContactInput = { name: string; email: string; heardFrom?: string; message: string; company?: string /* honeypot */; turnstileToken: string }`
  - `validateContact(input: unknown): { ok: true; value: ContactInput } | { ok: false; errors: Partial<Record<keyof ContactInput, string>> }`. Rules: name 1–100, a valid email, message 1–5000, a non-empty honeypot means spam.
  - `renderContactEmail(v: ContactInput): { subject: string; html: string; text: string }`. The subject is `"Website question/prayer from {name}"`, all fields are HTML-escaped, and `reply_to` is the sender.
  - `sendContactEmail(v): Promise<void>` (Resend SDK; `to` = `CONTACT_TO_EMAIL`, `from` = `CONTACT_FROM_EMAIL`)
  - `POST /api/contact` accepts form-encoded or JSON and returns:
    - `200 {ok:true}`
    - `400 {ok:false, errors}`
    - `200 {ok:true}` on honeypot (silently dropped)
    - `403` when Turnstile verification fails (`https://challenges.cloudflare.com/turnstile/v0/siteverify`)
    - `502 {ok:false}` when Resend fails
  - `<QuestionsForm />`: fields Name, Email, "How'd you hear about us?", "Question // Prayer Request". It shows the Turnstile widget in invisible/managed mode and progressively enhances with fetch. Without JS it posts and the endpoint 303-redirects to `?sent=1#questions`.

- [ ] **Step 1: Write the failing tests:**
  - `validateContact` rejects a missing email and an `a@` email.
  - *(Review Focus 4)* A 10,001-character message is rejected with `errors.message === 'Please keep your message under 5,000 characters.'`.
  - `renderContactEmail` with message `<script>alert(1)</script>` produces HTML containing `&lt;script&gt;` and no `<script>`.
  - The honeypot returns `{ok:true}` without calling `sendContactEmail` (mocked).
  - e2e:
    - A successful submit (mocked endpoint) shows "Thank you! We'll get back to you soon."
    - *(Review Focus 4)* With the endpoint returning 502, it shows "Something went wrong sending your message. Please try again, or email us directly." and the textarea still contains the typed text.
    - Every field has an associated `<label>`.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 3:** **This needs the owner:** create a Resend API key and verify the crosswaysa.org sending domain (add the DNS records early, per the spec). Until it's verified, `CONTACT_FROM_EMAIL` uses Resend's test sender.
- [ ] **Step 4: Commit (phase 5):** `git commit -m "Questions and prayer form via Resend"`

---

## Phase 6 — Pages

### Task 15: Home page

**Files:**
- Create: `src/components/home-hero.astro`, `src/components/sunday-card.astro`, `src/components/mission-band.astro`, `src/components/connect-steps.astro`, `src/components/latest-sermon-feature.astro`, `src/components/entrusted-feature.astro`, `src/components/announcement-bar.astro`, `tests/e2e/home.spec.ts`
- Modify: `src/pages/index.astro`, `src/layouts/base-layout.astro` (render `<AnnouncementBar>` site-wide above the header when `settings.announcement.enabled`: a slim Navy bar with the text and an optional link)

**Interfaces:**
- Consumes: `<HeroVideo>`, `<SiteHeader overHero>`, `getSiteSettings`, `getSermons`, `fetchUpcomingEvents`, `<EventList>`, `<QuestionsForm>`, the motion attributes.
- Section order:
  1. **Hero.** Footage under a Paper wash: `linear-gradient(90deg, Paper/.97 0%, Paper/.92 32%, Paper/.55 52%, Paper/0 74%)` plus a bottom fade. The eyebrow "Crossway Bible Church · San Antonio", the headline "You are / *loved.*" (`data-reveal="lines"`), and the verse "We love because he first loved us." with "1 John 4:19" in Amber-ink.
  2. **Sunday card.** Navy, overlapping the hero's bottom-right edge by 64px at ≥1100px and stacked in flow below the hero under 1100px. Label "This Sunday", times from settings ("9:00 & 10:45 AM"), rows from settings, and an amber "Plan your visit →" linking to `/visit`. `data-reveal="up"`.
  3. **Mission band.** Navy, "Why we gather", and "We exist to glorify God through the fulfillment of the *Great Commission.*" (italic emphasis in Amber).
  4. **Upcoming events** (the next 4; `EventList variant="home"`).
  5. **Latest sermon** (title, speaker, passage, thumbnail, link to the detail page).
  6. **Connect → Consider → Commit**, using the current copy: "We want to meet you!" / "Learn more about us." / "Join our church!". The first links to `/visit`, the second to `/culture`, the third to `https://crosswaysa.churchcenter.com/home`.
  7. **Entrusted feature**, only if `showEntrustedOnHome`: a quiet Paper section with "ENTRUSTED", "With Much, For More", the one-fund/two-years/three-aims summary, and a link to `/entrusted`.
  8. **Questions form** (`id="questions"`).
  - The header renders the frosted pill over the hero. Sermon, event and Entrusted sections use `fade` reveals; the hero uses `lines` and a slight video zoom settle (scale 1.08 → 1, 2.4s).

- [ ] **Step 1: Write the failing tests** in `home.spec.ts`:
  - The h1 text is "You are loved."
  - The Sunday card contains "9:00" and "10:45" and a link to `/visit`.
  - With `showEntrustedOnHome=false` (fixture) there's no Entrusted section.
  - With the announcement fixture enabled, the bar text appears on `/` and `/sermons`. With it disabled, there's no bar.
  - *(Review Focus 5)* At 320×640 and at 1440 with `document.documentElement.style.fontSize='200%'`: `scrollWidth <= clientWidth`. At 390px the Sunday card's top is ≥ the hero's bottom (stacked, no overlap). At 1440px it overlaps (card top < hero bottom).
  - axe passes.
- [ ] **Step 2:** Run. Expected: FAIL. Implement to match `docs/mockups/sanctuary-details.html` option 1, using the official color tokens. Run. Expected: PASS.

### Task 16: Plan a Visit page

**Files:**
- Create: `src/pages/visit.astro`, `src/content/pages/visit.md` (frontmatter-driven sections), `tests/e2e/visit.spec.ts`

**Interfaces:**
- Consumes: `<ProseLayout>` variant with livelier motion, `<Placeholder>`, `getSiteSettings`, `<QuestionsForm>`.
- Sections:
  - Service times and address with a "Get directions" link to `mapsUrl`, and the Watch-live link.
  - "What a Sunday is like". Use only the owner's description: bright and busy, a respectful and peaceful service, and hard questions not avoided. Anything more specific is a Placeholder.
  - Kids, with the age groups from `PRODUCT.md`: Infants, Walkers, 2's–3's, Pre-K/Kinder, 1st–2nd Grade, 3rd–5th Grade. The check-in process is a Placeholder.
  - Students: link to `/students`.
  - Parking & arrival: a Placeholder.
  - Service length: a Placeholder.
  - Questions form.

- [ ] **Step 1: Write the failing test:** `/visit` returns 200, contains "15759 San Pedro Ave", lists all six age groups, and contains at least one `[data-placeholder]` (so unsupplied facts stay visible until replaced).
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 17: Content pages carried over from Webflow

**Files:**
- Create: `scripts/scrape-pages.ts`, `src/content.config.ts` (collection `pages`), `src/content/pages/{culture,who-we-are,what-we-believe,child-safety,networks,small-groups,students,crossway-kids,biblical-counseling,christian-stewardship}.md`, matching `src/pages/*.astro`, `src/components/culture-values.astro`, `src/components/leader-grid.astro`, `tests/e2e/pages.spec.ts`

**Interfaces:**
- `scrape-pages.ts <path>` fetches `https://crosswaysa.org/<path>`, strips the nav, footer and form, and writes Markdown with headings preserved. The output is a starting draft; review every file by hand for leftover Webflow junk.
- `/culture` uses `<CultureValues>` to render the six values, each with its verse, from frontmatter.
- `/who-we-are` uses `<LeaderGrid>` from `getLeaders()`, grouped by `group`, falling back to frontmatter. Names and roles only; no invented bios.
- All of these use `<ProseLayout>` with calm `fade` reveals.

- [ ] **Step 1: Write the failing test:** each of the ten paths returns 200, has exactly one `h1`, and passes axe. `/culture` shows six values, each with a verse reference matching `/\d+:\d+/`.
- [ ] **Step 2:** Run. Expected: FAIL. Scrape, clean and implement. Seed `leader` documents from the current roster in Sanity. Run. Expected: PASS.

### Task 18: Entrusted page

**Files:**
- Create: `src/pages/entrusted.astro`, `src/content/pages/entrusted.md`, `src/components/faq-list.astro`, `tests/e2e/entrusted.spec.ts`

**Interfaces:**
- `<FaqList items>` uses `<details>/<summary>` (accessible, no JS).
- Content is carried over verbatim from the current page: "$6,500,000", one fund / two years / three aims (Existing, Expanding, Extending), the Gift Chart and Worksheet sections, and the full FAQ.
- The Gift Chart and Worksheet assets come from Webflow. If the Worksheet is interactive on the current site, link to it rather than rebuild it, and flag that to the owner.

- [ ] **Step 1: Write the failing test:** `/entrusted` contains "$6,500,000", contains "December 13, 2026", has at least 12 `<summary>` elements, and the first `<details>` toggles open on click.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 3: Commit (phase 6):** `git commit -m "Home, visit, content, and Entrusted pages"`

---

## Phase 7 — Operations and launch quality

### Task 19: Rebuild hooks, cron, audio report

**Files:**
- Create: `src/pages/api/cron/rebuild.ts` (`prerender = false`), `scripts/audio-report.ts`, `tests/unit/rebuild.test.ts`
- Modify: `vercel.json` (cron `0 11 * * *` UTC = 6am Chicago; Spreaker and PCO data refresh daily), `package.json` (a `postbuild` that runs the audio report)

**Interfaces:**
- `GET /api/cron/rebuild` requires `Authorization: Bearer ${CRON_SECRET}`. It POSTs `VERCEL_DEPLOY_HOOK_URL` and returns 200, or 401 without the header.
- Sanity webhook: on publish/unpublish of sermon, series, speaker, leader or siteSettings, POST the Vercel deploy hook. Configure this in the Sanity manage UI and document it in `README.md`.
- `audio-report.ts` prints the unmatched sermons and unmatched episodes from the last `matchAudio` run (saved by the build to `node_modules/.cache/crossway/audio-report.json`). It never fails the build.

- [ ] **Step 1: Write the failing test:** the handler returns 401 without the bearer token, and with it calls the mocked `fetch` once with the hook URL.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 20: SEO

**Files:**
- Create: `src/components/seo-jsonld.astro`, `public/og/default.jpg` (1200×630, from the lobby poster plus the lockup), `tests/e2e/seo.spec.ts`
- Modify: `astro.config.mjs` (add `@astrojs/sitemap`, excluding `/dev/*` and `/api/*`)

**Interfaces:**
- Every page has a unique `<title>` and `<meta name="description">`. Sermon pages use the sermon title and description.
- JSON-LD:
  - `Church` on `/` and `/visit`: address, the times as `openingHoursSpecification` on Sunday, and the social `sameAs` links.
  - `Event` on `/events` entries.

- [ ] **Step 1: Write the failing test:** `/sitemap-index.xml` exists and excludes `/dev/`. `/` has a JSON-LD `@type` of `Church` with `streetAddress` "15759 San Pedro Ave". There are no duplicate titles across the 10 content pages.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.

### Task 21: Performance and quality gate

**Files:**
- Create: `lighthouserc.json`, `tests/e2e/responsive.spec.ts`, `README.md` (setup, env vars, Studio deploy, webhooks, import, video encode, launch checklist)

**Interfaces:**
- Lighthouse CI asserts ≥ 0.9 in all four categories, `largest-contentful-paint` ≤ 2500ms and `cumulative-layout-shift` ≤ 0.1 (mobile preset) on `/`, `/sermons` and one fixture sermon detail.
- `responsive.spec.ts` visits every route at 320, 390, 768, 1024, 1280 and 1600 widths. It asserts no horizontal overflow, that the header is visible, and that the hero h1 has no clipped glyphs (its `getBoundingClientRect` is inside its container). It saves screenshots to `test-results/responsive/` for a human look.

- [ ] **Step 1:** Add the config and spec. Run `npx lhci autorun` and `npm run test:e2e -- responsive`. Expected: any failures point to real issues. Fix until everything passes. Typical fixes: preload the poster, font `display=swap` with the metric-matched fallback, defer GSAP to after first paint, and lazy-load below-the-fold images.
- [ ] **Step 2:** Open the screenshots and check every page at every width by eye for clunky layouts. The owner's explicit anti-goal is slow or clunky layouts and animations. Fix anything awkward at in-between sizes.
- [ ] **Step 3:** Deploy to Vercel (Kordial team) as a preview. Run Lighthouse against the preview URL. Expected: passing.
- [ ] **Step 4: Commit (phase 7):** `git commit -m "Ops, SEO, and performance gate"`

### Launch checklist (owner-dependent; not code)

- Church supplies: Plan a Visit facts (parking, kids check-in, service length), logo vectors if any, and the original hero video if any. Replace every `<Placeholder>`; `grep -r "data-placeholder" dist/` must return nothing before launch.
- Resend domain verified, Turnstile keys created, PCO credentials set, Sanity webhook configured, Studio deployed (`npx sanity deploy`), and the editor invited to Sanity.
- DNS cutover of crosswaysa.org to Vercel, then a spot-check of 10 old Webflow sermon URLs and every preserved path.
