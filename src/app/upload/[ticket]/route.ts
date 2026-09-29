import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { articles, monsters, users, worlds } from "@/db/schema";
import { getArticle } from "@/lib/domain/articles";
import { getMonster } from "@/lib/domain/monsters";
import { isDiscordIdAllowed, isMcpEnabled } from "@/lib/env";
import { attachImage } from "@/lib/files/attach";
import { inspectImage, isImageError, maxBytesFor } from "@/lib/files/inspect";
import type { ImageKind } from "@/lib/files/kinds";
import { consumeMcpUploadRedeem, McpUploadRateLimitError, writeMcpAuditLog } from "@/lib/mcp/audit";
import { listMcpWorldMemberships } from "@/lib/mcp/context";
import { consumeMcpUploadTicket, peekMcpUploadTicket } from "@/lib/mcp/upload-tickets";
import { standOf } from "@/lib/mcp/write-rich";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_LABEL = {
  welt: "Welt-Titelbild",
  artikel: "Artikel-Titelbild",
  monster: "Monster-Profilbild",
} as const;

type TicketRow = NonNullable<Awaited<ReturnType<typeof peekMcpUploadTicket>>>;

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function notFound() {
  return new NextResponse("Nicht gefunden.", { status: 404 });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function assertTicketStillAuthorized(ticket: TicketRow): Promise<string | null> {
  if (!isMcpEnabled()) return "MCP ist nicht verfügbar.";
  const [user] = await db
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.id, ticket.userId))
    .limit(1);
  if (!user || !isDiscordIdAllowed(user.discordId)) return "Zugriff verweigert.";

  const memberships = await listMcpWorldMemberships(ticket.userId);
  const world = memberships.find((entry) => entry.id === ticket.worldId);
  if (!world) return "Welt nicht gefunden.";
  if (!world.mcpEnabled) return "MCP ist für diese Welt nicht freigegeben.";

  const actualStand = await currentStand(ticket);
  if (!actualStand || actualStand !== ticket.expectedStand) {
    return "Inhalt wurde inzwischen geändert, bitte neu lesen.";
  }
  return null;
}

async function currentStand(ticket: TicketRow): Promise<string | null> {
  if (ticket.targetKind === "welt") {
    const memberships = await listMcpWorldMemberships(ticket.userId);
    const world = memberships.find((entry) => entry.id === ticket.worldId);
    return world ? standOf(world.updatedAt) : null;
  }
  if (ticket.targetKind === "artikel") {
    const [row] = await db
      .select({ updatedAt: articles.updatedAt })
      .from(articles)
      .where(eq(articles.id, ticket.targetId))
      .limit(1);
    return row ? standOf(row.updatedAt) : null;
  }
  if (ticket.targetKind === "monster") {
    const [row] = await db
      .select({ updatedAt: monsters.updatedAt })
      .from(monsters)
      .where(eq(monsters.id, ticket.targetId))
      .limit(1);
    return row ? standOf(row.updatedAt) : null;
  }
  return null;
}

async function targetTitle(ticket: TicketRow): Promise<string> {
  if (ticket.targetKind === "welt") {
    const [row] = await db.select({ name: worlds.name }).from(worlds).where(eq(worlds.id, ticket.worldId)).limit(1);
    return row?.name ?? "Welt";
  }
  const memberships = await listMcpWorldMemberships(ticket.userId);
  const world = memberships.find((entry) => entry.id === ticket.worldId);
  if (!world) return ticket.targetKind === "artikel" ? "Artikel" : "Monster";
  if (ticket.targetKind === "artikel") {
    const article = await getArticle(ticket.worldId, ticket.targetId, world.role, ticket.userId);
    return article?.title ?? "Artikel";
  }
  const monster = await getMonster(ticket.worldId, ticket.targetId, world.role, ticket.userId);
  return monster?.name ?? "Monster";
}

