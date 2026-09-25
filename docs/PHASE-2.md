# Phase 2 — Backend, Database & Authentication

## Implemented

- PostgreSQL schema for users, sessions, games, and immutable game events.
- Parameterized PostgreSQL access with a bounded connection pool.
- Password hashing using Node scrypt.
- HMAC-protected session token hashes.
- HTTP-only, secure-by-production session cookies.
- Register, login, current-user, and logout endpoints.
- Database-backed game persistence.
- Row-locked transactions for game actions.
- Idempotent game actions using actionId plus a database uniqueness constraint.
- Server-side cryptographic dice generation.
- Authenticated game creation and reads.
- Current-player authorization for dice rolls and token moves.
- PostgreSQL health endpoint.

## Environment

Copy .env.example to .env.local and set DATABASE_URL and SESSION_SECRET.

Apply db/schema.sql to the PostgreSQL database before using the API.

## API

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout

POST /api/games
GET  /api/games/:gameId
POST /api/games/:gameId/roll
POST /api/games/:gameId/move
GET  /api/health

## Authority boundary

The browser is not trusted for dice values, turn ownership, token movement, or winners. The multiplayer phases will extend this boundary to room membership and realtime WebSocket events.

## Phase status

Phase 2 backend foundation: complete.

The Phase 1 UI is intentionally still local. Later phases will connect it to these authenticated server endpoints.
