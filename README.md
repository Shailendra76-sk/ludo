# Ludo Play

Phase 1 of the Advanced Ludo Platform.

## What is implemented

- Next.js + React + TypeScript foundation
- Modular pure Ludo game engine
- 2, 3 and 4 player setup
- Four tokens per player
- Six-to-start rule
- Legal move detection
- Token movement and finish state
- Safe cells and capture logic
- Turn rotation and extra turn on six
- Winner detection
- State versioning
- Responsive playable board
- Unit test foundation

## Phase 2 backend

- PostgreSQL persistence schema
- Secure password hashing and session cookies
- Auth API
- Server-authoritative game API
- Transactional, idempotent game actions
- Server-side dice generation
- Health endpoint

See docs/PHASE-2.md.

## Architecture

The game rules are isolated under game-engine/ and do not depend on React.

The future authority model is:

Client action -> authenticated backend validation -> state mutation -> event broadcast -> UI.

The browser is not the final source of truth for multiplayer dice, turns, token positions or winners. Those controls move to the server in the multiplayer phases.

## Local development

~~~bash
npm install
npm run dev
npm test
~~~

## Phase 3 — AI bots

- AI game mode
- Easy / Medium / Hard / Expert bot difficulty
- Server-side bot decision engine
- Same legal-move engine for bots and humans
- Transactional bot-turn endpoint

See docs/PHASE-3.md.

## Phase 4 — Rooms & Lobby

- Room creation and 6-character codes
- Host ownership and player slots
- Ready/unready flow
- Host-only start
- Atomic joins and room persistence
- Responsive lobby at /rooms
- Temporary state polling until realtime transport is implemented

See docs/PHASE-4.md.

## Phase 5 — Real-time multiplayer foundation

- Socket.IO server with room-scoped WebSocket channels
- Signed short-lived realtime tickets
- Redis pub/sub event fan-out
- Automatic reconnect and ticket refresh
- Realtime room lobby updates
- Online game client at /play/:gameId
- Server-authoritative REST mutations with realtime invalidation
- Member-only room and game reads

See docs/PHASE-5.md.

## Phase 6 — Profiles, statistics, leaderboard & history

- Persistent player profiles and preferences
- Persistent rating, XP, wins/losses and streak statistics
- Immutable completed-game result records
- Per-player result history
- Achievement catalog storage
- Profile API at /api/profile
- Leaderboard API at /api/leaderboard
- Personal history API at /api/history
- Profile UI at /profile
- Leaderboard UI at /leaderboard
- Finished-game statistics are written atomically with the game transaction

See docs/PHASE-6.md.

## Phase 7 — Friends, chat & notifications

- Player search and online/in-game presence indicators
- Friend requests, acceptance, rejection and removal
- Player blocking and relationship cleanup
- Friend room invitations via notifications
- Persistent room chat with realtime delivery
- Chat rate limiting and member-only access
- Notification inbox with unread count and mark-all-read
- Social dashboard at /social
- Chat panel embedded in online games

See docs/PHASE-7.md.

## Phase 8 — Quick Match & replay

- Public matchmaking queue for 2 / 3 / 4 players
- Transactional queue matching
- Automatic public room creation for matched players
- Quick Match UI at /quick-match
- Queue cancellation and status
- Authorized replay event API
- Replay frame builder and scrubber UI at /play/:gameId/replay

See docs/PHASE-8.md.

## Phase 9 — Admin & security hardening

- Database-backed player/admin roles
- Admin dashboard at /admin
- User, game and report inspection
- Session revocation and role management
- Audit log storage
- Report moderation APIs
- Branding and game settings storage/API
- Browser security headers and production HSTS
- Abuse-sensitive API rate limiting
- Security checklist documentation

See docs/PHASE-9.md and docs/SECURITY-CHECKLIST.md.

Voice-command control remains intentionally deferred to a later phase as requested.


## Phase 10 — Voice + AI command control

- Browser voice input for Hindi/English Ludo commands
- Deterministic allowlisted voice intent parser
- “six” / “छे” / “roll dice” roll intents
- “token 2” / “गोटी 2 चलाओ” movement intents
- Server-authoritative voice action endpoint
- Voice action rate limiting and idempotency
- Voice commands participate in the normal event/replay stream
- Voice control integrated into online games
- Final QA and production deployment checklist

See docs/PHASE-10.md.

Architecture: microphone → speech recognition → intent → authenticated server action → game engine → persistence → realtime UI.
