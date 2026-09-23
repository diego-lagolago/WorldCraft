import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { loadWorldContext, type WorldContext } from "@/lib/domain/membership";
import { parseUuid } from "@/lib/http";
import { getOptionalSession } from "@/lib/session";

/** Server pages: signed-in user or redirect to the login on `/`. */
export const requirePageUser = cache(async () => {
  const session = await getOptionalSession();
  if (!session?.user) redirect("/");
  return session.user;
});

/**
 * World pages: signed-in active member, else login redirect or 404. A missing
 * world and a foreign world both look like 404 so ids reveal nothing.
 */
export const requireWorldPage = cache(
  async (rawWorldId: string): Promise<WorldContext & { user: { id: string; name: string } }> => {
    const user = await requirePageUser();
    const worldId = parseUuid(rawWorldId);
    if (!worldId) notFound();
    const context = await loadWorldContext(worldId, user.id);
    if (!context.ok) notFound();
    return { ...context.data, user: { id: user.id, name: user.name } };
  },
);
