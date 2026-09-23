import { MENTION_QUERY_MAX, type MentionHit } from "@/lib/editor/mentions";

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Non-JSON error body: keep the fallback.
  }
  return fallback;
}

export async function searchMentions(worldId: string, query: string): Promise<MentionHit[]> {
  const params = new URLSearchParams({ q: query.slice(0, MENTION_QUERY_MAX) });
  const response = await fetch(`/api/worlds/${worldId}/mentions?${params}`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Suche fehlgeschlagen."));
  const body = (await response.json()) as { hits: MentionHit[] };
  return body.hits;
}

export async function createArticleStub(worldId: string, title: string): Promise<MentionHit> {
  const response = await fetch(`/api/worlds/${worldId}/articles`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Der Artikel konnte nicht angelegt werden."));
  }
  const body = (await response.json()) as { article: { id: string; title: string; templateType: string } };
  return {
    kind: "article",
    id: body.article.id,
    title: body.article.title,
    templateType: body.article.templateType,
  };
}
