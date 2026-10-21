# Crossway Bible Church — Website Redesign

**Date:** 2026-10-20
**Site:** crosswaysa.org (Crossway Bible Church, 15759 San Pedro Ave, San Antonio, TX 78232)
**Status:** Approved by owner, 2026-10-20

Items marked **(builder's call — Claude)** were decided by Claude during design, not by the owner. Everything else was stated or approved by the owner.

**Related:** `PRODUCT.md` at the repo root is an earlier product brief. Its facts and principles still apply, for example kids age groups, monthly Prayer & Praise, "never fabricate church facts," and "no leader bios or testimonials exist, so don't invent them." Where the two documents differ, **this document wins** on direction, stack and visual choices. The earlier exploration files in `design/` (directions 1–5) are superseded by the Sanctuary direction here, except `design/assets/`, which is still used (see §4).

---

## 1. Intent

Rebuild crosswaysa.org as a custom site that feels **modern and not template-like**, with enough traditional cues that Crossway comes across as **established, warm and inviting**. GSAP drives an interactive experience that people remember.

The site should mirror a Sunday at Crossway:

- **Arriving (the lobby):** busy, bright and inviting. The building is fairly modern and full of light.
- **The service:** respectful, peaceful and inspiring. Hard questions and hard truths aren't avoided.

So the home page and visitor-facing pages carry the energy, while the sermon, belief and culture pages are calmer and focused on reading, like a well-made book.

The owner's inspiration is https://www.tablefellowship.co/ (GSAP + ScrollTrigger + SplitText). What they liked about it: the animations, the non-templated feel, the large type, and an appealing design ("something churches aren't known for"). Crossway should match that level of craft without copying its look.

## 2. Audience

- **Home page:** leans toward **first-time visitors** deciding whether to come on a Sunday.
- **The rest of the site:** roughly an even split between visitors and **members**. Members mostly come back for **sermons** and **events**.

## 3. Goals, non-goals, anti-goals

**Goals**
- A first-time visitor can tell within seconds when and where to show up, what it will be like, and how to plan a visit.
- Members can find last Sunday's sermon immediately, then browse by series, book of the Bible and speaker.
- A non-technical staff member can post each week's sermon without help.
- The owner (a developer) maintains everything else in code.

**Non-goals**
- A custom giving system (stays on Pushpay).
- A custom livestream (stays on live.crosswaysa.org).
- A bookstore (stays on 10ofThose).
- Rebuilding the Español site (stays a separate site, linked from the nav).
- Topic tagging of sermons at launch (possible later, see §8).
- Replacing Planning Center for events or registrations.

**Anti-goals (would count as failure even if everything technically works)**
- **Slow performance.**
- **Clunky layouts.**
- **Clunky animations.**

These three are hard requirements; see §10.

## 4. Brand assets

- **Colors (keep):** Paper, Navy, Amber, Mist.
  - **Navy `#1A374D` and Amber `#F5A707` are the official values.** They're sampled from the church's own logo files (the amber cross PNG and the navy badge) and match `PRODUCT.md`. The mockups use slightly off eyedropped values (`#182C42`, `#EBA92F`); ignore those.
  - Paper `#F3F0E8` and Mist `#A9B7C8` come from the owner's swatch image (approximate).
  - The wordmark charcoal in the current logo is `#333333`.
  - **Small amber text on Paper must use `#8F6000`** (4.8:1 contrast, passes AA). Plain `#F5A707` on Paper is only 1.8:1, so use it there only for large decorative marks, the cross, and buttons with navy text. On Navy, `#F5A707` works for text (6.1:1). **(builder's call — Claude; the `#9A6B10` in the mockups fails AA at 4.1:1.)**
- **Logo (keep as-is):** horizontal lockup "CROSSWAY BIBLE CHURCH" with an amber outlined cross mark. The mark is a cross whose crossbar's lower edge forms an upward chevron, with a pointed "house/way" shape below it.
  - **Use the traced SVGs already in `design/assets/`:** `crossway-mark-amber.svg`, `crossway-mark-navy.svg`, the lockups on light and dark, and the wordmark/name files. They're filled outlines traced from the official PNGs.
  - For the draw-in animation, derive a stroke version of the mark, or animate a clip/mask over the filled path. The rough stroke trace in `docs/mockups/` is only for the mockups.
  - If the church can supply original vector files, prefer them.

## 5. Visual direction: "Sanctuary"

Chosen from three explored directions (A Sanctuary, B Wayfinder, C Morning Light). Reference mockups:
- `docs/mockups/sanctuary-details.html`, **option 1 "This Sunday card" is the approved home hero.** Option 2 on that page was rejected.
- `docs/mockups/directions-v2.html` for context on the other directions (not chosen).

Open the mockups in a browser; they load fonts, GSAP and the hero video from CDNs.

**Character:** warm, editorial and quietly established. A well-made book with real life happening behind it.

**Type**
- Display: **Libre Caslon Display**, with **Libre Caslon Text italic** for emphasis words ("*loved.*", "*Great Commission.*"). Caslon was chosen deliberately as the typeface of traditional printed Bibles.
- UI/body: **Hanken Grotesk**. Nav, labels and small caps use wide letter-spacing and uppercase.
- Traditional cues: small-caps eyebrow labels with a short leading rule, thin rules, verse citations set in small caps.
- Large headline sizes (the hero headline is ~96–210px fluid).
- Self-host the fonts, subset to the needed glyphs **(builder's call — Claude)**.

**Color use**
- Paper is the main background, and Navy is for deeper/quieter sections and the Sunday card.
- Amber is used sparingly for verse citations, emphasis words on Navy, and the main action button. It should mean something when it appears.
- Mist is for secondary text on Navy.

**Home hero (approved)**
- The lobby footage runs full-bleed behind the hero with a Paper wash: strong on the left so the type stays crisp, fading out toward the right so the people show through.
- Eyebrow "Crossway Bible Church · San Antonio", then the headline "You are / *loved.*", then the verse "We love because he first loved us." (1 John 4:19).
- **Nav:** a floating frosted-Paper pill bar (Paper at ~86% opacity with a backdrop blur, a hairline border, and a neutral shadow), with navy uppercase links and a navy "Plan a Visit" pill. The owner specifically flagged that nav links got lost over the video; this treatment fixed it and must be kept.
- **"This Sunday" card:** a navy card overlapping the bottom-right edge of the hero, with:
  - an amber dot and the label "This Sunday",
  - "9:00 & 10:45 AM" in large Caslon,
  - rows for Kids & Students (both services), the address with "Directions →", and "Can't make it? Watch live →",
  - a full-width amber "Plan your visit →" button.
  The owner rejected the previous flat "bulletin bar" of quick details as too formal and bland.
- Next section: a Navy band with "Why we gather" and "We exist to glorify God through the fulfillment of the *Great Commission.*"

**Pages without mockups** (inner pages, the rest of the home page, mobile nav, footer) are left to the builder, within this direction. Visitor-facing pages are livelier; sermon, belief and culture pages are calmer and favor reading.

## 6. Motion (GSAP)

- **The energy comes from scroll-driven motion, not loud visuals.** The owner agreed with this.
- Home and visitor pages:
  - headlines rise into view line by line,
  - the hero footage settles in from a slight zoom,
  - the Sunday card slides up,
  - sections hand off to each other as you scroll (ScrollTrigger).
- Sermon, belief and culture pages: mostly gentle text reveals.
- The cross mark can draw itself in (stroke animation).
- Libraries: GSAP 3 with ScrollTrigger and SplitText (all free since 3.13).
- **No Lenis or other smooth-scroll/scroll-jacking.** It's the most common source of "clunky" **(builder's call — Claude)**.
- Animate transforms and opacity only.
- Respect `prefers-reduced-motion`: content renders in its final state with no movement.
- Content must be visible and usable if JavaScript fails or loads late. Don't leave elements hidden waiting for an animation.

## 7. Technology

| Concern | Choice | Who decided |
|---|---|---|
| Framework | **Astro** | Owner ("Astro for sure") |
| Hosting | **Vercel**, on the agency's (Kordial) team, Pro plan, like the owner's SAPTX site. Hobby is for non-commercial use and has limited cron. | Claude, owner did not object; matches the owner's other Astro sites |
| CMS | **Sanity** | Owner ("probably fine"; asked whether Planning Center Publishing could store sermons instead, then chose to stay with Sanity) |
| Animation | **GSAP** | Owner |
| Sermon video | **Vimeo** (existing) | Existing |
| Sermon audio | **Spreaker** podcast (existing) | Existing; Claude's call to keep it, see §8 |
| Events | **Planning Center Calendar API** | Claude, owner did not object |
| Contact/prayer form | Email to a church inbox via **Resend** | Owner |
| Giving | Pushpay link `https://pushpay.com/g/crosswaysa?src=hpp` | Existing |
| Livestream | `https://live.crosswaysa.org/` link | Existing |
| Bookstore | `https://us.10ofthose.com/partners/crosswaysa` link | Existing |
| Español | `https://crossway-espanol.webflow.io/` link | Existing |
| Church Center | `https://crosswaysa.churchcenter.com/` (home, registrations) links | Existing |

**Rendering and freshness (builder's call — Claude):**
- Static-first Astro build.
- Rebuild when a Sanity document is published (webhook to a Vercel deploy hook).
- A scheduled daily rebuild picks up new Planning Center events and Spreaker episodes.
- The builder may switch to on-demand/ISR rendering for the events and sermon pages if rebuilds turn out to be too slow or too stale.

**Sanity scope (builder's call — Claude):**
- Sanity holds the content the non-technical editor touches:
  - **Sermons, Series, Speakers**,
  - site-wide **Settings**: service times, address, an optional announcement, and what the Sunday card shows.
- Leadership bios may also live in Sanity so staff can update them.
- Long-form page copy (beliefs, culture, child safety, etc.) stays in the codebase, maintained by the owner. Move it to Sanity later only if staff need to edit it.

## 8. Sermons

**How members look for sermons, in order (owner):**
1. Last Sunday's message
2. A series
3. A book of the Bible (the owner's "topic"; the current site filters by book)
4. A speaker

**Sermons page layout (Claude, follows the owner's ranking):**
- **Latest message** at the top: a large player with the title, speaker, passage, series and date.
- **Series**: a row or grid of series cards with artwork, then each series has its own page.
- **Archive** below, filterable by **book** and **speaker**, paginated or load-more. Around 600 sermons at launch.

**Sanity editor form ("New Sermon") — must take about two minutes for a non-technical person:**
- Title
- Date
- Speaker (reference/dropdown)
- Series (reference/dropdown; "Stand Alone Messages" is an existing series value)
- Book of the Bible (fixed list of 66 books)
- Passage (free text, e.g. "1 Timothy 6:6–19")
- Vimeo link
- Optional short description
- Optional **audio override** (see below)

**Watching and listening (owner: offer both):**
- Every sermon page has a **Watch / Listen** toggle.
- Watch: embed Vimeo through a lightweight facade, so the full Vimeo player loads only on click (performance).
- Listen: a custom audio player styled to the site, with speed control and resume position (stored locally).
- **Audio source: the existing Spreaker podcast** "Crossway Bible Church | Sermons", feed `https://www.spreaker.com/show/2817602/episodes/feed`, 620 episodes. The site reads the feed and automatically attaches each episode's MP3 enclosure to the matching sermon by date (Sunday) and, as a tiebreaker, by title similarity. The editor does nothing extra. The Sanity **audio override** field fixes any mismatch by hand. **(builder's call — Claude: keep Spreaker and don't build a new feed, so existing subscribers and stats stay put.)**
- Show "Subscribe on Apple Podcasts / Spotify" links on sermon pages.
- Build-time report: list sermons with no matching audio and episodes with no matching sermon. Example: on 2026-10-20, Spreaker had "Entrusted - A Way of Life" (Oct 11) but the website's sermon list didn't.

**Topics:** not at launch. A topic field can be added later if the church wants it.

## 9. Pages and structure

Keep the current structure, "the same for now (or close)" (owner).

**Top navigation (builder's call — Claude):** the current top level is Connect, Culture, About Us ▾, Church Life ▾, Resources ▾, Events and Give, plus the "Plan a Visit" pill.
- The six-item nav in the mockup (Visit, About, Church Life, Sermons, Events, Give) was shorthand. Don't treat it as an information-architecture decision.
- Sermons stays first under Resources. Since sermons are what members come for most, it also gets a one-tap shortcut: the "Can't make it? Watch live" row on the Sunday card, plus a latest-sermon section on the home page.
- At laptop widths the pill bar may need tighter letter-spacing or dropdown panels. Below roughly 1100px it collapses into a full-screen menu. The builder solves this within the Sanctuary look.

Current navigation and pages:

- **Connect**
- **Culture** — six values, each tied to a verse. Known values include Purposeful Discipleship (1 Thess. 2:8), Fervent Prayer (Rom. 12:12), Courageous Evangelism (John 20:21) and Church Planting (Acts 14:23); the full list comes from the current page.
- **About Us** — Our Leadership, Our Beliefs, Child Safety, Networks
- **Church Life** — Small Groups, Students, Kids (Crossway Kids), Biblical Counseling, Español (external link)
- **Resources** — Sermons, Sunday Live (external), Bookstore (external)
- **Give** (external, Pushpay)
- **Events** (on-site, from Planning Center)
- **Entrusted** — the current giving initiative page, $6.5M over two years, December 13, 2026 – December 2028. Keep the page and its FAQ. **The home page features Entrusted** while it runs (owner): a modest section below the hero and mission line, not the hero itself. A Sanity Settings switch turns the home section on and off so it can be retired when the initiative ends **(builder's call — Claude)**.
- **Plan a Visit (new page)** (owner) — the destination for the "Plan a Visit" nav pill and the Sunday card's main button. Path `/visit` **(builder's call — Claude)**. The current site's "Visit"/"Connect" links, which point to `/culture`, also move here.
  - Content: service times and address with a map/directions link, what a Sunday is like, kids (check-in process and the age groups listed in `PRODUCT.md`), students, parking and arrival, what to wear, and the questions form.
  - **Parking/arrival details, the kids check-in process, and service length aren't known yet.** The church must supply them. Never invent them: build with clearly marked placeholders, and treat the real content as a launch requirement.
  - No separate "let us know you're coming" form at launch; the site-wide questions form covers it **(builder's call — Claude)**.
- **Christian Stewardship** — an existing page; carry it over.

Every page's content is carried over from the current site and restyled. The builder scrapes or exports it from Webflow.

**Home page content (beyond the hero), carried over and restyled:**
- the "Why we gather" mission line,
- upcoming events (from Planning Center),
- the Connect → Consider → Commit three-step path ("We want to meet you" / "Learn more about us" / "Join our church!"),
- latest sermon,
- the questions/prayer form,
- the footer with times, address, links and social links (Facebook `CrosswayBibleChurchSA`, Instagram `crosswaybiblechurchsa`).

**URLs:** add the new `/visit`. Preserve the existing paths (`/sermons`, `/who-we-are`, `/what-we-believe`, `/culture`, `/small-groups`, `/students`, `/crossway-kids`, `/biblical-counseling`, `/child-safety`, `/networks`, `/entrusted`, `/christian-stewardship`). Add 301 redirects for any path that changes, including individual sermon URLs. Map the old Webflow sermon slugs before launch.

## 10. Performance, quality and accessibility (hard requirements)

- **Lighthouse mobile 90+** on Performance, Accessibility, Best Practices and SEO for the home, sermons-list and sermon-detail pages.
- **LCP under 2.5s** on a mid-range phone over 4G. No layout shift from fonts, images or the Sunday card.
- **Hero video:**
  - The current file is 13.7 MB at 1280×720, 72s long. Its first ~2.5s is a dark exterior shot.
  - Re-encode to a few MB (H.264 MP4 plus a WebM/AV1 alternative), trim the dark opening, and serve a smaller version to phones.
  - Show a poster image instantly.
  - Under `Save-Data` / data-saver or reduced motion, show the poster only.
  - Host the video files on Vercel or another CDN, not on Webflow (the Webflow site goes away).
- **Minimal JavaScript:** GSAP only where it's used. The Sanity Studio bundle never loads on public pages.
- **Animations** stay at 60fps on mid-range phones, using transform and opacity only.
- **Layouts** are designed for phones first and checked at phone, tablet, laptop and wide desktop widths. Nothing breaks at in-between sizes.
- **Accessibility:** WCAG 2.2 AA contrast, which is why small amber text on Paper uses the darker amber. Full keyboard navigation, visible focus states, reduced motion, alt text, and correct form labels and errors.
- **SEO:** per-page titles and descriptions, Open Graph images, a sitemap, and Church/Event/structured data where useful.

## 11. Forms

- **"Have Questions? Need Prayer?"** form (name, email, how'd you hear about us, message) appears site-wide, as it does now.
- Submissions are **emailed to a church inbox** (owner). The address is an environment setting.
- An Astro server endpoint on Vercel sends the email through **Resend** (owner). *(builder's call — Claude)* Spam protection is invisible: a honeypot plus Cloudflare Turnstile, with no visible captcha. The success and error states are friendly and on-brand.
- Sending from a crosswaysa.org address needs the email provider's DNS records (SPF/DKIM) added **before launch**, not at cutover. Until then, send from the provider's default domain or an agency domain.

## 12. Events

- Pull upcoming events from the **Planning Center Calendar API** server-side (credentials kept secret). Show only events that are visible in Church Center.
- Display them in the site's design on the home page (next few events) and on `/events` (full list).
- Each event links to its Church Center event page for details and registration.
- Staff keep managing events in Planning Center exactly as they do now.

## 13. Migration from Webflow

- **Sermons:** export the Webflow CMS sermon collection (CSV), about 600 items going back years. Write a one-time import script into Sanity covering title, date, speaker, series, book, Vimeo URL, slug and any artwork. Speakers and series become referenced documents; around 21 speakers appear on the current site. The exact Webflow field names will only be known after export.
- **Series artwork** comes over if the Webflow collection has it.
- **Page content** is copied from the live site.
- **Images** from the current site can be reused; better photography is welcome later.
- The current hero footage (lobby, kids, coffee, worship) is the main visual asset for now.

## 14. Left to the builder

- Inner page layouts, the rest of the home page below the mission line, the mobile nav and the footer, all within the Sanctuary direction.
- Component architecture, Sanity schema details, and the folder structure.
- Exact rebuild scheduling.
- The series page and sermon detail page layouts, following §8's priorities.

## 15. Assets and access to collect from the church

1. Logo vector files and official color values.
2. A Webflow CMS export (sermons) and Webflow site access.
3. Planning Center API credentials (Calendar). Confirm events are marked visible in Church Center.
4. Vimeo account access, if private videos need embed permissions.
5. Spreaker show access (not strictly required, since the feed is public).
6. The destination inbox for form submissions.
7. Domain/DNS access for crosswaysa.org: early for the email-sending records, and again at cutover.
8. The original hero video file, if available, for a higher-quality re-encode.
9. Plan a Visit content: parking and arrival, kids check-in, service length, and anything else first-timers should know. **Required before launch.**

## 16. Timeline

No deadline. Launch when it's right.
