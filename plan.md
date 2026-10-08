# Printer Auto — Phase 1 Customer Platform

## Scope
Only the QR-to-print customer journey is implemented. Shopkeeper and Super Admin interfaces are deliberately excluded.

## Architecture
- **Customer UI:** mobile-first vanilla HTML/CSS/JS served by the local Node server.
- **Backend:** Express API. The browser never talks to a printer or trusts client-side payment claims.
- **Temporary file storage:** private `storage/tmp/` files addressed by opaque internal references, never by public URL.
- **Order state:** an in-memory Phase 1 store with a replaceable repository boundary. Production should move this to PostgreSQL/Drizzle without changing API contracts.
- **Pricing:** backend-owned per-shop configuration; UI only displays server-calculated totals.
- **Payment:** `PaymentProvider` abstraction. Online is intentionally `NOT_CONFIGURED` until a real gateway verifies a webhook; cash creates `CASH_PENDING` and is not released to print.
- **Printing:** `PrintConnector` interface with a mock connector. It accepts only server-authorized, paid jobs and is the future seam for a secure shop agent.

## Future-compatible data model
- `shops`: `id`, `slug`, `displayName`, `currency`, `pricingConfig`, `active`
- `orders`: `id`, `shopId`, `fileRef`, `fileName`, `mimeType`, `pageCount`, `printType`, `copies`, `pageSelection`, `amount`, `paymentMethod`, `paymentStatus`, `status`, timestamps
- `print_jobs`: `id`, `orderId`, `shopId`, print payload, connector status, timestamps
- `payments`: provider reference, amount, verified status, webhook timestamps

## API contract
- `GET /api/shops/:shopId` — validate QR shop identifier and return public shop data/pricing summary.
- `POST /api/uploads` — multipart upload; accepts PDF/JPG/PNG, max 10 MB, validates magic bytes and returns an opaque upload reference plus page count.
- `POST /api/orders` — server recalculates price, validates options, creates the correct payment state, and never accepts a client payment-success flag.
- `GET /api/orders/:orderId` — status polling without exposing file paths.
- `DELETE /api/uploads/:uploadRef` — customer cleanup request; server still enforces TTL.

## Customer screens
1. **Shop landing / upload:** shop identity, QR-derived shop name, file picker and privacy note.
2. **Print options:** preview metadata, B&W/color, copies, all/selected pages, server-priced estimate.
3. **Payment & review:** online/UPI or cash, explicit payment state, print action.
4. **Status:** queued/printing/printed/failed/pending with retry-safe polling and next-step guidance.

## Printing flow
QR opens `/print/shop/:shopId` → shop is validated → upload is scanned → options are sent to backend → server prices and creates order → only a verified online payment can become `PAID` → connector receives a minimal authorized payload → status is polled → successful print schedules deletion.

## Payment flow
The UI can select Online/UPI or Cash, but the backend owns transitions. Online remains `PAYMENT_PENDING` until a real provider webhook calls the payment adapter. Cash remains `CASH_PENDING` for Phase 2 approval. No fake success control exists.

## File deletion
A cleanup worker runs every 60 seconds. Uploaded files expire after 5 minutes, and printed/failed/expired orders delete their private file reference. Cleanup is also attempted on explicit delete and process shutdown.

## Security
- MIME allowlist plus PDF/JPEG/PNG signature checks.
- 10 MB upload limit and random server file names.
- No customer file URL, secret, or internal path is sent to the browser.
- Shop ID is validated against backend data.
- Order IDs and upload references are cryptographically random.
- Backend recalculates totals and owns payment status.
- Basic per-IP rate limiting on uploads/orders.
- Mock connector is isolated behind an interface and cannot release unpaid jobs.

## Design direction
**Design movement:** calm utilitarian service design with a warm print-studio accent.
**Principles:** one decision per screen, strong hierarchy, visible progress, reassuring privacy.
**Color philosophy:** ink navy for trust, paper cream for approachability, saffron as the ownable action color.
**Layout paradigm:** a narrow “paper trail” flow with a persistent progress rail rather than a dense dashboard.
**Signature elements:** paper-card surfaces, a QR corner notch, and a thin progress spine.
**Interaction:** large tap targets, immediate validation, no hidden settings; motion is short slide/fade feedback only.
**Typography:** system sans stack for reliable Hindi/English rendering; display weight is bold, body is relaxed and high-contrast.
**Brand essence:** “Print from the shop doorway, without an account.” Personality: clear, considerate, dependable.
**Voice:** “Upload once. We’ll handle the rest.” / “Your file stays private and temporary.”
**Wordmark/mark:** a folded paper corner forming a small QR-like square.
**Signature color:** saffron `#F4A62A`.
