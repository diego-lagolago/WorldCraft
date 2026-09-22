/** Spike T-011 — HTTP-Router für direkte Rechte-API-Tests (Session-Cookie). */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  bringCharacter,
  changeMemberRole,
  createArticle,
  createCharacter,
  createInvite,
  createManualRelation,
  createMap,
  createPin,
  createJournal,
  createUniverse,
  createWorld,
  deleteArticle,
  deleteMap,
  deleteMarker,
  deletePin,
  deleteRelation,
  deleteUniverse,
  deleteWorld,
  getWorldForActor,
  joinByInvite,
  leaveWorld,
  listArticles,
  listCharacters,
  listJournals,
  listMembers,
  listRelations,
  listWorldGeography,
  moveMarker,
  persistenceSnapshot,
  placeMarker,
  removeMember,
  revokeInvite,
  updateArticle,
  updateMap,
  updatePin,
  updateUniverse,
} from "./repository";
import {
  CONTENT_KINDS,
  INVITE_VALIDITIES,
  JOURNAL_VISIBILITIES,
  MEMBERSHIP_ROLES,
  PIN_TYPES,
  VISIBILITY_STATUSES,
  type Actor,
  type AuthzResult,
} from "./types";

const Uuid = z.string().uuid();
const Visibility = z.enum(VISIBILITY_STATUSES);

function jsonResult<T>(result: AuthzResult<T>, created = false): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: created ? 201 : 200 });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function requireActor(request: Request): Promise<
  { actor: Actor; error: null } | { actor: null; error: NextResponse }
> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return {
      actor: null,
      error: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
    };
  }
  return { actor: { id: session.user.id, name: session.user.name }, error: null };
}

