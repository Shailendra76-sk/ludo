# Phase 3 — AI Bot Engine

## Implemented

- Added AI game mode configuration.
- Added explicit bot player identity on game state.
- Added bot difficulty levels: easy, medium, hard, expert.
- Added a server-side bot decision engine.
- Bot decisions are restricted to legal moves from the same game engine used by human players.
- Easy mode selects randomly from legal moves.
- Medium mode is strategy-biased with controlled variation.
- Hard mode selects the highest-scoring legal move.
- Expert mode adds stronger finishing, progress, and safety weighting with limited variation.
- Added an authenticated, transactional bot-turn API.
- Bot dice are generated server-side with cryptographic randomness.
- Bot turns use the same state transaction and actionId idempotency boundary as human actions.

## API

Create an AI game with POST /api/games and a config such as:

~~~json
{
  "config": {
    "playerCount": 4,
    "mode": "ai",
    "botDifficulty": "hard"
  }
}
~~~

Then call:

POST /api/games/:gameId/bot-turn

with:

~~~json
{
  "actionId": "unique-client-generated-id"
}
~~~

The endpoint executes one bot turn atomically. If a six grants an extra turn, the next bot-turn call will process the next bot turn.

## Security boundary

The bot cannot inject arbitrary positions or dice values. Its output is generated from the server game state and is validated by the same game engine before the persisted state is committed.
