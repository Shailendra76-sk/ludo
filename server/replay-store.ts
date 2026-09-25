import { getDb } from "@/db/client";
import type { ReplayEvent, GameState } from "@/lib/types";

export async function getReplay(gameId: string, userId: string): Promise<ReplayEvent[]> {
  const access = await getDb().query(
    `SELECT 1
     FROM games g
     LEFT JOIN room_players rp ON rp.room_id=(SELECT r.id FROM rooms r WHERE r.game_id=g.id LIMIT 1)
     WHERE g.id=$1 AND (
       EXISTS (SELECT 1 FROM game_result_players grp WHERE grp.game_id=g.id AND grp.user_id=$2)
       OR rp.user_id=$2
     )
     LIMIT 1`,
    [gameId, userId],
  );

  if (!access.rowCount) throw new Error("You do not have access to this game's replay.");

  const result = await getDb().query(
    "SELECT id,action_id,event_type,actor_user_id,created_at,payload FROM game_events WHERE game_id=$1 ORDER BY id ASC",
    [gameId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    actionId: row.action_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    state: (row.payload?.state as GameState | undefined) ?? null,
    previousState: (row.payload?.previousState as GameState | undefined) ?? null,
  }));
}
