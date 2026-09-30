"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameError, addBot, applyAction, createLobby, startGame, viewFor } from "@/lib/game/engine";
import { botAction } from "@/lib/game/bot";
import type { BotLevel, GameAction, GameState } from "@/lib/game/types";
import { GameBoard } from "./GameBoard";
import { NAME_KEY } from "./ModeSelect";
import { SoundToggle } from "./SoundToggle";

const ME = "me";
const BOT_DELAY = 950;

function newGame(name: string, bots: number, target: number, level: BotLevel): GameState {
  const s = createLobby(ME, name, target);
  for (let i = 0; i < bots; i++) addBot(s, level);
  return startGame(s);
}

/** localStorage is only available in the browser. */
function savedName(): string {
  if (typeof window === "undefined") return "Игрок";
  return localStorage.getItem(NAME_KEY) || "Игрок";
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { v: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`min-h-11 flex-1 rounded-lg border-2 border-ink px-3 py-2 text-sm font-extrabold transition ${
            value === o.v ? "bg-sun text-ink" : "bg-white/40 text-ink hover:bg-white/70"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LevelPicker({ value, onChange }: { value: BotLevel; onChange: (v: number) => void }) {
  const hints: Record<BotLevel, string> = {
    1: "Боты в основном строят этажи и изредка играют особые карты — хорошо для первого знакомства с правилами.",
    2: "Боты строят, крадут и разрушают, но иногда ошибаются.",
    3: "Боты действуют слаженно: воруют карты, крадут этажи, сбивают лидера молотком, шар-бабой и коктейлями.",
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Seg
        value={value}
        onChange={onChange}
        options={[
          { v: 1, label: "Лёгкий" },
          { v: 2, label: "Средний" },
          { v: 3, label: "Тяжёлый" },
        ]}
      />
      <p className="text-[12.5px] font-medium text-ink/80">{hints[value]}</p>
    </div>
  );
}

export function LocalGame({
  bots: initBots,
  target: initTarget,
  level: initLevel,
}: {
  bots: number;
  target: number;
  level: BotLevel;
}) {
  const router = useRouter();
  const validParams = initBots > 0 && (initTarget === 4 || initTarget === 5) && initLevel >= 1;
  const [session, setSession] = useState<{ bots: number; target: number; level: BotLevel; key: number } | null>(() =>
    validParams ? { bots: initBots, target: initTarget, level: initLevel, key: 0 } : null,
  );

  if (!session) {
    return (
      <BotSetup
        initial={{ bots: initBots > 0 ? initBots : 2, target: initTarget === 4 ? 4 : 5, level: initLevel ?? 2 }}
        onStart={(bots, target, level) => {
          const name = (localStorage.getItem(NAME_KEY) || "").trim() || "Игрок";
          localStorage.setItem(NAME_KEY, name);
          router.push(`/bots?n=${bots}&t=${target}&d=${level}`);
          setSession({ bots, target, level, key: 0 });
        }}
      />
    );
  }

  return (
    <BotGame
      key={session.key}
      bots={session.bots}
      target={session.target}
      level={session.level}
      onRestart={() => setSession((s) => (s ? { ...s, key: s.key + 1 } : s))}
      onSettings={() => {
        setSession(null);
        router.push("/bots");
      }}
    />
  );
}

function BotSetup({
  initial,
  onStart,
}: {
  initial: { bots: number; target: number; level: BotLevel };
  onStart: (bots: number, target: number, level: BotLevel) => void;
}) {
  const [name, setName] = useState("");
  const [bots, setBots] = useState(initial.bots);
  const [target, setTarget] = useState<4 | 5>(initial.target === 4 ? 4 : 5);
  const [level, setLevel] = useState<BotLevel>(initial.level);
  const saved = typeof window !== "undefined" ? (localStorage.getItem(NAME_KEY) ?? "") : "";
  const displayName = name.trim() || saved || "Игрок";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-3 py-5 pb-safe sm:gap-5 sm:px-4 sm:py-8">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="title-3d text-2xl sm:text-3xl">
          ВЫСОТКИ
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-white/10 px-3 py-1 font-semibold sm:inline">🤖 Против ботов</span>
          <SoundToggle compact />
        </div>
      </header>
      <section className="panel flex flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl">Настройка игры</h1>
        <label className="block">
          <span className="mb-1 block text-sm font-extrabold uppercase text-white">Ваше имя</span>
          <input
            className="input"
            value={name}
            maxLength={20}
            placeholder={saved || "Игрок"}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div>
          <div className="mb-1 text-xs font-bold uppercase">Соперников</div>
          <Seg value={bots} onChange={setBots} options={[{ v: 1, label: "1" }, { v: 2, label: "2" }, { v: 3, label: "3" }]} />
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase">Сложность ботов</div>
          <LevelPicker value={level} onChange={(v) => setLevel(v as BotLevel)} />
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase">Высотка</div>
          <Seg
            value={target}
            onChange={(v) => setTarget((v === 4 ? 4 : 5))}
            options={[
              { v: 5, label: "5 этажей" },
              { v: 4, label: "4 (короткая)" },
            ]}
          />
        </div>
        <button className="btn btn-sun mt-1" onClick={() => onStart(bots, target, level)}>
          Начать игру ▶
        </button>
        <p className="text-center text-xs font-semibold text-ink/70">Играете как «{displayName}»</p>
      </section>
    </main>
  );
}

function BotGame({
  bots,
  target,
  level,
  onRestart,
  onSettings,
}: {
  bots: number;
  target: number;
  level: BotLevel;
  onRestart: () => void;
  onSettings: () => void;
}) {
  const [state, setState] = useState<GameState>(() => newGame(savedName(), bots, target, level));
  const [error, setError] = useState<string | null>(null);
  const botLevel = state.players[state.current]?.isBot ? (state.players[state.current].level ?? level) : null;

  // Bot turns
  useEffect(() => {
    if (botLevel === null || state.phase !== "playing") return;
    const id = setTimeout(() => {
      setState((prev) => {
        if (prev.phase !== "playing") return prev;
        const bot = prev.players[prev.current];
        if (!bot?.isBot) return prev;
        try {
          return applyAction(prev, bot.id, botAction(prev, bot.level ?? level));
        } catch {
          return applyAction(prev, bot.id, { type: "endTurn" });
        }
      });
    }, BOT_DELAY);
    return () => clearTimeout(id);
  }, [botLevel, state, level]);

  const onAction = (a: GameAction) => {
    try {
      setState(applyAction(state, ME, a));
    } catch (e) {
      setError(e instanceof GameError ? e.message : "Ошибка");
    }
  };

  const levelLabel = ["", "Лёгкий", "Средний", "Тяжёлый"][level];

  return (
    <GameBoard
      state={viewFor(state, ME)}
      meId={ME}
      onAction={onAction}
      error={error}
      onClearError={() => setError(null)}
      headerExtra={
        <>
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">🤖 Боты: {levelLabel}</span>
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onSettings}>
            ⚙ Настройки
          </button>
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onRestart}>
            ↻ Заново
          </button>
        </>
      }
      finishedActions={
        <>
          <button className="btn btn-sun" onClick={onRestart}>
            Сыграть ещё
          </button>
          <button className="btn btn-lav" onClick={onSettings}>
            Изменить настройки
          </button>
          <Link href="/" className="btn btn-lav">
            В меню
          </Link>
        </>
      }
    />
  );
}
