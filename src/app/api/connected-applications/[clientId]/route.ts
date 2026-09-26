import { NextResponse } from "next/server";
import { revokeConnectedApplication } from "@/lib/domain/connected-applications";
import { requireProductSession } from "@/lib/session";

type Ctx = { params: Promise<{ clientId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response ?? NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const clientId = (await ctx.params).clientId;
  if (!clientId || clientId.length > 500) return NextResponse.json({ error: "Anwendung nicht gefunden." }, { status: 404 });
  if (!(await revokeConnectedApplication(session.user.id, clientId))) {
    return NextResponse.json({ error: "Anwendung nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ clientId });
}
