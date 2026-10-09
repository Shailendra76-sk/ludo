# PrinterAuto Security Audit & Remediation

**Repository:** `Shailendra76-sk/ludo`  
**Audit branch:** `security-audit-remediation-2026-10-09`  
**Baseline:** `efdc358` (Phase 4)  
**Testing mode:** Local production-mode configuration, isolated temporary data directories, no real payments and no production secrets.

## Executive summary

The audit first ran a written regression suite against the untouched Phase 1–4 baseline. Five security regressions reproduced:

1. Public order endpoint disclosed private order information.
2. Shopkeeper payment callback trusted client-supplied `verified: true`.
3. A signed webhook without an amount could be accepted as paid.
4. CORS reflected an arbitrary attacker origin.
5. Production could use public fallback Super Admin credentials.

All five baseline checks now pass. Additional tests pass for provider identity matching, webhook replay, duplicate print prevention, connector completion proof, token revocation, malformed uploads, CSRF, trusted CORS, upload ownership, persistent sessions, persistent login rate limiting, revocation and production startup guards.

## Findings and remediation

| ID | Severity | Affected baseline | Reproduction | Remediation | Status |
|---|---|---|---|---|---|
| SEC-01 | **High** | `server.js`, baseline `GET /api/orders/:orderId` | Create any order, request it without authentication; baseline returned `200` and `publicOrder`. | Order reads require an authenticated Shopkeeper session and same-shop ownership; cross-shop requests return `404`. | **Fixed** |
| SEC-02 | **Critical** | `phase4.js`, baseline payment callback | Start onboarding, submit `verified: true` and an attacker-controlled merchant account without a provider signature; baseline connected it. | `verified` is ignored. Callback requires provider-specific signed raw body, onboarding ID, merchant account ID and provider transaction ID. | **Fixed** |
| SEC-03 | **Critical** | `phase4.js`, baseline webhook | Submit a validly signed `PAID` event with no amount; baseline substituted the order amount. | Missing event ID, provider transaction ID, amount, currency or merchant account returns `400`. Exact order, provider, merchant, currency and amount matching is required. | **Fixed** |
| SEC-04 | **High** | `phase4.js`, baseline webhook | Replay the same event or provider transaction; baseline could enter payment/queue logic again. | Persistent provider/event keys and transaction checks make replay idempotent. Duplicate payment cannot release a second job. | **Fixed** |
| SEC-05 | **High** | `server.js`, baseline `cors({ origin: true })` | Send `Origin: https://attacker.example`; baseline reflected it. | `TRUSTED_ORIGINS` allowlist; absent/unknown origins are not reflected. | **Fixed** |
| SEC-06 | **Critical** | `server.js` and `phase3.js`, baseline credential bootstrap | Start production without configured credentials and try `demo@printerauto.local/demo1234` or `admin@printerauto.local/Admin123!`; baseline accepted fallback/default values. | Production fails startup unless Super Admin identifier/password are configured and password is at least 16 characters. Demo account is scrubbed in production. Shopkeeper bootstrap requires explicit variables. | **Fixed** |
| SEC-07 | **High** | `server.js`/`phase3.js`, in-memory sessions and rate map | Login, restart process, or distribute requests across workers; baseline session/rate state was lost. | Sessions, expiry, CSRF token, revocation and rate state are persisted to the configured data directory. Multi-node deployment still needs Redis/PostgreSQL transactions (see residual risks). | **Fixed for single node; production scale follow-up** |
| SEC-08 | **High** | `server.js`, cookie-authenticated mutations | Submit a Shopkeeper mutation with cookies but no CSRF header. | Strict SameSite cookies, CSRF cookie plus `X-CSRF-Token` validation for non-safe methods, and frontend token forwarding. | **Fixed** |
| SEC-09 | **High** | `server.js`, upload/order flow | Upload for Shop A and submit the upload reference to Shop B. | Upload requires an active `shopId`, stores it, and order creation rejects a different shop or reused upload. | **Fixed** |
| SEC-10 | **High** | `phase4.js`, connector completion | Submit `{status:"PRINTED"}` without proof; baseline accepted it. | Jobs receive a per-job completion token. Completion requires the token, active `PRINTING` state and explicit `PRINTED`/`PRINT_FAILED` result. Repeated completion is idempotent. | **Fixed** |
| SEC-11 | **High** | `phase4.js`, connector lifecycle | Reuse a pairing code or continue using a revoked token. | Pairing code uses `crypto.randomInt`, stores only a hash, expires after 10 minutes, limits attempts to five, and is one-time. Shopkeepers can revoke or rotate connector tokens. | **Fixed** |
| SEC-12 | **Medium** | `server.js`, upload handling | Send malformed image/PDF data, concurrent uploads or fill temporary storage. | Magic-byte validation, 250 MB limit, active-upload cap, free-space check, `pdfinfo` timeout and 400/413/429/507 failures. | **Fixed with single-node limits** |
| SEC-13 | **Medium** | `server.js`, cleanup | Age a completed file past retention; baseline cleanup did not delete files whose order was already `PRINTED`. | Cleanup now deletes `PRINTED`, `FAILED` and `EXPIRED` files while retaining active queued work until it is terminal. | **Fixed** |
| SEC-14 | **Medium** | `phase4.js`, payment success path | Configure fake provider values and expect a fake success; baseline adapter only described a session. | Payment session calls official Cashfree/Razorpay server APIs when real server credentials are present; API failures return `502`. No frontend or mock success changes an order to paid. | **Fixed / requires real sandbox credentials for live API verification** |
| SEC-15 | **Medium** | `phase4.js` and Supabase schema, persistence | Restart local process and inspect payment/connector state. | Phase 4 state is persisted to JSON; Supabase tables include webhook, payment, connector, print-job and file-processing records. | **Fixed for single node; migration/transaction follow-up** |
| SEC-16 | **Medium** | `supabase/schema.sql`, RLS | No configured Supabase project was available for live policy execution. | Backend has shop authorization and schema contains shop-scoped RLS policies. Runtime Supabase RLS test remains a launch prerequisite. | **Open verification** |
| SEC-17 | **Low** | `package.json`/lockfile | Dependency audit. | `npm audit --audit-level=high` completed with zero vulnerabilities. | **Fixed / passed** |

