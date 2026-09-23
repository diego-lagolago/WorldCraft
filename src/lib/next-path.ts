const ALLOWED = /^\/(invite\/[A-Za-z0-9_-]{16,128}|w\/[0-9a-f-]{36}(\/[A-Za-z0-9/_-]*)?)$/i;

/** Return target after login: only known in-app paths, never another origin. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  return ALLOWED.test(value) ? value : null;
}
