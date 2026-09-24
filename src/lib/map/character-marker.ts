import { escapeHtml } from "@/lib/html";

export type MarkerPinVariant = "character" | "monster";

/** Matches `--marker-character` / `--marker-monster` in globals.css (Plan 006 T-002). */
const VARIANT_COLORS: Record<
  MarkerPinVariant,
  { fill: string; stroke: string; className: string }
> = {
  character: { fill: "#c9a227", stroke: "#3d2e08", className: "character" },
  monster: { fill: "#141414", stroke: "#e8e4dc", className: "monster" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function pinBodySvg(variant: MarkerPinVariant): string {
  const { fill, stroke } = VARIANT_COLORS[variant];
  return `<svg class="pin-body" xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58" aria-hidden="true"><path d="M24 2c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34C44 11 35 2 24 2z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="24" cy="21" r="11" fill="#fff7ed"/></svg>`;
}

/** Stecknadel with portrait/initials in the head; tip is the Leaflet anchor (K8). */
export function markerPinHtml(opts: {
  name: string;
  imageUrl: string | null;
  variant: MarkerPinVariant;
}): string {
  const colors = VARIANT_COLORS[opts.variant];
  const short = escapeHtml(opts.name.trim().split(/\s+/)[0] || opts.name);
  const head = opts.imageUrl
    ? `<img class="head" src="${escapeHtml(opts.imageUrl)}" alt="">`
    : `<span class="head">${escapeHtml(initials(opts.name))}</span>`;
  return `<div class="map-marker-pin ${colors.className}">${pinBodySvg(opts.variant)}${head}<span class="nm">${short}</span></div>`;
}

/** @deprecated Prefer markerPinHtml({ variant: "character" }). */
export function characterMarkerHtml(name: string, portraitUrl: string | null): string {
  return markerPinHtml({ name, imageUrl: portraitUrl, variant: "character" });
}
