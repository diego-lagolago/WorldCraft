import Link from "next/link";
import { Avatar, VisibilityBadge } from "@/components/world/display";
import { hubFilterHref, type HubFilterParams } from "@/lib/hub-filter-href";
import { contentHref, contentNewHref } from "@/lib/content-href";
import type { MonsterSummary } from "@/lib/domain/monsters";
import { MONSTER_KINDS, MONSTER_KIND_LABEL, type MonsterKind } from "@/lib/monsters/labels";
import { MonsterBossMark, MonsterRarityPill } from "./MonsterRarityPill";

const FILTERS: { value: "all" | MonsterKind; label: string }[] = [
  { value: "all", label: "Alle" },
  ...MONSTER_KINDS.map((kind) => ({ value: kind, label: MONSTER_KIND_LABEL[kind] })),
];

export function MonsterList({
  worldId,
  monsters,
  canCreate,
  filter = "all",
  hubFilters = {},
}: {
  worldId: string;
  monsters: MonsterSummary[];
  canCreate: boolean;
  filter?: "all" | MonsterKind;
  /** Current hub query so Glossar `template` survives kind chips (PR6). */
  hubFilters?: HubFilterParams;
}) {
  return (
    <>
      <div className="section-h">
        <h2>Bestiarium</h2>
        {canCreate ? (
          <Link className="btn sm" href={contentNewHref(worldId, "monster")}>
            + Monster
          </Link>
        ) : null}
      </div>
      <div className="chips">
        {FILTERS.map((entry) => (
          <Link
            key={entry.value}
            href={hubFilterHref(worldId, hubFilters, "kind", entry.value)}
            scroll={false}
            className={filter === entry.value ? "chip on" : "chip"}
          >
            {entry.label}
          </Link>
        ))}
      </div>
      <div className="card list" style={{ padding: "0 4px", marginTop: 8 }}>
        {monsters.length === 0 ? <div className="empty">Keine Monster in dieser Kategorie.</div> : null}
        {monsters.map((monster) => (
          <Link key={monster.id} className="item" href={contentHref(worldId, "monster", monster.id)}>
            <Avatar
              name={monster.name}
              image={monster.portraitId ? `/api/files/${monster.portraitId}` : null}
            />
            <div className="grow">
              {monster.name}
              <div className="kind">{MONSTER_KIND_LABEL[monster.kind]}</div>
            </div>
            <MonsterRarityPill rarity={monster.rarity} />
            <MonsterBossMark isBoss={monster.isBoss} />
            <VisibilityBadge visibility={monster.visibility} />
            <span className="muted" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
