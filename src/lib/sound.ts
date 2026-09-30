"use client";

import type { SfxKind } from "./game/types";

/**
 * Procedural sound effects for «Высотки», synthesized with the Web Audio API.
 * No audio files are required — every sound is built from oscillators and noise.
 */

export type SoundName =
  | Exclude<SfxKind, "turn" | "win">
  | "myTurn"
  | "otherTurn"
  | "win"
  | "lose"
  | "click"
  | "unclick"
  | "button"
  | "join"
  | "error";

export interface SoundSettings {
  muted: boolean;
  volume: number; // 0..1
}

const STORAGE_KEY = "vysotki:sound";
const DEFAULT_SETTINGS: SoundSettings = { muted: false, volume: 0.7 };

let settings: SoundSettings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function loadSettings() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SoundSettings>;
      settings = {
        muted: !!p.muted,
        volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : DEFAULT_SETTINGS.volume,
      };
    }
  } catch {
    /* ignore broken storage */
  }
}

export function getSoundSettings(): SoundSettings {
  loadSettings();
  return settings;
}

export function getServerSoundSettings(): SoundSettings {
  return DEFAULT_SETTINGS;
}

export function setSoundSettings(patch: Partial<SoundSettings>) {
  loadSettings();
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  applyVolume();
  listeners.forEach((l) => l());
}

export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* ------------------------------------------------------------------ */
/* Audio graph                                                         */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function applyVolume() {
  if (!master || !ctx) return;
  const v = settings.muted ? 0 : settings.volume * settings.volume; // perceptual curve
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    // gentle limiter so stacked sounds never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    loadSettings();
    applyVolume();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

let unlockInstalled = false;
/** Browsers only allow audio after a user gesture — resume the context on the first one. */
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    audio();
    if (ctx?.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function envelope(c: AudioContext, t: number, d: number, v: number, a = 0.005): GainNode {
  const g = c.createGain();
  const attack = Math.min(a, d * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  g.connect(master!);
  return g;
}

interface ToneOpts {
  f: number;
  f2?: number;
  type?: OscillatorType;
  t: number;
  d: number;
  v: number;
  a?: number;
  lp?: number;
  bp?: number;
  q?: number;
  vib?: number;
  vibRate?: number;
}

function tone(c: AudioContext, o: ToneOpts) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, o.t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.d);
  let node: AudioNode = osc;
  if (o.lp || o.bp) {
    const fl = c.createBiquadFilter();
    fl.type = o.lp ? "lowpass" : "bandpass";
    fl.frequency.value = o.lp ?? o.bp!;
    fl.Q.value = o.q ?? 1;
    node.connect(fl);
    node = fl;
  }
  node.connect(envelope(c, o.t, o.d, o.v, o.a));
  if (o.vib) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vibRate ?? 6;
    lg.gain.value = o.vib;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(o.t);
    lfo.stop(o.t + o.d + 0.05);
  }
  osc.start(o.t);
  osc.stop(o.t + o.d + 0.05);
}

interface NoiseOpts {
  t: number;
  d: number;
  v: number;
  a?: number;
  type?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  lfoRate?: number;
  lfoDepth?: number;
}

function noise(c: AudioContext, o: NoiseOpts) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = o.type ?? "lowpass";
  fl.frequency.setValueAtTime(o.f ?? 2000, o.t);
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.d);
  fl.Q.value = o.q ?? 1;
  if (o.lfoRate && o.lfoDepth) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.lfoRate;
    lg.gain.value = o.lfoDepth;
    lfo.connect(lg).connect(fl.frequency);
    lfo.start(o.t);
    lfo.stop(o.t + o.d + 0.05);
  }
  src.connect(fl).connect(envelope(c, o.t, o.d, o.v, o.a));
  src.start(o.t, Math.random() * 0.5);
  src.stop(o.t + o.d + 0.05);
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const bell = (c: AudioContext, f: number, t: number, d: number, v: number) => {
  tone(c, { f, t, d, v, type: "sine" });
  tone(c, { f: f * 2.01, t, d: d * 0.6, v: v * 0.35, type: "sine" });
  tone(c, { f: f * 3.02, t, d: d * 0.3, v: v * 0.12, type: "sine" });
};

const thud = (c: AudioContext, t: number, v: number) => {
  tone(c, { f: 170, f2: 45, t, d: 0.22, v, type: "sine" });
  noise(c, { t, d: 0.06, v: v * 0.5, type: "lowpass", f: 900 });
};

const swoosh = (c: AudioContext, t: number, d: number, f1: number, f2: number, v = 0.35) =>
  noise(c, { t, d, v, a: d * 0.55, type: "bandpass", f: f1, f2, q: 1.4 });

