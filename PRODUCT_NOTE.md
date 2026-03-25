# Product Note

## Architecture

The app is a single Next.js application with:

- a client-side upload and results UI
- one server route for dry-run validation and HubSpot source-code upload
- a shared domain layer for HTML inspection, retries, and safe logging

This keeps the MVP easy to deploy and maintain without introducing a database or extra services.

## Tradeoffs

- HTML validation uses lightweight heuristics instead of a full HTML parser to keep the implementation lean and dependency-light.
- Phase 1 uploads files into HubSpot Design Manager but does not yet convert them into fully valid coded email templates automatically.
- This keeps the flow much safer for design fidelity than routing raw HTML through drag-and-drop email content, but it shifts template-validity concerns to a later phase.

## Risks

- Raw uploaded HTML may still need HubSpot-specific template markup before it can behave as a production coded email template.
- Some files may validate locally but still need manual refinement in Design Manager.
- Very large batches may take time because retries intentionally slow down on rate limits and transient failures.

## Recommended next improvements

- Add authenticated internal access control if the tool will be shared beyond a small trusted team.
- Add structured audit logging to a secure sink instead of relying only on server console logs.
- Add richer HTML linting with a dedicated parser and HubSpot coded-template checks.
- Add Phase 2 support for transforming raw HTML into valid coded email templates with required HubL variables.
- Add resumable batch runs and persisted result history if teams need operational traceability across sessions.
