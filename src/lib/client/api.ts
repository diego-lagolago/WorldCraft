export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; body?: unknown };

const FALLBACK_ERROR = "Das hat nicht geklappt. Bitte erneut versuchen.";

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: body as T };
  const error =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : FALLBACK_ERROR;
  return { ok: false, error, status: response.status, body: body ?? undefined };
}

/** JSON request against the product API; network errors become a readable message. */
export async function apiRequest<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return readResult<T>(response);
  } catch {
    return { ok: false, error: "Keine Verbindung zum Server.", status: 0 };
  }
}

export async function uploadImage(input: {
  file: File;
  kind: ImageKind;
  worldId?: string;
  targetId?: string;
}): Promise<ApiResult<{ fileId: string }>> {
  const form = new FormData();
  form.set("image", input.file);
  form.set("kind", input.kind);
  if (input.worldId) form.set("worldId", input.worldId);
  if (input.targetId) form.set("targetId", input.targetId);
  try {
    const response = await fetch("/api/files", { method: "POST", credentials: "include", body: form });
    return readResult(response);
  } catch {
    return { ok: false, error: "Keine Verbindung zum Server.", status: 0 };
  }
}
import type { ImageKind } from "@/lib/files/kinds";
