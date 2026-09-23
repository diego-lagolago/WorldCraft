export const DISCORD_EMAIL_REQUIRED_MESSAGE =
  "Discord hat keine E-Mail geliefert. Ohne E-Mail ist die Anmeldung nicht möglich.";

export type DiscordProfileInput = {
  id: string;
  email?: string | null;
  username: string;
  global_name?: string | null;
  image_url?: string;
};

export type MappedDiscordUser = {
  name: string;
  email: string;
  image?: string;
  discordId: string;
};

/**
 * Rewrites animated Discord CDN avatars (…/a_….gif) to a static PNG.
 * Leaves other hosts and non-gif paths unchanged. Query strings are kept.
 */
export function staticDiscordAvatar(
  url: string | undefined | null,
): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "cdn.discordapp.com") return url;
    if (!/\.gif$/i.test(parsed.pathname)) return url;
    parsed.pathname = parsed.pathname.replace(/\.gif$/i, ".png");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Maps a Discord profile onto WorldCraft user fields.
 * Rejects missing email — no placeholder for real Discord accounts.
 */
export function mapDiscordProfileToUser(
  profile: DiscordProfileInput,
): MappedDiscordUser {
  const email = profile.email?.trim() ?? "";
  if (!email) {
    throw new Error(DISCORD_EMAIL_REQUIRED_MESSAGE);
  }

  const rawName = profile.global_name || profile.username || "Discord";
  const name = rawName.slice(0, 100) || "Discord";

  return {
    name,
    email,
    image: staticDiscordAvatar(profile.image_url),
    discordId: profile.id,
  };
}
