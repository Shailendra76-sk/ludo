# PrinterAuto Super Admin Control Center — Gap Analysis

**Feature branch:** `super-admin-control-center-2026-10-09`  
**Base security branch:** `security-audit-remediation-2026-10-09`  
**Base commit:** `df832fc`  
**Scope:** Repository/UI/API/schema/deployment inspection before implementation. No feature code has been added yet.

## 1. Current architecture inspected

### Runtime and persistence

- Node.js + Express 5 application in `server.js`.
- Phase 3 Super Admin routes and platform state in `phase3.js`.
- Phase 4 payment/connector state in `phase4.js`.
- Customer, Shopkeeper and Super Admin interfaces are static HTML plus single-file browser clients.
- Local persistence is JSON under a configurable data directory; business-critical maps remain in memory during a process lifetime.
- Supabase/PostgreSQL schema exists in `supabase/schema.sql`, but the current runtime does not use repositories or Supabase for normal reads/writes.
- `scripts/migrate-local-to-supabase.js` exists for migration preparation.
- NGINX example exists in `deploy/nginx.conf`.

### Security baseline retained

The new branch starts from the security-remediation commit and must preserve:

- Production credential startup guard.
- Persistent session and rate-limit state.
- Strict cookies and CSRF validation.
- Trusted-origin CORS.
- Same-shop authorization for order reads and upload binding.
- Provider-specific payment signatures and exact payment identity matching.
- Persistent webhook/print idempotency.
- Connector pairing expiry, token hashing, revoke/rotate and job completion proof.
- 250 MB upload limit, MIME/signature validation, active upload and disk-capacity guards.
- No demo payment success, fake AI success or secret exposure.

## 2. Existing Super Admin capabilities

### Existing navigation and UI

Current `public/superadmin.js` includes:

- Dashboard.
- Shops.
- Shopkeepers.
- Subscriptions.
- Payments (read-only basic list).
- Revenue.
- Orders.
- Printers.
- System health.
- AI assistant.
- Reports.
- Audit logs.
- Settings.

`public/superadmin.css` already provides responsive cards, panels, tables, status badges, forms, health rows, assistant layout and mobile navigation. These styles should be extended rather than replaced.

### Existing Super Admin APIs

`phase3.js` currently provides authenticated routes for:

- Login/logout/me.
- Dashboard, shops, shopkeepers.
- Plans and subscriptions.
- Orders, payments, revenue, printers.
- Health, reports, audit logs.
- Platform settings and maintenance mode.
- Keyword-based AI assistant with confirmation-gated limited actions.

`phase4.js` currently provides Super Admin read-only metrics for:

- Payment provider status.
- Connector health.
- File-processing counts.

All new routes must use the existing `app.locals.superAdminAuth` middleware and the existing CSRF/session model. No new auth/session system should be introduced.

## 3. Requested capability gap matrix

| Requested area | Current state | Gap | Planned approach |
|---|---|---|---|
| Navigation | Core operational sections exist | Missing CMS, banners, media, coupons, BI, notifications, dedicated security/settings labels | Extend existing `navs` and route dispatcher; preserve existing sections and deep links. |
| Website CMS | Not present | No pages/sections, announcements, preview or publish workflow | Add versioned, status-controlled CMS content records and safe public delivery endpoint. |
| Banner Manager | Not present | No upload, schedule, reorder, publish/unpublish, CTA validation or responsive variants | Add banner CRUD, schedule expiry, asset references and public published-only API. |
| Media Library | Not present | No asset metadata, dimensions, usage links or deletion protection | Add media metadata, private storage references, safe public asset route and usage checks. |
| Coupons/offers | Not present | No coupon model, validation, atomic redemption, checkout integration or reporting | Add coupon campaigns, redemptions, server-side price calculation and order/payment binding. |
| Customer coupon UI | Not present | Customer payment/options flow has no coupon field/breakdown | Add apply/remove workflow to customer options/payment screens, backed by server recalculation. |
| Payment Center | Basic payments list + provider counts | No filters, webhook timeline, refunds, reconciliation, provider error redaction or safe controls | Add payment event query/report routes and provider health/refund boundaries; no simulated refunds. |
| Provider configuration | Environment-only | No Super Admin status/config screen; no secret persistence UI | Show configured/not-configured, masked references and environment only. Keep secrets in env/secret manager unless deployment supports encrypted secret storage. |
| AI Control Center | Keyword-only local handler | No provider/model/budget/timeout/usage configuration; responses are not real provider calls | Add provider abstraction and explicit disabled state when no valid server provider is configured. Retain allowlisted tools and confirmation. |
| BI dashboard | Dashboard/reports aggregate local maps | No date filters, coupon metrics, refund rates, net/gross definitions or reliable persisted source | Add normalized metrics service with date-range filters and safe CSV export; label unavailable persistence/health metrics. |
| Notifications | Dashboard notifications only | No notification center, templates, preferences or delivery history | Add platform notification records and admin UI; delivery adapters remain explicit boundaries. |
| Reports/exports | Basic revenue/reports CSV | No safe escaping, date/currency filters or coupon/payment reconciliation reports | Centralize CSV escaping and date/currency formatting in a report service. |
| Settings | Platform name, support, retention, maintenance | Missing branding, legal content, announcements, notification settings, validated fee/tax settings | Extend existing settings with allowlisted fields, previews and audit events. |
| Database | Phase 3/4 schema, no CMS/coupon/AI usage tables | Missing CMS/media/campaign/redemption/provider-reference/AI usage/publishing event models | Add forward-only migration with constraints/indexes/RLS; preserve existing tables and IDs. |
| Public website | Customer print route only | No published CMS/banner content rendered | Add public read-only published-content endpoint and render on customer/public shell. |

