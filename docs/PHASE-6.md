# Phase 6 — Profiles, Statistics, Leaderboards & History

## Implemented

- Persistent player profiles with display name, bio, language, theme and preference fields.
- Persistent game statistics including rating, XP, wins, losses, streaks and token totals.
- Immutable game result records.
- Per-player game result records with placement, XP and rating delta.
- Achievement catalog and user achievement storage.
- Authenticated profile GET/PATCH API.
- Authenticated leaderboard API.
- Authenticated personal game-history API.
- Responsive profile dashboard at /profile.
- Responsive leaderboard at /leaderboard.

## Rating

The foundation uses a simple deterministic rating adjustment for the first implementation: +25 for a win and -10 for a loss, floored at zero. This is application logic, not a claim of competitive ranking quality. It can be replaced with a more sophisticated rating system later.

## History

Completed games are recorded once using the game_id primary key. This prevents duplicate results during retries.

## Note

Bot-only games do not create user ranking rows for bots. Human participants are the persisted competitive statistics population.
