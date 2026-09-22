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
    image: profile.image_url,
    discordId: profile.id,
  };
}
