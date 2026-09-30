import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { botAction } from "./game/bot";
import {
  GameError,
  MAX_PLAYERS,
  addBot,
  applyAction,
  createLobby,
  makePlayer,
  randomId,
  startGame,
  viewFor,
} from "./game/engine";
import type { GameAction, GameState, LobbyAction } from "./game/types";

type Tokens = Record<string, string>;
type Row = typeof rooms.$inferSelect;

const BOT_DELAY_MS = 900;

function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function cleanName(name: unknown) {
  const n = typeof name === "string" ? name.trim().slice(0, 20) : "";
  return n || "Игрок";
}

async function mutate(
  code: string,
  fn: (state: GameState, tokens: Tokens) => { state: GameState; tokens: Tokens } | null,
): Promise<Row> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const [row] = await db.select().from(rooms).where(eq(rooms.code, code));
    if (!row) throw new GameError("Комната не найдена");
    const res = fn(structuredClone(row.state as GameState), { ...(row.tokens as Tokens) });
    if (!res) return row;
    const updated = await db
      .update(rooms)
      .set({ state: res.state, tokens: res.tokens, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(rooms.code, code), eq(rooms.version, row.version)))
      .returning();
    if (updated.length) return updated[0];
  }
  throw new GameError("Сервер занят, попробуйте ещё раз");
}

export function roomView(row: Row, token: string | null) {
  const tokens = row.tokens as Tokens;
  const me = token ? tokens[token] ?? null : null;
  const state = viewFor(row.state as GameState, me);
  state.version = row.version;
  return { code: row.code, me, state };
}

export async function createRoom(name: unknown, target: unknown) {
  // occasional cleanup of stale rooms (older than 2 days)
  await db.delete(rooms).where(lt(rooms.updatedAt, new Date(Date.now() - 2 * 86400_000))).catch(() => {});
  const token = randomId(24);
  const playerId = `p_${randomId(8)}`;
  const t = target === 4 ? 4 : 5;
  const state = createLobby(playerId, cleanName(name), t);
  for (let i = 0; i < 5; i++) {
    const code = roomCode();
    try {
      const [row] = await db.insert(rooms).values({ code, state, tokens: { [token]: playerId } }).returning();
      return { token, ...roomView(row, token) };
    } catch {
      // code collision, retry
    }
  }
  throw new GameError("Не удалось создать комнату");
}

export async function joinRoom(code: string, name: unknown, existingToken: string | null) {
  let token = existingToken ?? "";
  const row = await mutate(code, (state, tokens) => {
    if (token && tokens[token]) return null; // already joined
    if (state.phase !== "lobby") throw new GameError("Игра в этой комнате уже началась");
    if (state.players.length >= MAX_PLAYERS) throw new GameError("Комната заполнена");
    token = randomId(24);
    const playerId = `p_${randomId(8)}`;
    tokens[token] = playerId;
    state.players.push(makePlayer(playerId, cleanName(name), false));
    return { state, tokens };
  });
  return { token, ...roomView(row, token) };
}

export async function getRoom(code: string, token: string | null) {
  const row = await mutate(code, (state, tokens) => {
    if (state.phase !== "playing") return null;
    const cur = state.players[state.current];
    if (!cur?.isBot) return null;
    if (Date.now() - state.lastActionAt < BOT_DELAY_MS) return null;
    let next: GameState;
    try {
      next = applyAction(state, cur.id, botAction(state, cur.level ?? 2));
    } catch {
      next = applyAction(state, cur.id, { type: "endTurn" });
    }
    return { state: next, tokens };
  });
  return roomView(row, token);
}

const LOBBY_TYPES = new Set([
  "addBot",
  "removePlayer",
  "setLevel",
  "setTarget",
  "start",
  "restart",
  "replaceWithBot",
]);

export async function performAction(code: string, token: string, action: GameAction | LobbyAction) {
  const row = await mutate(code, (state, tokens) => {
    const me = tokens[token];
    if (!me) throw new GameError("Вы не участник этой комнаты");
    if (LOBBY_TYPES.has(action.type)) {
      const a = action as LobbyAction;
      if (state.hostId !== me) throw new GameError("Только создатель комнаты может это сделать");
      switch (a.type) {
        case "addBot":
          addBot(state, a.level ?? 2);
          break;
        case "setLevel": {
          const p = state.players.find((x) => x.id === a.playerId);
          if (!p || !p.isBot) throw new GameError("Сложность можно изменить только у бота");
          p.level = a.level === 1 || a.level === 3 ? a.level : 2;
          break;
        }
        case "removePlayer": {
          if (state.phase !== "lobby") throw new GameError("Игра уже началась");
          if (a.playerId === state.hostId) throw new GameError("Нельзя удалить создателя");
          state.players = state.players.filter((p) => p.id !== a.playerId);
          for (const [k, v] of Object.entries(tokens)) if (v === a.playerId) delete tokens[k];
          break;
        }
        case "setTarget":
          if (state.phase !== "lobby") throw new GameError("Игра уже началась");
          state.target = a.target === 4 ? 4 : 5;
          break;
        case "start":
          if (state.phase !== "lobby") throw new GameError("Игра уже началась");
          startGame(state);
          break;
        case "restart":
          if (state.phase !== "finished") throw new GameError("Игра ещё не закончена");
          startGame(state);
          break;
        case "replaceWithBot": {
          const p = state.players.find((x) => x.id === a.playerId);
          if (!p || p.id === me) throw new GameError("Нельзя заменить этого игрока");
          if (!p.isBot) {
            p.isBot = true;
            p.name = `${p.name} (бот)`.slice(0, 24);
            state.lastActionAt = Date.now();
          }
          break;
        }
      }
      return { state, tokens };
    }
    const next = applyAction(state, me, action as GameAction);
    return { state: next, tokens };
  });
  return roomView(row, token);
}
