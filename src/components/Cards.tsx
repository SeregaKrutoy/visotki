"use client";

import type { Card, CardKind, Floor } from "@/lib/game/types";
import { CARD_HINTS, CARD_NAMES } from "@/lib/game/engine";

export type CardSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<CardSize, { box: string; corner: string; icon: string; label: string }> = {
  xs: { box: "w-7 h-10 rounded-[4px]", corner: "text-[7px] w-2.5 h-2.5", icon: "text-sm", label: "hidden" },
  sm: { box: "w-10 h-14 rounded-md", corner: "text-[9px] w-3.5 h-3.5", icon: "text-xl", label: "hidden" },
  md: { box: "w-[3.55rem] h-[5.1rem] md:w-20 md:h-28 rounded-lg", corner: "text-[10px] w-3.5 h-3.5 md:text-[11px] md:w-4 md:h-4", icon: "text-3xl md:text-4xl", label: "text-[7px] md:text-[8px]" },
  lg: { box: "w-28 h-40 rounded-xl", corner: "text-sm w-6 h-6", icon: "text-6xl", label: "text-[10px]" },
};

const FLOOR_ICONS = ["", "🪴", "🛋️", "🧍", "🐈", "🪑", "📚", "🛏️", "🎸"];

const SPECIAL_ICONS: Record<Exclude<CardKind, "floor" | "joker">, string> = {
  dog: "🐕",
  bone: "🦴",
  hammer: "🔨",
  wrecking: "",
  thief: "🥷",
  superthief: "🕵️",
  milkshake: "🥤",
  van: "🚐",
};

function WreckingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 50" className={className} aria-hidden>
      <line x1="20" y1="0" x2="20" y2="22" stroke="#111" strokeWidth="2.5" strokeDasharray="3 2" />
      <circle cx="20" cy="34" r="14" fill="#111" />
      <circle cx="15" cy="29" r="4" fill="#fff" opacity="0.35" />
    </svg>
  );
}

interface CardProps {
  card: Card;
  size?: CardSize;
  selected?: boolean;
  highlight?: boolean;
  dim?: boolean;
  value?: number;
  onClick?: () => void;
  className?: string;
}

