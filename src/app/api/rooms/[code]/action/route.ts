import { handle } from "@/lib/api";
import { GameError } from "@/lib/game/engine";
import { performAction } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.token !== "string" || !body.action || typeof body.action.type !== "string") {
      throw new GameError("Неверный запрос");
    }
    return performAction(code.toUpperCase(), body.token, body.action);
  });
}
