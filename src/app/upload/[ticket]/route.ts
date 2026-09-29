import { NextResponse } from "next/server";
import { hasActiveMcpConsent } from "@/lib/domain/connected-applications";
import { isDiscordIdAllowed, isMcpEnabled } from "@/lib/env";
import { attachImage } from "@/lib/files/attach";
import { inspectImage, isImageError, maxBytesFor } from "@/lib/files/inspect";
import type { ImageKind } from "@/lib/files/kinds";
import { consumeMcpUploadRedeem, McpUploadRateLimitError, writeMcpAuditLog } from "@/lib/mcp/audit";
import { listMcpWorldMemberships } from "@/lib/mcp/context";
import { consumeMcpUploadTicket, peekMcpUploadTicket } from "@/lib/mcp/upload-tickets";
import { formatDelta, RECEIPT_INSTRUCTION } from "@/lib/mcp/change-format";
import { escapeHtml, uploadPageHtml } from "./page-html";
import { loadUploadTargetState, ticketOwnerDiscordId } from "./target-state";

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
  return !accept.includes("text/html");
}

function notFound() {
  return new NextResponse("Nicht gefunden.", { status: 404 });
}

async function assertTicketStillAuthorized(ticket: TicketRow): Promise<string | null> {
  if (!isMcpEnabled()) return "MCP ist nicht verfügbar.";
  const discordId = await ticketOwnerDiscordId(ticket.userId);
  if (!discordId || !isDiscordIdAllowed(discordId)) return "Zugriff verweigert.";
  if (!await hasActiveMcpConsent(ticket.userId, ticket.clientId)) return "Zugriff verweigert.";

  const memberships = await listMcpWorldMemberships(ticket.userId);
  const world = memberships.find((entry) => entry.id === ticket.worldId);
  if (!world) return "Welt nicht gefunden.";
  if (!world.mcpEnabled) return "MCP ist für diese Welt nicht freigegeben.";

  const state = await loadUploadTargetState(ticket);
  if (!state) return "Inhalt nicht gefunden.";
  if (state.stand !== ticket.expectedStand) {
    return "Inhalt wurde inzwischen geändert, bitte neu lesen.";
  }
  return null;
}

/** Receipt after a redeemed upload link (012 T-008): same first line and delta as the tools. */
async function uploadReceipt(ticket: TicketRow, replaced: boolean): Promise<string> {
  const label = TARGET_LABEL[ticket.targetKind as keyof typeof TARGET_LABEL];
  const state = await loadUploadTargetState(ticket);
  return [
    RECEIPT_INSTRUCTION,
    "Gespeichert.",
    `Art: ${ticket.targetKind}`,
    `ID: ${ticket.targetKind === "welt" ? ticket.worldId : ticket.targetId}`,
    `Titel: ${state?.title ?? label}`,
    `Stand: ${state?.stand ?? "–"}`,
    `Ziel: ${ticket.targetKind}`,
    `Bildart: ${label}`,
    `Ersetzt vorhandenes Bild: ${replaced ? "ja" : "nein"}`,
    ...formatDelta(
      [{ label, oldValue: replaced ? "bisheriges Bild" : "–", newValue: "neu hochgeladenes Bild" }],
      "Gespeicherte Änderungen (vorher → nachher):",
    ),
  ].join("\n");
}

async function pageResponse(ticket: TicketRow, status: number, error?: string, success?: boolean, receipt?: string) {
  const label = TARGET_LABEL[ticket.targetKind as keyof typeof TARGET_LABEL] ?? "Bild";
  const title = (await loadUploadTargetState(ticket))?.title ?? label;
  const maxMb = Math.round(maxBytesFor(ticket.imageKind as ImageKind) / (1024 * 1024));
  return new NextResponse(uploadPageHtml({
    label, title, expiresAt: ticket.expiresAt, maxMb, error, success, receipt,
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
  const authError = await assertTicketStillAuthorized(ticket);
  if (authError) {
    if (authError.includes("geändert")) return pageResponse(ticket, 409, authError);
    return notFound();
  }
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

  const maxBytes = maxBytesFor(peeked.imageKind as ImageKind);
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes + 64 * 1024) {
    const message = "Die Upload-Größe konnte nicht sicher geprüft werden.";
    if (wantsJson(request)) return NextResponse.json({ error: message }, { status: 413 });
    return pageResponse(peeked, 413, message);
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

  const replaced = Boolean((await loadUploadTargetState(peeked))?.hasImage);
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
    clientId: ticket.clientId,
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

  const receipt = await uploadReceipt(ticket, replaced);
  if (wantsJson(request)) {
    return NextResponse.json({
      fileId: result.data.fileId,
      ziel: ticket.targetKind,
      id: ticket.targetId,
      quittung: receipt,
    }, { status: 201 });
  }

  return pageResponse(ticket, 201, undefined, true, receipt);
}
