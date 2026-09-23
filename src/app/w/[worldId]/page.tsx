import Link from "next/link";
import { ArticleList } from "@/components/articles/ArticleList";
import { QuestList } from "@/components/quests/QuestList";
import { RichTextView } from "@/components/editor/RichTextView";
import { worldPath } from "@/components/shell/nav";
import { CampaignSearch } from "@/components/world/CampaignSearch";
import { Hero, VisibilityBadge } from "@/components/world/display";
import { ROLE_LABEL } from "@/components/world/labels";
import { isStaff } from "@/lib/authz/types";
import { listArticles } from "@/lib/domain/articles";
import { listQuests } from "@/lib/domain/quests";
import { listUniverses } from "@/lib/domain/universes";
import { getWorldDetails, listMyWorlds } from "@/lib/domain/worlds";
import { asRichDoc } from "@/lib/editor/rich-text";
import { requireWorldPage } from "@/lib/page-context";
import { isTemplateType } from "@/lib/templates/registry";

export default async function CampaignHubPage({ params, searchParams }: PageProps<"/w/[worldId]">) {
  const { worldId } = await params;
  const { template } = await searchParams;
  const { world, membership, user } = await requireWorldPage(worldId);
  const filter = typeof template === "string" && isTemplateType(template) ? template : "all";
  const [details, universes, myWorlds, articles, quests] = await Promise.all([
    getWorldDetails(world.id),
    listUniverses(world.id, membership.role, membership.userId),
    listMyWorlds(user.id),
    listArticles(world.id, membership.role, membership.userId, filter),
    listQuests(world.id, membership.role, membership.userId),
  ]);
  const staff = isStaff(membership.role);

  return (
    <>
      <Hero title={world.name} imageId={details?.titleImageId} />
      <RichTextView doc={asRichDoc(details?.descriptionJson)} />

      <CampaignSearch worldId={world.id} />

      <div className="section-h">
        <h2>Welten</h2>
      </div>
      <div className="card list" style={{ padding: "0 4px" }}>
        {myWorlds.map((entry) => (
          <Link key={entry.id} className="item" href={worldPath(entry.id)}>
            <div className="grow">
              {entry.name}
              <div className="kind">{ROLE_LABEL[entry.role]}</div>
            </div>
            {entry.id === world.id ? <span aria-label="aktuelle Welt">✓</span> : null}
          </Link>
        ))}
        <Link className="item" href="/?new=1">
          <span className="av sm" style={{ background: "var(--panel2)", color: "var(--accent)" }} aria-hidden="true">
            +
          </span>
          <div className="grow">Neue Welt / Einladung</div>
        </Link>
      </div>

      <div className="section-h">
        <h2>Universen</h2>
        {staff ? (
          <Link className="btn sm" href={worldPath(world.id, "/universes/new")}>
            + Universum
          </Link>
        ) : null}
      </div>
      <div className="card list" style={{ padding: "0 4px" }}>
        {universes.length === 0 ? <div className="empty">Noch kein sichtbares Universum.</div> : null}
        {universes.map((universe) => (
          <Link key={universe.id} className="item" href={worldPath(world.id, `/universes/${universe.id}`)}>
            <span style={{ fontSize: 22 }} aria-hidden="true">
              🪐
            </span>
            <div className="grow">{universe.name}</div>
            <VisibilityBadge visibility={universe.visibility} />
            <span className="muted" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>

      <QuestList worldId={world.id} quests={quests} canCreate={staff} />

      <ArticleList worldId={world.id} articles={articles} canCreate={staff} filter={filter} />
    </>
  );
}
