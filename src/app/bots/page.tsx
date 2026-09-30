import { LocalGame } from "@/components/LocalGame";
import type { BotLevel } from "@/lib/game/types";

export const metadata = { title: "Высотки — игра против ботов" };

export default async function BotsPage({ searchParams }: { searchParams: Promise<{ n?: string; t?: string; d?: string }> }) {
  const sp = await searchParams;
  const hasParams = Number(sp.n) > 0;
  const n = Math.min(3, Math.max(1, Number(sp.n) || 2));
  const t = sp.t === "4" ? 4 : 5;
  const d = (Math.min(3, Math.max(1, Number(sp.d) || 2)) || 2) as BotLevel;
  // without parameters we show the setup screen first
  return <LocalGame bots={hasParams ? n : 0} target={t} level={d} />;
}
