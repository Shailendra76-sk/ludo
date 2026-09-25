# Phase 5 — Real-Time Multiplayer

## Implemented

- Socket.IO realtime server under realtime/server.ts.
- Signed, short-lived realtime tickets issued only to authenticated room members.
- WebSocket-first client transport with Socket.IO fallback transport.
- Redis pub/sub bridge for multi-instance/server-to-server game notifications.
- Room-scoped realtime channels.
- Game state change invalidation events broadcast to all connected room clients.
- Automatic Socket.IO reconnection with exponential backoff bounds.
- Realtime health endpoint on the standalone server.
- Room lobby client hook for realtime event consumption.

## Architecture

REST/API remains authoritative for mutations.

Client action
-> authenticated API
-> transaction + database state change
-> Redis pub/sub notification
-> Socket.IO broadcast to room
-> clients refetch authoritative room/game state

Sockets are used for delivery and synchronization signals, not for trusting client-provided game state.

## Environment

Frontend:

~~~text
NEXT_PUBLIC_REALTIME_URL=https://your-realtime-host
NEXT_PUBLIC_APP_URL=https://your-web-host
~~~

Backend/API:

~~~text
REDIS_URL=redis://...
SESSION_SECRET=...
~~~

Realtime server:

~~~text
REALTIME_PORT=3001
REALTIME_CORS_ORIGIN=https://your-web-host
REDIS_URL=redis://...
SESSION_SECRET=...
~~~

## Deployment note

The standalone Socket.IO server is intentionally separated from the Next.js/Vercel web process. The web app can be deployed to Vercel while the realtime service runs on a Node-compatible service that supports long-lived WebSocket connections.

## Consistency model

The database remains the source of truth. A realtime event tells clients that authoritative state changed; clients then load the current state. This prevents socket payloads from becoming a second game-state authority.
