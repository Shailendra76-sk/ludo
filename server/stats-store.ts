import { getDb } from "@/db/client";
import type { PoolClient } from "pg";
import type { GameState } from "@/lib/types";

export async function recordFinishedGame(
  state: GameState,
  startedAt: Date,
  finishedAt: Date,
  transactionClient?: PoolClient,
) {
  if (state.status !== "finished") return;

  const db = transactionClient ?? getDb();
  const winner = state.players.find((player) => player.id === state.winnerId);
  const participants = state.players.filter((player) => player.userId && !player.isBot);

  if (!winner || !participants.length) return;

  const existing = await db.query("SELECT 1 FROM game_results WHERE game_id=$1 LIMIT 1", [state.id]);
  if (existing.rowCount) return;

  const durationSeconds = Math.max(0, Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000));
  const resultRows = participants.map((player, index) => ({
    player,
    placement: player.id === winner.id ? 1 : index + 2,
    won: player.id === winner.id,
    tokensFinished: player.tokens.filter((token) => token.steps >= 58).length,
  }));

  const client: PoolClient = transactionClient ?? await getDb().connect();
  const ownsTransaction = !transactionClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    await client.query(
      "INSERT INTO game_results(game_id,winner_user_id,started_at,finished_at,duration_seconds,mode,player_count,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        state.id,
        winner.userId ?? null,
        startedAt,
        finishedAt,
        durationSeconds,
        state.config.mode,
        state.config.playerCount,
        JSON.stringify(state),
      ],
    );

    for (const row of resultRows) {
      const captures = 0;
      const xp = row.won ? 120 : 40;
      const ratingDelta = row.won ? 25 : -10;
      await client.query(
        "INSERT INTO game_result_players(game_id,user_id,placement,won,tokens_captured,tokens_finished,xp_earned,rating_delta) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [state.id,row.player.userId,row.placement,row.won,captures,row.tokensFinished,xp,ratingDelta],
      );
      await client.query(
        "INSERT INTO user_stats(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
        [row.player.userId],
      );
      await client.query(
        "UPDATE user_stats SET games_played=games_played+1,wins=wins+$2,losses=losses+$3,tokens_finished=tokens_finished+$4,current_streak=CASE WHEN $5 THEN current_streak+1 ELSE 0 END,best_streak=GREATEST(best_streak,CASE WHEN $5 THEN current_streak+1 ELSE 0 END),rating=GREATEST(0,rating+$6),xp=xp+$7,updated_at=now() WHERE user_id=$1",
        [row.player.userId,row.won?1:0,row.won?0:1,row.tokensFinished,row.won,ratingDelta,xp],
      );
    }
    if (ownsTransaction) await client.query("COMMIT");
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
}

export async function getLeaderboard(limit=50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await getDb().query(
    "SELECT u.id,p.display_name,s.rating,s.xp,s.games_played,s.wins,s.losses,s.current_streak,s.best_streak FROM user_stats s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.user_id=s.user_id ORDER BY s.rating DESC,s.wins DESC,s.xp DESC LIMIT $1",
    [safeLimit],
  );
  return result.rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export async function getGameHistory(userId: string, limit=50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await getDb().query(
    "SELECT gr.game_id,gr.finished_at,gr.duration_seconds,gr.mode,gr.player_count,grp.placement,grp.won,grp.tokens_finished,grp.xp_earned,grp.rating_delta FROM game_results gr JOIN game_result_players grp ON grp.game_id=gr.game_id WHERE grp.user_id=$1 ORDER BY gr.finished_at DESC LIMIT $2",
    [userId, safeLimit],
  );
  return result.rows;
}