## 4. Existing security constraints for implementation

1. **No source-code editing workflow:** all CMS, banners, offers, plans and settings must be persisted through authenticated APIs.
2. **No arbitrary paths:** media records store opaque asset IDs/object references, never client paths.
3. **No unrestricted public media:** public delivery only resolves assets referenced by published content and returns safe MIME/content.
4. **No unsafe redirects:** CTA URLs allow same-origin relative paths and an explicit HTTPS host allowlist only; `javascript:`, `data:`, protocol-relative and untrusted schemes are rejected.
5. **No client totals:** coupon discount, tax/fee and final order total are recalculated server-side from current shop/pricing/campaign data.
6. **No coupon over-redemption:** redemptions require atomic transaction/unique constraints in production; local fallback must use a serialized lock or clearly remain test-only.
7. **No fake provider/refund state:** Payment Center may show environment/status and verified event data, but cannot mark a refund successful without an official provider response.
8. **No fake AI:** if provider credentials are unavailable, AI Control Center must show `UNCONFIGURED` and return a clear disabled response.
9. **No auto-publish from AI:** AI may draft content or offers; publication requires a separate admin review/confirmation API call.
10. **No fabricated BI:** pending payments are not revenue, duplicate webhook events count once, and unavailable database/payment checks are labeled unavailable.
11. **Existing CSRF and Super Admin auth:** every mutation uses the current middleware and browser CSRF helper.
12. **Secrets:** provider/AI keys remain server-side; UI shows only masked reference/configured status.

## 5. Proposed persistent data model

The migration should add, at minimum:

- `cms_pages` or `cms_sections`: key, content JSON, status, version, preview token/reference, created/updated/published timestamps, admin actor.
- `media_assets`: opaque ID, storage key, MIME, dimensions, bytes, checksum, alt text, visibility, created/updated timestamps, deletion status.
- `banners`: title, subtitle, media IDs for desktop/mobile, alt text, CTA label/URL, position, priority, start/end timestamps with timezone, status, published version, created/updated by.
- `campaigns`: normalized code/name/description, discount type/value/cap, minimum amount, eligibility JSON, applicable shops/plans, start/end timestamps, status, total/per-customer limits.
- `coupon_redemptions`: campaign ID, normalized customer/order/subscription key, discount, original/final totals, status, provider/payment reference, timestamps, unique idempotency key.
- `payment_provider_configs`: provider, environment, masked identifiers, secret-manager reference, status, last health check, rotated/deactivated timestamps; never plaintext secret.
- `payment_provider_events`: provider/event ID unique key, order/subscription ID, identity fields, normalized amount/currency, status, signature result, raw payload hash, timestamps, redacted error.
- `ai_provider_configs`: provider/model, enabled flag, secret-manager reference, limits, allowed tools, status, last error, timestamps.
- `ai_usage_records`: admin, provider/model, request/response token estimates, cost estimate marker, status, timestamps.
- `admin_notifications` and `notification_templates`: type, audience, severity, payload, read/delivery status, timestamps.
- `campaign_publish_events` and `admin_change_events`: immutable actor/action/entity/version records.
- Optional normalized analytics views/materialized aggregates for date-range BI.

