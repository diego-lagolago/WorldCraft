import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/articles/ArticleForm";
import { isStaff } from "@/lib/authz/types";
import { getArticle, listArticleRefOptions } from "@/lib/domain/articles";
import { editorMentionStates, resolveMentions } from "@/lib/domain/mention-resolve";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function EditArticlePage({ params }: PageProps<"/w/[worldId]/articles/[articleId]/edit">) {
  const { worldId, articleId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const id = parseUuid(articleId);
  const article = id ? await getArticle(world.id, id, membership.role, membership.userId) : null;
  if (!article) notFound();
  const body = asRichDoc(article.bodyJson);
  const [mentions, refOptions] = await Promise.all([
    resolveMentions(world.id, membership.role, membership.userId, extractMentions(body)),
    listArticleRefOptions(world.id),
  ]);

  return (
    <ArticleForm
      worldId={world.id}
      article={{
        id: article.id,
        title: article.title,
        templateType: article.templateType,
        visibility: article.visibility,
        titleImageId: article.titleImageId,
        body,
        templateFields: article.templateFields,
      }}
      refOptions={refOptions}
      mentionStates={editorMentionStates(mentions)}
    />
  );
}
