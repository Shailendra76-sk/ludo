# Phase 8 — Quick Match & Replay

## Implemented

- Public matchmaking queue for 2, 3 and 4 player games.
- Queue uniqueness per user.
- Transactional queue matching with row locks and SKIP LOCKED.
- Immediate game creation when a complete group is available.
- Matched players are placed into a public room so the existing realtime transport continues to work.
- Quick Match UI at /quick-match.
- Queue cancellation.
- Match status endpoint.
- Replay event API for authorized participants.
- Replay frame builder from persisted game-event snapshots.
- Replay viewer at /play/:gameId/replay.
- Previous/next frame controls and range scrubber.

## Consistency

Match creation writes the game, room, room membership, and queue deletion in one database transaction.

Replay reads immutable game events in order. The game database remains the authority for the current game state.
