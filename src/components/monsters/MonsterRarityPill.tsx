import { MONSTER_RARITY_LABEL, type MonsterRarity } from "@/lib/monsters/labels";

/** English rarity keys with German labels (Owner 2026-09-24). */
export function MonsterRarityPill({ rarity }: { rarity: MonsterRarity }) {
  return <span className={`badge rarity-${rarity}`}>{MONSTER_RARITY_LABEL[rarity]}</span>;
}

/** Boss-Kennzeichen: Totenschädel statt Pill (Owner 2026-09-24). */
export function MonsterBossMark({ isBoss }: { isBoss: boolean }) {
  if (!isBoss) return null;
  return (
    <span className="monster-boss-mark" title="Boss" aria-label="Boss">
      💀
    </span>
  );
}
