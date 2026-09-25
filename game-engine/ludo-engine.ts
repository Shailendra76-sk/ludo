import {
  ENTRY_ROLL,
  FINISH_STEPS,
  PLAYER_COLORS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
} from "./constants";
import { CENTER, getRoutePosition, getSharedTrackIndex, isSafeCell, SHARED_TRACK } from "./paths";
import type { GameConfig, GameState, Player, PlayerColor } from "@/lib/types";

const DEFAULT_CONFIG: GameConfig = {
  playerCount: 4,
  mode: "classic",
  botDifficulty: "medium",
  turnTimeSeconds: 15,
  requireSixToStart: true,
  rollAgainOnSix: true,
  rollAgainOnCapture: true,
  rollAgainOnHome: true,
  threeSixPenalty: true,
};

export function createInitialState(
  playerCount: 2 | 3 | 4 = 4,
  configOverrides: Partial<GameConfig> = {},
  firstPlayer?: { userId: string; name: string },
  initialStatus: GameState["status"] = "playing",
): GameState {
  const players = PLAYER_COLORS.slice(0, playerCount).map((color, index) =>
    createPlayer(
      index,
      color,
      index === 0 ? firstPlayer : undefined,
      configOverrides.mode === "ai" && index > 0,
    ),
  );

  return {
    id: crypto.randomUUID(),
    status: initialStatus,
    config: {
      ...DEFAULT_CONFIG,
      playerCount,
      ...configOverrides,
    },
    players,
    currentPlayerIndex: 0,
    dice: null,
    turnNumber: 1,
    winnerId: null,
    message: initialStatus === "waiting" ? "Waiting in room lobby." : players[0].name + "'s turn",
    stateVersion: 1,
    sixStreak: 0,
  };
}

function createPlayer(
  id: number,
  color: PlayerColor,
  identity?: { userId: string; name: string },
  isBot = false,
): Player {
  return {
    id,
    userId: identity?.userId ?? null,
    name: identity?.name ?? color[0].toUpperCase() + color.slice(1),
    color,
    connected: true,
    isBot,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, tokenId) => ({ id: tokenId, steps: 0 })),
  };
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getTokenBoardPosition(player: Player, steps: number) {
  if (steps >= FINISH_STEPS) return CENTER;
  return getRoutePosition(player.color, steps);
}

export function globalTrackIndex(player: Player, steps: number): number | null {
  return getSharedTrackIndex(player.color, steps);
}

export function isSafePosition(player: Player, steps: number): boolean {
  return isSafeCell(getTokenBoardPosition(player, steps));
}

function tokenPositionKey(player: Player, steps: number): string | null {
  if (steps < 1 || steps > TRACK_LENGTH) return null;
  const position = getRoutePosition(player.color, steps);
  return position ? position.x + "," + position.y : null;
}

function targetProgress(player: Player, token: { steps: number }, dice: number): number {
  return token.steps === 0 ? 1 : token.steps + dice;
}

function playersAtSharedPosition(
  state: GameState,
  movingPlayerId: number,
  target: string,
): Array<{ player: Player; tokenId: number }> {
  const result: Array<{ player: Player; tokenId: number }> = [];
  for (const player of state.players) {
    if (player.id === movingPlayerId) continue;
    for (const token of player.tokens) {
      const key = tokenPositionKey(player, token.steps);
      if (key === target) result.push({ player, tokenId: token.id });
    }
  }
  return result;
}

function ownTokensAtPosition(state: GameState, playerId: number, target: string) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return [];
  return player.tokens.filter((token) => tokenPositionKey(player, token.steps) === target);
}

function hasOpponentBlockOnPath(state: GameState, mover: Player, fromSteps: number, toSteps: number) {
  for (let progress = Math.max(1, fromSteps + 1); progress <= Math.min(toSteps, TRACK_LENGTH); progress += 1) {
    const position = tokenPositionKey(mover, progress);
    if (!position) continue;
    const opponents = playersAtSharedPosition(state, mover.id, position);
    if (opponents.length >= 2) return true;
  }
  return false;
}

