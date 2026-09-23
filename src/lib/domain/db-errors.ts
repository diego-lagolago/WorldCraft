import { fail, type AuthzFail } from "@/lib/authz";

/** Trigger SQLSTATEs from migration 0009 (datenmodell §12). */
const TRIGGER_MESSAGES: Record<string, string> = {
  WC001: "Der Game Master muss der Ersteller der Welt sein.",
  WC002: "Der Ersteller einer Welt kann nicht geändert werden.",
  WC003: "Verknüpfungen sind nur innerhalb derselben Welt möglich.",
  WC004: "Das letzte Universum einer Welt kann nicht gelöscht werden.",
  WC005: "Tagebucheinträge brauchen eine aktive Teilnahme an der Welt.",
  WC006: "Nur Mitglieder der Welt können Charaktere mitbringen.",
  WC007: "Der Besitzer eines Charakters kann nicht geändert werden.",
  WC008: "Ein Charakter kann höchstens 10 Bildanhänge haben.",
};

function sqlState(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Maps expected database errors to a user-facing failure. Unknown errors
 * return null so the caller rethrows them (they are real 500s).
 */
export function mapDbError(error: unknown, messages: { unique?: string } = {}): AuthzFail | null {
  const code = sqlState(error);
  if (!code) return null;
  if (code in TRIGGER_MESSAGES) {
    return fail(code === "WC004" || code === "WC008" ? 409 : 400, TRIGGER_MESSAGES[code]);
  }
  switch (code) {
    case "23505":
      return fail(409, messages.unique ?? "Diesen Eintrag gibt es schon.");
    case "23503":
      return fail(404, "Ein verknüpfter Eintrag existiert nicht mehr.");
    case "23514":
    case "22001":
    case "22P02":
      return fail(400, "Die Eingaben sind ungültig.");
    default:
      return null;
  }
}
