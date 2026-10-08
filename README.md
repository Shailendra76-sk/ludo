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

## Production hand-off points

1. Replace the in-memory `shops`/`orders` maps with PostgreSQL repositories.
2. Implement the `PaymentProvider` adapter and verified webhook route for a real UPI/payment provider.
3. Add authenticated signed connector registration and outbound job delivery for the shop agent.
4. Put the app behind HTTPS, add durable object storage with server-side encryption, and add a persistent queue/worker.
5. Add Redis-backed rate limiting and structured audit logs.

The full architecture and contracts are in [`plan.md`](./plan.md).
