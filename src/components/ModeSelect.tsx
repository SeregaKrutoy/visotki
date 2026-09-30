"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const NAME_KEY = "vysotki:name";
export const tokenKey = (code: string) => `vysotki:token:${code}`;

function Seg<T extends number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
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

export function ModeSelect() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomTarget, setRoomTarget] = useState<4 | 5>(5);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  const saveName = () => {
    const n = name.trim() || "Игрок";
    localStorage.setItem(NAME_KEY, n);
    return n;
  };

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const n = saveName();
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, target: roomTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      localStorage.setItem(tokenKey(data.code), data.token);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Введите код комнаты");
      return;
    }
    saveName();
    router.push(`/room/${c}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="panel p-5">
        <label className="mb-1.5 block text-sm font-extrabold uppercase text-white">Ваше имя</label>
        <input className="input" value={name} maxLength={20} placeholder="Например, Прораб Вася" onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="panel flex flex-col gap-3 p-5">
        <h2 className="text-xl">🤖 Против ботов</h2>
        <p className="text-sm font-medium">
          Тренируйтесь в одиночку против компьютерных строителей. Можно выбрать сложность (лёгкий, средний, тяжёлый),
          число соперников и длину высотки.
        </p>
        <button
          className="btn btn-sun"
          onClick={() => {
            saveName();
            router.push("/bots");
          }}
        >
          Играть с ботами
        </button>
      </div>

      <div className="panel flex flex-col gap-3 p-5">
        <h2 className="text-xl">👥 С друзьями онлайн</h2>
        <p className="text-sm font-medium">Создайте комнату и отправьте друзьям код или ссылку. Свободные места можно занять ботами.</p>
        <div>
          <div className="mb-1 text-xs font-bold uppercase">Высотка</div>
          <Seg value={roomTarget} onChange={setRoomTarget} options={[{ v: 5, label: "5 этажей" }, { v: 4, label: "4 (короткая)" }]} />
        </div>
        <button className="btn btn-sun" onClick={createRoom} disabled={busy}>
          {busy ? "Создаём…" : "Создать комнату"}
        </button>
        <div className="flex gap-2">
          <input
            className="input font-display uppercase tracking-widest"
            placeholder="КОД"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button className="btn btn-lav shrink-0" onClick={join}>
            Войти
          </button>
        </div>
        {error && <div className="rounded-lg bg-brick px-3 py-2 text-sm font-bold text-white">{error}</div>}
      </div>
    </div>
  );
}
