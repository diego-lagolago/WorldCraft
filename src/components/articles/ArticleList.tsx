import Link from "next/link";
import { worldPath } from "@/components/shell/nav";
import { VisibilityBadge } from "@/components/world/display";
import type { ArticleSummary } from "@/lib/domain/articles";
import { hubFilterHref, type HubFilterParams } from "@/lib/hub-filter-href";
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
  articles: ArticleSummary[];
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
          return (
            <Link key={article.id} className="item" href={worldPath(worldId, `/articles/${article.id}`)}>
              <div className="grow">
                <span className={stub ? "stub-title" : undefined}>{article.title}</span>
                <div className="kind">{[badge, stub ? "noch leer" : null].filter(Boolean).join(" · ")}</div>
              </div>
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
