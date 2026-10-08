# Printer Auto — Phase 1 Customer Side

A plain-local, mobile-first QR printing customer flow. It intentionally does **not** include shopkeeper or Super Admin UI.

## Run

```bash
cd /home/ubuntu/printer-auto
npm start
```

Open:

- `http://localhost:8787/print/shop/demo-shop`
- `http://localhost:8787/print/shop/paperlane-central`

## Current working behavior

- QR-style shop route with backend shop validation
- PDF/JPG/PNG upload with 10 MB limit, signature validation, private random storage, and PDF page counting via `pdfinfo`
- Backend-owned pricing and total calculation
- B&W/color, copies, all/selected pages
- Cash order creation as `CASH_PENDING`
- Online order creation as `PAYMENT_PENDING`; no fake payment success and no unpaid print release
- Five-minute cleanup worker for abandoned temporary files
- Mock print connector interface guarded by verified payment state

## Production hand-off points

1. Replace the in-memory `shops`/`orders` maps with PostgreSQL repositories.
2. Implement the `PaymentProvider` adapter and verified webhook route for a real UPI/payment provider.
3. Add authenticated signed connector registration and outbound job delivery for the shop agent.
4. Put the app behind HTTPS, add durable object storage with server-side encryption, and add a persistent queue/worker.
5. Add Redis-backed rate limiting and structured audit logs.

The full architecture and contracts are in [`plan.md`](./plan.md).
