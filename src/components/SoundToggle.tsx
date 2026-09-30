"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getServerSoundSettings,
  getSoundSettings,
  installAudioUnlock,
  playSfx,
  setSoundSettings,
  subscribeSound,
} from "@/lib/sound";

export function useSoundSettings() {
  return useSyncExternalStore(subscribeSound, getSoundSettings, getServerSoundSettings);
}

export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const s = useSoundSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const off = s.muted || s.volume === 0;
  const icon = off ? "🔇" : s.volume < 0.4 ? "🔈" : s.volume < 0.75 ? "🔉" : "🔊";

  return (
    <div ref={ref} className="relative">
      <button
        className="btn btn-ghost !px-3 !py-1.5 text-xs"
        onClick={() => setOpen((o) => !o)}
        title={off ? "Звук выключен" : "Звук"}
        aria-label="Настройки звука"
      >
        {icon}
        {!compact && <span className="hidden sm:inline"> Звук</span>}
      </button>
      {open && (
        <div className="panel pop-in absolute right-0 top-full z-50 mt-2 w-60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-extrabold uppercase text-white">Звук</span>
            <button
              onClick={() => {
                setSoundSettings({ muted: !s.muted });
                if (s.muted) setTimeout(() => playSfx("click"), 30);
              }}
              className={`rounded-full border-2 border-ink px-3 py-0.5 text-xs font-extrabold ${
                s.muted ? "bg-white/40 text-ink" : "bg-sun text-ink"
              }`}
            >
              {s.muted ? "Выкл" : "Вкл"}
            </button>
          </div>
          <label className="block text-xs font-bold uppercase">
            Громкость: {Math.round(s.volume * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(s.volume * 100)}
              disabled={s.muted}
              onChange={(e) => setSoundSettings({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => playSfx("myTurn")}
              onKeyUp={() => playSfx("click")}
              className="mt-2 w-full accent-[#f6d23c] disabled:opacity-40"
            />
          </label>
          <button className="btn btn-sun mt-3 w-full !py-1.5 text-xs" disabled={s.muted} onClick={() => playSfx("build")}>
            ▶ Проверить звук
          </button>
        </div>
      )}
    </div>
  );
}
