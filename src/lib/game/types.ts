export type BotLevel = 1 | 2 | 3;

export const BOT_LEVEL_NAMES: Record<BotLevel, string> = {
  1: "Лёгкий",
  2: "Средний",
  3: "Тяжёлый",
};

export type CardKind =
  | "floor"
  | "joker"
  | "dog"
  | "bone"
  | "hammer"
  | "wrecking"
  | "thief"
  | "superthief"
  | "milkshake"
  | "van";

export interface Card {
  id: string;
  kind: CardKind;
  value?: number;
}

export interface FloorCard {
  card: Card;
  value: number;
}

export interface Floor {
  cards: FloorCard[];
  dog?: Card;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  level?: BotLevel;
  hand: Card[];
  handCount: number;
  tower: Floor[];
  milkshake?: Card;
}

export type SfxKind =
  | "start"
  | "turn"
  | "shuffle"
  | "build"
  | "steal"
  | "dog"
  | "bone"
  | "hammer"
  | "wrecking"
  | "thief"
  | "superthief"
  | "milkshake"
  | "skip"
  | "van"
  | "discard"
  | "win";

export interface LogEntry {
  id: number;
  text: string;
  tone?: "info" | "good" | "bad" | "turn";
  sfx?: SfxKind;
  /** player who caused the event */
  actor?: string;
  /** players affected by the event */
  victims?: string[];
}

export type Phase = "lobby" | "playing" | "finished";

export interface GameState {
  phase: Phase;
  players: Player[];
  deck: Card[];
  deckCount: number;
  discard: Card[];
  current: number;
  target: number;
  van?: Card;
  winnerId?: string;
  log: LogEntry[];
  logSeq: number;
  turn: number;
  hostId: string;
  lastActionAt: number;
  version?: number;
}

export type GameAction =
  | { type: "build"; cards: [string, string] }
  | { type: "steal"; card: string; target: string; stealIdx: number }
  | { type: "dog"; card: string; floor: number }
  | { type: "bone"; card: string; target: string }
  | { type: "hammer"; card: string; target: string }
  | { type: "wrecking"; card: string; target: string }
  | { type: "thief"; card: string; target: string }
  | { type: "milkshake"; card: string; target: string }
  | { type: "superthief"; card: string }
  | { type: "van"; card: string }
  | { type: "discard"; card: string }
  | { type: "endTurn" };

export type LobbyAction =
  | { type: "addBot"; level?: BotLevel }
  | { type: "removePlayer"; playerId: string }
  | { type: "setLevel"; playerId: string; level: BotLevel }
  | { type: "setTarget"; target: number }
  | { type: "start" }
  | { type: "restart" }
  | { type: "replaceWithBot"; playerId: string };
