import { deleteArticle } from "@/lib/domain/articles";

type DeleteArticleInput = Parameters<typeof deleteArticle>[0];

type StubArticle = { id: string };

export async function compensateMcpStubArticles(input: {
  membership: DeleteArticleInput["membership"];
  actorId: string;
  worldId: string;
  stubs: StubArticle[];
}) {
  await Promise.all(input.stubs.map(async (stub) => {
    const removed = await deleteArticle({
      membership: input.membership,
      actorId: input.actorId,
      worldId: input.worldId,
      articleId: stub.id,
    }).catch(() => null);
    if (!removed?.ok) console.error(JSON.stringify({ event: "mcp_stub_compensation_error", stubId: stub.id }));
  }));
}

/** Runs a write phase and removes only the stubs created earlier in this request on failure. */
export async function withMcpStubCompensation<T>(input: {
  membership: DeleteArticleInput["membership"];
  actorId: string;
  worldId: string;
  stubs: StubArticle[];
  write: () => Promise<T>;
}): Promise<T> {
  try {
    return await input.write();
  } catch (error) {
    await compensateMcpStubArticles(input);
    throw error;
  }
}
