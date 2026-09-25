# Phase 4 — Rooms & Lobby

## Implemented

- Database-backed rooms.
- 6-character room codes with server-side random generation.
- Private/public room visibility field.
- Host ownership.
- 2 / 3 / 4 player room capacity.
- Room membership with stable player slots.
- Ready/unready state.
- Host-only start action.
- Minimum two-player start guard.
- All-player-ready start guard.
- Atomic room join with row locking to avoid slot races.
- Leaving a room and host close behavior.
- Waiting game state connected to each room.
- Room inspection API.
- Create, join, ready, start, and leave APIs.
- A responsive lobby page at /rooms.
- Short polling in the lobby provides current room state until the dedicated realtime transport phase is wired in.

## API

POST /api/rooms
POST /api/rooms/join
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/ready
POST /api/rooms/:roomId/start
POST /api/rooms/:roomId/leave

## Realtime note

The room state is persisted and the lobby uses short polling as a temporary compatibility layer. Persistent realtime multiplayer transport is intentionally implemented in the next phase rather than pretending that polling is a WebSocket implementation.