export async function handleRechteRequest(request: Request): Promise<NextResponse> {
  const { actor, error } = await requireActor(request);
  if (error || !actor) return error;
  const url = new URL(request.url);
  const parts = url.pathname
    .replace(/^\/api\/spike\/rechte\/?/, "")
    .split("/")
    .filter(Boolean);
  const method = request.method.toUpperCase();

  try {
    return await dispatch(actor, method, parts, request);
  } catch (caught) {
    if (caught instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    throw caught;
  }
}

async function dispatch(
  actor: Actor,
  method: string,
  parts: string[],
  request: Request,
): Promise<NextResponse> {
  if (parts.length === 1 && parts[0] === "worlds" && method === "POST") {
    const body = z.object({ name: z.string() }).parse(await readJson(request));
    return jsonResult(await createWorld(actor, body), true);
  }

  if (parts[0] === "invites" && parts.length === 3 && parts[2] === "revoke" && method === "POST") {
    return jsonResult(await revokeInvite(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "invites" && parts.length === 3 && parts[2] === "join" && method === "POST") {
    return jsonResult(await joinByInvite(actor, parts[1]));
  }

  if (parts[0] === "characters" && parts.length === 1 && method === "POST") {
    const body = z.object({ name: z.string() }).parse(await readJson(request));
    return jsonResult(await createCharacter(actor, body), true);
  }

  if (parts[0] === "articles" && parts.length === 2 && method === "PATCH") {
    const body = z
      .object({
        title: z.string().optional(),
        visibility: Visibility.optional(),
        body: z.string().optional(),
      })
      .parse(await readJson(request));
    return jsonResult(await updateArticle(actor, Uuid.parse(parts[1]), body));
  }

  if (parts[0] === "articles" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deleteArticle(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "universes" && parts.length === 2 && method === "PATCH") {
    const body = z
      .object({ name: z.string().optional(), visibility: Visibility.optional() })
      .parse(await readJson(request));
    return jsonResult(await updateUniverse(actor, Uuid.parse(parts[1]), body));
  }

  if (parts[0] === "universes" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deleteUniverse(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "universes" && parts.length === 3 && parts[2] === "maps" && method === "POST") {
    const body = z
      .object({ name: z.string(), visibility: Visibility.optional() })
      .parse(await readJson(request));
    return jsonResult(await createMap(actor, Uuid.parse(parts[1]), body), true);
  }

  if (parts[0] === "maps" && parts.length === 2 && method === "PATCH") {
    const body = z
      .object({ name: z.string().optional(), visibility: Visibility.optional() })
      .parse(await readJson(request));
    return jsonResult(await updateMap(actor, Uuid.parse(parts[1]), body));
  }

  if (parts[0] === "maps" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deleteMap(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "maps" && parts.length === 3 && parts[2] === "pins" && method === "POST") {
    const body = z
      .object({
        pinType: z.enum(PIN_TYPES),
        title: z.string(),
        visibility: Visibility.optional(),
        posX: z.number(),
        posY: z.number(),
      })
      .parse(await readJson(request));
    return jsonResult(await createPin(actor, Uuid.parse(parts[1]), body), true);
  }

  if (parts[0] === "maps" && parts.length === 3 && parts[2] === "markers" && method === "POST") {
    const body = z
      .object({
        characterId: Uuid,
        posX: z.number(),
        posY: z.number(),
      })
      .parse(await readJson(request));
    return jsonResult(await placeMarker(actor, Uuid.parse(parts[1]), body), true);
  }

  if (parts[0] === "pins" && parts.length === 2 && method === "PATCH") {
    const body = z
      .object({
        title: z.string().optional(),
        visibility: Visibility.optional(),
        posX: z.number().optional(),
        posY: z.number().optional(),
      })
      .parse(await readJson(request));
    return jsonResult(await updatePin(actor, Uuid.parse(parts[1]), body));
  }

  if (parts[0] === "pins" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deletePin(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "markers" && parts.length === 2 && method === "PATCH") {
    const body = z.object({ posX: z.number(), posY: z.number() }).parse(await readJson(request));
    return jsonResult(await moveMarker(actor, Uuid.parse(parts[1]), body));
  }

  if (parts[0] === "markers" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deleteMarker(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "relations" && parts.length === 2 && method === "DELETE") {
    return jsonResult(await deleteRelation(actor, Uuid.parse(parts[1])));
  }

  if (parts[0] === "worlds" && parts.length >= 2) {
    const worldId = Uuid.parse(parts[1]);
    return dispatchWorld(actor, method, worldId, parts.slice(2), request);
  }

  return NextResponse.json({ error: "Unbekannte Route." }, { status: 404 });
}

async function dispatchWorld(
  actor: Actor,
  method: string,
  worldId: string,
  rest: string[],
  request: Request,
): Promise<NextResponse> {
  if (rest.length === 0 && method === "GET") {
    return jsonResult(await getWorldForActor(actor, worldId));
  }
  if (rest.length === 0 && method === "DELETE") {
    return jsonResult(await deleteWorld(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "leave" && method === "POST") {
    return jsonResult(await leaveWorld(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "members" && method === "GET") {
    return jsonResult(await listMembers(actor, worldId));
  }
  if (rest.length === 2 && rest[0] === "members" && method === "PATCH") {
    const body = z.object({ role: z.enum(MEMBERSHIP_ROLES) }).parse(await readJson(request));
    return jsonResult(await changeMemberRole(actor, worldId, rest[1], body.role));
  }
  if (rest.length === 2 && rest[0] === "members" && method === "DELETE") {
    return jsonResult(await removeMember(actor, worldId, rest[1]));
  }
  if (rest.length === 1 && rest[0] === "invites" && method === "POST") {
    const raw = await readJson(request);
    const body = z
      .object({ validity: z.enum(INVITE_VALIDITIES).optional() })
      .parse(raw && typeof raw === "object" ? raw : {});
    return jsonResult(await createInvite(actor, worldId, body.validity ?? "unlimited"), true);
  }
  if (rest.length === 1 && rest[0] === "articles" && method === "GET") {
    return jsonResult(await listArticles(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "articles" && method === "POST") {
    const body = z
      .object({
        title: z.string(),
        visibility: Visibility.optional(),
        body: z.string().optional(),
      })
      .parse(await readJson(request));
    return jsonResult(await createArticle(actor, worldId, body), true);
  }
  if (rest.length === 1 && rest[0] === "journals" && method === "GET") {
    return jsonResult(await listJournals(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "journals" && method === "POST") {
    const body = z
      .object({
        characterId: Uuid,
        title: z.string().optional(),
        body: z.string(),
        visibility: z.enum(JOURNAL_VISIBILITIES),
      })
      .parse(await readJson(request));
    return jsonResult(await createJournal(actor, worldId, body), true);
  }
  if (rest.length === 1 && rest[0] === "characters" && method === "GET") {
    return jsonResult(await listCharacters(actor, worldId));
  }
  if (rest.length === 2 && rest[0] === "characters" && rest[1] && method === "POST") {
    return jsonResult(await bringCharacter(actor, worldId, Uuid.parse(rest[1])), true);
  }
  if (rest.length === 1 && rest[0] === "universes" && method === "GET") {
    return jsonResult(await listWorldGeography(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "universes" && method === "POST") {
    const body = z
      .object({ name: z.string(), visibility: Visibility.optional() })
      .parse(await readJson(request));
    return jsonResult(await createUniverse(actor, worldId, body), true);
  }
  if (rest.length === 1 && rest[0] === "relations" && method === "GET") {
    return jsonResult(await listRelations(actor, worldId));
  }
  if (rest.length === 1 && rest[0] === "relations" && method === "POST") {
    const body = z
      .object({
        sourceKind: z.enum(CONTENT_KINDS),
        sourceId: Uuid,
        targetKind: z.enum(CONTENT_KINDS),
        targetId: Uuid,
        label: z.string(),
      })
      .parse(await readJson(request));
    return jsonResult(await createManualRelation(actor, worldId, body), true);
  }
  if (rest.length === 1 && rest[0] === "_persistence" && method === "GET") {
    return jsonResult(await persistenceSnapshot(actor, worldId));
  }
  return NextResponse.json({ error: "Unbekannte Route." }, { status: 404 });
}
