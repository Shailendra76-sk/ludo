import type { GameState, ReplayEvent } from "@/lib/types";

export type ReplayFrame = {
  index: number;
  eventId: number;
  eventType: string;
  createdAt: string;
  state: GameState;
};

export function buildReplayFrames(events: ReplayEvent[]): ReplayFrame[] {
  return events
    .filter((event) => event.state !== null)
    .map((event, index) => ({
      index,
      eventId: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      state: event.state as GameState,
    }));
}
