# Phase 7 — Social: Friends, Chat & Notifications

## Implemented

- Player search by username or display name.
- Online and in-game indicators based on current sessions and active game membership.
- Friend request lifecycle: send, accept, reject.
- Friend list with status.
- Remove friend.
- Block player, including relationship cleanup and pending-request cancellation.
- Persistent game-room chat with member-only access.
- Chat history endpoint.
- Chat message realtime delivery over the existing room WebSocket channel.
- Per-user chat rate limit of 30 messages per minute per room.
- Persistent notifications.
- Unread notification count.
- Mark-one and mark-all notification read actions.
- Social dashboard at /social.

## Security

Friend and chat APIs require authentication. Search excludes users involved in a block relationship. Room chat requires actual room membership.

Chat input is bounded to 500 characters and rate limited.

## Realtime

Chat messages are stored first, then published through the existing Redis/Socket.IO notification path. Database storage remains authoritative; realtime delivery is an update signal.