function hasOwnBlockAtTarget(state: GameState, playerId: number, target: string) {
  return ownTokensAtPosition(state, playerId, target).length >= 2;
}

export function isLegalMove(state: GameState, tokenId: number, dice: number = state.dice ?? 0): boolean {
  const player = getCurrentPlayer(state);
  const token = player.tokens.find((item) => item.id === tokenId);
  if (!token || dice < 1 || dice > 6 || state.status !== "playing") return false;

  if (token.steps === 0) {
    if (state.config.requireSixToStart && dice !== ENTRY_ROLL) return false;
    const target = getTokenBoardPosition(player, 1);
    if (!target) return false;
    return !hasOwnBlockAtTarget(state, player.id, target.x + "," + target.y);
  }

  if (token.steps >= FINISH_STEPS) return false;

  const nextSteps = token.steps + dice;
  if (nextSteps > FINISH_STEPS) return false;

  const target = getTokenBoardPosition(player, nextSteps);
  if (!target) return false;

  if (nextSteps <= TRACK_LENGTH && hasOpponentBlockOnPath(state, player, token.steps, nextSteps)) {
    return false;
  }

  const targetKey = target.x + "," + target.y;
  if (hasOwnBlockAtTarget(state, player.id, targetKey)) return false;

  if (nextSteps <= TRACK_LENGTH) {
    const opponents = playersAtSharedPosition(state, player.id, targetKey);
    if (opponents.length >= 2) return false;
  }

  return true;
}

export function getLegalMoves(state: GameState): number[] {
  if (state.dice === null) return [];
  return getCurrentPlayer(state).tokens
    .filter((token) => isLegalMove(state, token.id, state.dice ?? 0))
    .map((token) => token.id);
}

function nextPlayer(state: GameState) {
  return (state.currentPlayerIndex + 1) % state.players.length;
}

function advanceTurn(
  state: GameState,
  currentPlayerIndex: number,
  message: string,
  keepTurn: boolean,
  sixStreak: number,
): GameState {
  return {
    ...state,
    dice: null,
    currentPlayerIndex: keepTurn ? currentPlayerIndex : nextPlayer(state),
    turnNumber: keepTurn ? state.turnNumber : state.turnNumber + 1,
    sixStreak,
    message,
    stateVersion: state.stateVersion + 1,
  };
}

export function applyDice(state: GameState, dice: number): GameState {
  if (state.status !== "playing") return state;
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    return { ...state, message: "Invalid dice result." };
  }
  if (state.dice !== null) return { ...state, message: "Dice already rolled." };

  const sixStreak = dice === 6 ? (state.sixStreak ?? 0) + 1 : 0;

  if (dice === 6 && state.config.threeSixPenalty && sixStreak >= 3) {
    const nextIndex = nextPlayer(state);
    return {
      ...state,
      dice: null,
      currentPlayerIndex: nextIndex,
      turnNumber: state.turnNumber + 1,
      sixStreak: 0,
      message: getPlayerAtIndex(state.players, nextIndex).name + " gets the turn.",
      stateVersion: state.stateVersion + 1,
    };
  }

  const rolled = { ...state, dice, sixStreak, stateVersion: state.stateVersion + 1 };
  const legal = getLegalMoves(rolled);

  if (legal.length > 0) {
    return {
      ...rolled,
      message: legal.length === 1 ? "Tap the highlighted token." : "Choose a highlighted token.",
    };
  }

  if (dice === 6 && state.config.rollAgainOnSix) {
    return {
      ...rolled,
      dice: null,
      message: getCurrentPlayer(state).name + " rolled a 6. Roll again.",
      stateVersion: rolled.stateVersion + 1,
    };
  }

  const nextIndex = nextPlayer(rolled);
  return {
    ...rolled,
    dice: null,
    currentPlayerIndex: nextIndex,
    turnNumber: state.turnNumber + 1,
    sixStreak: 0,
    message: getPlayerAtIndex(rolled.players, nextIndex).name + "'s turn.",
    stateVersion: rolled.stateVersion + 1,
  };
}

