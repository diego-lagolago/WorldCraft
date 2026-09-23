import { notFound } from "next/navigation";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { getOwnCharacter } from "@/lib/domain/characters";
import { parseUuid } from "@/lib/http";
import { requirePageUser } from "@/lib/page-context";
import { safeNextPath } from "@/lib/next-path";

/** Only the owner edits; for everyone else the character does not exist here (R-3.8-1). */
export default async function EditCharacterPage({ params, searchParams }: PageProps<"/characters/[characterId]">) {
  const { characterId } = await params;
  const { back } = await searchParams;
  const user = await requirePageUser();
  const id = parseUuid(characterId);
  const sheet = id ? await getOwnCharacter(user.id, id) : null;
  if (!sheet) notFound();
  const backHref = safeNextPath(typeof back === "string" ? back : null) ?? "/characters";

  return <CharacterForm key={sheet.id} sheet={sheet} backHref={backHref} />;
}
