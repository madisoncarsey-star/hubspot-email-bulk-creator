# Product Note

## Architecture

The app is a single Next.js application with:

- a client-side upload and results UI
- one server route for dry-run validation and HubSpot draft creation
- a shared domain layer for CSV parsing, HTML inspection, plain text generation, payload construction, retries, and safe logging

This keeps the MVP easy to deploy and maintain without introducing a database or extra services.

## Tradeoffs

- HTML validation uses lightweight heuristics instead of a full HTML parser to keep the implementation lean and dependency-light.
- The HubSpot payload is built around a minimal rich text module inside a draft email shell, which is practical for bulk ingestion but may not reproduce every advanced template behavior.
- Clone mode is supported as an advanced option because it can preserve account-specific defaults and modules, but the standard create flow remains the default because it is easier to reason about in bulk.

## Risks

- HubSpot email content schemas can be sensitive to account-specific template expectations, especially in clone mode.
- Some complex uploaded HTML may still need manual cleanup in HubSpot after draft creation.
- Very large batches may take time because retries intentionally slow down on rate limits and transient failures.

## Recommended next improvements

- Add authenticated internal access control if the tool will be shared beyond a small trusted team.
- Add structured audit logging to a secure sink instead of relying only on server console logs.
- Add richer HTML linting with a dedicated parser and optional email-client compatibility checks.
- Add resumable batch runs and persisted result history if teams need operational traceability across sessions.
