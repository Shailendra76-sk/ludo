# Printer Auto — Phase 1 + Phase 2 Architecture

## Scope
Phase 1 covers the customer QR → upload → print options → backend pricing → payment → order journey. Phase 2 adds only the Shopkeeper experience. Super Admin, platform revenue, subscriptions, AI assistant and global shop management remain Phase 3 scope.

## Phase 1 architecture
The customer UI is a mobile-first vanilla HTML/CSS/JS app served by the local Node server. Express owns the API, pricing, payment state and printer boundary; the browser never talks to a printer or trusts client-side payment claims. Uploaded files are stored privately under `storage/tmp/` with opaque references and are never exposed as public URLs. The current local order repository is in memory behind a replaceable boundary; production can move it to PostgreSQL without changing the API contract.

The backend validates PDF/JPG/PNG MIME types and magic bytes, applies the 10 MB limit, counts PDF pages, recalculates totals, creates cryptographically random order IDs, and cleans temporary files after approximately five minutes. Online orders stay `PAYMENT_PENDING` until a real verified provider webhook is added. Cash orders start as `CASH_PENDING`.

## Phase 1 data and API
Future-compatible shapes include `shops`, `orders`, `print_jobs` and `payments`. The customer APIs are:

- `GET /api/shops/:shopId`
- `POST /api/uploads`
- `POST /api/orders`
- `GET /api/orders/:orderId`
- `DELETE /api/uploads/:uploadRef`

The customer screens are upload, print options, payment/review and status. The print seam is `PrintConnector`; it accepts only server-authorized paid jobs and is ready to be replaced with a signed outbound shop-agent connector.

## Phase 2 Shopkeeper architecture
A Shopkeeper signs in with mobile/email and password. Passwords use Node `scrypt`; plaintext passwords are never persisted. Successful login creates an opaque, server-side `shopkeeper_session` token in an httpOnly, SameSite cookie. Logout expires that cookie and records the activity.

Every protected handler resolves the authenticated user and filters by `req.shopkeeper.shopId`. Client-supplied shop IDs are not trusted for Shopkeeper data access, so a Shopkeeper cannot read or modify another shop’s orders, payments, printers, files, pricing or settings. Local profile, user, printer and activity data persists to ignored `storage/phase2-data.json`; customer files remain private under `storage/tmp/` and are never browsable by Shopkeepers.

## Phase 2 data shapes
- `shopUsers`: `id`, `identifier`, `shopId`, `salt`, `hash`
- `shops`: profile, opening status, accepted payment methods, pricing `{bw, color, minimumOrder, serviceCharge}`
- `printers`: `id`, `shopId`, `name`, `type`, `status`, `lastSeen`, `currentJob`, `isDefault`
- `activityLogs`: `action`, `at`, `shopId`, `userId`, metadata
- Existing `orders`: original `amount` is preserved after future pricing changes

## Phase 2 protected API contract
Authentication uses `POST /api/shopkeeper/login`, `POST /api/shopkeeper/logout` and `GET /api/shopkeeper/me`. Dashboard and order APIs are `GET /api/shopkeeper/dashboard`, `GET /api/shopkeeper/orders`, `GET /api/shopkeeper/orders/:id` and `POST /api/shopkeeper/orders/:id/cash-collected`.

Printer management uses `GET/POST /api/shopkeeper/printers`, `DELETE /api/shopkeeper/printers/:id`, `POST /api/shopkeeper/printers/:id/default` and `POST /api/shopkeeper/printers/:id/test`. Pricing and profile use `GET/PUT /api/shopkeeper/pricing` and `GET/PUT /api/shopkeeper/profile`. QR and reports use `GET /api/shopkeeper/qr` and `GET /api/shopkeeper/reports?format=csv`.

## Payment and print transitions
Cash collection is a guarded, one-time transition from `CASH_PENDING` to `PAID`. Duplicate collection attempts return a conflict. The backend then calls the connector boundary; a successful mock release moves `PRINT_QUEUED` → `PRINTING` → `PRINTED`. A failed or unavailable connector moves the order to `FAILED`. Online orders remain `PAYMENT_PENDING` until a real verified payment provider confirms them; no frontend `payment_success` flag can release a job.

## Shopkeeper UI
The responsive panel has Dashboard, Orders, Printer, Pricing, Shop QR, Reports, Settings and Logout navigation. Dashboard cards show today’s orders, prints, revenue, pending payments, queued jobs and failed jobs. Orders support date/payment/type filters and cash collection. Printer screens show status, last seen, current job and errors. Pricing supports B&W, color, minimum amount and service charge. QR supports preview, download and print. Reports expose daily/date-filtered aggregates and CSV export.

## Security and production hand-off
Current protections include server-side auth, shop-scoped authorization, hashed passwords, httpOnly sessions, backend pricing, payment verification boundaries, random file/order references, file signature validation, rate limits and private temporary storage. Before production, replace local JSON/in-memory repositories with PostgreSQL, add a real verified payment webhook, use encrypted object storage, add a persistent queue and signed connector heartbeats, and use Redis-backed rate limiting.

## Design direction
The interface uses a calm utilitarian service style with ink navy for trust, paper cream for approachability and saffron for action. The customer flow is a narrow paper-trail sequence with large tap targets, clear progress and reassuring privacy language. The Shopkeeper panel uses the same visual language with compact operational cards, clear status pills, responsive tables and a navigation model suited to non-technical shop owners.
