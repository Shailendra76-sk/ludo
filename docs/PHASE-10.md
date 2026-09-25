# Phase 10 — Voice + AI Command Control & Final QA

## Voice command architecture

The command flow is intentionally constrained:

Microphone → browser speech recognition → deterministic intent parser → allowlisted action intent → authenticated API → server-side game validation → game engine → database event → realtime sync

The voice layer never receives permission to execute arbitrary JavaScript, SQL, shell commands, database writes, or direct game-state mutations.

## Supported commands

Examples:

- "six"
- "छह" / "छे"
- "roll dice"
- "पासा फेंको"
- "token 1"
- "token two"
- "गोटी 3 चलाओ"

When a number such as "six" is spoken before a roll, it is treated as a roll command, not as a request to force the dice result. The server still generates the actual dice value securely.

When a dice result already exists, token numbers 1–4 can be interpreted as movement commands.

## Browser support

Voice uses the browser Web Speech Recognition API. Browsers without a speech-recognition implementation keep the normal button-based game controls available.

Microphone access is requested only after the player explicitly activates voice control.

## Security

- Authentication is required.
- The current player must own the active turn.
- Voice actions are rate-limited.
- Intent types are allowlisted.
- Token IDs are range-checked.
- The game engine remains authoritative.
- Action IDs preserve idempotency.
- Persisted VOICE_COMMAND events participate in the normal replay/event stream.
- The server ignores any client-provided dice value.

## Final QA

Run:

    npm install
    npm test
    npm run build

Production deployment must provide PostgreSQL, SESSION_SECRET, REALTIME_CORS_ORIGIN, NEXT_PUBLIC_REALTIME_URL, and REDIS_URL for the standalone realtime service.

Do not place provider keys or database credentials in browser code.