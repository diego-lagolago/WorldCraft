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

  const reportPurgeError = (error: unknown) => console.error(JSON.stringify({
    event: "mcp_audit_error",
    operation: "purge",
    error: error instanceof Error ? error.name : "unknown",
  }));

  void purgeMcpAuditLog().catch(reportPurgeError);
  void purgeMcpChangeConfirmations().catch(reportPurgeError);
  void purgeMcpUploadTickets().catch(reportPurgeError);
  const timer = setInterval(() => {
    void purgeMcpAuditLog().catch(reportPurgeError);
    void purgeMcpChangeConfirmations().catch(reportPurgeError);
    void purgeMcpUploadTickets().catch(reportPurgeError);
  }, 24 * 60 * 60 * 1000);
  timer.unref?.();
}
