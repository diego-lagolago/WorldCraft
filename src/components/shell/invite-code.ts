/** Accepts a full invite link or just the code. */
export function inviteCodeFrom(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/invite\/([A-Za-z0-9_-]+)/);
  const code = match ? match[1] : trimmed;
  return /^[A-Za-z0-9_-]{4,64}$/.test(code) ? code : null;
}
