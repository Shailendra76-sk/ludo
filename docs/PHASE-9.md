# Phase 9 — Admin Panel & Security Hardening

## Implemented

- User roles with player/admin authorization.
- Admin-only dashboard APIs.
- Admin dashboard UI at /admin.
- User inspection, role change, and session revocation.
- Game inspection.
- Report moderation workflow.
- App settings storage for branding and game configuration.
- Admin audit log storage.
- Response security headers.
- HSTS in production.
- Request rate-limit helper for abuse-sensitive routes.
- Realtime server continues to require signed tickets plus room membership.
- Admin APIs never expose password hashes.

## Important operational note

The role column is database-backed. After applying db/schema.sql, create the first admin by setting one trusted user's role to admin using a controlled database migration/operation.

The in-process rate-limit helper is a local guard and is not a replacement for a distributed limiter in a multi-instance production deployment. Redis-backed rate limiting can be added in the final hardening phase.
