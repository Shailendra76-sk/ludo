# Printer Auto — Phase 1 + Phase 2 + Phase 3

A plain-local, mobile-first QR printing customer flow, secure Shopkeeper panel, and Super Admin platform control plane. Phase 4 is intentionally not included.

## Run

```bash
cd /home/ubuntu/ludo
npm start
```

Open:

- `http://localhost:8787/print/shop/demo-shop`
- `http://localhost:8787/print/shop/paperlane-central`
- `http://localhost:8787/shopkeeper/login`
- `http://localhost:8787/superadmin/login`

Local demo Shopkeeper login: `demo@printerauto.local` / `demo1234`.
Local demo Super Admin login: `admin@printerauto.local` / `Admin123!`.

## Current working behavior

- QR-style shop route with backend shop validation
- PDF/JPG/PNG upload with 10 MB limit, signature validation, private random storage, and PDF page counting via `pdfinfo`
- Backend-owned pricing and total calculation
- B&W/color, copies, all/selected pages
- Cash order creation as `CASH_PENDING`
- Online order creation as `PAYMENT_PENDING`; no fake payment success and no unpaid print release
- Five-minute cleanup worker for abandoned temporary files
- Mock print connector interface guarded by verified payment state

## Phase 2 Shopkeeper features

- Password-hashed login with an opaque httpOnly server session
- Shop-isolated dashboard, orders and cash collection
- Cash `CASH_PENDING` → `PAID` → print queue transition with duplicate protection
- Printer add/remove/default/test actions through a mock connector boundary
- Backend pricing with B&W, color, minimum order and service charge
- Shop profile/settings, unique QR download/print, reports and CSV export
- Activity logging for login, logout, pricing, printer, cash and settings actions

Every protected API resolves `shopId` from the authenticated server session; the browser cannot select another shop.

## Phase 3 Super Admin features

Super Admin has a separate role/session boundary and control-plane navigation for Dashboard, Shops, Shopkeepers, Subscriptions, Payments, Revenue, Orders, Printers, System Health, AI Assistant, Reports, Audit Logs and Settings. Shop suspension blocks new customer orders and Shopkeeper login without deleting existing data. Subscription plans are data-backed, expiry is checked automatically, platform subscription revenue is tracked separately from shop print revenue, and CSV exports are available for revenue and platform reports.

The AI assistant is a restricted server-side query layer. It can read summarized dashboard/shop/order/revenue/health data, cannot access customer files or unrestricted database records, and must receive `confirm: true` for allowlisted changes such as shop suspend/activate. Every AI proposal/action is audited. Maintenance mode shows a service-unavailable response to customers while leaving existing jobs untouched.

## Supabase setup

Apply [`supabase/schema.sql`](./supabase/schema.sql) to a Supabase project, then keep `SUPABASE_SERVICE_ROLE_KEY` server-only. The local migration utility is idempotent and supports a dry run:

```bash
node scripts/migrate-local-to-supabase.js
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-local-to-supabase.js
```

## Phase 4 production integration

- `phase4.js` provides a common payment abstraction with Cashfree and Razorpay adapters. Shopkeepers can start official onboarding only when matching server credentials are configured; no secret key is collected in the browser and no fake connection is created.
- Customer online orders use the shop’s connected provider through `POST /api/orders/:orderId/payment-session`. Webhooks use the captured raw body, HMAC signature verification, amount matching and event idempotency. Only verified `PAID` events call the print queue. Cash collection remains `CASH_PENDING → PAID → PRINT_QUEUED`.
- The secure connector API supports one-time pairing, hashed bearer tokens, shop-scoped jobs, outbound polling, heartbeat, private authenticated file streaming and idempotent completion. The Python agent is at [`connector/agent.py`](./connector/agent.py); it never exposes a local printer to the internet.
- Uploads are limited to 250 MB in the browser and backend, while PDF/JPG/PNG MIME and content signatures remain required. Temporary files remain private. The existing cleanup worker retains completed files for approximately five minutes; production object-storage cleanup should use `file_cleanup_jobs`.
- Super Admin Phase 4 endpoints expose provider status, connector health and file-processing metrics without exposing file contents. Provider errors are stored server-side and customer responses remain generic.

Without Cashfree/Razorpay sandbox credentials, provider connection and webhook tests intentionally return `PROVIDER_NOT_CONFIGURED` or invalid-signature responses. This is a safe non-fake state, not a simulated payment success.

## Security audit and remediation

