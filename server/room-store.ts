import { getDb } from "@/db/client";
import { createInitialState } from "@/game-engine/ludo-engine";
import type { GameConfig, Room, RoomPlayer, RoomVisibility } from "@/lib/types";
import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return code;
}

async function uniqueRoomCode(client: import("pg").PoolClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const found = await client.query("SELECT 1 FROM rooms WHERE code=$1 LIMIT 1", [code]);
    if (!found.rowCount) return code;
  }
  throw new Error("Unable to allocate a room code.");
}

export async function createRoom(
  userId: string,
  config: GameConfig,
  visibility: RoomVisibility = "private",
): Promise<Room> {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const state = createInitialState(config.playerCount, config, undefined, "waiting");
    state.players[0] = {
      ...state.players[0],
      userId,
      name: "Host",
      connected: true,
      isBot: false,
    };

    await client.query(
      "INSERT INTO games(id,status,config,state,state_version) VALUES($1,$2,$3,$4,$5)",
      [state.id, state.status, JSON.stringify(state.config), JSON.stringify(state), state.stateVersion],
    );

    const code = await uniqueRoomCode(client);
    const roomResult = await client.query(
      "INSERT INTO rooms(code,host_user_id,game_id,status,visibility,max_players) VALUES($1,$2,$3,'lobby',$4,$5) RETURNING *",
      [code, userId, state.id, visibility, config.playerCount],
    );
    await client.query(
      "INSERT INTO room_players(room_id,user_id,player_slot,ready) VALUES($1,$2,0,true)",
      [roomResult.rows[0].id, userId],
    );
    await client.query("COMMIT");
    return mapRoom(roomResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRoom(roomId: string): Promise<{ room: Room; players: RoomPlayer[]; game: any } | null> {
  const db = getDb();
  const roomResult = await db.query(
    "SELECT * FROM rooms WHERE id=$1 LIMIT 1",
    [roomId],
  );
  if (!roomResult.rowCount) return null;

  const room = mapRoom(roomResult.rows[0]);
  const playersResult = await db.query(
    "SELECT rp.room_id,rp.user_id,rp.player_slot,rp.ready,u.username FROM room_players rp JOIN users u ON u.id=rp.user_id WHERE rp.room_id=$1 ORDER BY rp.player_slot",
    [roomId],
  );
  const gameResult = await db.query(
    "SELECT state,state_version,updated_at FROM games WHERE id=$1 LIMIT 1",
    [room.gameId],
  );

  return {
    room,
    players: playersResult.rows.map((row) => ({
      roomId: row.room_id,
      userId: row.user_id,
      playerSlot: row.player_slot,
      username: row.username,
      ready: row.ready,
    })),
    game: gameResult.rows[0] ?? null,
  };
}

function mapRoom(row: any): Room {
  return {
    id: row.id,
    code: row.code,
    hostUserId: row.host_user_id,
    status: row.status,
    visibility: row.visibility,
    maxPlayers: row.max_players,
    gameId: row.game_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function joinRoom(roomCode: string, userId: string) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT * FROM rooms WHERE code=$1 FOR UPDATE", [roomCode.trim().toUpperCase()]);
    if (!roomResult.rowCount) throw new Error("Room not found.");
    const room = roomResult.rows[0];
    if (room.status !== "lobby") throw new Error("Room is not accepting players.");

    const existing = await client.query(
      "SELECT player_slot FROM room_players WHERE room_id=$1 AND user_id=$2",
      [room.id, userId],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return room.id as string;
    }

    const count = await client.query("SELECT COUNT(*)::int AS count FROM room_players WHERE room_id=$1", [room.id]);
    if (count.rows[0].count >= room.max_players) throw new Error("Room is full.");

    const slotResult = await client.query(
      "SELECT player_slot FROM room_players WHERE room_id=$1 ORDER BY player_slot",
      [room.id],
    );
    const used = new Set<number>(slotResult.rows.map((r) => r.player_slot));
    let slot = 0;
    while (used.has(slot)) slot++;

    const gameResult = await client.query("SELECT state FROM games WHERE id=$1 FOR UPDATE", [room.game_id]);
    if (!gameResult.rowCount) throw new Error("Room game not found.");
    const state = gameResult.rows[0].state;
    const userResult = await client.query("SELECT username FROM users WHERE id=$1 LIMIT 1", [userId]);
    if (!userResult.rowCount) throw new Error("User not found.");

    state.players[slot] = {
      ...state.players[slot],
      userId,
      name: userResult.rows[0].username,
      connected: true,
      isBot: false,
    };
    state.stateVersion += 1;

    await client.query(
      "INSERT INTO room_players(room_id,user_id,player_slot,ready) VALUES($1,$2,$3,false)",
      [room.id, userId, slot],
    );
    await client.query(
      "UPDATE games SET state=$2,state_version=$3,updated_at=now() WHERE id=$1",
      [room.game_id, JSON.stringify(state), state.stateVersion],
    );
    await client.query("COMMIT");
    return room.id as string;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setReady(roomId: string, userId: string, ready: boolean) {
  const result = await getDb().query(
    "UPDATE room_players SET ready=$3 WHERE room_id=$1 AND user_id=$2 RETURNING *",
    [roomId, userId, ready],
  );
  if (!result.rowCount) throw new Error("You are not in this room.");
}

export async function startRoom(roomId: string, userId: string) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT * FROM rooms WHERE id=$1 FOR UPDATE", [roomId]);
    if (!roomResult.rowCount) throw new Error("Room not found.");
    const room = roomResult.rows[0];
    if (room.host_user_id !== userId) throw new Error("Only the host can start the room.");

    const players = await client.query(
      "SELECT user_id,player_slot,ready FROM room_players WHERE room_id=$1 ORDER BY player_slot",
      [roomId],
    );
    if (players.rowCount < 2) throw new Error("At least two players are required.");
    if (players.rows.some((p) => !p.ready)) throw new Error("All players must be ready.");

    const gameResult = await client.query("SELECT state FROM games WHERE id=$1 FOR UPDATE", [room.game_id]);
    if (!gameResult.rowCount) throw new Error("Room game not found.");
    const state = gameResult.rows[0].state;
    for (const p of players.rows) {
      const userResult = await client.query("SELECT username FROM users WHERE id=$1", [p.user_id]);
      const index = Number(p.player_slot);
      state.players[index] = {
        ...state.players[index],
        userId: p.user_id,
        name: userResult.rows[0].username,
        connected: true,
        isBot: false,
      };
    }
    state.status = "playing";
    state.message = state.players[state.currentPlayerIndex].name + "'s turn";
    state.stateVersion += 1;

    await client.query(
      "UPDATE games SET status='playing',state=$2,state_version=$3,updated_at=now() WHERE id=$1",
      [room.game_id, JSON.stringify(state), state.stateVersion],
    );
    await client.query("UPDATE rooms SET status='starting',updated_at=now() WHERE id=$1", [roomId]);
    await client.query("COMMIT");
    return state;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function leaveRoom(roomId: string, userId: string) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT * FROM rooms WHERE id=$1 FOR UPDATE", [roomId]);
    if (!roomResult.rowCount) throw new Error("Room not found.");
    const room = roomResult.rows[0];

    await client.query("DELETE FROM room_players WHERE room_id=$1 AND user_id=$2", [roomId, userId]);
    if (room.host_user_id === userId) {
      await client.query("UPDATE rooms SET status='closed',updated_at=now() WHERE id=$1", [roomId]);
    } else {
      const gameResult = await client.query("SELECT state FROM games WHERE id=$1 FOR UPDATE", [room.game_id]);
      if (gameResult.rowCount) {
        const state = gameResult.rows[0].state;
        const p = state.players.find((player: any) => player.userId === userId);
        if (p) {
          p.userId = null;
          p.name = p.color[0].toUpperCase() + p.color.slice(1);
          p.connected = false;
          p.isBot = false;
          state.stateVersion += 1;
          await client.query(
            "UPDATE games SET state=$2,state_version=$3,updated_at=now() WHERE id=$1",
            [room.game_id, JSON.stringify(state), state.stateVersion],
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
