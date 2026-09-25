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

Voice-command control remains intentionally deferred to a later phase as requested.
