import { handle } from "@/lib/api";
import { createRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    return createRoom(body.name, body.target);
  });
}
