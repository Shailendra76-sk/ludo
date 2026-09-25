export type PlayerColor = "red" | "blue" | "green" | "yellow";
export type GameStatus = "waiting" | "playing" | "finished";
export type GameMode = "classic" | "ai";
export type BotDifficulty = "easy" | "medium" | "hard" | "expert";
export type RoomVisibility = "private" | "public";
export type RoomStatus = "lobby" | "starting" | "closed";

export type Token = {
  id: number;
  steps: number;
};

export type Player = {
  id: number;
  userId?: string | null;
  name: string;
  color: PlayerColor;
  tokens: Token[];
  connected: boolean;
  isBot?: boolean;
};

export type GameConfig = {
  playerCount: 2 | 3 | 4;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  turnTimeSeconds: number;
  requireSixToStart: boolean;
  rollAgainOnSix: boolean;
};

export type GameState = {
  id: string;
  status: GameStatus;
  config: GameConfig;
  players: Player[];
  currentPlayerIndex: number;
  dice: number | null;
  turnNumber: number;
  winnerId: number | null;
  message: string;
  stateVersion: number;
};


export type Room = {
  id: string;
  code: string;
  hostUserId: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  maxPlayers: 2 | 3 | 4;
  gameId: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomPlayer = {
  roomId: string;
  userId: string;
  playerSlot: number;
  username: string;
  ready: boolean;
};
