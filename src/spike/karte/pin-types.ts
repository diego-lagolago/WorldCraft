/** Spike T-009 — 12 Pin-Typen laut Plan / datenmodell. Nicht das MVP-Kartenmodul. */

export const SPIKE_PIN_TYPES = [
  "danger",
  "boss",
  "house",
  "city",
  "treasure",
  "landmark",
  "fishing",
  "plants",
  "dungeon",
  "quest",
  "teleporter",
  "shop",
] as const;

export type SpikePinType = (typeof SPIKE_PIN_TYPES)[number];

export type SpikePinTypeMeta = {
  id: SpikePinType;
  label: string;
  color: string;
  symbol: string;
};

export const SPIKE_PIN_TYPE_META: readonly SpikePinTypeMeta[] = [
  { id: "danger", label: "Gefahr", color: "#b91c1c", symbol: "!" },
  { id: "boss", label: "Boss", color: "#6b21a8", symbol: "B" },
  { id: "house", label: "Haus", color: "#92400e", symbol: "H" },
  { id: "city", label: "Stadt", color: "#334155", symbol: "S" },
  { id: "treasure", label: "Schatz", color: "#ca8a04", symbol: "$" },
  { id: "landmark", label: "Stern", color: "#d97706", symbol: "★" },
  { id: "fishing", label: "Angeln", color: "#0891b2", symbol: "≈" },
  { id: "plants", label: "Pflanzen", color: "#15803d", symbol: "♣" },
  { id: "dungeon", label: "Dungeon", color: "#44403c", symbol: "D" },
  { id: "quest", label: "Quest", color: "#1d4ed8", symbol: "?" },
  { id: "teleporter", label: "Teleporter", color: "#c026d3", symbol: "◎" },
  { id: "shop", label: "Shop", color: "#c2410c", symbol: "€" },
];

export function isSpikePinType(value: string): value is SpikePinType {
  return (SPIKE_PIN_TYPES as readonly string[]).includes(value);
}

export function pinTypeMeta(id: SpikePinType): SpikePinTypeMeta {
  const found = SPIKE_PIN_TYPE_META.find((item) => item.id === id);
  if (!found) throw new Error(`Unbekannter Pin-Typ: ${id}`);
  return found;
}

export function pinTypeIconUrl(id: SpikePinType): string {
  const { color, symbol } = pinTypeMeta(id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
    <path d="M24 2c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34C44 11 35 2 24 2z" fill="${color}" stroke="#0f172a" stroke-width="2"/>
    <circle cx="24" cy="21" r="11" fill="#fff7ed"/>
    <text x="24" y="26.5" text-anchor="middle" font-size="14" font-family="system-ui,sans-serif" font-weight="700" fill="${color}">${escapeXml(symbol)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function pinMarkerHtml(id: SpikePinType, locked: boolean): string {
  const lock = locked
    ? `<span class="spike-pin-lock" aria-hidden="true"></span>`
    : "";
  return `<div class="spike-pin-hit">${lock}<img src="${pinTypeIconUrl(id)}" alt="" width="48" height="58"></div>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
