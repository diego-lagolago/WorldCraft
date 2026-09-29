import {
  assertDiscordAllowlistConfigured,
  assertServerEnv,
  assertTestLoginNotInProduction,
} from "@/lib/env";
import { configureZodLocale } from "@/lib/zod-locale";

export async function register() {
  configureZodLocale();
  assertServerEnv();
  assertTestLoginNotInProduction();
  assertDiscordAllowlistConfigured();
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ purgeMcpAuditLog }, { purgeMcpChangeConfirmations }, { purgeMcpUploadTickets }] = await Promise.all([
    import("@/lib/mcp/audit"),
    import("@/lib/mcp/confirmations"),
    import("@/lib/mcp/upload-tickets"),
  ]);

  const reportPurgeError = (operation: "purge_audit" | "purge_confirmations" | "purge_upload_tickets") => (error: unknown) => console.error(JSON.stringify({
    event: "mcp_purge_error",
    operation,
    error: error instanceof Error ? error.name : "unknown",
  }));

  void purgeMcpAuditLog().catch(reportPurgeError("purge_audit"));
  void purgeMcpChangeConfirmations().catch(reportPurgeError("purge_confirmations"));
  void purgeMcpUploadTickets().catch(reportPurgeError("purge_upload_tickets"));
  const timer = setInterval(() => {
    void purgeMcpAuditLog().catch(reportPurgeError("purge_audit"));
    void purgeMcpChangeConfirmations().catch(reportPurgeError("purge_confirmations"));
    void purgeMcpUploadTickets().catch(reportPurgeError("purge_upload_tickets"));
  }, 24 * 60 * 60 * 1000);
  timer.unref?.();
}
