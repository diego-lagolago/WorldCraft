import { z } from "zod";

const uuidSchema = z.uuid();

export function parseUuid(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400; error: string };

/**
 * Reads a JSON body and validates it. Invalid JSON or a schema miss is 400,
 * never an uncaught exception that becomes 500.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<JsonBodyResult<z.infer<T>>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, status: 400, error: "Die Anfrage enthält kein gültiges JSON." };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Die Eingaben sind ungültig." };
  }
  return { ok: true, data: parsed.data };
}