const crumble = (c: AudioContext, t: number, d: number, v = 0.35) => {
  noise(c, { t, d, v, a: 0.02, type: "lowpass", f: 1100, f2: 180 });
  for (let i = 0; i < 7; i++) {
    const off = t + Math.random() * d * 0.8;
    noise(c, { t: off, d: 0.05 + Math.random() * 0.06, v: v * 0.6, type: "bandpass", f: 250 + Math.random() * 700, q: 3 });
  }
};

const clang = (c: AudioContext, t: number, v = 0.3) => {
  const partials: [number, number, number][] = [
    [523, 0.7, 1],
    [1187, 0.5, 0.6],
    [1873, 0.35, 0.45],
    [2651, 0.22, 0.3],
  ];
  for (const [f, d, k] of partials) tone(c, { f, t, d, v: v * k, type: "sine" });
  noise(c, { t, d: 0.05, v: v * 0.9, type: "highpass", f: 2500 });
};

const boom = (c: AudioContext, t: number, v = 0.6) => {
  tone(c, { f: 95, f2: 28, t, d: 0.9, v, type: "sine" });
  noise(c, { t, d: 0.7, v: v * 0.8, type: "lowpass", f: 500, f2: 90 });
};

const bark = (c: AudioContext, t: number, v = 0.3) => {
  tone(c, { f: 560, f2: 240, t, d: 0.13, v, type: "sawtooth", bp: 950, q: 2.5 });
  tone(c, { f: 280, f2: 160, t, d: 0.12, v: v * 0.6, type: "square", lp: 800 });
  noise(c, { t, d: 0.08, v: v * 0.5, type: "bandpass", f: 1600, q: 2 });
};

const riffle = (c: AudioContext, t: number) => {
  for (let i = 0; i < 9; i++) {
    noise(c, { t: t + i * 0.035, d: 0.04, v: 0.16, type: "highpass", f: 2500 + Math.random() * 1500 });
  }
};

const sparkle = (c: AudioContext, t: number) => {
  [2093, 2637, 3136].forEach((f, i) => tone(c, { f, t: t + i * 0.05, d: 0.25, v: 0.05, type: "sine" }));
};

/* ------------------------------------------------------------------ */
/* The sounds                                                          */
/* ------------------------------------------------------------------ */

