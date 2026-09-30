"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BotLevel, GameAction, GameState, LobbyAction } from "@/lib/game/types";
import { BOT_LEVEL_NAMES } from "@/lib/game/types";
import { GameBoard } from "./GameBoard";
import { NAME_KEY, tokenKey } from "./ModeSelect";
import { GameInfoBadges } from "./Rules";
import { SoundToggle } from "./SoundToggle";
import { playSfx } from "@/lib/sound";

interface RoomData {
  code: string;
  me: string | null;
  state: GameState;
}

const POLL_MS = 1000;

export function RoomClient({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<RoomData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [newBotLevel, setNewBotLevel] = useState<BotLevel>(2);
  const versionRef = useRef(-1);
  const playerCount = useRef<number | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(tokenKey(code)));
    setName(localStorage.getItem(NAME_KEY) ?? "");
    setReady(true);
  }, [code]);

  const accept = useCallback((d: RoomData) => {
    const v = d.state.version ?? 0;
    if (v < versionRef.current) return;
    versionRef.current = v;
    if (d.state.phase === "lobby") {
      const n = d.state.players.length;
      if (playerCount.current !== null && n > playerCount.current) playSfx("join");
      playerCount.current = n;
    }
    setData(d);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}${token ? `?token=${encodeURIComponent(token)}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        setFatal(d.error ?? "Комната не найдена");
        return;
      }
      accept(d);
    } catch {
      /* network hiccup */
    }
  }, [code, token, accept]);

  useEffect(() => {
    if (!ready || fatal) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [ready, fatal, poll]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const n = name.trim() || "Игрок";
      localStorage.setItem(NAME_KEY, n);
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, token }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Ошибка");
      localStorage.setItem(tokenKey(code), d.token);
      setToken(d.token);
      accept(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const send = useCallback(
    async (action: GameAction | LobbyAction) => {
      if (!token) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/rooms/${code}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Ошибка");
        accept(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    },
    [code, token, accept],
  );

  const clearError = useCallback(() => setError(null), []);

  if (fatal) {
    return (
      <Center>
        <div className="panel max-w-md p-6 text-center">
          <h2 className="mb-2 text-2xl">Упс!</h2>
          <p className="mb-4 font-semibold">{fatal}</p>
          <Link href="/" className="btn btn-sun">
            На главную
          </Link>
        </div>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center>
        <div className="font-display text-2xl">Подключаемся к комнате {code}…</div>
      </Center>
    );
  }

  const { state, me } = data;
  const isHost = me === state.hostId;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (state.phase === "lobby") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-3 py-5 pb-safe sm:gap-6 sm:px-4 sm:py-8">
        <header className="flex items-center justify-between gap-2">
          <Link href="/" className="title-3d text-2xl sm:text-3xl">
            ВЫСОТКИ
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block">
              <GameInfoBadges />
            </div>
            <SoundToggle compact />
          </div>
        </header>

        <section className="panel p-4 sm:p-6">
          <h2 className="mb-1 text-lg sm:text-xl">Комната</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-display text-3xl tracking-[0.18em] text-white drop-shadow-[3px_3px_0_#1b2350] sm:text-5xl sm:tracking-[0.2em]">{code}</div>
            <button className="btn btn-sun w-full !py-2 text-sm sm:w-auto" onClick={copy}>
              {copied ? "✓ Скопировано" : "🔗 Скопировать ссылку"}
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold">Отправьте друзьям код или ссылку-приглашение. В комнате может быть до 4 игроков.</p>
        </section>

        {!me && (
          <section className="panel flex flex-col gap-3 p-6">
            <h2 className="text-xl">Присоединиться</h2>
            <input className="input" value={name} maxLength={20} placeholder="Ваше имя" onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-sun" onClick={join} disabled={busy || state.players.length >= 4}>
              {state.players.length >= 4 ? "Комната заполнена" : "Сесть за стол"}
            </button>
          </section>
        )}

        <section className="panel flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Игроки ({state.players.length}/4)</h2>
            <span className="rounded-full bg-ink/20 px-3 py-1 text-xs font-bold text-white">Цель: {state.target} этажей</span>
          </div>
          <ul className="flex flex-col gap-2">
            {state.players.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/30 px-3 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-4">
                <span className="text-xl">{p.isBot ? "🤖" : "🧑"}</span>
                <span className="flex-1 font-extrabold">
                  {p.name}
                  {p.id === me && <span className="ml-2 text-xs font-bold text-white">(вы)</span>}
                  {p.id === state.hostId && <span className="ml-2 rounded bg-sun px-1.5 py-0.5 text-[10px] uppercase">создатель</span>}
                </span>
                {p.isBot && (
                  <span className="rounded bg-ink/20 px-2 py-0.5 text-[11px] font-bold text-white">
                    {BOT_LEVEL_NAMES[p.level ?? 2]}
                  </span>
                )}
                {isHost && p.id !== state.hostId && (
                  <div className="flex items-center gap-2">
                    {p.isBot && (
                      <select
                        className="rounded-lg border-2 border-ink bg-white px-2 py-1 text-xs font-bold text-ink"
                        value={p.level ?? 2}
                        onChange={(e) => send({ type: "setLevel", playerId: p.id, level: Number(e.target.value) as BotLevel })}
                      >
                        <option value={1}>Лёгкий</option>
                        <option value={2}>Средний</option>
                        <option value={3}>Тяжёлый</option>
                      </select>
                    )}
                    <button className="text-sm font-bold text-brick hover:underline" onClick={() => send({ type: "removePlayer", playerId: p.id })}>
                      Убрать
                    </button>
                  </div>
                )}
              </li>
            ))}
            {Array.from({ length: 4 - state.players.length }).map((_, i) => (
              <li key={`e${i}`} className="rounded-xl border-2 border-dashed border-ink/30 px-4 py-2.5 text-sm font-semibold text-ink/60">
                Свободное место
              </li>
            ))}
          </ul>
          {isHost ? (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex gap-2">
                {[5, 4].map((t) => (
                  <button
                    key={t}
                    onClick={() => send({ type: "setTarget", target: t })}
                    className={`flex-1 rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-extrabold ${state.target === t ? "bg-sun" : "bg-white/40"}`}
                  >
                    {t === 5 ? "5 этажей" : "4 этажа (короткая)"}
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase">Сложность нового бота</div>
                <LevelPicker value={newBotLevel} onChange={setNewBotLevel} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-lav"
                  disabled={busy || state.players.length >= 4}
                  onClick={() => send({ type: "addBot", level: newBotLevel })}
                >
                  + Добавить бота
                </button>
                <button className="btn btn-sun flex-1" disabled={busy || state.players.length < 2} onClick={() => send({ type: "start" })}>
                  {state.players.length < 2 ? "Нужно минимум 2 игрока" : "Начать игру ▶"}
                </button>
              </div>
            </div>
          ) : (
            me && <p className="mt-2 text-center font-bold text-white">Ждём, пока создатель комнаты начнёт игру…</p>
          )}
        </section>
        {error && <div className="rounded-lg bg-brick px-4 py-2 font-bold">{error}</div>}
      </main>
    );
  }

  return (
    <GameBoard
      state={state}
      meId={me}
      onAction={send}
      busy={busy}
      error={error}
      onClearError={clearError}
      headerExtra={
        <>
          <button className="rounded-full bg-white/10 px-3 py-1 font-display tracking-widest hover:bg-white/20" onClick={copy} title="Скопировать ссылку">
            {copied ? "✓" : "#"} {code}
          </button>
          {!me && <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">Вы зритель</span>}
        </>
      }
      opponentExtra={
        isHost && state.phase === "playing"
          ? (p) =>
              !p.isBot ? (
                <button
                  className="text-left text-[11px] font-bold text-ink/70 hover:text-brick hover:underline"
                  onClick={() => {
                    if (confirm(`Заменить игрока ${p.name} ботом? (если он отключился)`)) send({ type: "replaceWithBot", playerId: p.id });
                  }}
                >
                  Заменить ботом
                </button>
              ) : null
          : undefined
      }
      finishedActions={
        <>
          {isHost ? (
            <button className="btn btn-sun" onClick={() => send({ type: "restart" })} disabled={busy}>
              Реванш!
            </button>
          ) : (
            <span className="self-center text-sm font-bold text-white">Создатель может начать реванш</span>
          )}
          <Link href="/" className="btn btn-lav">
            В меню
          </Link>
        </>
      }
    />
  );
}

function LevelPicker({ value, onChange }: { value: BotLevel; onChange: (v: BotLevel) => void }) {
  const opts: BotLevel[] = [1, 2, 3];
  return (
    <div className="flex gap-1.5">
      {opts.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`min-h-11 flex-1 rounded-lg border-2 border-ink px-3 py-2 text-sm font-extrabold transition ${
            value === l ? "bg-sun text-ink" : "bg-white/40 text-ink hover:bg-white/70"
          }`}
        >
          {BOT_LEVEL_NAMES[l]}
        </button>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-4">{children}</div>;
}
