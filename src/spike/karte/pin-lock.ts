/** Spike T-009 — gesperrte Pins dürfen nur explizit entsperrt werden. */

export function isUnlockOnlyPatch(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body).filter((key) => body[key] !== undefined);
  return keys.length === 1 && body.locked === false;
}
