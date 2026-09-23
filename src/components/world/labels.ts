import type { MembershipRole } from "@/lib/authz/types";

export const ROLE_LABEL: Record<MembershipRole, string> = {
  game_master: "Game Master",
  master: "Master",
  player: "Player",
};
