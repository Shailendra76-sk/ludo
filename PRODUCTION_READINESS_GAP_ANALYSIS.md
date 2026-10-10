# PrinterAuto — Verified Production Readiness Gap Analysis

Date: 2026-10-09  
Base branch: `super-admin-control-center-2026-10-09`  
Base commit: `8176414`  
Working branch: `production-readiness-2026-10-09`

## Verified current state

- Phase 1–4 security remediation and the Super Admin Control Center are present in the checkout.
- `supabase/schema.sql` contains core shop/order/payment/connector/file-processing tables and basic shop-scoped RLS policies.
- `supabase/migrations/20261009_superadmin_control_center.sql` contains forward-only CMS, media, banner, campaign, redemption, AI, notification and admin-change tables with RLS enabled.
- The runtime currently stores shops, orders, sessions, payment events, connector state and print jobs in process memory, with selected Phase 2–5 state persisted to local JSON files.
- Uploads currently land in a local temporary directory and connector file delivery reads a local path.
- Cleanup is timer-driven and currently removes/marks files after a short local lifecycle; it is not yet a durable scheduled cleanup queue.
- Cashfree/Razorpay provider adapters and webhook verification are implemented as server-side code paths, but no official sandbox credentials or staging merchant accounts are configured in this environment.
- AI control configuration is server-side and fail-closed, but the current control center does not yet support encrypted key replacement/removal through an authenticated endpoint.
- The existing tests are real local integration/regression tests. They do not prove Supabase PostgreSQL runtime behavior, Storage policy behavior, or provider sandbox behavior.

## Severity-ranked gaps

| Severity | Area | Evidence | Required follow-up | Verification status |
|---|---|---|---|---|
| Critical | Durable production persistence | `server.js`, `phase3.js`, `phase4.js` use `Map`/objects and local JSON persistence | Add an opt-in Supabase repository contract, startup validation, transaction/idempotency SQL functions and documented migration path | Not run: no Supabase URL/keys/project available |
| Critical | Private object storage | `server.js` multer writes to local `storage/tmp`; `phase4.js` connector route reads local path | Add Supabase Storage adapter, private object keys, signed/authorized access, remote-delete queue and local fallback only outside production | Not run: no Storage credentials/project available |
| High | Order/coupon/payment transaction boundaries | Order creation and coupon redemption are separate in-memory mutations; webhook update and print release are not one database transaction | Add idempotency keys, database constraints/RPC contract and durable event/reconciliation tables | Local regression only; database transaction test blocked |
| High | Sessions/rate limits across instances | Current runtime persistence is local JSON; no shared production session/rate-limit backend is wired | Add shared persistence contract and production startup guard | Local persistence tests passed; shared-store test blocked |
| High | RLS runtime verification | SQL policies exist, but no staging Supabase identity tests have run | Add SQL/policy test plan and executable staging test harness | Blocked by missing staging project/credentials |
| High | AI secret lifecycle | AI config exposes masked status and fails closed, but no encrypted add/replace/remove endpoint exists | Add authenticated secret-manager/encrypted-secret adapter and server-side provider verification | Provider test blocked; no key-management backend configured |
| Medium | Retention/deletion operations | Cleanup is timer-based and local; deletion failure/retry records are not durable | Add cleanup queue schema, retention settings, retry/backoff and audit events | Local timer behavior test pending in this branch |
| Medium | Backups/recovery | README has deployment notes but no concrete backup/restore runbook | Add Supabase backup/restore and object-storage recovery procedures | Documentation gap |
| Low | Observability | Health/report APIs are mostly local-derived and lack persistence availability signal | Add explicit persistence/storage/provider health dimensions and blocked-state reporting | Local smoke possible; production health blocked |

## External checks intentionally not claimed

The following cannot be honestly marked passed in this sandbox because no credentials or staging resources are configured:

- Applying the migration to a real Supabase PostgreSQL project.
- Anonymous/authenticated/shopkeeper/staff/Super Admin RLS runtime tests.
- Supabase Storage private object upload/download/delete policy tests.
- Cashfree/Razorpay official sandbox webhook and refund reconciliation tests.
- Provider connection verification using a real merchant account.
- Managed AI key replacement/connection verification through an external secret manager.
- Multi-instance session/rate-limit consistency test.

## Implementation plan for this branch

1. Add safe forward-only persistence/storage migration artifacts and explicit production configuration validation.
2. Add transaction/idempotency SQL contracts for orders, coupon redemptions, payment events and print jobs.
3. Add an optional Supabase Storage client with private object keys, authorized signed access and deletion retry records without changing local development behavior.
4. Add encrypted secret lifecycle support using an external encryption key, with no browser/API plaintext secret response.
5. Add executable local tests for cleanup scheduling, idempotency and secret redaction; add staging-only test scripts that refuse to run without real credentials.
6. Document migration, staging RLS verification, backups, recovery and manual production gates.

This branch must not claim production readiness until the blocked staging/provider checks actually run and pass.
