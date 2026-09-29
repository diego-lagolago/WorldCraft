import { describe, expect, it, vi } from "vitest";

const { deleteArticle } = vi.hoisted(() => ({ deleteArticle: vi.fn() }));

vi.mock("@/lib/domain/articles", () => ({ deleteArticle }));

import { withMcpStubCompensation } from "./stub-compensation";

describe("withMcpStubCompensation", () => {
  it("deletes exactly the stubs from a failed write phase", async () => {
    const error = new Error("main write failed");
    const write = vi.fn().mockRejectedValue(error);
    deleteArticle.mockResolvedValue({ ok: true });

    await expect(withMcpStubCompensation({
      membership: {} as never,
      actorId: "user-1",
      worldId: "world-1",
      stubs: [{ id: "stub-1" }, { id: "stub-2" }],
      write,
    })).rejects.toBe(error);

    expect(deleteArticle).toHaveBeenCalledTimes(2);
    expect(deleteArticle).toHaveBeenNthCalledWith(1, expect.objectContaining({ articleId: "stub-1" }));
    expect(deleteArticle).toHaveBeenNthCalledWith(2, expect.objectContaining({ articleId: "stub-2" }));
  });
});
