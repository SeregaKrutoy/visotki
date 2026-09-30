import type {
  BotLevel,
  Card,
  CardKind,
  Floor,
  GameAction,
  GameState,
  LogEntry,
  Player,
  SfxKind,
} from "./types";

export class GameError extends Error {}

export const MAX_PLAYERS = 4;
export const START_HAND = 5;
export const MAX_HAND_FOR_DRAW = 8;
export const END_TURN_MIN = 3;

export const CARD_NAMES: Record<CardKind, string> = {
  floor: "Этаж",
  joker: "Джокер",
  dog: "Собака",
  bone: "Кость",
  hammer: "Молоток",
  wrecking: "Шар-баба",
  thief: "Вор",
  superthief: "Супер-вор",
  milkshake: "Молочный коктейль",
  van: "Фургон с пончиками",
};

export const CARD_HINTS: Record<CardKind, string> = {
  floor: "Две карты с суммой 9 — один этаж. Или украдите карту с верхнего этажа соперника.",
  joker: "Любое значение. Строится только с обычной картой этажа. Красть им нельзя.",
  dog: "Охраняет ваш этаж: его нельзя украсть или разрушить молотком.",
  bone: "Отвлекает сторожевую собаку соперника — собака и кость уходят в сброс.",
  hammer: "Разрушает верхний этаж соперника (если его не охраняет собака).",
  wrecking: "Разрушает верхний этаж соперника, даже охраняемый собакой.",
  thief: "Украдите случайную карту из руки выбранного соперника.",
  superthief: "Украдите по одной случайной карте у КАЖДОГО соперника.",
  milkshake: "Соперник пропустит свой следующий ход и не возьмёт карту.",
  van: "Все соперники пропускают ход — вы ходите ещё раз.",
};