export function moveToken(state: GameState, tokenId: number): GameState {
  const player = getCurrentPlayer(state);
  const dice = state.dice;

  if (dice === null || !isLegalMove(state, tokenId, dice)) {
    return { ...state, message: "Invalid move. Choose a highlighted token." };
  }

  const token = player.tokens.find((item) => item.id === tokenId)!;
  const nextSteps = targetProgress(player, token, dice);
  const target = getTokenBoardPosition(player, nextSteps)!;
  const targetKey = target.x + "," + target.y;
  const sharedTarget = nextSteps <= TRACK_LENGTH;
  const opponents = sharedTarget ? playersAtSharedPosition(state, player.id, targetKey) : [];
  const capturedTokenIds = !isSafePosition(player, nextSteps) && opponents.length === 1 ? opponents.map((item) => item.tokenId) : [];
  const capturePlayerIds = capturedTokenIds.length ? opponents.map((item) => item.player.id) : [];

  const nextPlayers = state.players.map((item) => ({
    ...item,
    tokens: item.tokens.map((currentToken) =>
      item.id === player.id && currentToken.id === tokenId
        ? { ...currentToken, steps: nextSteps }
        : currentToken,
    ),
  }));

  const withCaptures = nextPlayers.map((item) => {
    if (!capturePlayerIds.includes(item.id)) return item;
    return {
      ...item,
      tokens: item.tokens.map((currentToken) =>
        capturedTokenIds.includes(currentToken.id) ? { ...currentToken, steps: 0 } : currentToken,
      ),
    };
  });

  const movedPlayer = withCaptures.find((item) => item.id === player.id)!;
  const movedToken = movedPlayer.tokens.find((item) => item.id === tokenId)!;
  const reachedHome = movedToken.steps >= FINISH_STEPS;

  const winner = withCaptures.find((item) => item.tokens.every((currentToken) => currentToken.steps >= FINISH_STEPS));
  const earnedBonus =
    !winner &&
    (
      (dice === 6 && state.config.rollAgainOnSix) ||
      (capturedTokenIds.length > 0 && state.config.rollAgainOnCapture) ||
      (reachedHome && state.config.rollAgainOnHome)
    );

  let message: string;
  if (winner) {
    message = movedPlayer.name + " wins!";
  } else if (capturedTokenIds.length > 0) {
    message = movedPlayer.name + " captured a token. Roll again.";
  } else if (reachedHome) {
    message = movedPlayer.name + " reached Home. Roll again.";
  } else if (earnedBonus && dice === 6) {
    message = movedPlayer.name + " rolled a 6. Roll again.";
  } else {
    message = getPlayerAtIndex(withCaptures, nextPlayer(state)).name + "'s turn.";
  }

  return {
    ...state,
    players: withCaptures,
    currentPlayerIndex: winner || earnedBonus ? state.currentPlayerIndex : nextPlayer(state),
    dice: null,
    turnNumber: winner || earnedBonus ? state.turnNumber : state.turnNumber + 1,
    winnerId: winner?.id ?? null,
    status: winner ? "finished" : "playing",
    message,
    sixStreak: (winner || earnedBonus) && dice === 6 ? (state.sixStreak ?? 0) : 0,
    stateVersion: state.stateVersion + 1,
  };
}

function getPlayerAtIndex(players: Player[], index: number): Player {
  return players[index];
}

export const ENGINE_VERSION = "phase-10-classic-ludo";
export const ENGINE_LIMITS = {
  trackLength: TRACK_LENGTH,
  finishSteps: FINISH_STEPS,
  tokensPerPlayer: TOKENS_PER_PLAYER,
  sharedTrackCells: SHARED_TRACK.length,
};
