import { z } from "zod";

const uuidSchema = z.uuid();

export function parseUuid(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Custom issues with `params: { [USER_MESSAGE]: true }` show their (German) message instead of the generic one. */
export const USER_MESSAGE = "userMessage";

/**
 * Validates a domain rule and exposes only an intentional German validation
 * message. Request-shape errors remain the responsibility of `parseJsonBody`.
 */
export function parseWithUserMessage<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const shown = parsed.error.issues.find((issue) => issue.code === "custom" && issue.params?.[USER_MESSAGE]);
  return { ok: false, error: shown?.message ?? parsed.error.issues[0]?.message ?? "Die Eingaben sind ungültig." };
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
    const shown = parsed.error.issues.find((issue) => issue.code === "custom" && issue.params?.[USER_MESSAGE]);
    return { ok: false, status: 400, error: shown?.message ?? "Die Eingaben sind ungültig." };
  }
  return { ok: true, data: parsed.data };
}
