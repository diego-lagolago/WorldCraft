import {
  assertDiscordAllowlistConfigured,
  assertTestLoginNotInProduction,
} from "@/lib/env";

export async function register() {
  assertTestLoginNotInProduction();
  assertDiscordAllowlistConfigured();
}
