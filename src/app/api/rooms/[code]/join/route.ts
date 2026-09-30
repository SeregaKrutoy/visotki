import { handle } from "@/lib/api";
import { joinRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    return joinRoom(code.toUpperCase(), body.name, typeof body.token === "string" ? body.token : null);
  });
}
