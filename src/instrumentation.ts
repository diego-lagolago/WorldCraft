import {
  assertDiscordAllowlistConfigured,
  assertServerEnv,
  assertTestLoginNotInProduction,
} from "@/lib/env";
import { purgeMcpAuditLog } from "@/lib/mcp/audit";
import { configureZodLocale } from "@/lib/zod-locale";

export async function register() {
  configureZodLocale();
  assertServerEnv();
  assertTestLoginNotInProduction();
  assertDiscordAllowlistConfigured();
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const reportPurgeError = (error: unknown) => console.error(JSON.stringify({ event: "mcp_audit_error", operation: "purge", error: error instanceof Error ? error.name : "unknown" }));
  void purgeMcpAuditLog().catch(reportPurgeError);
  const timer = setInterval(() => void purgeMcpAuditLog().catch(reportPurgeError), 24 * 60 * 60 * 1000);
  timer.unref?.();
}
