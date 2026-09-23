import { NextResponse } from "next/server";
import type { AuthzFail, AuthzResult } from "@/lib/authz";
import { loadWorldContext, type WorldContext } from "@/lib/domain/membership";
import { parseUuid } from "@/lib/http";
import { requireProductSession } from "@/lib/session";

export function failResponse(result: Pick<AuthzFail, "status" | "error">): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export function notFoundResponse(message = "Nicht gefunden."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function resultResponse<T>(result: AuthzResult<T>, status = 200): NextResponse {
  if (!result.ok) return failResponse(result);
  return NextResponse.json(result.data, { status });
}

type SessionUser = { id: string; name: string };

export type WorldRequest =
  | { ok: true; user: SessionUser; context: WorldContext }
  | { ok: false; response: NextResponse };

/** Session, valid world id and world context; the membership itself is checked by the domain call. */
export async function openWorldRequest(rawWorldId: string): Promise<WorldRequest> {
  const { session, response } = await requireProductSession();
  if (response || !session) return { ok: false, response: response ?? failResponse({ status: 401, error: "Anmeldung erforderlich." }) };
  const worldId = parseUuid(rawWorldId);
  if (!worldId) return { ok: false, response: notFoundResponse("Diese Welt gibt es nicht.") };
  const context = await loadWorldContext(worldId, session.user.id);
  if (!context.ok) return { ok: false, response: failResponse(context) };
  return { ok: true, user: { id: session.user.id, name: session.user.name }, context: context.data };
}
