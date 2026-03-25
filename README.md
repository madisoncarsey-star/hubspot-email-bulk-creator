# HubSpot Email Bulk Creator

Internal web app for safely bulk-creating HubSpot marketing email drafts from uploaded HTML files.

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
  Shared domain logic for CSV parsing, HTML inspection, payload building, HubSpot API access, retry logic, and safe logging.
- `samples/`
  Example HTML and CSV for testing the workflow.
- `tests/`
  Unit tests for CSV parsing, HTML body extraction, plain text generation, and HubSpot payload building.

## Key behaviors

- Upload multiple `.html` files.
- Optionally upload a CSV with:
  - `filename`
  - `subject`
  - `preview_text`
  - `internal_name`
- Dry run validation mode checks:
  - file extensions
  - HTML structure heuristics
  - body extraction
  - payload readiness
- Create mode:
  - creates draft HubSpot marketing emails only
  - never calls publish endpoints
  - supports test mode for first 1 or 2 emails
  - supports full batch mode
  - reads the HubSpot private app token from server environment variables instead of a browser form field
- Optional advanced clone mode:
  - if `baseEmailId` is provided, the app clones the base email with `POST /marketing/v3/emails/clone`
  - then patches the cloned draft with `PATCH /marketing/v3/emails/{emailId}/draft`
- Generates plain text fallbacks from HTML.
- Redacts tokens in request/response logs.
- Retries transient HubSpot failures and rate limits with exponential backoff.
- Exports result rows as CSV from the browser.

## HubSpot API notes

This project is built around the HubSpot Marketing Emails v3 API. As of March 25, 2026, the relevant official docs are:

- Create marketing email: [developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/post-marketing-v3-emails-](https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/post-marketing-v3-emails-)
- Clone marketing email: [developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/post-marketing-v3-emails-clone](https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/post-marketing-v3-emails-clone)
- Patch draft version: [developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/patch-marketing-v3-emails-emailId-draft](https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/patch-marketing-v3-emails-emailId-draft)

The app intentionally uses only create, clone, and draft patch operations. It does not publish or send emails.

## Environment variables

Copy `.env.example` to `.env.local` and set the values you need:

```bash
cp .env.example .env.local
```

Available settings:

- `HUBSPOT_PRIVATE_APP_TOKEN`
- `DEFAULT_FROM_NAME`
- `DEFAULT_REPLY_TO_EMAIL`
- `DEFAULT_FOLDER_ID`
- `DEFAULT_CAMPAIGN_ID`
- `DEFAULT_LANGUAGE`

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
   - `DEFAULT_FROM_NAME`
   - `DEFAULT_REPLY_TO_EMAIL`
   - `DEFAULT_FOLDER_ID`
   - `DEFAULT_CAMPAIGN_ID`
   - `DEFAULT_LANGUAGE`

If you already have a local `.env.local`, Netlify also supports importing variables from a `.env` file in the UI.

### Deploy

1. Click **Deploy site**.
2. Wait for the build to finish.
3. Open the deployed URL.
4. Start with a dry run using the sample files.

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
2. Upload a small sample batch and optional CSV.
3. Review validation warnings.
4. Switch to `First 1` or `First 2` in create mode.
5. Confirm the resulting drafts in HubSpot.
6. Run the full batch once you are comfortable with the mapping.

## Security choices

- No database is used.
- Tokens are not persisted server-side.
- The HubSpot token is expected to come from environment variables rather than browser input.
- Logs redact bearer tokens before writing to the console.
- Filenames are sanitized before processing.
- Uploaded content is treated as data for HubSpot payload creation, not executed locally.

## Verification note

The current workspace environment did not include `node` or `npm`, so I could not execute the app or test suite here. The project is fully scaffolded and ready to run in a standard Node.js environment.
