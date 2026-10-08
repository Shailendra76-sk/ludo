# Printer Auto — Phase 1 + Phase 2 + Phase 3 Architecture

## Scope
Phase 1 covers the customer QR → upload → print options → backend pricing → payment → order journey. Phase 2 adds only the Shopkeeper experience. Phase 3 adds only Super Admin and platform management. Phase 4 is out of scope.

## Phase 1 architecture
The customer UI is a mobile-first vanilla HTML/CSS/JS app served by the local Node server. Express owns the API, pricing, payment state and printer boundary; the browser never talks to a printer or trusts client-side payment claims. Uploaded files are stored privately under `storage/tmp/` with opaque references and are never exposed as public URLs. The current local order repository is in memory behind a replaceable boundary; production can move it to PostgreSQL without changing the API contract.

The backend validates PDF/JPG/PNG MIME types and magic bytes, applies the 10 MB limit, counts PDF pages, recalculates totals, creates cryptographically random order IDs, and cleans temporary files after approximately five minutes. Online orders stay `PAYMENT_PENDING` until a real verified provider webhook is added. Cash orders start as `CASH_PENDING`.

## Phase 1 data and API
Future-compatible shapes include `shops`, `orders`, `print_jobs` and `payments`. The customer APIs are `GET /api/shops/:shopId`, `POST /api/uploads`, `POST /api/orders`, `GET /api/orders/:orderId` and `DELETE /api/uploads/:uploadRef`. Customer screens are upload, print options, payment/review and status. The print seam is `PrintConnector`; it accepts only server-authorized paid jobs and is ready to be replaced with a signed outbound shop-agent connector.

## Phase 2 Shopkeeper architecture
A Shopkeeper signs in with mobile/email and password. Passwords use Node `scrypt`; plaintext passwords are never persisted. Successful login creates an opaque, server-side `shopkeeper_session` token in an httpOnly, SameSite cookie. Logout expires that cookie and records the activity.

Every protected handler resolves the authenticated user and filters by `req.shopkeeper.shopId`. Client-supplied shop IDs are not trusted for Shopkeeper data access, so a Shopkeeper cannot read or modify another shop’s orders, payments, printers, files, pricing or settings. Local profile, user, printer and activity data persists to ignored `storage/phase2-data.json`; customer files remain private under `storage/tmp/` and are never browsable by Shopkeepers.

## Phase 2 data and API
Phase 2 shapes are `shopUsers` (`id`, `identifier`, `shopId`, `salt`, `hash`), shop profile/settings with pricing, `printers` (`id`, `shopId`, `name`, `type`, `status`, `lastSeen`, `currentJob`, `isDefault`) and `activityLogs` (`action`, `at`, `shopId`, `userId`, metadata). Existing orders preserve their original `amount` after pricing changes.

Protected APIs include `/api/shopkeeper/login`, `/logout`, `/me`, `/dashboard`, `/orders`, `/orders/:id/cash-collected`, `/printers`, `/pricing`, `/profile`, `/qr` and `/reports`. Cash collection is a guarded, one-time transition from `CASH_PENDING` to `PAID`, then the connector boundary moves the job through `PRINT_QUEUED`, `PRINTING` and `PRINTED`. Online orders remain `PAYMENT_PENDING` until a real verified provider confirms them.

## Phase 3 role and session boundary
Super Admin uses a separate `/superadmin/login` route, `SUPER_ADMIN` role and `superadmin_session` cookie. The Shopkeeper session cannot satisfy Super Admin middleware. Sessions expire after eight hours, use httpOnly/SameSite cookies, and login/logout/actions are audited. The Super Admin role is seeded from server-only environment variables or safe local development defaults.

## Phase 3 platform management
The control plane exposes Dashboard, Shops, Shopkeepers, Subscriptions, Payments, Revenue, Orders, Printers, System Health, AI Assistant, Reports, Audit Logs and Settings. Shop status is `ACTIVE`, `SUSPENDED` or `EXPIRED`. Suspension sets `active=false`, blocks the public shop API/new orders and blocks Shopkeeper login without deleting data. Subscription expiry is refreshed automatically; expired/cancelled subscriptions block new customer orders and Shopkeeper access by default.

Plans are data-backed rather than hardcoded into the UI. Local defaults seed Basic ₹299/month, Pro ₹599/month and Business ₹999/month; Super Admin can create/edit plans. Subscription payments are stored separately from customer print orders, so platform revenue and shop print revenue never mix. Revenue and reports support CSV export. Shop print revenue, subscription revenue, other platform revenue, successful payments, failures and refunds remain separate fields.

