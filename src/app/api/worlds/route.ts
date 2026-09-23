import { NextResponse } from "next/server";
import { z } from "zod";
import { createWorld, listMyWorlds, worldNameSchema } from "@/lib/domain/worlds";
import { parseJsonBody } from "@/lib/http";
import { failResponse, resultResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: worldNameSchema,
  description: z.unknown().optional(),
});

export async function GET() {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  return NextResponse.json({ worlds: await listMyWorlds(session.user.id) });
}

export async function POST(request: Request) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  const created = await createWorld({
    actorId: session.user.id,
    name: body.data.name,
    description: body.data.description,
  });
  return resultResponse(created, 201);
}