function uploadPageHtml(input: {
  label: string;
  title: string;
  expiresAt: Date;
  maxMb: number;
  error?: string;
  success?: boolean;
}) {
  const expiry = input.expiresAt.toLocaleString("de-DE", { timeZone: "Europe/Vienna" });
  const body = input.success
    ? `<p class="ok">Bild hochgeladen. Du kannst dieses Fenster schließen.</p>`
    : `
      <p>Ziel: <strong>${escapeHtml(input.label)}</strong> – ${escapeHtml(input.title)}</p>
      <p>Gültig bis: ${escapeHtml(expiry)}</p>
      <p>Erlaubt: JPEG, PNG oder WebP, höchstens ${input.maxMb}&nbsp;MB.</p>
      ${input.error ? `<p class="err">${escapeHtml(input.error)}</p>` : ""}
      <form method="post" enctype="multipart/form-data">
        <label for="datei">Bilddatei</label>
        <input id="datei" name="datei" type="file" accept="image/jpeg,image/png,image/webp" required />
        <button type="submit">Hochladen</button>
      </form>`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorldCraft Upload</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 1.25rem; background: #e7e5e4; color: #1c1917; }
    main { max-width: 28rem; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    label { display: block; margin: 1rem 0 0.35rem; font-weight: 600; }
    input[type=file] { width: 100%; }
    button { margin-top: 1rem; width: 100%; padding: 0.75rem 1rem; font-size: 1rem; border: 0; border-radius: 0.5rem; background: #1c1917; color: #fff; }
    .err { color: #9f1239; }
    .ok { color: #166534; }
  </style>
</head>
<body>
  <main>
    <h1>Bild hochladen</h1>
    ${body}
  </main>
</body>
</html>`;
}

async function pageResponse(ticket: TicketRow, status: number, error?: string, success?: boolean) {
  const title = await targetTitle(ticket);
  const label = TARGET_LABEL[ticket.targetKind as keyof typeof TARGET_LABEL] ?? "Bild";
  const maxMb = Math.round(maxBytesFor(ticket.imageKind as ImageKind) / (1024 * 1024));
  return new NextResponse(uploadPageHtml({
    label, title, expiresAt: ticket.expiresAt, maxMb, error, success,
  }), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticket: string }> },
) {
  const { ticket: token } = await context.params;
  const ticket = await peekMcpUploadTicket(token);
  if (!ticket) return notFound();
  if (await assertTicketStillAuthorized(ticket)) return notFound();
  return pageResponse(ticket, 200);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ ticket: string }> },
) {
  const start = performance.now();
  const { ticket: token } = await context.params;
  const peeked = await peekMcpUploadTicket(token);
  if (!peeked) return notFound();

  try {
    consumeMcpUploadRedeem(peeked.userId);
  } catch (error) {
    if (error instanceof McpUploadRateLimitError) {
      return new NextResponse(error.message, {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "no-store" },
      });
    }
    throw error;
  }

  const authError = await assertTicketStillAuthorized(peeked);
  if (authError) {
    // Stand drift: keep ticket usable and explain; other auth failures stay opaque.
    if (authError.includes("geändert")) {
      if (wantsJson(request)) return NextResponse.json({ error: authError }, { status: 409 });
      return pageResponse(peeked, 409, authError);
    }
    return notFound();
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    const message = "Bitte ein Bild als Formular senden.";
    if (wantsJson(request)) return NextResponse.json({ error: message }, { status: 400 });
    return pageResponse(peeked, 400, message);
  }

  const file = form.get("datei") ?? form.get("image");
  if (!(file instanceof File)) {
    const message = "Bitte eine Bilddatei im Feld „datei“ senden.";
    if (wantsJson(request)) return NextResponse.json({ error: message }, { status: 400 });
    return pageResponse(peeked, 400, message);
  }

  const imageKind = peeked.imageKind as ImageKind;
  const maxBytes = maxBytesFor(imageKind);
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    const message = `Das Bild darf höchstens ${limitMb} MB groß sein.`;
    if (wantsJson(request)) return NextResponse.json({ error: message }, { status: 400 });
    return pageResponse(peeked, 400, message);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const inspected = inspectImage(bytes, maxBytes);
  if (isImageError(inspected)) {
    if (wantsJson(request)) return NextResponse.json({ error: inspected.error }, { status: 400 });
    return pageResponse(peeked, 400, inspected.error);
  }

  const ticket = await consumeMcpUploadTicket(token);
  if (!ticket) return notFound();

  const result = await attachImage({
    kind: imageKind,
    actorId: ticket.userId,
    bytes,
    worldId: ticket.worldId,
    targetId: ticket.targetKind === "welt" ? ticket.worldId : ticket.targetId,
  });

  await writeMcpAuditLog({
    userId: ticket.userId,
    clientId: "upload-ticket",
    toolName: "upload_einloesen",
    worldId: ticket.worldId,
    targetKind: ticket.targetKind,
    targetId: ticket.targetId,
    confirmed: true,
    origin: "mcp",
    durationMs: performance.now() - start,
    result: result.ok ? "ok" : "error",
  }).catch(() => undefined);

  if (!result.ok) {
    if (wantsJson(request)) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return new NextResponse(
      `<!DOCTYPE html><html lang="de"><body><p>${escapeHtml(result.error)}</p></body></html>`,
      { status: result.status, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (wantsJson(request)) {
    return NextResponse.json({
      fileId: result.data.fileId,
      ziel: ticket.targetKind,
      id: ticket.targetId,
    }, { status: 201 });
  }

  return pageResponse(ticket, 201, undefined, true);
}
