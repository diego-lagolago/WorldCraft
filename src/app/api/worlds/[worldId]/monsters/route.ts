import { NextResponse } from "next/server";
import { createMonster, isMonsterKind, listMonsters, monsterCreateSchema } from "@/lib/domain/monsters";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const raw = new URL(request.url).searchParams.get("kind");
  const kind = raw && isMonsterKind(raw) ? raw : "all";
  return NextResponse.json({
    monsters: await listMonsters(
      req.context.world.id,
      req.context.membership.role,
      req.context.membership.userId,
      kind,
    ),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, monsterCreateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createMonster({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      ...body.data,
    }),
    201,
  );
}
