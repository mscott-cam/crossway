# Crossway Studio

Sanity Studio for crosswaysa.org content: sermons, series, speakers, leaders and site settings.

## Set up

1. Create a project at https://www.sanity.io/manage and note its project ID. Add a `production` dataset.
2. Copy `.env.example` to `.env` and fill in `SANITY_STUDIO_PROJECT_ID` (and `SANITY_STUDIO_DATASET` if not `production`).
3. `npm install`
4. `npm run dev` opens the Studio at http://localhost:3333.
5. `npm run deploy` publishes it to a hosted `*.sanity.studio` address.

Without the env vars the Studio builds against a placeholder project ID and cannot load or save content.

The site reads the same project through `SANITY_PROJECT_ID` and `SANITY_DATASET`, set in Vercel. A production site build fails without them. See the [root README](../README.md#environment-variables) for the full variable list, the publish webhook and the launch checklist (deploying the Studio with `npm run deploy`, inviting the editor).

## Adding a sermon

Fill in Title, Date, Speaker, Series, Book of the Bible and Vimeo link, click Generate on Web address, then Publish. Everything else is optional.

`src/lib/books.ts` in the site is the single list of Bible books; the Studio imports it.