export function cardLabel(c: Card): string {
  if (c.kind === "floor") return `«${c.value}»`;
  return `«${CARD_NAMES[c.kind]}»`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomId(len = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (kind: CardKind, count: number, value?: number) => {
    for (let i = 0; i < count; i++) cards.push({ id: `c${n++}`, kind, value });
  };
  for (let v = 1; v <= 8; v++) add("floor", 4, v);
  add("joker", 4);
  add("dog", 4);
  add("bone", 2);
  add("hammer", 3);
  add("wrecking", 1);
  add("milkshake", 4);
  add("van", 1);
  add("thief", 3);
  add("superthief", 1);
  return shuffle(cards);
}

export const BOT_NAMES = ["Бот Прораб", "Бот Крановщик", "Бот Архитектор", "Бот Бетонщик", "Бот Монтажник"];

export function createLobby(hostId: string, hostName: string, target = 5): GameState {
  return {
    phase: "lobby",
    players: [makePlayer(hostId, hostName, false)],
    deck: [],
    deckCount: 0,
    discard: [],
    current: 0,
    target,
    log: [],
    logSeq: 0,
    turn: 0,
    hostId,
    lastActionAt: Date.now(),
  };
}

export function makePlayer(id: string, name: string, isBot: boolean): Player {
  return { id, name: name.slice(0, 20), isBot, hand: [], handCount: 0, tower: [] };
}

export function addBot(s: GameState, level: BotLevel = 2): GameState {
  if (s.phase !== "lobby") throw new GameError("Игра уже началась");
  if (s.players.length >= MAX_PLAYERS) throw new GameError("Максимум 4 игрока");
  const used = new Set(s.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Бот ${s.players.length + 1}`;
  const bot = makePlayer(`bot_${randomId(6)}`, name, true);
  bot.level = level === 1 || level === 3 ? level : 2;
  s.players.push(bot);
  return s;
}

function log(
  s: GameState,
  text: string,
  tone: LogEntry["tone"] = "info",
  sfx?: SfxKind,
  actor?: string,
  victims?: string[],
) {
  s.logSeq += 1;
  const e: LogEntry = { id: s.logSeq, text, tone };
  if (sfx) e.sfx = sfx;
  if (actor) e.actor = actor;
  if (victims?.length) e.victims = victims;
  s.log.push(e);
  if (s.log.length > 60) s.log = s.log.slice(-60);
}

function drawCards(s: GameState, p: Player, n: number) {
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) return;
      s.deck = shuffle(s.discard);
      s.discard = [];
      log(s, "Колода закончилась — стопка сброса перемешана в новую колоду.", "info", "shuffle");
    }
    const c = s.deck.pop();
    if (c) p.hand.push(c);
  }
}

export function startGame(s: GameState): GameState {
  if (s.players.length < 2) throw new GameError("Нужно минимум 2 игрока");
  s.phase = "playing";
  s.deck = buildDeck();
  s.discard = [];
  s.van = undefined;
  s.winnerId = undefined;
  s.log = [];
  s.turn = 0;
  for (const p of s.players) {
    p.hand = [];
    p.tower = [];
    p.milkshake = undefined;
    drawCards(s, p, START_HAND);
  }
  s.current = Math.floor(Math.random() * s.players.length);
  log(s, `Игра началась! Цель — построить высотку в ${s.target} этажей. Первым ходит ${s.players[s.current].name}.`, "good", "start");
  beginTurn(s);
  return s;
}

function nextIndex(s: GameState, i: number) {
  return (i + 1) % s.players.length;
}

function beginTurn(s: GameState) {
  for (let guard = 0; guard < 12; guard++) {
    const p = s.players[s.current];
    if (p.milkshake) {
      s.discard.push(p.milkshake);
      p.milkshake = undefined;
      log(s, `${p.name} пьёт молочный коктейль и пропускает ход.`, "bad", "skip", undefined, [p.id]);
      s.current = nextIndex(s, s.current);
      continue;
    }
    s.turn += 1;
    log(s, `Ход игрока ${p.name}.`, "turn", "turn", p.id);
    if (p.hand.length < MAX_HAND_FOR_DRAW) drawCards(s, p, 1);
    return;
  }
}

function getPlayer(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new GameError("Игрок не найден");
  return p;
}

function takeFromHand(p: Player, cardId: string, kind?: CardKind | CardKind[]): Card {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new GameError("Этой карты нет у вас в руке");
  const c = p.hand[idx];
  if (kind) {
    const kinds = Array.isArray(kind) ? kind : [kind];
    if (!kinds.includes(c.kind)) throw new GameError("Эта карта здесь не подходит");
  }
  p.hand.splice(idx, 1);
  return c;
}

function peekHand(p: Player, cardId: string): Card {
  const c = p.hand.find((x) => x.id === cardId);
  if (!c) throw new GameError("Этой карты нет у вас в руке");
  return c;
}

function opponent(s: GameState, me: Player, targetId: string): Player {
  if (targetId === me.id) throw new GameError("Выберите соперника");
  return getPlayer(s, targetId);
}

function discardFloor(s: GameState, f: Floor) {
  for (const fc of f.cards) s.discard.push(fc.card);
  if (f.dog) s.discard.push(f.dog);
}

function checkWin(s: GameState, p: Player) {
  if (p.tower.length >= s.target) {
    s.phase = "finished";
    s.winnerId = p.id;
    log(s, `🏆 ${p.name} построил высотку в ${s.target} этажей и ПОБЕЖДАЕТ!`, "good", "win", p.id);
  }
}

export function applyAction(state: GameState, playerId: string, action: GameAction): GameState {
  if (state.phase !== "playing") throw new GameError("Игра не идёт");
  const s: GameState = structuredClone(state);
  const me = s.players[s.current];
  if (!me || me.id !== playerId) throw new GameError("Сейчас не ваш ход");

  switch (action.type) {
    case "build": {
      const [aId, bId] = action.cards;
      if (aId === bId) throw new GameError("Выберите две разные карты");
      const a = peekHand(me, aId);
      const b = peekHand(me, bId);
      const ok = (c: Card) => c.kind === "floor" || c.kind === "joker";
      if (!ok(a) || !ok(b)) throw new GameError("Этаж строится только из карт этажей");
      if (a.kind === "joker" && b.kind === "joker") throw new GameError("Нельзя построить этаж из двух джокеров");
      const va = a.kind === "joker" ? 9 - (b.value ?? 0) : (a.value ?? 0);
      const vb = b.kind === "joker" ? 9 - (a.value ?? 0) : (b.value ?? 0);
      if (va + vb !== 9) throw new GameError("Сумма карт должна быть равна 9");
      takeFromHand(me, aId);
      takeFromHand(me, bId);
      me.tower.push({ cards: [{ card: a, value: va }, { card: b, value: vb }] });
      log(s, `${me.name} строит ${me.tower.length}-й этаж (${va} + ${vb} = 9).`, "good", "build", me.id);
      checkWin(s, me);
      break;
    }
    case "steal": {
      const card = peekHand(me, action.card);
      if (card.kind === "joker") throw new GameError("Джокером нельзя украсть этаж");
      if (card.kind !== "floor") throw new GameError("Для кражи этажа нужна карта этажа");
      const opp = opponent(s, me, action.target);
      const top = opp.tower[opp.tower.length - 1];
      if (!top) throw new GameError("У соперника нет этажей");
      if (top.dog) throw new GameError("Этот этаж охраняет собака");
      const stolen = top.cards[action.stealIdx];
      if (!stolen) throw new GameError("Неверная карта");
      if ((card.value ?? 0) + stolen.value !== 9) throw new GameError("Сумма карт должна быть равна 9");
      takeFromHand(me, action.card);
      const other = top.cards[1 - action.stealIdx];
      if (other) s.discard.push(other.card);
      opp.tower.pop();
      me.tower.push({ cards: [{ card, value: card.value ?? 0 }, stolen] });
      log(s, `${me.name} крадёт этаж у игрока ${opp.name} (${card.value} + ${stolen.value} = 9)!`, "bad", "steal", me.id, [opp.id]);
      checkWin(s, me);
      break;
    }
    case "dog": {
      const f = me.tower[action.floor];
      if (!f) throw new GameError("Выберите свой построенный этаж");
      if (f.dog) throw new GameError("Этот этаж уже охраняется");
      const c = takeFromHand(me, action.card, "dog");
      f.dog = c;
      log(s, `${me.name} ставит сторожевую собаку на ${action.floor + 1}-й этаж.`, "info", "dog", me.id);
      break;
    }
    case "bone": {
      const opp = opponent(s, me, action.target);
      const top = opp.tower[opp.tower.length - 1];
      if (!top || !top.dog) throw new GameError("Верхний этаж соперника не охраняется");
      const c = takeFromHand(me, action.card, "bone");
      s.discard.push(c, top.dog);
      top.dog = undefined;
      log(s, `${me.name} бросает кость — собака игрока ${opp.name} убегает!`, "bad", "bone", me.id, [opp.id]);
      break;
    }
    case "hammer":
    case "wrecking": {
      const opp = opponent(s, me, action.target);
      const top = opp.tower[opp.tower.length - 1];
      if (!top) throw new GameError("У соперника нет этажей");
      if (action.type === "hammer" && top.dog) throw new GameError("Молотком нельзя разрушить охраняемый этаж");
      const c = takeFromHand(me, action.card, action.type);
      discardFloor(s, top);
      opp.tower.pop();
      s.discard.push(c);
      log(
        s,
        action.type === "hammer"
          ? `${me.name} молотком разрушает верхний этаж игрока ${opp.name}!`
          : `${me.name} сносит шар-бабой верхний этаж игрока ${opp.name}!`,
        "bad",
        action.type,
        me.id,
        [opp.id],
      );
      break;
    }
    case "thief": {
      const opp = opponent(s, me, action.target);
      if (opp.hand.length === 0) throw new GameError("У соперника нет карт в руке");
      const c = takeFromHand(me, action.card, "thief");
      const idx = Math.floor(Math.random() * opp.hand.length);
      const [stolen] = opp.hand.splice(idx, 1);
      me.hand.push(stolen);
      s.discard.push(c);
      log(s, `${me.name} подсылает вора и крадёт карту у игрока ${opp.name}.`, "bad", "thief", me.id, [opp.id]);
      break;
    }
    case "superthief": {
      const opps = s.players.filter((p) => p.id !== me.id && p.hand.length > 0);
      if (opps.length === 0) throw new GameError("У соперников нет карт");
      const c = takeFromHand(me, action.card, "superthief");
      for (const opp of opps) {
        const idx = Math.floor(Math.random() * opp.hand.length);
        const [stolen] = opp.hand.splice(idx, 1);
        me.hand.push(stolen);
      }
      s.discard.push(c);
      log(s, `${me.name} играет Супер-вора и крадёт по карте у ${opps.map((o) => o.name).join(", ")}!`, "bad", "superthief", me.id, opps.map((o) => o.id));
      break;
    }
    case "milkshake": {
      const opp = opponent(s, me, action.target);
      if (opp.milkshake) throw new GameError("У этого соперника уже есть коктейль");
      const c = takeFromHand(me, action.card, "milkshake");
      opp.milkshake = c;
      log(s, `${me.name} угощает игрока ${opp.name} молочным коктейлем — тот пропустит ход.`, "bad", "milkshake", me.id, [opp.id]);
      break;
    }
    case "van": {
      if (s.van) throw new GameError("Фургон уже на столе");
      const c = takeFromHand(me, action.card, "van");
      s.van = c;
      log(s, `${me.name} вызывает фургон с пончиками — соперники пропускают ход!`, "good", "van", me.id);
      break;
    }
    case "discard": {
      if (me.hand.length < MAX_HAND_FOR_DRAW) throw new GameError("Сбрасывать можно, только когда в руке 8 карт и больше");
      const c = takeFromHand(me, action.card);
      s.discard.push(c);
      log(s, `${me.name} сбрасывает карту ${cardLabel(c)} (рука переполнена).`, "info", "discard", me.id);
      break;
    }
    case "endTurn": {
      if (me.hand.length < END_TURN_MIN) drawCards(s, me, END_TURN_MIN - me.hand.length);
      if (s.van) {
        s.discard.push(s.van);
        s.van = undefined;
        log(s, `Фургон уезжает. ${me.name} ходит ещё раз!`, "good", "van", me.id);
      } else {
        s.current = nextIndex(s, s.current);
      }
      beginTurn(s);
      break;
    }
    default:
      throw new GameError("Неизвестное действие");
  }
  s.lastActionAt = Date.now();
  return s;
}

/**
 * Hide private information for a given viewer.
 * When the game is finished, all remaining hands are revealed to everyone.
 */
export function viewFor(state: GameState, viewerId: string | null): GameState {
  const v: GameState = structuredClone(state);
  v.deckCount = state.deck.length;
  v.deck = [];
  const revealed = state.phase === "finished";
  for (const p of v.players) {
    p.handCount = p.hand.length;
    if (!revealed && p.id !== viewerId) p.hand = [];
  }
  return v;
}
