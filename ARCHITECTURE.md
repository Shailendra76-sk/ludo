# Architecture

## Phase 1 boundaries

- components/ is the presentation layer.
- game-engine/ owns game rules.
- lib/ contains shared state types and browser randomness helpers.
- tests/ covers engine behavior.

## Server-authoritative target

Every important multiplayer action will follow:

Authenticated player
-> game membership
-> correct turn
-> action validation
-> transaction
-> event log
-> broadcast
-> client render

The client must never be trusted for dice results, winner state, token coordinates, room ownership or permissions.

## Planned event model

~~~text
ROOM_CREATED
PLAYER_JOINED
PLAYER_READY
GAME_STARTED
TURN_STARTED
DICE_ROLLED
MOVE_STARTED
MOVE_COMPLETED
TOKEN_CAPTURED
TOKEN_FINISHED
TURN_CHANGED
PLAYER_DISCONNECTED
PLAYER_RECONNECTED
GAME_FINISHED
~~~
