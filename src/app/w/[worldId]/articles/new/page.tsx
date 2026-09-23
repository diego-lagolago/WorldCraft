import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/articles/ArticleForm";
import { isStaff } from "@/lib/authz/types";
import { listArticleRefOptions } from "@/lib/domain/articles";
import { requireWorldPage } from "@/lib/page-context";

export default async function NewArticlePage({ params }: PageProps<"/w/[worldId]/articles/new">) {
  const { worldId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const refOptions = await listArticleRefOptions(world.id);
  return <ArticleForm worldId={world.id} actorId={membership.userId} refOptions={refOptions} />;
}
