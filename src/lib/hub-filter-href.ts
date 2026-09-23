import { worldPath } from "@/components/shell/nav";

/** Independent hub list filters (PR6): Glossar `template`, Bestiarium `kind`. */
export type HubFilterParams = {
  template?: string;
  kind?: string;
};

/**
 * Build a campaign-hub chip link that sets or clears only `key`.
 * Other filter params from `current` stay intact.
 */
export function hubFilterHref(
  worldId: string,
  current: HubFilterParams,
  key: keyof HubFilterParams,
  value: string | "all",
): string {
  const next: HubFilterParams = { ...current };
  if (value === "all") delete next[key];
  else next[key] = value;

  const params = new URLSearchParams();
  if (next.template) params.set("template", next.template);
  if (next.kind) params.set("kind", next.kind);
  const qs = params.toString();
  return qs ? `${worldPath(worldId)}?${qs}` : worldPath(worldId);
}
