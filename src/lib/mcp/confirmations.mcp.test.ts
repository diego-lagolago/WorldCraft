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

  it("rejects expired and tampered confirmation payloads before calling the handler", async () => {
    const { sql, worldId } = await fixture();
    try {
      const expired = await createMcpConfirmation({
        userId: "test-gm", clientId: "confirmation-client", worldId,
        targetKind: "article", targetId: "expired-target", expectedStand: "stand-1", payload: { operation: "test-expired" },
      });
      await sql.unsafe("UPDATE mcp_change_confirmations SET expires_at = now() - interval '1 minute' WHERE target_id = $1", ["expired-target"]);
      expect(await consumeMcpConfirmation({ token: expired.token, userId: "test-gm", clientId: "confirmation-client" })).toBeNull();

      let executed = false;
      registerMcpConfirmationHandler("test-integrity", async () => {
        executed = true;
        return { worldId, value: "must not run" };
      });
      const tampered = await createMcpConfirmation({
        userId: "test-gm", clientId: "confirmation-client", worldId,
        targetKind: "article", targetId: "tampered-target", expectedStand: "stand-1", payload: { operation: "test-integrity", art: "article" },
      });
      await sql.unsafe("UPDATE mcp_change_confirmations SET payload = jsonb_set(payload, '{art}', '\"quest\"') WHERE target_id = $1", ["tampered-target"]);
      const consumed = await consumeMcpConfirmation({ token: tampered.token, userId: "test-gm", clientId: "confirmation-client" });
      await expect(executeMcpConfirmation(consumed!)).rejects.toThrow("vorgemerkte Änderung ist ungültig");
      expect(executed).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it("012 E10: an optional payload field left undefined still verifies after the JSONB round-trip", async () => {
    const { sql, worldId } = await fixture();
    try {
      registerMcpConfirmationHandler("test-optional", async (row) => ({ worldId: row.worldId, value: "ok" }));
      const created = await createMcpConfirmation({
        userId: "test-gm", clientId: "confirmation-client", worldId,
        targetKind: "relation", targetId: "optional-target", expectedStand: "",
        payload: { operation: "test-optional", bezeichnung: "kennt", gegenbezeichnung: undefined },
      });
      const consumed = await consumeMcpConfirmation({ token: created.token, userId: "test-gm", clientId: "confirmation-client" });
      expect(await executeMcpConfirmation(consumed!)).toEqual({ worldId, value: "ok" });
    } finally {
      await sql.end();
    }
  });
});
