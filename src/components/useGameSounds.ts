"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, SfxKind } from "@/lib/game/types";
import { installAudioUnlock, playSfx, type SoundName } from "@/lib/sound";

/** Rough length of each sound (seconds) — used to space out bursts of events. */
const DURATION: Partial<Record<SoundName, number>> = {
  start: 1.0,
  shuffle: 0.6,
  build: 0.7,
  steal: 0.6,
  dog: 0.4,
  bone: 0.6,
  hammer: 0.6,
  wrecking: 1.0,
  thief: 0.6,
  superthief: 0.9,
  milkshake: 0.9,
  skip: 1.1,
  van: 0.9,
  discard: 0.15,
  myTurn: 0.3,
  otherTurn: 0.12,
};

function soundFor(kind: SfxKind, e: LogEntry, meId: string | null): SoundName {
  if (kind === "turn") return e.actor && e.actor === meId ? "myTurn" : "otherTurn";
  if (kind === "win") return !meId || e.actor === meId ? "win" : "lose";
  return kind;
}

/**
 * Plays sound effects for log entries that appeared since the last render.
 * Works identically for local bot games and online rooms because both
 * share the same game log.
 */
export function useGameSounds(log: LogEntry[], logSeq: number, meId: string | null) {
  const lastSeen = useRef<number | null>(null);
  const freeAt = useRef(0);

  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    if (lastSeen.current === null) {
      // First render: only play the opening sounds if the game has just begun,
      // so joining a game in progress (or reloading the page) stays silent.
      lastSeen.current = logSeq <= 3 ? 0 : logSeq;
    }
    const seen = lastSeen.current;
    const fresh = log.filter((e) => e.id > seen && e.sfx);
    lastSeen.current = Math.max(seen, logSeq);
    if (!fresh.length) return;

    // Never replay a long backlog — the latest few events are enough.
    const batch = fresh.slice(-5);
    const now = Date.now();
    let at = Math.max(now, freeAt.current);
    for (const e of batch) {
      const name = soundFor(e.sfx!, e, meId);
      const delay = Math.min(1.8, (at - now) / 1000);
      playSfx(name, delay);
      at = now + delay * 1000 + (DURATION[name] ?? 0.4) * 800;
    }
    freeAt.current = at;
  }, [log, logSeq, meId]);
}
