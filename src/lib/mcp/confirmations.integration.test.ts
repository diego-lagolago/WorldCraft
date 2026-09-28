import { describe, expect, it } from "vitest";
import { testSql } from "@/test/api-harness";
import { consumeMcpConfirmation, createMcpConfirmation, executeMcpConfirmation, registerMcpConfirmationHandler } from "./confirmations";

async function fixture() {
  const sql = testSql();
  const [world] = await sql.unsafe("SELECT id FROM worlds WHERE name = 'MCP-Testwelt' LIMIT 1");
  return { sql, worldId: world.id as string };
}

describe("MCP confirmation tokens", () => {
  it("stores no plaintext token and consumes a handle exactly once for its owner and client", async () => {
    const { sql, worldId } = await fixture();
    try {
      const created = await createMcpConfirmation({
        userId: "test-gm", clientId: "confirmation-client", worldId,
        targetKind: "article", targetId: "target-1", expectedStand: "stand-1", payload: { operation: "test" },
      });
      const [stored] = await sql.unsafe("SELECT token_hash, payload FROM mcp_change_confirmations WHERE target_id = $1", ["target-1"]);
      expect(stored.token_hash).not.toBe(created.token);
      expect(JSON.stringify(stored)).not.toContain(created.token);
      expect(await consumeMcpConfirmation({ token: created.token, userId: "test-master", clientId: "confirmation-client" })).toBeNull();
      expect(await consumeMcpConfirmation({ token: created.token, userId: "test-gm", clientId: "other-client" })).toBeNull();
      registerMcpConfirmationHandler("test", async (row) => ({ worldId: row.worldId, value: `ausgeführt: ${row.targetId}` }));
      const consumed = await consumeMcpConfirmation({ token: created.token, userId: "test-gm", clientId: "confirmation-client" });
      expect(consumed).toMatchObject({ targetId: "target-1" });
      expect(await executeMcpConfirmation(consumed!)).toEqual({ worldId, value: "ausgeführt: target-1" });
      expect(await consumeMcpConfirmation({ token: created.token, userId: "test-gm", clientId: "confirmation-client" })).toBeNull();
    } finally {
      await sql.end();
    }
  });
});
