# HubSpot HTML Bulk Uploader

Internal web app for safely uploading HTML files into HubSpot Design Manager as draft source-code files.

## Why this stack

This implementation uses `Next.js + TypeScript` so the UI, server routes, validation logic, and tests all live in one maintainable codebase with minimal operational overhead. A Python backend could work for batch processing, but it is not materially better for this MVP because:

- the product needs a polished internal web UI as much as it needs the API client
- Next.js makes file upload, server-side secret handling, and deployment straightforward
- keeping frontend and backend in one TypeScript repo reduces maintenance cost for an internal tool

## Architecture

- `app/`
  Next.js App Router UI and API route.
- `components/`
  Client-side upload flow and results UI.
- `lib/`
  Shared domain logic for HTML inspection, HubSpot API access, retry logic, and safe logging.
- `samples/`
  Example HTML and CSV for testing the workflow.
- `tests/`
  Utility tests from earlier phases plus HTML extraction coverage.

## Key behaviors

- Upload multiple `.html` files.
- Dry run validation mode checks:
  - file extensions
  - HTML structure heuristics
  - malformed markup warnings
- Upload mode:
  - validates each file against HubSpot's CMS source code validator
  - uploads each file into HubSpot's draft source code environment
  - supports test mode for first 1 or 2 files
  - supports full batch mode
  - reads the HubSpot private app token from server environment variables
- Redacts tokens in request/response logs.
- Retries transient HubSpot failures and rate limits with exponential backoff.
- Exports result rows as CSV from the browser.

## HubSpot API notes

This phase is built around HubSpot's CMS Source Code API. As of March 25, 2026, the relevant official docs are:

- CMS Source Code API guide: [developers.hubspot.com/docs/api-reference/cms-source-code-v3/guide](https://developers.hubspot.com/docs/api-reference/cms-source-code-v3/guide)
- Email template markup: [developers.hubspot.com/docs/cms/start-building/building-blocks/templates/email-template-markup](https://developers.hubspot.com/docs/cms/start-building/building-blocks/templates/email-template-markup)

The app uploads files into HubSpot's `draft` source-code environment only. It does not publish files or create marketing email drafts in this phase.

## Environment variables

Copy `.env.example` to `.env.local` and set the values you need:

```bash
cp .env.example .env.local
```

Available settings:

- `HUBSPOT_PRIVATE_APP_TOKEN`

## Local development

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Deploying to Netlify

This project is ready to deploy on Netlify. A small [`netlify.toml`](./netlify.toml) file is included so the build command, publish directory, and Node version are explicit.

### One-time setup

1. Push this project to GitHub, GitLab, or Bitbucket.
2. In Netlify, click **Add new site**.
3. Choose **Import an existing project**.
4. Connect your Git provider and select this repository.

### Build settings

Netlify usually detects Next.js automatically, but if it asks:

- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `20`

### Environment variables

Before the first production deploy, add these in Netlify:

1. Open your site in Netlify.
2. Go to **Site configuration** > **Environment variables**.
3. Add:
   - `HUBSPOT_PRIVATE_APP_TOKEN`

If you already have a local `.env.local`, Netlify also supports importing variables from a `.env` file in the UI.

### Deploy

1. Click **Deploy site**.
2. Wait for the build to finish.
3. Open the deployed URL.
4. Start with a dry run using the sample HTML file.

### Updating later

After setup, future deploys are simple:

1. Commit changes.
2. Push to your main branch.
3. Netlify rebuilds automatically.

## Running tests

```bash
npm test
```

## Suggested workflow

1. Start in dry run mode.
2. Upload a small sample batch.
3. Review validation warnings.
4. Switch to `First 1` or `First 2` in upload mode.
5. Confirm the uploaded files in HubSpot Design Manager.
6. Run the full batch once you are comfortable with the folder path.

## Security choices

- No database is used.
- Tokens are not persisted server-side.
- The HubSpot token is expected to come from environment variables rather than browser input.
- Logs redact bearer tokens before writing to the console.
- Filenames are sanitized before processing.
- Uploaded content is treated as file data for HubSpot source code upload, not executed locally.

## Verification note

The current workspace environment did not include `node` or `npm`, so I could not execute the app or test suite here. The project is fully scaffolded and ready to run in a standard Node.js environment.
