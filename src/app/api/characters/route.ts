import { NextResponse } from "next/server";
import { characterCreateSchema, createCharacter, listMyCharacters } from "@/lib/domain/characters";
import { parseJsonBody } from "@/lib/http";
import { failResponse, resultResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  return NextResponse.json({ characters: await listMyCharacters(session.user.id) });
}

export async function POST(request: Request) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const body = await parseJsonBody(request, characterCreateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(await createCharacter(session.user.id, body.data), 201);
}
