import { MONSTER_RARITY_LABEL, type MonsterRarity } from "@/lib/monsters/labels";

/** English rarity label with color from Plan 005 Begriffe. */
export function MonsterRarityPill({ rarity }: { rarity: MonsterRarity }) {
  return <span className={`badge rarity-${rarity}`}>{MONSTER_RARITY_LABEL[rarity]}</span>;
}

export function MonsterLegendaryPill({ isLegendary }: { isLegendary: boolean }) {
  if (!isLegendary) return null;
  return <span className="badge legendary-flag">Legendär</span>;
}