Important constraints:

- Unique normalized coupon code.
- Unique `(provider, provider_event_id)` payment event.
- Unique redemption idempotency key.
- Check constraints for non-negative discount/amount and valid date windows.
- RLS by shop for shop-owned records; Super Admin access through server-side claims/service role only.
- Indexes on status, date ranges, shop IDs, provider event IDs and campaign codes.

## 6. API design direction

All `/api/superadmin/*` mutations use the existing Super Admin auth + CSRF middleware and generate audit entries.

Planned route groups:

- `/api/superadmin/cms/pages`, `/preview`, `/publish`, `/unpublish`.
- `/api/superadmin/banners`, `/reorder`, `/publish`, `/preview`.
- `/api/superadmin/media`, `/upload`, `/:id/usage`, `/:id/delete`.
- `/api/public/content`, `/api/public/banners` for published-only content.
- `/api/superadmin/campaigns`, `/:id/redemptions`, `/:id/status`.
- `/api/orders/:orderId/coupon/validate` and `/api/orders/:orderId/coupon/remove` with authenticated server-side recalculation rules appropriate to the customer flow.
- `/api/superadmin/payment-center/transactions`, `/events`, `/reconciliation`, `/refunds`.
- `/api/superadmin/provider-status` and optional secret-manager reference status; never return secret material.
- `/api/superadmin/ai/config`, `/usage`, `/health`, `/ask` with provider abstraction and allowlisted tools.
- `/api/superadmin/bi/summary`, `/trends`, `/export` with date-range validation.
- `/api/superadmin/notifications`, `/templates`, `/preferences`.
- `/api/superadmin/settings/branding`, `/legal`, `/announcements`.

Routes must return loading/error-safe JSON contracts for the UI and must not expose local file paths, raw webhook bodies, credentials, session tokens or customer document data.

## 7. Delivery phases

1. **Phase 1 — Schema and control-plane foundation:** migration, service helpers, navigation, shared UI states, route contracts and audit events.
2. **Phase 2 — CMS, banners and media:** secure upload/variants, CRUD, preview/publish/scheduling and public rendering.
3. **Phase 3 — Coupons/offers:** campaign CRUD, atomic validation/redemption, customer checkout integration and reporting.
4. **Phase 4 — Payment Center:** provider/event/reconciliation views, official refund boundary, environment/status display and safe controls.
5. **Phase 5 — AI Control Center:** real server-side provider abstraction, disabled/unconfigured state, configuration references, usage/budget and allowlisted tools.
6. **Phase 6 — BI, notifications and settings:** verifiable metrics, exports, notification center/templates and validated platform settings.
7. **Phase 7 — Persistence and regression:** migration rehearsal, RLS/backend authorization tests, mobile/desktop verification, full security suite and documentation.

## 8. Explicit blockers and assumptions

- No Supabase connection or deployment secret manager is currently configured in the inspected repository, so the first implementation can add migration/schema contracts and preserve a safe local adapter, but must not claim live multi-node persistence until executed against the real deployment.
- No Cashfree/Razorpay production credentials are present; Payment Center will show actual configured/not-configured status and verified historical events only.
- No AI provider is configured; AI Control Center must remain visibly disabled rather than return fabricated answers.
- Media storage is currently local temporary storage. A production object-storage adapter should be introduced behind an interface; local development must enforce private storage and safe delivery.
- Existing static single-file Super Admin UI should be extended incrementally, but a small client-side state/section helper may be introduced to avoid repeating unsafe HTML/event logic.

## 9. Acceptance gates before coding is considered complete

- Existing `npm test`, `npm run security:audit` and `npm run security:deps` remain green.
- New unauthorized/CSRF/cross-shop tests remain green.
- CMS publication is visible on the actual public customer page.
- Expired/unpublished banners do not appear publicly.
- Media deletion is blocked while referenced.
- Coupon totals are independently recomputable and never negative.
- Failed/pending payments do not consume redemptions or release print.
- Payment Center does not fabricate refunds or provider health.
- AI is disabled without a real provider and cannot bypass confirmation.
- BI totals reconcile against stored orders/payments/events.
- Migration is forward-only, repeatable and preserves existing data.
- Desktop and mobile UI paths have been verified.
