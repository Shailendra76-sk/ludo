# Security Checklist — Phase 9

## Server authority

- Game mutations require an authenticated session.
- Current-player authorization is enforced before dice/move actions.
- Dice are generated server-side for authoritative APIs.
- Game state mutations occur under database row locks.
- Duplicate action IDs are rejected/replayed idempotently.
- Room reads and realtime ticket issuance require membership.

## Account security

- Passwords are derived with Node scrypt.
- Session identifiers are stored only as HMAC-derived hashes.
- Session cookies are HttpOnly and SameSite=Lax.
- Production cookies use Secure.

## HTTP / browser hardening

- HSTS in production.
- X-Content-Type-Options.
- X-Frame-Options.
- Referrer-Policy.
- Permissions-Policy.
- Cross-Origin-Opener-Policy.
- Cross-Origin-Resource-Policy.

## Operational controls

- Admin-only control plane.
- Admin audit log persistence.
- Session revocation action.
- Report moderation.
- Abuse-sensitive rate-limit helper.
- No password hashes returned by admin APIs.

For multi-instance production, use Redis-backed distributed request throttling rather than relying only on the local in-memory helper.
