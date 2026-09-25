import { getDb } from "@/db/client";
import { createInitialState } from "@/game-engine/ludo-engine";
import { publishRealtimeEvent } from "@/server/realtime-pubsub";
import type { GameConfig, MatchmakingTicket } from "@/lib/types";
import type { PoolClient } from "pg";

function mapTicket(row: {
  id: string;
  user_id: string;
  player_count: number;
  created_at: string;
}): MatchmakingTicket {
  return {
    id: row.id,
    userId: row.user_id,
    playerCount: row.player_count as 2 | 3 | 4,
    status: "queued",
    createdAt: row.created_at,
  };
}

async function loadTicket(client: PoolClient, userId: string) {
  const result = await client.query(
    "SELECT id,user_id,player_count,created_at FROM matchmaking_queue WHERE user_id=$1 LIMIT 1",
    [userId],
  );
  return result.rows[0] ? mapTicket(result.rows[0]) : null;
}

export async function queueForMatch(
  userId: string,
  playerCount: 2 | 3 | 4,
  configOverrides: Partial<GameConfig> = {},
) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await loadTicket(client, userId);
    if (existing) {
      await client.query("COMMIT");
      return { ticket: existing, roomId: null, gameId: null };
    }

    await client.query(
      "INSERT INTO matchmaking_queue(user_id,player_count) VALUES($1,$2)",
      [userId, playerCount],
    );

    const candidates = await client.query(
      `SELECT q.id,q.user_id,q.player_count,q.created_at,u.username
       FROM matchmaking_queue q
       JOIN users u ON u.id=q.user_id
       WHERE q.player_count=$1
       ORDER BY q.created_at ASC
       FOR UPDATE SKIP LOCKED`,
      [playerCount],
    );

    const group = candidates.rows.slice(0, playerCount);
    if (group.length < playerCount) {
      const ticket = await loadTicket(client, userId);
      await client.query("COMMIT");
      if (!ticket) throw new Error("Unable to create matchmaking ticket.");
      return { ticket, roomId: null, gameId: null };
    }

    const config: GameConfig = {
      playerCount,
      mode: "classic",
      botDifficulty: "medium",
      turnTimeSeconds: 15,
      requireSixToStart: true,
      rollAgainOnSix: true,
      ...configOverrides,
    };

    const identities = group.map((row) => ({
      userId: row.user_id as string,
      name: row.username as string,
    }));
    const state = createInitialState(playerCount, config, identities[0], "playing");

    for (let index = 0; index < identities.length; index += 1) {
      const identity = identities[index];
      state.players[index] = {
        ...state.players[index],
        userId: identity.userId,
        name: identity.name,
        connected: true,
        isBot: false,
      };
    }

    await client.query(
      "INSERT INTO games(id,status,config,state,state_version) VALUES($1,'playing',$2,$3,$4)",
      [state.id, JSON.stringify(config), JSON.stringify(state), state.stateVersion],
    );

    let roomRow: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 10 && !roomRow; attempt += 1) {
      const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(0, 32)]).join("");
      try {
        const room = await client.query(
          "INSERT INTO rooms(code,host_user_id,game_id,status,visibility,max_players) VALUES($1,$2,$3,'starting','public',$4) RETURNING id,code",
          [code, identities[0].userId, state.id, playerCount],
        );
        roomRow = roomRow as { id: string; code: string };
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505")) throw error;
      }
    }
    if (!roomRow) throw new Error("Unable to allocate a public match room.");

    for (let index = 0; index < identities.length; index += 1) {
      await client.query(
        "INSERT INTO room_players(room_id,user_id,player_slot,ready) VALUES($1,$2,$3,true)",
        [roomRow.id, identities[index].userId, index],
      );
    }

    await client.query(
      "DELETE FROM matchmaking_queue WHERE id = ANY($1::uuid[])",
      [group.map((row) => row.id)],
    );

    await client.query("COMMIT");

    await publishRealtimeEvent({
      kind: "matchmaking",
      type: "MATCH_FOUND",
      roomId: roomRow.id,
      gameId: state.id,
      playerCount,
    });

    const ownTicket = group.find((row) => row.user_id === userId);
    return {
      ticket: ownTicket ? mapTicket(ownTicket) : null,
      roomId: roomRow.id as string,
      gameId: state.id as string,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMatchStatus(userId: string) {
  const queue = await getDb().query(
    "SELECT id,user_id,player_count,created_at FROM matchmaking_queue WHERE user_id=$1 LIMIT 1",
    [userId],
  );
  if (queue.rowCount) {
    return { status: "queued" as const, ticket: mapTicket(queue.rows[0]), roomId: null, gameId: null };
  }

  const active = await getDb().query(
    `SELECT r.id AS room_id,r.game_id,r.code
     FROM rooms r
     JOIN room_players rp ON rp.room_id=r.id
     JOIN games g ON g.id=r.game_id
     WHERE rp.user_id=$1 AND r.visibility='public' AND r.status='starting' AND g.status='playing'
     ORDER BY r.updated_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!active.rowCount) return { status: "idle" as const, ticket: null, roomId: null, gameId: null };
  return {
    status: "matched" as const,
    ticket: null,
    roomId: active.rows[0].room_id as string,
    gameId: active.rows[0].game_id as string,
    roomCode: active.rows[0].code as string,
  };
}

export async function cancelMatch(userId: string) {
  await getDb().query("DELETE FROM matchmaking_queue WHERE user_id=$1", [userId]);
}