const SOUNDS: Record<SoundName, (c: AudioContext, t: number) => void> = {
  click: (c, t) => tone(c, { f: 1500, f2: 950, t, d: 0.05, v: 0.18, type: "triangle" }),
  unclick: (c, t) => tone(c, { f: 800, f2: 520, t, d: 0.05, v: 0.14, type: "triangle" }),
  button: (c, t) => tone(c, { f: 480, f2: 620, t, d: 0.08, v: 0.14, type: "sine" }),
  join: (c, t) => {
    bell(c, 659, t, 0.4, 0.12);
    bell(c, 988, t + 0.12, 0.6, 0.12);
  },
  error: (c, t) => {
    tone(c, { f: 220, t, d: 0.11, v: 0.12, type: "square", lp: 1400 });
    tone(c, { f: 160, t: t + 0.12, d: 0.2, v: 0.12, type: "square", lp: 1400 });
  },

  myTurn: (c, t) => [784, 988, 1319].forEach((f, i) => bell(c, f, t + i * 0.09, 0.9, 0.2)),
  otherTurn: (c, t) => bell(c, 587, t, 0.35, 0.06),

  start: (c, t) => {
    riffle(c, t);
    riffle(c, t + 0.28);
    [523, 659, 784, 1047].forEach((f, i) => bell(c, f, t + 0.6 + i * 0.08, 0.8, 0.16));
  },
  shuffle: (c, t) => {
    riffle(c, t);
    riffle(c, t + 0.3);
  },

  build: (c, t) => {
    thud(c, t, 0.45);
    thud(c, t + 0.13, 0.45);
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, t: t + 0.28 + i * 0.07, d: 0.3, v: 0.13, type: "triangle" }));
    sparkle(c, t + 0.55);
  },

  steal: (c, t) => {
    swoosh(c, t, 0.35, 500, 3500, 0.3);
    [880, 784, 659, 523].forEach((f, i) =>
      tone(c, { f, t: t + 0.15 + i * 0.07, d: 0.1, v: 0.07, type: "square", lp: 2400 }),
    );
    thud(c, t + 0.5, 0.35);
  },

  dog: (c, t) => {
    bark(c, t);
    bark(c, t + 0.22, 0.34);
  },

  bone: (c, t) => {
    for (let i = 0; i < 3; i++) noise(c, { t: t + i * 0.09, d: 0.06, v: 0.25, type: "bandpass", f: 2200, q: 1.5 });
    tone(c, { f: 700, f2: 1500, t: t + 0.32, d: 0.22, v: 0.1, type: "sine" }); // happy whistle
    tone(c, { f: 900, f2: 1900, t: t + 0.55, d: 0.2, v: 0.08, type: "sine" });
    swoosh(c, t + 0.4, 0.35, 3000, 400, 0.15); // dog runs away
  },

  hammer: (c, t) => {
    clang(c, t, 0.3);
    clang(c, t + 0.18, 0.22);
    crumble(c, t + 0.3, 0.7, 0.32);
  },

  wrecking: (c, t) => {
    swoosh(c, t, 0.55, 180, 1400, 0.4);
    boom(c, t + 0.5, 0.65);
    crumble(c, t + 0.55, 1.2, 0.4);
  },

  thief: (c, t) => {
    // tiptoeing pizzicato
    [392, 466, 392, 466].forEach((f, i) =>
      tone(c, { f, t: t + i * 0.12, d: 0.08, v: 0.13, type: "triangle", lp: 1800 }),
    );
    swoosh(c, t + 0.48, 0.25, 800, 4000, 0.25);
  },

  superthief: (c, t) => {
    [392, 466, 523, 466, 392, 587].forEach((f, i) =>
      tone(c, { f, t: t + i * 0.09, d: 0.07, v: 0.13, type: "triangle", lp: 1800 }),
    );
    swoosh(c, t + 0.5, 0.2, 800, 4000, 0.25);
    swoosh(c, t + 0.68, 0.2, 800, 4000, 0.25);
    swoosh(c, t + 0.86, 0.2, 800, 4000, 0.25);
  },

  milkshake: (c, t) => {
    // straw slurp
    noise(c, { t, d: 0.55, v: 0.3, a: 0.1, type: "bandpass", f: 500, f2: 1500, q: 7, lfoRate: 16, lfoDepth: 250 });
    noise(c, { t: t + 0.62, d: 0.3, v: 0.25, a: 0.05, type: "bandpass", f: 900, f2: 1900, q: 7, lfoRate: 20, lfoDepth: 300 });
    tone(c, { f: 180, f2: 120, t: t + 0.98, d: 0.12, v: 0.12, type: "sine" }); // gulp
  },

  skip: (c, t) => {
    // sad "wah-wah-wah-waaah"
    [392, 370, 349].forEach((f, i) =>
      tone(c, { f, t: t + i * 0.25, d: 0.22, v: 0.12, type: "sawtooth", lp: 900, a: 0.03 }),
    );
    tone(c, { f: 330, f2: 300, t: t + 0.75, d: 0.7, v: 0.12, type: "sawtooth", lp: 900, a: 0.03, vib: 8, vibRate: 6 });
  },

  van: (c, t) => {
    // two-tone horn "beep-beep"
    for (const [off, d] of [
      [0, 0.14],
      [0.2, 0.3],
    ] as const) {
      tone(c, { f: 415, t: t + off, d, v: 0.12, type: "square", lp: 1800, a: 0.01 });
      tone(c, { f: 523, t: t + off, d, v: 0.1, type: "square", lp: 1800, a: 0.01 });
    }
    // ice-cream-van style jingle
    [1047, 1175, 1319, 1047, 1568].forEach((f, i) => bell(c, f, t + 0.6 + i * 0.1, 0.4, 0.07));
  },

  discard: (c, t) => {
    noise(c, { t, d: 0.09, v: 0.22, type: "highpass", f: 1800, f2: 5000 });
    noise(c, { t: t + 0.07, d: 0.06, v: 0.12, type: "bandpass", f: 600 });
  },

  win: (c, t) => {
    const notes: [number, number, number][] = [
      [523, 0, 0.14],
      [659, 0.14, 0.14],
      [784, 0.28, 0.14],
      [1047, 0.42, 0.3],
      [784, 0.74, 0.12],
      [1047, 0.88, 0.9],
    ];
    for (const [f, off, d] of notes) {
      tone(c, { f, t: t + off, d, v: 0.12, type: "square", lp: 3000 });
      tone(c, { f: f / 2, t: t + off, d, v: 0.08, type: "triangle" });
    }
    [1319, 1568].forEach((f) => tone(c, { f, t: t + 0.88, d: 0.9, v: 0.06, type: "triangle" }));
    sparkle(c, t + 1.0);
    sparkle(c, t + 1.25);
  },

  lose: (c, t) => {
    [523, 494, 466].forEach((f, i) => tone(c, { f, t: t + i * 0.3, d: 0.26, v: 0.12, type: "triangle", a: 0.02 }));
    tone(c, { f: 440, f2: 415, t: t + 0.9, d: 0.9, v: 0.12, type: "triangle", vib: 6, vibRate: 5, a: 0.02 });
  },
};

export function playSfx(name: SoundName, delay = 0) {
  loadSettings();
  if (settings.muted || settings.volume <= 0) return;
  const c = audio();
  if (!c || c.state !== "running" || !master) return;
  try {
    SOUNDS[name](c, c.currentTime + 0.01 + delay);
  } catch {
    /* never let audio break the game */
  }
}
