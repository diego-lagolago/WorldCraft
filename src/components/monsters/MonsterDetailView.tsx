import Link from "next/link";
import { LinkedSection } from "@/components/linked/LinkedSection";
import { SheetBodyView } from "@/components/sheet/SheetBodyView";
import { worldPath } from "@/components/shell/nav";
import { Avatar, VisibilityBadge } from "@/components/world/display";
import type { MembershipRole } from "@/lib/authz/types";
import { contentHref } from "@/lib/content-href";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_KIND_LABEL,
  MONSTER_SIZE_LABEL,
} from "@/lib/monsters/labels";
import type { MonsterDetails } from "@/lib/domain/monsters";
import { MonsterBossMark, MonsterRarityPill } from "./MonsterRarityPill";
import "@/components/sheet/sheet.css";

function sizeLabel(size: MonsterDetails["size"]): string {
  const label = MONSTER_SIZE_LABEL[size];
  return size === "medium" ? `${label} (ca. 1,50 m Schulterhöhe)` : label;
}

export function MonsterDetailView({
  worldId,
  monster,
  habitat,
  mentions,
  canEdit,
  role,
  viewerId,
}: {
  worldId: string;
  monster: MonsterDetails;
  habitat: { id: string; title: string } | null;
  mentions: Record<string, ResolvedMention>;
  canEdit: boolean;
  role: MembershipRole;
  viewerId: string;
}) {
  return (
    <>
      <Link className="back" href={worldPath(worldId)}>
        ‹ Kampagne
      </Link>
      <div className="row" style={{ marginBottom: 14 }}>
        <Avatar
          name={monster.name}
          image={monster.portraitId ? `/api/files/${monster.portraitId}` : null}
          size="lg"
        />
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>{monster.name}</h1>
          <div className="muted">
            {[monster.class, MONSTER_KIND_LABEL[monster.kind]].filter(Boolean).join(" · ")}
          </div>
          <div className="row wrap" style={{ marginTop: 6, gap: 6 }}>
            <MonsterRarityPill rarity={monster.rarity} />
            <MonsterBossMark isBoss={monster.isBoss} />
            <VisibilityBadge visibility={monster.visibility} />
          </div>
        </div>
        {canEdit ? (
          <Link className="btn sm" href={contentHref(worldId, "monster", monster.id, "edit")}>
            Bearbeiten
          </Link>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <dl className="fields">
          <dt>Art</dt>
          <dd>{MONSTER_KIND_LABEL[monster.kind]}</dd>
          <dt>Größe</dt>
          <dd>{sizeLabel(monster.size)}</dd>
          <dt>Gefahrenstufe</dt>
          <dd>{MONSTER_DANGER_LABEL[monster.danger]}</dd>
          <dt>Lebensraum</dt>
          <dd>
            {habitat ? (
              <Link className="mention" href={contentHref(worldId, "article", habitat.id)}>
                {habitat.title}
              </Link>
            ) : (
              <span className="muted">–</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="grid2">
        <SheetBodyView
          sheet={monster}
          mentions={mentions}
          bioEmpty={<p className="muted">Noch keine Bio.</p>}
        />
        <div className="stack">
          <div className="card">
            <h2>Profilbild</h2>
            {monster.portraitId ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by /api/files
              <img
                src={`/api/files/${monster.portraitId}`}
                alt=""
                style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 10 }}
              />
            ) : (
              <span className="muted small">Kein Bild – Initialen als Platzhalter.</span>
            )}
          </div>
          <LinkedSection
            worldId={worldId}
            role={role}
            viewerId={viewerId}
            kind="monster"
            id={monster.id}
            canEdit={canEdit}
          />
        </div>
      </div>
    </>
  );
}
