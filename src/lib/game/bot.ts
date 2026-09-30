import { applyAction } from "./engine";
import type { BotLevel, Card, GameAction, GameState, Player } from "./types";

const isFloorish = (c: Card) => c.kind === "floor" || c.kind === "joker";
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function find(hand: Card[], kind: Card["kind"]) {
  return hand.find((c) => c.kind === kind);
}

/** All actions the current player may legally perform right now. */
function legalActions(s: GameState): GameAction[] {
  const me = s.players[s.current];
  const hand = me.hand;
  const cands: GameAction[] = [{ type: "endTurn" }];

  const floors = hand.filter(isFloorish);
  for (let i = 0; i < floors.length; i++) {
    for (let j = i + 1; j < floors.length; j++) {
      cands.push({ type: "build", cards: [floors[i].id, floors[j].id] });
    }
  }
  for (const card of floors) {
    if (card.kind !== "floor") continue;
    for (const o of s.players) {
      if (o.id === me.id) continue;
      for (let idx = 0; idx < 2; idx++) cands.push({ type: "steal", card: card.id, target: o.id, stealIdx: idx });
    }
  }
  const dog = find(hand, "dog");
  if (dog) me.tower.forEach((_, floor) => cands.push({ type: "dog", card: dog.id, floor }));
  const targeted: Card["kind"][] = ["bone", "hammer", "wrecking", "thief", "milkshake"];
  for (const kind of targeted) {
    const card = find(hand, kind);
    if (!card) continue;
    for (const o of s.players) {
      if (o.id === me.id) continue;
      cands.push({ type: kind, card: card.id, target: o.id } as GameAction);
    }
  }
  const sup = find(hand, "superthief");
  if (sup) cands.push({ type: "superthief", card: sup.id });
  const van = find(hand, "van");
  if (van) cands.push({ type: "van", card: van.id });
  if (hand.length >= 8) for (const c of hand) cands.push({ type: "discard", card: c.id });

  return cands.filter((a) => {
    try {
      applyAction(s, me.id, a);
      return true;
    } catch {
      return false;
    }
  });
}

/** Level 1: builds what it can, plays special cards almost at random. */
function easyAction(s: GameState): GameAction {
  const legal = legalActions(s);
  const plays = legal.filter((a) => a.type !== "endTurn");
  const builds = plays.filter((a) => a.type === "build");
  if (builds.length && Math.random() < 0.8) return pick(builds);
  if (plays.length && Math.random() < 0.35) return pick(plays);
  if (builds.length) return pick(builds);
  return { type: "endTurn" };
}

/** Level 2: plays well most of the time, but makes mistakes. */
function mediumAction(s: GameState): GameAction {
  // now and then it fumbles: builds instead of attacking, hammers at random, etc.
  const fumbleTypes: GameAction["type"][] = ["build", "dog", "hammer", "wrecking", "bone", "milkshake", "van", "discard"];
  if (Math.random() < 0.3) {
    const legal = legalActions(s).filter((a) => a.type !== "endTurn" && fumbleTypes.includes(a.type));
    if (legal.length) return pick(legal);
  }
  return hardAction(s);
}

/** Level 3: strong play — steals, coordinates attacks, watches the leader. */
function hardAction(s: GameState): GameAction {
  const me = s.players[s.current];
  const hand = me.hand;
  const opps = s.players
    .filter((p) => p.id !== me.id)
    .sort((a, b) => b.tower.length - a.tower.length || b.hand.length - a.hand.length);
  const leader: Player | undefined = opps[0];
  const top = (p: Player) => p.tower[p.tower.length - 1];

  // 1. Donut van — extra turn is always good
  const van = find(hand, "van");
  if (van && !s.van) return { type: "van", card: van.id };

  // 2. Thieves early in the turn (more options later)
  const sup = find(hand, "superthief");
  if (sup && opps.some((o) => o.hand.length > 0)) return { type: "superthief", card: sup.id };
  const thief = find(hand, "thief");
  if (thief) {
    const richest = [...opps].sort((a, b) => b.hand.length - a.hand.length)[0];
    if (richest && richest.hand.length > 0) return { type: "thief", card: thief.id, target: richest.id };
  }

  // 3. Steal a floor from an opponent (best: the leader)
  const floorCards = hand.filter((c) => c.kind === "floor");
  for (const o of opps) {
    const t = top(o);
    if (!t || t.dog) continue;
    for (let i = 0; i < t.cards.length; i++) {
      const need = 9 - t.cards[i].value;
      const c = floorCards.find((x) => x.value === need);
      if (c) return { type: "steal", card: c.id, target: o.id, stealIdx: i };
    }
  }

  // 3b. Distract a dog if we can follow up with a steal or a hammer
  const bone = find(hand, "bone");
  const hammer = find(hand, "hammer");
  if (bone) {
    for (const o of opps) {
      const t = top(o);
      if (!t || !t.dog) continue;
      const canSteal = t.cards.some((fc) => floorCards.some((c) => c.value === 9 - fc.value));
      if (canSteal || (hammer && o === leader)) return { type: "bone", card: bone.id, target: o.id };
    }
  }

  // 4. Build floors from own hand
  for (let i = 0; i < floorCards.length; i++) {
    for (let j = i + 1; j < floorCards.length; j++) {
      if ((floorCards[i].value ?? 0) + (floorCards[j].value ?? 0) === 9) {
        return { type: "build", cards: [floorCards[i].id, floorCards[j].id] };
      }
    }
  }
  const joker = find(hand, "joker");
  if (joker && floorCards.length > 0) {
    // use the card whose complement we don't hold
    const lonely = floorCards[0];
    return { type: "build", cards: [joker.id, lonely.id] };
  }

  // 5. Guard own top floor
  const dog = find(hand, "dog");
  const myTop = top(me);
  if (dog && myTop && !myTop.dog) return { type: "dog", card: dog.id, floor: me.tower.length - 1 };

  // 6. Attack the leader
  if (leader && leader.tower.length > 0) {
    const t = top(leader)!;
    const wreck = find(hand, "wrecking");
    if (!t.dog && hammer) return { type: "hammer", card: hammer.id, target: leader.id };
    if (wreck && (t.dog || leader.tower.length >= s.target - 2)) {
      return { type: "wrecking", card: wreck.id, target: leader.id };
    }
  }
  // attack any other opponent with an unguarded floor
  if (hammer) {
    const o = opps.find((x) => top(x) && !top(x)!.dog);
    if (o) return { type: "hammer", card: hammer.id, target: o.id };
  }

  // 7. Milkshake to the leader
  const shake = find(hand, "milkshake");
  if (shake) {
    const o = opps.find((x) => !x.milkshake);
    if (o) return { type: "milkshake", card: shake.id, target: o.id };
  }

  // 8. Hand is full and nothing to do — discard the least useful card
  if (hand.length >= 8) {
    const counts = new Map<number, number>();
    for (const c of floorCards) counts.set(c.value ?? 0, (counts.get(c.value ?? 0) ?? 0) + 1);
    const junk =
      [...floorCards].sort((a, b) => (counts.get(b.value ?? 0) ?? 0) - (counts.get(a.value ?? 0) ?? 0))[0] ??
      hand.find((c) => c.kind === "bone" || c.kind === "dog") ??
      hand[0];
    return { type: "discard", card: junk.id };
  }

  return { type: "endTurn" };
}

/** Decide the next single action for the current bot player. */
export function botAction(s: GameState, level: BotLevel = 3): GameAction {
  switch (level) {
    case 1:
      return easyAction(s);
    case 2:
      return mediumAction(s);
    default:
      return hardAction(s);
  }
}
