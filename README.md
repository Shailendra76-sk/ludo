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

Phase 1 is intentionally focused on the game foundation. Voice and AI-command control are reserved for a later phase as requested.
