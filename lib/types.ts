export type PlayerColor = "red" | "blue" | "green" | "yellow";
export type GameStatus = "waiting" | "playing" | "finished";
export type GameMode = "classic" | "ai";
export type BotDifficulty = "easy" | "medium" | "hard" | "expert";
export type RoomVisibility = "private" | "public";
export type RoomStatus = "lobby" | "starting" | "closed";
export type UserRole = "player" | "admin";

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
  rollAgainOnCapture: boolean;
  rollAgainOnHome: boolean;
  threeSixPenalty: boolean;
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
  sixStreak: number;
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


export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type FriendSummary = {
  userId: string;
  username: string;
  displayName: string;
  online: boolean;
  inGame: boolean;
  createdAt: string;
};

export type FriendRequest = {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterDisplayName: string;
  addresseeId: string;
  status: FriendRequestStatus;
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  roomId: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};


export type MatchmakingStatus = "queued" | "matched";

export type MatchmakingTicket = {
  id: string;
  userId: string;
  playerCount: 2 | 3 | 4;
  status: MatchmakingStatus;
  createdAt: string;
};

export type ReplayEvent = {
  id: number;
  actionId: string;
  eventType: string;
  actorUserId: string | null;
  createdAt: string;
  state: GameState | null;
  previousState: GameState | null;
};


export type AdminDashboardStats = {
  totalUsers: number;
  activeUsers: number;
  gamesToday: number;
  activeGames: number;
  completedGames: number;
  openReports: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  gamesPlayed: number;
  wins: number;
  rating: number;
};

export type AdminGameRow = {
  id: string;
  status: string;
  playerCount: number;
  mode: string;
  stateVersion: number;
  updatedAt: string;
};
