# PrinterAuto — Shopkeeper Printer Management and Help Center Gap Analysis

Date: 2026-10-09  
Base branch: `system-configuration-center-2026-10-09`  
Feature branch: `shopkeeper-printer-help-center-2026-10-09`

## Existing architecture confirmed

### Shopkeeper panel

- `public/shopkeeper.js` already has a `printers` page with add/remove/default/test actions.
- The current page calls `/api/shopkeeper/printers` and `/api/shopkeeper/printers/:id/test`, but displays only printer name, type, status, last seen and default state.
- Navigation has no Help Center and no connector-management view.
- The customer browser is correctly kept away from direct printer control.
- Existing Shopkeeper API calls use the authenticated Shopkeeper session and CSRF token for mutations.

### Server and connector

- `phase4.js` already implements:
  - Shopkeeper-created one-time pairing codes with SHA-256 stored code hashes and a ten-minute expiry.
  - Connector registration that returns a random bearer token while storing only its hash.
  - Shop-scoped connector polling and private authenticated file streaming.
  - Per-job completion tokens and idempotent duplicate completion handling.
  - Shop ownership checks on connector jobs and revoke/rotate routes.
  - Super Admin aggregate connector-health metrics.
- `connector/agent.py` already detects local printers, sends heartbeats, polls authorized jobs, downloads private files, submits completion tokens and removes local temporary files.
- Existing cleanup preserves files until the configured retention anchor and does not expose customer documents through Shopkeeper APIs.

## Verified gaps

| Severity | Gap | Evidence | Planned additive fix |
|---|---|---|---|
| High | Printer page is not a real connector management surface | Current `printersPage()` shows mock CRUD plus a simulated timeout test; no pairing, revoke, rotate, pending-job or evidence view | Add a connector/printer management API and Shopkeeper UI without removing existing printer actions |
| High | No detailed connector heartbeat/evidence model | `/api/shopkeeper/connectors` returns only id, deviceName, status and updatedAt; there is no explicit heartbeat timestamp, last verified print, printer identity, error or queue summary | Add safe per-shop connector summaries: connection state, last heartbeat, last verified print, pending jobs, failed jobs and sanitized error |
| High | Offline connector cannot reliably recover its heartbeat | `connectorAuth` accepts only `ONLINE`/`BUSY`; an `OFFLINE` or `ERROR` connector cannot call heartbeat to recover | Allow token-authenticated heartbeat for non-revoked connectors; derive stale/offline status server-side from heartbeat age and preserve revocation enforcement |
| High | Windows agent detects printers but does not print | `print_file()` returns `False` on Windows; `--test` only returns a local boolean and does not create a server-verified test job | Add a Windows print implementation using the locally detected printer and explicit command/evidence result; add a server-issued test-print job flow |
| High | “PRINTED” evidence is too weak | Server checks completion token and connector-supplied `result`, but does not require printer name, command outcome, local job reference or verification timestamp | Require structured connector evidence for successful completion; validate job/connector/shop/printer binding server-side; retain idempotent duplicate behavior |
| High | No safe retry workflow | Failed jobs are marked `PRINT_FAILED`, but no Shopkeeper retry endpoint/UI or retry limit exists; polling has no lease timeout/recovery | Add authorized retry with bounded attempts, idempotent job identity, failure reason and safe re-queue rules; never duplicate an already verified print |
| Medium | No connector re-pair UX | Backend pair/revoke/rotate routes exist, but the Shopkeeper UI does not expose them | Add one-time pairing code display, expiration, revoke and rotate/re-pair actions with no token display after registration |
| Medium | Test print is a mock shortcut | Existing `/api/shopkeeper/printers/:id/test` changes status with a 500ms timeout; it is not tied to an authenticated connector or completion evidence | Route test print through a connector-owned test job and show `REQUESTED`, `PRINTING`, `VERIFIED`, `FAILED` states |
| Medium | No Shopkeeper Help Center | No Shopkeeper route/page exists; CMS `helpContent` is Super Admin-managed but not a searchable bilingual help model | Add searchable Hindi/English guides, category filters, step-by-step instructions, safe troubleshooting and links to live printer/connector state |
| Medium | No screenshots/help assets | No connector setup screenshots or asset references exist in the Shopkeeper panel | Add screenshot slots/illustrations only where available; show an honest text fallback rather than inventing screenshots |
| Medium | No Shopkeeper Help Center | No Shopkeeper route/page exists; CMS helpContent is Super Admin-managed but not a searchable bilingual help model | Add deterministic searchable Hindi/English guides; do not add a Shopkeeper AI chatbot |
| Medium | No explicit Windows/USB/network setup guide | README/plan mention connector generally, but no Windows driver, USB, network, test-print or troubleshooting runbook | Add bilingual setup guide with prerequisites, Windows spooler/driver steps, USB/network discovery, connector installation, pairing and troubleshooting |
| Medium | Error/status semantics are too broad | Existing statuses are `Online`, `Offline`, `Busy`, `Error`, but there is no safe error taxonomy or last verified print record | Add normalized safe statuses and sanitized error messages; no claim of connected/successful without server evidence |
| Low | Connector state and print-job state are separate from existing local printer map | Phase 4 maintains connector/print-job state separately from the Phase 2 `printers` map | Add a read-only projection joining authorized connector/job/printer data instead of duplicating ownership records |
| Low | Durable multi-instance connector state remains a deployment gate | Current Phase 4 state is local/file-backed unless production persistence is enabled | Reuse the existing Supabase production migration boundary; document that staging migration and multi-instance tests remain manual gates |