A dedicated security branch was created for this audit: `security-audit-remediation-2026-10-09`. The baseline suite was run before remediation and reproduced five failures: public order disclosure, client-controlled payment callback verification, missing-amount webhook acceptance, reflected arbitrary CORS, and default Super Admin credentials.

See the complete severity-ranked report, reproduction details and remaining launch blockers in [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

The remediation adds:

- Provider-specific signed callback/webhook checks with exact order ID, provider transaction ID, amount, currency and merchant-account matching.
- Persistent webhook and print-job idempotency, duplicate payment/print protection and per-job connector completion proof.
- No demo/default credentials in production; missing or weak Super Admin credentials fail startup.
- Persistent session records, expiry, revocation, strict/httpOnly cookies, CSRF checks and persisted login rate limits.
- Configured-origin-only CORS using `TRUSTED_ORIGINS`.
- Authenticated shop-scoped order reads, upload-to-shop binding, connector token revoke/rotate and malformed-file rejection.
- Production-only server credential configuration; mock payment success is not used by payment routes.

Run the full local, production-mode, no-real-payment audit with:

```bash
npm run security:audit
npm run security:deps
```

Actual test suites and scope:

- `security-audit.test.js` — baseline vulnerability regressions.
- `security-audit.phase4.test.js` — payment identity, official-signed callback, replay, print proof, connector revoke, malformed file and startup guard.
- `security-audit.state.test.js` — CSRF, trusted/untrusted CORS, cross-shop upload binding, session persistence/revocation and persistent rate limiting.

The production data path is configurable through `PRINTER_AUTO_DATA_DIR`. The current file-backed persistence is suitable for a single-node deployment; multi-process production should move sessions/rate limits/idempotency to Redis or PostgreSQL with transactions/unique constraints.

## Production hand-off points

1. Replace the in-memory `shops`/`orders` maps with PostgreSQL repositories.
2. Implement the `PaymentProvider` adapter and verified webhook route for a real UPI/payment provider.
3. Add authenticated signed connector registration and outbound job delivery for the shop agent.
4. Put the app behind HTTPS, add durable object storage with server-side encryption, and add a persistent queue/worker.
5. Add Redis-backed rate limiting and structured audit logs.

The full architecture and contracts are in [`plan.md`](./plan.md).

## Phase 5 — Super Admin Control Center

The `super-admin-control-center-2026-10-09` branch adds an additive control plane at `/superadmin` without rewriting the Phase 1–4 flows. New sections cover **Shops and Shopkeepers, Orders and Print Jobs, Subscriptions and Plans, Payment Center, Coupons and Offers, Website CMS, Banner Manager, Media Library, AI Control Center, BI and Analytics, Notifications, Reports and Exports, System Health, Audit Logs, and Security and Settings**.

### Phase 5 capabilities

- Persistent CMS/site settings, privacy/terms/refund/help content, announcements and explicit draft/publish banner workflow.
- PNG/JPEG/WEBP media library with MIME/signature checks, dimension limits, alt text, public/private state and in-use deletion protection.
- Server-side coupon validation and final price recalculation; percentage/fixed discounts, caps, minimums, shop eligibility, date windows and redemption limits.
- Payment Center status view for Cashfree/Razorpay configuration without exposing secrets; no fake payment/refund state is created.
- AI Control Center that stores only provider/model/limits, never returns a key, and fails closed when no server-side provider is configured.
- BI metrics and CSV export with explicit definitions and formula-safe CSV escaping.
- Persistent admin notifications and control-center change events.
- Published content is delivered through `/api/public/content`; the customer QR print page renders only published server-sanitized announcements/banners.

### Configuration

See `supabase/migrations/20261009_superadmin_control_center.sql` for the production schema and RLS boundary. Configure provider credentials only through environment variables or a secrets manager; do not put them in CMS, JSON state, browser storage or logs. For production, set a real shared database/data directory, trusted origins, provider merchant references and verified Cashfree/Razorpay webhook credentials. AI remains disabled until a server-side provider key and an approved model are configured.

### Tests

- `npm run test:control-center` — isolated production-mode CMS/media/coupon/public-content/AI/BI regression suite.
- `npm run security:audit` — security remediation regression suite.
- `npm run security:deps` — dependency audit.
- `npm run test:all` — syntax, security, dependency and control-center checks.

## Production-readiness follow-up

The `production-readiness-2026-10-09` branch adds opt-in Supabase REST/Storage adapters, forward-only transaction/idempotency/retention contracts, private signed-object streaming for connectors, encrypted AI key replacement/removal, cleanup retry metadata, and explicit staging verification commands. Local development remains on local persistence/storage unless `PERSISTENCE_BACKEND=supabase` is enabled.

### Staging procedure

1. Create a dedicated Supabase staging project and apply `supabase/schema.sql`, then the migrations in timestamp order, including `20261009_superadmin_control_center.sql` and `20261009_production_readiness.sql`.
2. Configure `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, and `STAGING_SUPABASE_SERVICE_ROLE_KEY` only in the staging shell/CI secret store.
3. Run `npm run staging:verify`. This performs service-role schema checks and explicitly reports that identity/RLS checks are not claimed unless the corresponding test identities are configured. Use `npm run staging:verify:required` in a release gate.
4. Configure `PERSISTENCE_BACKEND=supabase`, `SUPABASE_RUNTIME_MIGRATION_COMPLETE=true`, `REQUIRE_DURABLE_PERSISTENCE=true`, `SUPABASE_STORAGE_BUCKET`, `APP_ENCRYPTION_KEY`, trusted origins and provider sandbox credentials only after the staging checks pass. The server fails startup when durable persistence is required but not configured.
5. Verify anonymous, authenticated shopkeeper, staff and Super Admin RLS access in the staging project, including cross-shop reads, Storage object access and cleanup retries. Record the results before enabling production.

### Backup and recovery runbook

- Enable Supabase point-in-time recovery and scheduled database backups for the production project; retain the backup schedule and restore owner in the deployment runbook.
- Keep Storage object versioning/retention enabled where supported. Database `storage_objects` and `file_cleanup_jobs` records are the source of truth for deletion reconciliation.
- For recovery, restore the database snapshot first, validate the migration version, then reconcile Storage objects by `object_key` and `status`; never make restored print files public by default.
- Rotate the service-role key and `APP_ENCRYPTION_KEY` through the secret manager during an incident. Key rotation requires a reviewed re-encryption migration; do not overwrite the old key without a recovery copy.

### External checks not run in this environment

No Supabase staging project, Storage bucket, provider sandbox merchant account, or external secret manager was configured for this task. Therefore this branch does **not** claim production readiness, RLS runtime verification, Storage policy verification, Cashfree/Razorpay sandbox verification, refunds/reconciliation, or multi-instance session consistency.

## System Configuration Center

The protected Super Admin panel now includes **System Configuration Center** at `/superadmin` as a unified, read-only-by-default configuration and diagnostics surface. It groups:

1. Dashboard and Configuration Overview
2. Database and Data Persistence
3. File Storage and Retention
4. AI Providers
5. Payment Providers
6. Authentication and Security
7. Printer Connector
8. Notifications and Email
9. Environment and Deployment
10. Health Checks and Diagnostics
11. Setup Guide and Integration Checklist
12. Configuration Audit History

The registry distinguishes runtime-editable settings, sensitive credential presence, and deployment-only values. Secrets are never returned. Connection status is not inferred from credential presence: diagnostics use `TEST_PASSED`, `TEST_FAILED`, `BLOCKED_EXTERNAL_SETUP`, `MIGRATION_REQUIRED`, `CONFIGURED_NOT_TESTED`, `NOT_CONFIGURED`, `DISABLED`, `NOT_IMPLEMENTED` and `NEEDS_ATTENTION` states.

Protected endpoints include:

- `GET /api/superadmin/system-config`
- `GET /api/superadmin/system-config/:category`
- `GET /api/superadmin/system-config/guide?q=...`
- `GET /api/superadmin/system-config/audit`
- `POST /api/superadmin/system-config/test`
- `PUT /api/superadmin/system-config/runtime`

Only allowlisted runtime settings can be changed. Authentication, CSRF, CORS, tenant isolation, payment verification, replay protection and audit logging cannot be disabled from the panel. Email is accurately shown as not implemented; no email credential is accepted. MongoDB remains optional and unused.

Apply the new forward-only migration after the production-readiness migration:

```text
supabase/schema.sql
supabase/migrations/20261009_superadmin_control_center.sql
supabase/migrations/20261009_production_readiness.sql
supabase/migrations/20261009_system_configuration_center.sql
```

Real Supabase RLS, Storage, payment sandbox and provider connection tests remain staging-gated. The panel reports those checks as blocked or not tested until real external setup is supplied.
