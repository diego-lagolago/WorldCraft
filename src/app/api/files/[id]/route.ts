import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { openStoredFile } from "@/lib/files/store";
import { parseUuid } from "@/lib/http";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireProductSession();
  if (response) return response;

  const { id } = await context.params;
  if (!parseUuid(id)) {
    return NextResponse.json({ error: "Die Datei-ID ist ungültig." }, { status: 400 });
  }

  const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(openStoredFile(file.storageKey), {
    headers: {
      "Content-Type": file.mime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
