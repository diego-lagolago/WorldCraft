import { NextResponse } from "next/server";
import { attachImage } from "@/lib/files/attach";
import { IMAGE_KINDS, type ImageKind } from "@/lib/files/authorize";
import { parseUuid } from "@/lib/http";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isImageKind(value: string): value is ImageKind {
  return (IMAGE_KINDS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;

  const form = await request.formData();
  const file = form.get("image");
  const kindRaw = form.get("kind");
  if (!(file instanceof File) || typeof kindRaw !== "string" || !isImageKind(kindRaw)) {
    return NextResponse.json(
      { error: "Bitte ein Bild und eine gültige Bildart senden." },
      { status: 400 },
    );
  }

  const worldId = parseUuid(form.get("worldId"));
  const targetId = parseUuid(form.get("targetId"));
  if (form.get("worldId") && !worldId) {
    return NextResponse.json({ error: "Die Welt-ID ist ungültig." }, { status: 400 });
  }
  if (form.get("targetId") && !targetId) {
    return NextResponse.json({ error: "Die Ziel-ID ist ungültig." }, { status: 400 });
  }

  const result = await attachImage({
    kind: kindRaw,
    actorId: session.user.id,
    bytes: Buffer.from(await file.arrayBuffer()),
    worldId,
    targetId: kindRaw === "world_title" ? worldId : targetId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ fileId: result.data.fileId }, { status: 201 });
}
