import {
  ENTRY_ROLL,
  FINISH_STEPS,
  PLAYER_COLORS,
  SAFE_TRACK_INDEXES,
  START_OFFSETS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
} from "./constants";
import type { GameConfig, GameState, Player, PlayerColor } from "@/lib/types";

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
      playerCount,
      mode: "classic",
      botDifficulty: "medium",
      turnTimeSeconds: 15,
      requireSixToStart: true,
      rollAgainOnSix: true,
      ...configOverrides,
    },
    players,
    currentPlayerIndex: 0,
    dice: null,
    turnNumber: 1,
    winnerId: null,
    message: initialStatus === "waiting" ? "Waiting in room lobby." : players[0].name + "'s turn",
    stateVersion: 1,
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

export function globalTrackIndex(player: Player, steps: number): number | null {
  if (steps < 1 || steps > TRACK_LENGTH) return null;
  return (START_OFFSETS[player.color] + steps - 1) % TRACK_LENGTH;
}

export function isSafePosition(player: Player, steps: number): boolean {
  const index = globalTrackIndex(player, steps);
  return index !== null && SAFE_TRACK_INDEXES.has(index);
}

export function isLegalMove(state: GameState, tokenId: number, dice: number = state.dice ?? 0): boolean {
  const player = getCurrentPlayer(state);
  const token = player.tokens.find((item) => item.id === tokenId);
  if (!token || dice < 1 || state.status !== "playing") return false;
  if (token.steps === 0) return !state.config.requireSixToStart || dice === ENTRY_ROLL;
  if (token.steps >= FINISH_STEPS) return false;
  return token.steps + dice <= FINISH_STEPS;
}

export function getLegalMoves(state: GameState): number[] {
  if (state.dice === null) return [];
  return getCurrentPlayer(state).tokens
    .filter((token) => isLegalMove(state, token.id, state.dice ?? 0))
    .map((token) => token.id);
}

export function applyDice(state: GameState, dice: number): GameState {
  if (state.status !== "playing") return state;
  if (dice < 1 || dice > 6) return { ...state, message: "Invalid dice result." };
  if (state.dice !== null) return { ...state, message: "Dice already rolled." };

  const rolled = { ...state, dice, stateVersion: state.stateVersion + 1 };
  const legal = getLegalMoves(rolled);

  if (legal.length > 0) {
    return {
      ...rolled,
      message: legal.length === 1 ? "One legal token is highlighted." : "Legal tokens are highlighted.",
    };
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...rolled,
    dice: null,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: state.turnNumber + 1,
    message: getPlayerAtIndex(state.players, nextPlayerIndex).name + "'s turn.",
    stateVersion: rolled.stateVersion + 1,
  };
}

export function moveToken(state: GameState, tokenId: number): GameState {
  const player = getCurrentPlayer(state);
  const dice = state.dice;
  if (dice === null || !isLegalMove(state, tokenId, dice)) {
    return { ...state, message: "Invalid move. Choose a highlighted token." };
  }

  const nextPlayers = state.players.map((item) => ({
    ...item,
    tokens: item.tokens.map((token) =>
      item.id === player.id && token.id === tokenId
        ? { ...token, steps: token.steps === 0 ? 1 : token.steps + dice }
        : token,
    ),
  }));

  const movedPlayer = nextPlayers.find((item) => item.id === player.id)!;
  const movedToken = movedPlayer.tokens.find((item) => item.id === tokenId)!;
  const capturedIds = getCapturedPlayerIds(nextPlayers, player.id, movedToken.steps);

  const withCaptures = nextPlayers.map((item) => {
    if (!capturedIds.includes(item.id)) return item;
    return {
      ...item,
      tokens: item.tokens.map((token) =>
        sameTrackPosition(item, token.steps, player, movedToken.steps) ? { ...token, steps: 0 } : token,
      ),
    };
  });

  const winner = withCaptures.find((item) => item.tokens.every((token) => token.steps >= FINISH_STEPS));
  const extraTurn = state.config.rollAgainOnSix && dice === 6 && !winner;
  const nextPlayerIndex = winner || extraTurn
    ? state.currentPlayerIndex
    : (state.currentPlayerIndex + 1) % state.players.length;

  let message = "";
  if (winner) {
    message = winner.name + " wins!";
  } else if (capturedIds.length > 0) {
    message = player.name + " captured a token!";
  } else if (extraTurn) {
    message = player.name + " rolled a 6. Roll again.";
  } else {
    message = getCurrentPlayer(withCaptures, nextPlayerIndex).name + "'s turn.";
  }

  return {
    ...state,
    players: withCaptures,
    currentPlayerIndex: nextPlayerIndex,
    dice: null,
    turnNumber: state.turnNumber + 1,
    winnerId: winner?.id ?? null,
    status: winner ? "finished" : "playing",
    message,
    stateVersion: state.stateVersion + 1,
  };
}

function sameTrackPosition(opponent: Player, opponentSteps: number, mover: Player, moverSteps: number): boolean {
  const a = globalTrackIndex(opponent, opponentSteps);
  const b = globalTrackIndex(mover, moverSteps);
  return a !== null && b !== null && a === b && !isSafePosition(opponent, opponentSteps);
}

function getCapturedPlayerIds(players: Player[], moverId: number, moverSteps: number): number[] {
  const mover = players.find((player) => player.id === moverId);
  if (!mover) return [];
  return players
    .filter((player) => player.id !== moverId)
    .filter((player) => player.tokens.some((token) => sameTrackPosition(player, token.steps, mover, moverSteps)))
    .map((player) => player.id);
}

function getPlayerAtIndex(players: Player[], index: number): Player {
  return players[index];
}

export const ENGINE_VERSION = "phase-1";
export const ENGINE_LIMITS = { trackLength: TRACK_LENGTH, finishSteps: FINISH_STEPS, tokensPerPlayer: TOKENS_PER_PLAYER };
