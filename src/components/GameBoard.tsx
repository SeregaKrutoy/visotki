"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Card, GameAction, GameState, Player } from "@/lib/game/types";
import { CARD_HINTS, CARD_NAMES } from "@/lib/game/engine";
import { BOT_LEVEL_NAMES } from "@/lib/game/types";
import { CardBack, CardView, Tower } from "./Cards";
import { RulesContent } from "./Rules";
import { SoundToggle } from "./SoundToggle";
import { useGameSounds } from "./useGameSounds";
import { playSfx } from "@/lib/sound";

interface Props {
  state: GameState;
  meId: string | null;
  onAction: (a: GameAction) => void;
  busy?: boolean;
  error?: string | null;
  onClearError?: () => void;
  headerExtra?: ReactNode;
  finishedActions?: ReactNode;
  opponentExtra?: (p: Player) => ReactNode;
}

const isFloorish = (c: Card) => c.kind === "floor" || c.kind === "joker";

const TARGET_LABEL: Partial<Record<Card["kind"], string>> = {
  bone: "🦴 Кость",
  hammer: "🔨 Снести",
  wrecking: "💥 Шар-баба",
  thief: "🥷 Украсть",
  milkshake: "🥤 Коктейль",
};

export function GameBoard({ state, meId, onAction, busy, error, onClearError, headerExtra, finishedActions, opponentExtra }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);
  const hideWinner = hiddenAt === state.logSeq;
  const logRef = useRef<HTMLDivElement>(null);
  const logSheetRef = useRef<HTMLDivElement>(null);

  const me = state.players.find((p) => p.id === meId) ?? null;
  const current = state.players[state.current];
  const myTurn = state.phase === "playing" && current?.id === meId;
  const hand = useMemo(() => me?.hand ?? [], [me]);
  const selCards = sel.map((id) => hand.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const one = selCards.length === 1 ? selCards[0] : null;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    logSheetRef.current?.scrollTo({ top: logSheetRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log.length]);

  useGameSounds(state.log, state.logSeq, meId);

  useEffect(() => {
    if (error) playSfx("error");
  }, [error]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => onClearError?.(), 3500);
    return () => clearTimeout(t);
  }, [error, onClearError]);

  const myIdx = state.players.findIndex((p) => p.id === meId);
  const opponents =
    myIdx >= 0 ? [...state.players.slice(myIdx + 1), ...state.players.slice(0, myIdx)] : state.players;

  function toggle(c: Card) {
    playSfx(sel.includes(c.id) ? "unclick" : "click");
    if (sel.includes(c.id)) setSel(sel.filter((x) => x !== c.id));
    else if (isFloorish(c) && selCards.length === 1 && isFloorish(selCards[0])) setSel([selCards[0].id, c.id]);
    else setSel([c.id]);
  }

  function act(a: GameAction) {
    if (!myTurn || busy) return;
    onAction(a);
    setSel([]);
  }

  let buildOk = false;
  let buildLabel = "Построить";
  if (selCards.length === 2 && selCards.every(isFloorish)) {
    const [a, b] = selCards;
    if (a.kind === "joker" && b.kind === "joker") buildOk = false;
    else if (a.kind === "joker") {
      buildOk = true;
      buildLabel = `Построить ${9 - (b.value ?? 0)}+${b.value}`;
    } else if (b.kind === "joker") {
      buildOk = true;
      buildLabel = `Построить ${a.value}+${9 - (a.value ?? 0)}`;
    } else {
      buildOk = (a.value ?? 0) + (b.value ?? 0) === 9;
      buildLabel = buildOk ? `Построить ${a.value}+${b.value}` : `${a.value}+${b.value}≠9`;
    }
  }

  function targetAction(opp: Player): GameAction | null {
    if (!one) return null;
    const top = opp.tower[opp.tower.length - 1];
    switch (one.kind) {
      case "bone":
        return top?.dog ? { type: "bone", card: one.id, target: opp.id } : null;
      case "hammer":
        return top && !top.dog ? { type: "hammer", card: one.id, target: opp.id } : null;
      case "wrecking":
        return top ? { type: "wrecking", card: one.id, target: opp.id } : null;
      case "thief":
        return opp.handCount > 0 ? { type: "thief", card: one.id, target: opp.id } : null;
      case "milkshake":
        return !opp.milkshake ? { type: "milkshake", card: one.id, target: opp.id } : null;
      default:
        return null;
    }
  }

  function stealIdxFor(opp: Player): number | null {
    if (!myTurn || one?.kind !== "floor") return null;
    const top = opp.tower[opp.tower.length - 1];
    if (!top || top.dog) return null;
    for (let i = 0; i < top.cards.length; i++) {
      if ((one.value ?? 0) + top.cards[i].value === 9) return i;
    }
    return null;
  }

  let hint = "";
  if (state.phase === "playing") {
    if (!myTurn) hint = me ? `Ходит ${current?.name}` : `Ходит ${current?.name}.`;
    else if (selCards.length === 0) hint = "Выберите карту или завершите ход";
    else if (selCards.length === 2) hint = buildOk ? "Можно строить этаж!" : "Сумма должна быть 9";
    else if (one?.kind === "floor") hint = "Вторая карта на 9 или украдите этаж соперника";
    else if (one?.kind === "joker") hint = "Выберите карту этажа — джокер дополнит до 9";
    else if (one?.kind === "dog") hint = "Нажмите свой этаж, чтобы поставить охрану";
    else if (one) hint = CARD_HINTS[one.kind];
  }

  const winner = state.players.find((p) => p.id === state.winnerId);
  const discardTop = state.discard[state.discard.length - 1];
  const lastLog = state.log[state.log.length - 1];
  const skyline = me ? [...opponents, me] : opponents;

  const actionButtons = me && (
    <>
      <button
        className="btn btn-sun flex-1"
        disabled={!myTurn || !buildOk || busy}
        onClick={() => act({ type: "build", cards: [selCards[0].id, selCards[1].id] })}
      >
        🏗️ {buildLabel}
      </button>
      {one?.kind === "dog" && me.tower.length > 0 && (
        <button
          className="btn btn-sun"
          disabled={!myTurn || busy || !!me.tower[me.tower.length - 1].dog}
          onClick={() => act({ type: "dog", card: one.id, floor: me.tower.length - 1 })}
        >
          🐕 Собака
        </button>
      )}
      {one?.kind === "superthief" && (
        <button
          className="btn btn-sun"
          disabled={!myTurn || busy || !opponents.some((o) => o.handCount > 0)}
          onClick={() => act({ type: "superthief", card: one.id })}
        >
          🕵️ Всех
        </button>
      )}
      {one?.kind === "van" && (
        <button className="btn btn-sun" disabled={!myTurn || busy || !!state.van} onClick={() => act({ type: "van", card: one.id })}>
          🚐 Фургон
        </button>
      )}
      {one && hand.length >= 8 && (
        <button className="btn btn-ghost" disabled={!myTurn || busy} onClick={() => act({ type: "discard", card: one.id })}>
          🗑️
        </button>
      )}
      <button className="btn btn-lav flex-1" disabled={!myTurn || busy} onClick={() => act({ type: "endTurn" })}>
        Ход ➜
      </button>
    </>
  );

  function renderMini(p: Player) {
    const isMe = p.id === meId;
    const isCur = state.phase === "playing" && current?.id === p.id;
    const ta = !isMe && myTurn ? targetAction(p) : null;
    const sIdx = !isMe ? stealIdxFor(p) : null;
    const top = p.tower[p.tower.length - 1];
    const stealVal = sIdx !== null && top ? top.cards[sIdx].value : null;
    return (
      <div
        key={p.id}
        className={`flex min-w-[6.6rem] max-w-[9.5rem] flex-1 flex-col items-center rounded-xl px-1.5 py-2 ${
          isCur ? "bg-sun/25 ring-2 ring-sun" : isMe ? "bg-white/15" : "bg-black/20"
        } ${state.winnerId === p.id ? "ring-2 ring-green-400" : ""}`}
      >
        <Tower
          floors={p.tower}
          target={state.target}
          size="xs"
          hideEmpty
          stealable={(ci) => stealIdxFor(p) === ci}
          onSteal={(ci) => one && act({ type: "steal", card: one.id, target: p.id, stealIdx: ci })}
          floorClickable={(i) => isMe && myTurn && one?.kind === "dog" && !p.tower[i]?.dog}
          onFloorClick={(i) => one && act({ type: "dog", card: one.id, floor: i })}
          topHighlight={!!ta && (one?.kind === "hammer" || one?.kind === "wrecking")}
        />
        <div className="mt-1 flex max-w-full items-center gap-0.5">
          <span className="text-sm">{isMe ? "⭐" : p.isBot ? "🤖" : "🧑"}</span>
          <span className="truncate text-[11px] font-extrabold text-white">{isMe ? "Вы" : p.name}</span>
        </div>
        <div className="text-[10px] font-semibold text-white/80">
          {p.tower.length}/{state.target} · 🃏{isMe ? p.hand.length : p.handCount}
        </div>
        {isCur && <span className="mt-0.5 rounded bg-sun px-1.5 text-[9px] font-extrabold uppercase text-ink">ходит</span>}
        {p.milkshake && <span className="text-[10px] font-bold">🥤 пропуск</span>}
        {ta && (
          <button className="btn btn-sun mt-1 w-full !min-h-8 !px-1 !py-1 text-[10px]" disabled={busy} onClick={() => act(ta)}>
            {TARGET_LABEL[one!.kind]}
          </button>
        )}
        {sIdx !== null && (
          <button
            className="btn btn-sun mt-1 w-full !min-h-8 !px-1 !py-1 text-[10px]"
            disabled={busy}
            onClick={() => one && act({ type: "steal", card: one.id, target: p.id, stealIdx: sIdx })}
          >
            🃏 Украсть «{stealVal}»
          </button>
        )}
        {state.phase === "finished" && p.hand.length > 0 && (
          <div className="mt-1 flex max-w-full flex-wrap justify-center gap-0.5">
            {p.hand.map((c) => (
              <CardView key={c.id} card={c} size="xs" />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderFullOpp(opp: Player) {
    const isCur = state.phase === "playing" && current?.id === opp.id;
    const top = opp.tower[opp.tower.length - 1];
    const ta = myTurn ? targetAction(opp) : null;
    const canStealIdx = (ci: number) => stealIdxFor(opp) === ci;
    const sIdx = stealIdxFor(opp);
    return (
      <div
        key={opp.id}
        className={`panel flex gap-3 p-3 transition ${isCur ? "ring-4 ring-sun" : ""} ${state.winnerId === opp.id ? "ring-4 ring-green-400" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{opp.isBot ? "🤖" : "🧑"}</span>
            <span className="truncate font-extrabold text-white">{opp.name}</span>
            {opp.isBot && (
              <span className="shrink-0 rounded bg-ink/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {BOT_LEVEL_NAMES[opp.level ?? 2]}
              </span>
            )}
            {isCur && <span className="rounded bg-sun px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-ink">ходит</span>}
          </div>
          <div className="text-xs font-semibold">
            Этажей: <b className="text-white">{opp.tower.length}</b> / {state.target} · Карт:{" "}
            <b className="text-white">{opp.handCount}</b>
          </div>
          {state.phase === "finished" ? (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase text-white/80">На руках было:</div>
              {opp.hand.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {opp.hand.map((c) => (
                    <CardView key={c.id} card={c} size="sm" />
                  ))}
                </div>
              ) : (
                <div className="text-xs font-semibold text-ink/70">Рука пуста</div>
              )}
            </div>
          ) : (
            <div className="flex -space-x-4">
              {Array.from({ length: Math.min(opp.handCount, 10) }).map((_, i) => (
                <CardBack key={i} size="xs" />
              ))}
            </div>
          )}
          {opp.milkshake && (
            <div className="flex items-center gap-2 text-xs font-bold">
              <CardView card={opp.milkshake} size="xs" /> Пропустит ход
            </div>
          )}
          {ta && (
            <button className="btn btn-sun pulse-ring mt-auto !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act(ta)}>
              {TARGET_LABEL[one!.kind]}
            </button>
          )}
          {sIdx !== null && (
            <button
              className="btn btn-sun pulse-ring mt-auto !px-3 !py-1.5 text-xs"
              disabled={busy}
              onClick={() => one && act({ type: "steal", card: one.id, target: opp.id, stealIdx: sIdx })}
            >
              🃏 Украсть «{top?.cards[sIdx].value}»
            </button>
          )}
          {opponentExtra?.(opp)}
        </div>
        <Tower
          floors={opp.tower}
          target={state.target}
          size="xs"
          stealable={canStealIdx}
          onSteal={(ci) => one && act({ type: "steal", card: one.id, target: opp.id, stealIdx: ci })}
          topHighlight={!!ta && (one?.kind === "hammer" || one?.kind === "wrecking")}
        />
      </div>
    );
  }

  const logLines = (ref: typeof logRef) => (
    <div ref={ref} className="scroll-thin h-full overflow-y-auto px-3 py-2 text-[13px]">
      {state.log.map((l) => (
        <div
          key={l.id}
          className={
            l.tone === "turn"
              ? "mt-1 font-bold text-sun"
              : l.tone === "good"
                ? "text-green-300"
                : l.tone === "bad"
                  ? "text-rose-300"
                  : "text-white/80"
          }
        >
          {l.tone === "turn" ? "▸ " : "· "}
          {l.text}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex h-dvh max-w-7xl flex-col overflow-hidden md:h-auto md:min-h-screen md:overflow-visible md:gap-4 md:px-5 md:py-4">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-30 flex items-center gap-2 bg-night/85 px-3 py-2 backdrop-blur-md md:static md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <Link href="/" className="title-3d shrink-0 text-xl md:text-3xl">
          ВЫСОТКИ
        </Link>
        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          {myTurn ? (
            <span className="rounded-full bg-sun px-2.5 py-1 font-display text-[10px] text-ink md:text-xs">ВАШ ХОД</span>
          ) : state.phase === "playing" ? (
            <span className="max-w-[7.5rem] truncate rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold md:max-w-none md:text-xs">
              {current?.name}
            </span>
          ) : null}
          <span className="hidden rounded-full bg-white/10 px-3 py-1 text-sm font-semibold md:inline">Цель: {state.target} эт.</span>
          <div className="hidden items-center gap-2 md:flex">
            {headerExtra}
            <button className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => setShowRules(true)}>
              📖 Правила
            </button>
            <SoundToggle />
          </div>
          <button
            className="btn btn-ghost !min-h-10 !px-3 !py-1.5 text-lg md:hidden"
            onClick={() => setShowMenu(true)}
            aria-label="Меню"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Scrollable table */}
      <div className="mobile-board-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-1 md:overflow-visible md:px-0">
        {/* Mobile skyline */}
        <div className="flex shrink-0 items-center justify-between px-1 pt-1 text-[10px] font-semibold text-white/60 md:hidden">
          <span>ЭТАЖИ · СВАЙП ↑↓</span>
          <span>ИГРОКИ · ← →</span>
        </div>
        <section className="mobile-skyline flex shrink-0 items-start gap-1.5 overflow-x-auto overscroll-x-contain pb-2 md:hidden">{skyline.map(renderMini)}</section>

        {/* Desktop opponents */}
        <section
          className={`hidden gap-3 md:grid ${opponents.length >= 3 ? "md:grid-cols-3" : opponents.length === 2 ? "md:grid-cols-2" : ""}`}
        >
          {opponents.map(renderFullOpp)}
        </section>

        {/* Table centre */}
        <section className="shrink-0 grid gap-2 md:grid-cols-[auto_1fr] md:gap-3">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 md:gap-4 md:px-5 md:py-3">
            <div className="flex flex-col items-center gap-0.5">
              {state.deckCount > 0 ? <CardBack size="xs" /> : <div className="h-10 w-7 rounded border-2 border-dashed border-white/30" />}
              <span className="text-[10px] font-semibold text-white/70">{state.deckCount}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              {discardTop ? (
                <CardView key={discardTop.id} card={discardTop} size="xs" className="pop-in" />
              ) : (
                <div className="h-10 w-7 rounded border-2 border-dashed border-white/30" />
              )}
              <span className="text-[10px] font-semibold text-white/70">{state.discard.length}</span>
            </div>
            {state.van && (
              <div className="flex flex-col items-center gap-0.5">
                <CardView card={state.van} size="xs" className="pop-in" />
                <span className="text-[10px] font-semibold text-sun">ещё ход</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowLog(true)}
            className="flex h-10 items-center gap-2 overflow-hidden rounded-2xl border border-white/15 bg-black/25 px-3 text-left text-[12px] font-semibold md:hidden"
          >
            <span className="min-w-0 flex-1 truncate text-white/85">{lastLog ? lastLog.text : "Журнал пуст"}</span>
            <span className="shrink-0 text-white/50">▴</span>
          </button>
          <div className="hidden h-28 rounded-2xl border border-white/15 bg-black/25 md:block">{logLines(logRef)}</div>
        </section>
      </div>

      {/* Me / hand */}
      {me && (
        <section
          className={`panel z-20 flex flex-col gap-2 rounded-b-none p-2 pb-safe md:relative md:mt-auto md:flex-row md:gap-4 md:rounded-[14px] md:p-4 ${
            myTurn ? "ring-2 ring-sun md:ring-4" : ""
          }`}
        >
          <div className="hidden flex-col items-center gap-2 md:flex md:w-36">
            <div className="text-center">
              <div className="font-extrabold text-white">{me.name} (вы)</div>
              <div className="text-xs font-semibold">
                Этажей: <b className="text-white">{me.tower.length}</b> / {state.target}
              </div>
            </div>
            <Tower
              floors={me.tower}
              target={state.target}
              size="sm"
              floorClickable={(i) => myTurn && one?.kind === "dog" && !me.tower[i]?.dog}
              onFloorClick={(i) => one && act({ type: "dog", card: one.id, floor: i })}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-3">
            <div className="hidden items-center justify-between gap-2 md:flex">
              <h3 className="text-base">Ваши карты ({hand.length})</h3>
              {myTurn ? (
                <span className="rounded-full bg-sun px-3 py-1 font-display text-xs text-ink">ВАШ ХОД</span>
              ) : state.phase === "playing" ? (
                <span className="rounded-full bg-ink/30 px-3 py-1 text-xs font-bold text-white">Ходит {current?.name}</span>
              ) : null}
            </div>
            <div className="hand-row min-h-[5.6rem] md:min-h-[8rem]">
              {hand.map((c, i) => (
                <div key={c.id} className={`hand-card pop-in ${sel.includes(c.id) ? "is-sel" : ""}`} style={{ zIndex: sel.includes(c.id) ? 10 : i }}>
                  <CardView card={c} size="md" selected={sel.includes(c.id)} onClick={() => toggle(c)} />
                </div>
              ))}
              {hand.length === 0 && <div className="px-3 text-sm font-semibold text-ink/70">Рука пуста</div>}
            </div>
            <div className="truncate rounded-lg bg-ink/15 px-3 py-1.5 text-[12px] font-semibold text-ink md:min-h-[2.5rem] md:py-2 md:text-[13px]">
              {one && <b className="text-white">{one.kind === "floor" ? `«${one.value}»` : CARD_NAMES[one.kind]}: </b>}
              {hint}
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">{actionButtons}</div>
          </div>
        </section>
      )}

      {/* Error toast */}
      {error && (
        <div
          className="fixed left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border-2 border-ink bg-brick px-4 py-3 text-center font-bold text-white shadow-2xl"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8.5rem)" }}
          onClick={onClearError}
        >
          {error}
        </div>
      )}

      {/* Winner */}
      {state.phase === "finished" && !hideWinner && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
          <div className="panel pop-in w-full max-w-md rounded-b-none p-5 pb-safe text-center md:rounded-[14px] md:p-6">
            <div className="mb-2 text-5xl md:text-6xl">{winner?.id === meId ? "🏆" : "🏙️"}</div>
            <h2 className="title-3d mb-2 text-2xl md:text-3xl">{winner?.id === meId ? "ПОБЕДА!" : "ИГРА ОКОНЧЕНА"}</h2>
            <p className="mb-2 font-semibold">
              {winner?.id === meId
                ? "Вы первым построили высотку!"
                : `${winner?.name ?? "Кто-то"} первым построил высотку из ${state.target} этажей.`}
            </p>
            <p className="mb-5 text-sm font-semibold text-ink/75">🃏 Карты на руках вскрыты — смотрите стол.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center [&_.btn]:w-full sm:[&_.btn]:w-auto">
              {finishedActions}
              <button className="btn btn-lav" onClick={() => setHiddenAt(state.logSeq)}>
                Посмотреть стол
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu sheet (mobile) */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setShowMenu(false)}>
          <div className="panel absolute inset-x-0 bottom-0 rounded-b-none p-4 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg">Меню</h2>
              <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => setShowMenu(false)}>
                ✕
              </button>
            </div>
            <div className="mb-3 text-sm font-semibold">Цель: {state.target} этажей</div>
            {headerExtra && <div className="mb-3 flex flex-wrap gap-2">{headerExtra}</div>}
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-sun w-full"
                onClick={() => {
                  setShowMenu(false);
                  setShowRules(true);
                }}
              >
                📖 Правила
              </button>
              <div className="flex items-center justify-between rounded-xl bg-white/25 px-3 py-2">
                <span className="text-sm font-extrabold">Звук</span>
                <SoundToggle />
              </div>
              <Link href="/" className="btn btn-lav w-full">
                На главную
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Log sheet */}
      {showLog && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowLog(false)}>
          <div className="panel absolute inset-x-0 bottom-0 flex h-[70vh] flex-col rounded-b-none p-0 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-lg">Журнал</h2>
              <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => setShowLog(false)}>
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">{logLines(logSheetRef)}</div>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-night/95 p-3 pt-safe md:p-4" onClick={() => setShowRules(false)}>
          <div className="mx-auto max-w-7xl pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-night/90 py-2 backdrop-blur">
              <h2 className="title-3d text-2xl md:text-3xl">ПРАВИЛА</h2>
              <button className="btn btn-sun" onClick={() => setShowRules(false)}>
                ✕ Закрыть
              </button>
            </div>
            <RulesContent />
          </div>
        </div>
      )}
    </div>
  );
}
