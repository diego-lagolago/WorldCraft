import Link from "next/link";
import { MonsterRarityPill } from "@/components/monsters/MonsterRarityPill";
import { worldPath } from "@/components/shell/nav";
import { VisibilityBadge } from "@/components/world/display";
import type { ArticleListItem } from "@/lib/domain/articles";
import { hubFilterHref, type HubFilterParams } from "@/lib/hub-filter-href";
import { MONSTER_RARITIES, type MonsterRarity } from "@/lib/monsters/labels";
import { TEMPLATES, TEMPLATE_TYPES, templateBadge, type TemplateType } from "@/lib/templates/registry";

const FILTERS: { value: "all" | TemplateType; label: string }[] = [
  { value: "all", label: "Alle" },
  ...TEMPLATE_TYPES.map((type) => ({ value: type, label: TEMPLATES[type].plural })),
];

export function ArticleList({
  worldId,
  articles,
  canCreate,
  filter = "all",
  hubFilters = {},
}: {
  worldId: string;
  articles: ArticleListItem[];
  canCreate: boolean;
  filter?: "all" | TemplateType;
  /** Current hub query so Bestiarium `kind` survives template chips (PR6). */
  hubFilters?: HubFilterParams;
}) {
  return (
    <>
      <div className="section-h">
        <h2>Glossar</h2>
        {canCreate ? (
          <Link className="btn sm" href={worldPath(worldId, "/articles/new")}>
            + Artikel
          </Link>
        ) : null}
      </div>
      <div className="chips">
        {FILTERS.map((entry) => (
          <Link
            key={entry.value}
            href={hubFilterHref(worldId, hubFilters, "template", entry.value)}
            scroll={false}
            className={filter === entry.value ? "chip on" : "chip"}
          >
            {entry.label}
          </Link>
        ))}
      </div>
      <div className="card list" style={{ padding: "0 4px", marginTop: 8 }}>
        {articles.length === 0 ? <div className="empty">Keine Artikel in dieser Kategorie.</div> : null}
        {articles.map((article) => {
          const badge = templateBadge(article.templateType);
          const stub = !article.firstEditedAt;
          const rarity =
            article.templateType === "item" &&
            article.rarity &&
            (MONSTER_RARITIES as readonly string[]).includes(article.rarity)
              ? (article.rarity as MonsterRarity)
              : null;
          return (
            <Link key={article.id} className="item" href={worldPath(worldId, `/articles/${article.id}`)}>
              <div className="grow">
                <span className={stub ? "stub-title" : undefined}>{article.title}</span>
                <div className="kind">{[badge, stub ? "noch leer" : null].filter(Boolean).join(" · ")}</div>
              </div>
              {rarity ? <MonsterRarityPill rarity={rarity} /> : null}
              <VisibilityBadge visibility={article.visibility} />
              <span className="muted" aria-hidden="true">
                ›
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
