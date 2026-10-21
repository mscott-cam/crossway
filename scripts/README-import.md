# Webflow import

```
npx tsx scripts/import-webflow.ts --sermons scripts/data/sermons.csv --series scripts/data/series.csv --dry-run
SANITY_PROJECT_ID=... SANITY_API_WRITE_TOKEN=... npx tsx scripts/import-webflow.ts --sermons ... --series ...
```

Export the Webflow CMS "Sermons" and "Series" collections to CSV into `scripts/data/` (gitignored). Always run `--dry-run` first: it prints counts, the first five sermons and every problem, and writes nothing. Reruns are safe: document ids are deterministic (`sermon-<slug>`, `series-<slug>`, `speaker-<slug>`) and written with `createOrReplace`. `SANITY_DATASET` defaults to `production`.

## Assumed columns

The sample CSVs in `tests/fixtures/webflow/` were modelled on Webflow's standard export plus guessed field labels. Real labels are unknown until the export exists. Headers match case- and whitespace-insensitively.

Sermons (`SERMON_COLUMNS` in `scripts/lib/webflow-transform.ts`): `Name` (title), `Slug`, `Draft`, `Archived`, `Date`, `Published On` (fallback only, flagged), `Speaker`, `Series`, `Book`, `Passage`, `Vimeo URL` / `Vimeo Embed` (any listed column; URL or Embedly iframe HTML), `Spreaker URL`, `Description`.

Series (`SERIES_COLUMNS`): `Name`, `Slug`, `Draft`, `Archived`, `Artwork` (Webflow CDN URL), `Description`.

If the real headers differ, add the real label to the matching list in `SERMON_COLUMNS` / `SERIES_COLUMNS`. A required column (title, date, speaker, book) that no header matches is reported as a problem. `Series` and `Speaker` are matched by name (series also by slug); if Webflow exports references as IDs, the series falls back to Stand Alone Messages and is reported.

## Rules worth knowing

- Draft and archived rows are skipped silently.
- A sermon is skipped, with a problem line, when it has no usable title, date, speaker or book. `book` is required by the Studio schema.
- Unknown books: add a lowercase key (no periods, digits for numerals, e.g. `'1 pet'`) to `BOOK_ALIASES`, then rerun the dry run.
- Dates: values at exactly 00:00 UTC (Webflow's date-only fields, e.g. `Sun Oct 18 2026 00:00:00 GMT+0000`) keep their calendar date. Any other instant is converted to America/Chicago.
- Series artwork is downloaded from the Webflow CDN and uploaded as a Sanity image only on a real run. A failed download is a warning, and the series is written without artwork.
- Fixture rows with spellings such as `I Peter`, `1 Thess.`, `Various`, `Josh De Koning` and the draft, archived and no-Vimeo rows are deliberate edge cases altered from the live site; the rest are real public sermons.