## Provider-specific security behavior

### Cashfree

- Sandbox/production order creation uses the official Cashfree PG API when both client ID and client secret are configured.
- Webhook validation uses the Cashfree timestamp plus raw body HMAC and provider signature header.
- Exact order ID, amount, currency, merchant account and provider transaction ID are required.

### Razorpay

- Order creation uses the official Razorpay Orders API with server-side Basic authentication when key ID and key secret are configured.
- Webhook validation uses the Razorpay raw-body signature.
- Razorpay webhook amounts are normalized from paise to INR before exact matching.

Merchant/connected-account onboarding is provider-program-specific and requires the shop/platform account to be enabled with Cashfree or Razorpay. The callback route no longer trusts browser data; it requires a provider-signed callback and configured merchant identity. No account is marked connected from `verified: true` alone.

## Tests actually run

### Baseline reproduction

```bash
node security-audit.test.js
```

Before remediation this exited non-zero with all five checks failing. The captured failure categories were public order disclosure, client-controlled callback verification, missing amount acceptance, reflected CORS and demo credentials.

### Full security suite after remediation

```bash
npm run security:audit
```

Passed:

- `security-audit.test.js`: 5/5 core regressions.
- `security-audit.phase4.test.js`: official-signed callback, amount/currency/account/order identity, replay idempotency, one print job, completion proof, connector revoke, malformed upload, production startup guard.
- `security-audit.state.test.js`: CSRF, trusted CORS, untrusted CORS, cross-shop upload binding, session persistence, persistent login rate limit and session revocation.

### Static and dependency checks

```bash
npm test
npm run security:deps
npm audit --audit-level=high    # found 0 vulnerabilities
node --check server.js
node --check phase3.js
node --check phase4.js
python3 -m py_compile connector/agent.py
git diff --check
```

All passed on the audit branch.

## Production launch blockers / remaining work

1. **Real provider sandbox verification:** No Cashfree/Razorpay credentials or merchant accounts were available in this audit, so no real gateway transaction, refund, chargeback, or provider callback was executed. Run success, failure, pending, duplicate, mismatch, refund and signature-rotation tests with provider sandbox accounts.
2. **Supabase RLS runtime verification:** The schema and backend tests are present, but no live Supabase project was configured. Execute cross-shop SELECT/INSERT/UPDATE tests using real JWT claims and service-role separation before launch.
3. **Multi-node persistence:** Current local JSON persistence is safe for the isolated single-node test mode, not for concurrent multi-process production. Move sessions, login throttles, webhook idempotency and print jobs to PostgreSQL/Redis with unique constraints and transactions.
4. **Durable queue/object storage:** Replace local temporary files and in-process timers with encrypted object storage, durable queue workers, atomic job leases, retry limits and a dead-letter queue.
5. **Connector proof boundary:** The per-job token prevents unauthorized/duplicate API completion, but a remote server cannot cryptographically prove that paper physically exited a printer. Add local OS spooler receipts, printer telemetry or operator confirmation for high-assurance deployments.
6. **Secret management:** Put provider credentials and Super Admin bootstrap values in the deployment secret manager. Do not commit `.env` or use the audit credentials outside isolated tests.
7. **Operational controls:** Add centralized logs/alerts for signature failures, storage-capacity responses, repeated pairing failures, provider API failures and print retries.

No real payment, production secret or fake payment success was used during this audit.