export function CardView({ card, size = "md", selected, highlight, dim, value, onClick, className = "" }: CardProps) {
  const s = SIZES[size];
  const ring = selected
    ? "ring-4 ring-sun -translate-y-1 md:-translate-y-3"
    : highlight
      ? "ring-2 ring-sun pulse-ring"
      : "";
  const base = `relative shrink-0 overflow-hidden border-2 border-ink shadow-md transition-transform duration-150 no-callout ${s.box} ${ring} ${
    dim ? "opacity-40" : ""
  } ${onClick ? "cursor-pointer active:scale-95 md:hover:-translate-y-1" : ""} ${className}`;
  const title = card.kind === "floor" ? `Этаж «${card.value}»` : `${CARD_NAMES[card.kind]} — ${CARD_HINTS[card.kind]}`;

  if (card.kind === "floor" || card.kind === "joker") {
    const isJoker = card.kind === "joker";
    const shown = isJoker ? (value !== undefined ? `${value}` : "?") : `${card.value}`;
    return (
      <div className={`${base} bg-[#141414]`} onClick={onClick} title={title}>
        <div className={`absolute left-[6%] top-[5%] ${s.corner} flex items-center justify-center rounded-[2px] font-extrabold leading-none ${isJoker ? "bg-sun text-ink" : "bg-white text-black"}`}>
          {shown}
        </div>
        <div className={`absolute right-[6%] top-[5%] ${s.corner} flex items-center justify-center rounded-[2px] font-extrabold leading-none ${isJoker ? "bg-sun text-ink" : "bg-white text-black"}`}>
          {shown}
        </div>
        <div
          className={`absolute left-[14%] right-[14%] top-[24%] bottom-[8%] flex items-end justify-center overflow-hidden rounded-[3px] border border-black/60 ${
            isJoker ? "bg-[#2b2b35]" : "card-win"
          }`}
        >
          {/* window frame */}
          <div className="absolute inset-x-0 top-1/3 h-px bg-black/50" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-black/40" />
          {isJoker ? (
            <span className={`relative mb-auto mt-auto font-display text-sun ${s.icon}`}>?</span>
          ) : (
            <span className={`silhouette relative mb-[6%] ${s.icon} leading-none`}>{FLOOR_ICONS[card.value ?? 0]}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${base} flex flex-col bg-sun`} onClick={onClick} title={title}>
      <div className={`${s.label} bg-ink px-0.5 py-[1px] text-center font-extrabold uppercase leading-tight tracking-tight text-sun`}>
        {CARD_NAMES[card.kind]}
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        {card.kind === "wrecking" ? (
          <WreckingIcon className="h-3/4 w-3/4" />
        ) : (
          <span className={`silhouette ${s.icon} leading-none`}>{SPECIAL_ICONS[card.kind]}</span>
        )}
        {card.kind === "van" && <span className={`silhouette absolute right-[8%] top-[8%] ${size === "sm" || size === "xs" ? "text-[8px]" : "text-base"}`}>🍩</span>}
        {card.kind === "superthief" && (
          <span className="absolute bottom-[6%] right-[8%] rounded bg-ink px-1 text-[8px] font-extrabold text-sun">×ALL</span>
        )}
      </div>
    </div>
  );
}

export function CardBack({ size = "md", className = "" }: { size?: CardSize; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={`relative shrink-0 overflow-hidden border-2 border-ink bg-night-2 shadow-md ${s.box} ${className}`}>
      <div className="absolute inset-[8%] rounded-[3px] border border-lav/60 bg-[repeating-linear-gradient(45deg,rgba(143,150,207,0.18)_0_4px,transparent_4px_8px)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display text-sun ${size === "xs" || size === "sm" ? "text-xs" : "text-2xl"}`}>В</span>
      </div>
    </div>
  );
}

interface TowerProps {
  floors: Floor[];
  target: number;
  size?: "xs" | "sm";
  stealable?: (floorCardIdx: number) => boolean;
  onSteal?: (floorCardIdx: number) => void;
  floorClickable?: (floorIdx: number) => boolean;
  onFloorClick?: (floorIdx: number) => void;
  topHighlight?: boolean;
  hideEmpty?: boolean;
}

export function Tower({ floors, target, size = "sm", stealable, onSteal, floorClickable, onFloorClick, topHighlight, hideEmpty }: TowerProps) {
  const n = hideEmpty ? Math.max(floors.length, 1) : Math.max(target, floors.length);
  const slots = Array.from({ length: n });
  const complete = floors.length >= target;
  const slotBox = size === "xs" ? "h-10 w-[3.9rem]" : "h-14 w-[5.5rem]";
  return (
    <div className="flex flex-col items-center">
      {/* roof */}
      <div className={`mb-0.5 flex flex-col items-center ${complete ? "opacity-100" : "opacity-25"}`}>
        <div className="h-3 w-0.5 bg-sun" />
        <div className={`h-1.5 ${size === "xs" ? "w-10" : "w-14"} rounded-t bg-sun`} />
      </div>
      <div className="flex flex-col-reverse gap-0.5 rounded-md bg-black/25 p-1">
        {slots.map((_, i) => {
          const f = floors[i];
          const isTop = i === floors.length - 1;
          if (!f) {
            return (
              <div key={i} className={`${slotBox} flex items-center justify-center rounded border border-dashed border-white/20 text-[10px] text-white/30`}>
                {i + 1}
              </div>
            );
          }
          const clickable = floorClickable?.(i);
          return (
            <div
              key={i}
              className={`pop-in relative flex items-center gap-0.5 rounded px-0.5 ${clickable ? "cursor-pointer ring-2 ring-sun pulse-ring" : ""} ${
                isTop && topHighlight ? "ring-2 ring-red-400" : ""
              }`}
              onClick={clickable ? () => onFloorClick?.(i) : undefined}
            >
              {f.cards.map((fc, ci) => {
                const canSteal = isTop && !!stealable?.(ci);
                return (
                  <CardView
                    key={fc.card.id}
                    card={fc.card}
                    value={fc.value}
                    size={size}
                    highlight={canSteal}
                    onClick={canSteal ? () => onSteal?.(ci) : undefined}
                  />
                );
              })}
              {f.dog && (
                <div
                  className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-sun text-sm shadow"
                  title="Этаж охраняет собака"
                >
                  <span className="silhouette">🐕</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={`${size === "xs" ? "w-[4.4rem]" : "w-24"} h-1.5 rounded-b bg-lav-3`} />
    </div>
  );
}
