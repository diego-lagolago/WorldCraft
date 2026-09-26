import {
  assertDiscordAllowlistConfigured,
  assertServerEnv,
  assertTestLoginNotInProduction,
} from "@/lib/env";
import { purgeMcpAuditLog } from "@/lib/mcp/audit";

export async function register() {
  assertServerEnv();
  assertTestLoginNotInProduction();
  assertDiscordAllowlistConfigured();
  void purgeMcpAuditLog().catch(() => undefined);
  const timer = setInterval(() => void purgeMcpAuditLog().catch(() => undefined), 24 * 60 * 60 * 1000);
  timer.unref?.();
}
