import { handle } from "@/lib/api";
import { getRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const token = new URL(req.url).searchParams.get("token");
    return getRoom(code.toUpperCase(), token);
  });
}
