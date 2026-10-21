# Webflow import

Part of the launch checklist in the [root README](../README.md#launch-checklist). `SANITY_API_WRITE_TOKEN` is a local-only Editor token; never put it in Vercel.

```
npx tsx scripts/import-webflow.ts --sermons scripts/data/sermons.csv --series scripts/data/series.csv --dry-run
SANITY_PROJECT_ID=... SANITY_API_WRITE_TOKEN=... npx tsx scripts/import-webflow.ts --sermons ... --series ...
npx tsx scripts/import-webflow.ts --sermons ... --series ... --overwrite --yes   # destructive, see below
```

Export the Webflow CMS "Sermons" and "Series" collections to CSV into `scripts/data/` (gitignored). Always run `--dry-run` first: it prints counts, the first five sermons, every problem and the write mode that would be used, and writes nothing (no token needed). `SANITY_DATASET` defaults to `production`.

## Write modes

- **Default (`createIfNotExists`)**: creates each speaker, series and sermon only if no document with that deterministic id (`sermon-<slug>`, `series-<slug>`, `speaker-<slug>`) exists yet. It never changes an existing document, so it is safe to rerun at any time, including after editors have started working in the Studio, and it resumes cleanly after a partial failure. The summary prints created versus already-existing counts per type. Use this for every rerun.
- **`--overwrite --yes` (`createOrReplace`)**: replaces whole documents with the imported data. The importer only writes a subset of each document's fields, so this erases Studio edits: speaker roles, series artwork and descriptions added by editors, audio override links, and any fixes to a sermon's book, speaker, series, passage, description or Vimeo link. Only use it for a deliberate re-import into a dataset where nobody has edited imported content. Without `--yes` the run refuses and writes nothing.

If a run fails part-way, it says how many documents were written. Rerun the same command (default mode) to resume.

Series artwork is downloaded from the Webflow CDN (20 second timeout per image) and uploaded as a Sanity image only on a real run, and only for series that will actually be written (new ones, or all with `--overwrite --yes`). A failed download is a warning and the series is written without artwork; because default mode never touches an existing series, add that artwork in the Studio (or use `--overwrite`).

## Assumed columns

The sample CSVs in `tests/fixtures/webflow/` were modelled on Webflow's standard export plus guessed field labels. Real labels are unknown until the export exists. Headers match case- and whitespace-insensitively.

Sermons (`SERMON_COLUMNS` in `scripts/lib/webflow-transform.ts`): `Name` (title), `Slug`, `Draft`, `Archived`, `Date`, `Published On` (fallback only, flagged), `Speaker`, `Series`, `Book`, `Passage`, `Vimeo URL` / `Vimeo Embed` (any listed column; URL or Embedly iframe HTML), `Spreaker URL`, `Description`.

Series (`SERIES_COLUMNS`): `Name`, `Slug`, `Draft`, `Archived`, `Artwork` (Webflow CDN URL), `Description`.

If the real headers differ, pass a JSON map instead of editing code. Names listed in the map are tried before the defaults:

```
npx tsx scripts/import-webflow.ts --sermons ... --series ... --map scripts/data/columns.json --dry-run
```

```json
{
  "sermons": {
    "speaker": ["Preacher"],
    "vimeo": ["Video Embed Code"],
    "book": ["Scripture Book"]
  },
  "series": { "artwork": ["Cover Image URL"] }
}
```

Fields: sermons `title slug draft archived date publishedOn speaker series book passage vimeo spreaker description`; series `title slug draft archived artwork description`. Unknown sections or fields are rejected. (Alternatively, add the label to `SERMON_COLUMNS` / `SERIES_COLUMNS` in `scripts/lib/webflow-transform.ts`.) A required column (title, date, speaker, book) that no header matches is reported as a problem.

## Rules worth knowing

- Draft and archived rows are skipped silently.
- Every non-draft sermon is imported. One with no speaker or an unknown/empty book is written without that field, with a problem line naming the slug and raw value; the Studio waives those two required fields for documents that have a `webflowPath`. Only a row with no title, an unparseable date or a duplicate slug is skipped.
- A sermon's `Series` may be the series slug or name (slug is tried first, then name case-insensitively). Unresolved or blank goes to Stand Alone Messages; an unresolved non-blank value is also reported.
- Unknown books: add a lowercase key (no periods, digits for numerals, e.g. `'1 pet'`) to `BOOK_ALIASES`, then rerun the dry run.
- Descriptions longer than 400 characters (the Studio limit) are cut at a word boundary with an ellipsis, and the slug is listed in the problems.
- Document ids use only `[a-zA-Z0-9._-]`; unusual characters in a Webflow slug become `-` in the id (the slug itself is preserved).
- Dates: values at exactly 00:00 UTC (Webflow's date-only fields, e.g. `Sun Oct 18 2026 00:00:00 GMT+0000`) keep their calendar date. Any other instant is converted to America/Chicago.
- Fixture rows with spellings such as `I Peter`, `1 Thess.`, `Various`, `Josh De Koning` and the draft, archived and no-Vimeo rows are deliberate edge cases altered from the live site; the rest are real public sermons.
