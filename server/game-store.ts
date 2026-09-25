import { getDb } from "@/db/client";
import type { GameConfig, GameState } from "@/lib/types";

export async function persistNewGame(state: GameState) {
  await getDb().query(
    "INSERT INTO games(id,status,config,state,state_version) VALUES($1,$2,$3,$4,$5)",
    [state.id, state.status, JSON.stringify(state.config), JSON.stringify(state), state.stateVersion],
  );
  return state;
}

export async function readGame(gameId: string) {
  const result = await getDb().query(
    "SELECT id,status,config,state,state_version,updated_at FROM games WHERE id=$1 LIMIT 1",
    [gameId],
  );
  return result.rows[0] ?? null;
}

export async function transactGame<T>(
  gameId: string,
  actionId: string,
  actorUserId: string | null,
  eventType: string,
  mutate: (state: GameState) => { state: GameState; payload?: Record<string, unknown> },
) {
  void actorUserId;
  void eventType;
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT payload FROM game_events WHERE game_id=$1 AND action_id=$2 LIMIT 1",
      [gameId, actionId],
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return (existing.rows[0].payload as { state: GameState }).state;
    }

    const locked = await client.query("SELECT state FROM games WHERE id=$1 FOR UPDATE", [gameId]);
    if (!locked.rowCount) throw new Error("Game not found.");

    const current = locked.rows[0].state as GameState;
    const result = mutate(current);

    await client.query(
      "UPDATE games SET status=$2,state=$3,state_version=$4,updated_at=now() WHERE id=$1",
      [gameId, result.state.status, JSON.stringify(result.state), result.state.stateVersion],
    );
    await client.query(
      "INSERT INTO game_events(game_id,action_id,event_type,actor_user_id,payload) VALUES($1,$2,$3,$4,$5)",
      [gameId, actionId, eventType, actorUserId, JSON.stringify({ ...(result.payload ?? {}), state: result.state })],
    );
    await client.query("COMMIT");
    return result.state;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function validateConfig(value: unknown): GameConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid game config.");
  const input = value as Partial<GameConfig>;
  if (input.playerCount !== 2 && input.playerCount !== 3 && input.playerCount !== 4) {
    throw new Error("playerCount must be 2, 3 or 4.");
  }
  const mode = input.mode === "ai" ? "ai" : "classic";
  const botDifficulty =
    input.botDifficulty === "easy" ||
    input.botDifficulty === "hard" ||
    input.botDifficulty === "expert"
      ? input.botDifficulty
      : "medium";
  return {
    playerCount: input.playerCount,
    mode,
    botDifficulty,
    turnTimeSeconds: Math.max(5, Math.min(60, Number(input.turnTimeSeconds ?? 15))),
    requireSixToStart: input.requireSixToStart !== false,
    rollAgainOnSix: input.rollAgainOnSix !== false,
  };
}
