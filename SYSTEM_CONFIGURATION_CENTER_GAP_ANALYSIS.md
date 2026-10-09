# PrinterAuto — System Configuration Center Gap Analysis

Date: 2026-10-09  
Base branch: `production-readiness-2026-10-09`  
Base commit: `7371a2d`  
Working branch: `system-configuration-center-2026-10-09`

## Verified existing capabilities

- A protected Super Admin session and CSRF-protected mutation path already exist.
- The existing Super Admin UI already has separate pages for settings, AI Control Center, Payment Center, Health, Audit, Notifications, CMS, media, campaigns and reports.
- `production-readiness.js` already exposes a protected readiness endpoint, encrypted AI secret lifecycle, opt-in Supabase REST/Storage adapter, signed object access and cleanup failure metadata.
- Cashfree/Razorpay server-side adapters and webhook identity/replay checks already exist in `phase4.js`.
- Existing security and control-center regression tests are present and pass on the base branch.
- Supabase schema and forward-only migrations exist; staging/RLS/provider integration has not been executed in this environment.
- MongoDB is not used by the application and remains intentionally optional.

## Verified gaps

| Severity | Gap | Evidence | Follow-up in this branch |
|---|---|---|---|
| High | No unified typed configuration registry | Settings, provider environment checks and AI controls are spread across `phase3.js`, `phase4.js`, `control-center.js` and `production-readiness.js` | Add a server-side registry with category, type, sensitivity, mutability, validation, requirements and safe display metadata |
| High | Credential presence is not the same as a tested connection | Existing Payment Center reports `configured` from environment presence; readiness exposes `NOT_RUN` but has no unified UI or test action | Add explicit status model: `NOT_CONFIGURED`, `CONFIGURED_NOT_TESTED`, `TEST_PASSED`, `TEST_FAILED`, `BLOCKED_EXTERNAL_SETUP`, `MIGRATION_REQUIRED`, `DISABLED` |
| High | No unified diagnostics endpoint | Individual health/provider/file endpoints exist but no aggregated safe configuration overview | Add protected overview, diagnostics and setup-guide APIs; never return secrets or private paths |
| High | No connection-test workflow for database/storage/payment/AI | AI has a real provider test during key save; other services have no central test action | Add server-side tests using existing adapters, with clear blocked/not-tested outcomes and audit events |
| Medium | No categorized runtime vs sensitive vs deployment-only settings | `.env.example` lists names but does not classify editability | Registry marks each setting and blocks browser editing of secrets/security-critical deployment values |
| Medium | No central setup guide/checklist | Instructions are distributed across README and production report | Add searchable safe guide with provider/account, fields by name, test action, external/deployment/migration ownership and next step |
| Medium | No unified configuration audit view | Existing audit/change endpoints are separate and not normalized for configuration tests/failures | Add sanitized configuration audit records and a filtered UI view backed by existing audit mechanisms |
| Medium | Notifications/email has no provider implementation | Notifications are local admin notices; no email provider adapter exists | Surface `NOT_IMPLEMENTED`/`NOT_CONFIGURED` accurately; do not fabricate delivery status |
| Low | Connector and security readiness are not presented together | Separate connector-health and production-readiness endpoints exist | Aggregate connector, auth, session, rate-limit, origin and security status without exposing tokens |
| Low | Deployment-only changes are not clearly marked | Port, encryption key, trusted origins and durable runtime flags are environment-controlled | Show deployment/restart requirement and never render editable forms for these values |

## Security boundaries to preserve

- All configuration APIs must use the existing Super Admin middleware and CSRF checks for mutations.
- Shopkeeper/staff requests must receive denial and never see global configuration or secret metadata beyond safe public state.
- No API key, password, service-role key, database URI, webhook secret, connector token or private customer file path may appear in a response, audit event or frontend bundle.
- No setting may disable authentication, CSRF, tenant isolation, payment verification, replay protection or audit logging.
- No arbitrary SQL or arbitrary provider/model URL may be accepted from the panel.
- MongoDB must remain `NOT_IMPLEMENTED`/optional because no feature requires it.
- “Configured” must not be presented as “tested”; external tests must report `BLOCKED_EXTERNAL_SETUP` or `NOT_TESTED` when credentials/projects are unavailable.

## Implementation plan

1. Add `system-configuration.js` with a typed registry, safe status evaluation, diagnostics/test actions and setup guide data.
2. Add protected Super Admin endpoints for overview, category details, test actions, runtime-editable settings and audit history.
3. Extend the existing Super Admin UI with a single **System Configuration Center** navigation item and 12-category searchable view, reusing existing styles and linking to existing pages where appropriate.
4. Add local tests for authorization, status semantics, secret redaction, immutable security settings, test failure handling and audit records.
5. Document configuration ownership, staging checklist, migration order, backup/recovery and manual external actions.
6. Run the complete existing suite, new tests and dependency audit; report all external checks as blocked unless real staging/provider credentials are present.