## Phase 3 health, maintenance and notifications
Health checks summarize backend, local database fallback, storage, payment gateway configuration, print connectors/queue and API response state. A maintenance flag is stored in platform settings; customer `/print` and customer order/upload endpoints return a service-unavailable response while existing print jobs are not cancelled. Notifications cover subscription expiry, offline printers and other health warnings.

## Phase 3 AI assistant and permissions
The assistant is a restricted, deterministic server-side data tool. It can answer summarized dashboard, shop, order, revenue and health questions. It cannot read customer file contents, secrets or unrestricted records. Mutations are allowlisted and require a separate explicit `confirm: true`; proposals and completed actions are written to AI audit entries. Dangerous financial transfers, secret changes, destructive deletes, customer file access and security changes have no action route.

## Supabase/PostgreSQL and migration
`supabase/schema.sql` defines production tables for shops, shop users, plans, subscriptions, orders, payments, printers, pricing, activity logs, health checks and AI audit logs. RLS is enabled with a shop claim helper for Shopkeeper reads and a public active-shop policy. The service-role key is server-only and never reaches the frontend. `scripts/migrate-local-to-supabase.js` reads ignored local Phase 2/3 JSON state, validates counts and performs idempotent REST upserts only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present; otherwise it is a safe dry run.

## Security and production hand-off
Current protections include server-side auth, role and shop-scoped authorization, hashed passwords, expiring httpOnly sessions, backend pricing, payment verification boundaries, random file/order references, file signature validation, rate limits, private temporary storage, maintenance blocking and confirmation-gated admin actions. Before production, replace local JSON/in-memory repositories with PostgreSQL, add a real verified payment webhook, use encrypted object storage, add a persistent queue and signed connector heartbeats, use Redis-backed rate limiting, configure MFA and rotate all local defaults.


# Phase 4 — Production Integration

## Payment abstraction and safety
`phase4.js` defines provider-neutral payment operations with Cashfree and Razorpay adapters. Shop customer payments use the shop’s connected provider; platform subscription payments remain a separate accounting stream. Shopkeeper connection routes only initiate official onboarding when server-side provider credentials are configured. No secret API key is collected from a Shopkeeper and no fake connected account is stored.

Online orders can request `POST /api/orders/:orderId/payment-session`. Webhooks use `req.rawBody`, provider HMAC verification, event idempotency, exact amount matching and duplicate-event handling. Only a verified paid event changes an order to `PAID` and calls the print queue. Invalid, pending, failed and amount-mismatch events never release print. Cash flow remains unchanged and duplicate collection protection remains in Phase 2.

## Secure print connector
`connector/agent.py` is an outbound-polling Python desktop agent. A Shopkeeper creates a one-time pairing code; the agent exchanges it for a random bearer token, while the backend stores only its SHA-256 hash. Connector jobs and private file streaming are scoped by connector shop. The agent detects local printers through `lpstat`/PowerShell, sends heartbeats, polls jobs, issues a local print command and completes each job idempotently. No printer port is exposed to the internet.

Print jobs use `PRINT_QUEUED`, `PRINTING`, `PRINTED`, `PRINT_FAILED` and `CANCELLED` fields with order/shop/printer/copies/type/page-range/timestamps/error. A connector-backed job is deferred instead of being silently printed by the mock path; only connector completion changes it to `PRINTED`.

## Files and cleanup
The supported types remain PDF, JPG/JPEG and PNG with MIME plus magic-byte validation. The browser and Multer backend enforce a 250 MB maximum. Temporary upload references remain opaque and private; connector file access requires the connector bearer token and matching shop. Existing cleanup retains successful-print files for approximately five minutes. `file_cleanup_jobs` and `file_processing_jobs` tables are included for the durable worker/object-storage deployment.

## Phase 4 tables and observability
Supabase additions are `payment_connections`, `payment_webhooks`, `payment_events`, `print_connectors`, `print_jobs`, `file_processing_jobs` and `file_cleanup_jobs`, with foreign keys, indexes and shop-scoped RLS policies. Super Admin metrics expose provider status, connected shop count, provider success/failure counters, connector health and file-processing counts without returning customer file contents.

## Test/production limitation
Provider adapters deliberately return a safe not-configured state until Cashfree/Razorpay sandbox credentials and official merchant onboarding are supplied. A payment success is never inferred from a frontend response. Before production, place the app behind HTTPS, configure real provider signing secrets and webhook URLs, use durable object storage and a queue worker, run the Python agent on the shop PC, and complete sandbox success/failure/pending/duplicate/mismatch/refund and real-printer tests.
