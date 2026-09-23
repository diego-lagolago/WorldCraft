import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleFields } from "@/components/articles/ArticleFields";
import { LinkedSection } from "@/components/linked/LinkedSection";
import { RichTextView } from "@/components/editor/RichTextView";
import { worldPath } from "@/components/shell/nav";
import { GmBadge, Hero } from "@/components/world/display";
import { isStaff } from "@/lib/authz/types";
import { getArticle } from "@/lib/domain/articles";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import type { MentionRef } from "@/lib/editor/mentions";
import { isMentionableKind } from "@/lib/editor/mentions";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";
import { templateBadge } from "@/lib/templates/registry";

export default async function ArticlePage({ params }: PageProps<"/w/[worldId]/articles/[articleId]">) {
  const { worldId, articleId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  const id = parseUuid(articleId);
  const article = id ? await getArticle(world.id, id, membership.role, membership.userId) : null;
  if (!article) notFound();

  const doc = asRichDoc(article.bodyJson);
  const fieldRefs: MentionRef[] = [];
  for (const value of Object.values(article.templateFields)) {
    if (typeof value === "object" && isMentionableKind(value.kind)) {
      fieldRefs.push({ kind: value.kind, id: value.id });
    }
  }
  const mentions = await resolveMentions(world.id, membership.role, membership.userId, [...extractMentions(doc), ...fieldRefs]);
  const badge = templateBadge(article.templateType);
  const empty = !article.firstEditedAt;

  return (
    <>
      <Link className="back" href={worldPath(world.id)}>
        ‹ Kampagne
      </Link>
      <Hero title={article.title} imageId={article.titleImageId} />
      <div className="row wrap" style={{ marginBottom: 12 }}>
        {badge ? <span className="badge">{badge}</span> : null}
        <GmBadge visibility={article.visibility} />
        {isStaff(membership.role) ? (
          <Link className="btn sm" style={{ marginLeft: "auto" }} href={worldPath(world.id, `/articles/${article.id}/edit`)}>
            Bearbeiten
          </Link>
        ) : null}
      </div>
      <div className="grid2">
        <div className="stack">
          <ArticleFields templateType={article.templateType} fields={article.templateFields} mentions={mentions} />
          <div className="card">
            <RichTextView
              doc={doc}
              mentions={mentions}
              empty={
                <p className="muted">
                  {empty
                    ? "Dieser Artikel ist noch leer. Erwähnungen darauf erscheinen rot, bis Text oder ein Vorlagenfeld gespeichert wird."
                    : "Noch kein Text."}
                </p>
              }
            />
          </div>
        </div>
        <LinkedSection
          worldId={world.id}
          role={membership.role}
          viewerId={membership.userId}
          kind="article"
          id={article.id}
          canEdit={isStaff(membership.role)}
        />
      </div>
    </>
  );
}