## Security and privacy boundaries to preserve

- Every Shopkeeper endpoint must filter by `req.shopkeeper.shopId`; cross-shop connector, printer, job and error reads must return not-found/denied.
- Pairing codes are one-time, short-lived, hashed at rest and rate-limited. Revoke must invalidate the bearer token immediately; rotate must return the token only once.
- Connector job polling and file streaming must continue to require the connector bearer token and matching shop ownership.
- Successful completion must require server-issued job proof plus structured connector evidence; browser assertions can never mark a print successful.
- Customer file names may be shown only where the existing Shopkeeper order contract already permits them; no file path, URL, document contents or signed object URL may enter Help Center/diagnostic responses.
- Retention remains controlled by the existing configured retention policy and completed/failed lifecycle. Retry must not delete a still-needed paid file.
- Help AI receives curated documentation and aggregate printer/job state only; it cannot access secrets, customer files, arbitrary orders or perform mutations.
- No fake “connected”, “printed” or “test passed” state will be rendered without server/connector evidence.

## Planned implementation sequence after gap-analysis confirmation

1. Add server-side connector/printer projection, heartbeat freshness, safe error/last-verified-print fields, pairing/revoke/rotate helpers and bounded retry/test-job routes.
2. Strengthen connector completion evidence and implement Windows printing/test evidence while preserving Linux behavior.
3. Add Shopkeeper Printer Management UI that consumes the protected projection and exposes pairing, revoke, re-pair, test print, retry and troubleshooting links.
4. Add bilingual searchable Help Center with no AI chatbot; show truthful screenshot availability and official support links.
5. Add isolated tests for shop isolation, pairing/revocation, offline/recovery status, failed jobs, retry idempotency, evidence-required completion and unauthorized access.
6. Update README, plan and setup guide with Windows prerequisites, drivers, USB/network setup, staging/manual gates and actual test results.
7. Run the full existing suite plus new tests; push only this feature branch and do not merge to `main`.


## Revised prompt addendum

The later beginner-friendly requirement supersedes the earlier AI-assistant requirement: the Shopkeeper Help Center is deterministic and searchable, with **no AI chatbot**. Repository verification found no Windows installer artifact, signed release or official download endpoint, so the wizard reports `NOT_AVAILABLE` and links to a fail-closed build process instead of inventing a download.
