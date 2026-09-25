import { randomInt } from "node:crypto";
import { FINISH_STEPS } from "@/game-engine/constants";
import {
  getCurrentPlayer,
  getLegalMoves,
  globalTrackIndex,
  isLegalMove,
  isSafePosition,
  moveToken,
} from "@/game-engine/ludo-engine";
import type { BotDifficulty, GameState, Player } from "@/lib/types";

function totalProgress(player: Player): number {
  return player.tokens.reduce((sum, token) => sum + Math.min(token.steps, FINISH_STEPS), 0);
}

function finishedCount(player: Player): number {
  return player.tokens.filter((token) => token.steps >= FINISH_STEPS).length;
}

function opponentProgressDelta(before: GameState, after: GameState, botId: number): number {
  let delta = 0;
  for (const beforePlayer of before.players) {
    if (beforePlayer.id === botId) continue;
    const afterPlayer = after.players.find((player) => player.id === beforePlayer.id);
    if (!afterPlayer) continue;
    delta += totalProgress(beforePlayer) - totalProgress(afterPlayer);
  }
  return delta;
}

function scoreToken(state: GameState, tokenId: number, difficulty: BotDifficulty): number {
  const bot = getCurrentPlayer(state);
  const dice = state.dice;
  if (dice === null || !isLegalMove(state, tokenId, dice)) return Number.NEGATIVE_INFINITY;

  const token = bot.tokens.find((item) => item.id === tokenId);
  if (!token) return Number.NEGATIVE_INFINITY;

  const simulated = moveToken(state, tokenId);
  const moved = simulated.players.find((player) => player.id === bot.id)!;
  const movedToken = moved.tokens.find((item) => item.id === tokenId)!;

  let score = movedToken.steps - token.steps;
  score += finishedCount(moved) * 35;
  score += opponentProgressDelta(state, simulated, bot.id) * 12;

  if (movedToken.steps >= FINISH_STEPS) score += 120;

  const trackIndex = globalTrackIndex(moved, movedToken.steps);
  if (trackIndex !== null && isSafePosition(moved, movedToken.steps)) score += 22;

  if (difficulty === "expert") {
    score += movedToken.steps * 0.35;
    score += (4 - moved.tokens.filter((item) => item.steps === 0).length) * 3;
  }

  return score;
}

export function chooseBotToken(state: GameState): number | null {
  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  const difficulty = state.config.botDifficulty;
  if (difficulty === "easy") {
    return legal[randomInt(0, legal.length)];
  }

  const scored = legal
    .map((tokenId) => ({ tokenId, score: scoreToken(state, tokenId, difficulty) }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === "medium" && scored.length > 1 && randomInt(0, 100) < 30) {
    return scored[1].tokenId;
  }

  if (difficulty === "expert" && scored.length > 1) {
    const margin = scored[0].score - scored[1].score;
    if (margin < 8 && randomInt(0, 100) < 25) return scored[1].tokenId;
  }

  return scored[0].tokenId;
}
