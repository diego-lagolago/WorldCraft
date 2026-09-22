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
};

export const SPIKE_PIN_TYPE_META: readonly SpikePinTypeMeta[] = [
  { id: "danger", label: "Gefahr", color: "#b91c1c" },
  { id: "boss", label: "Boss", color: "#6b21a8" },
  { id: "house", label: "Haus", color: "#92400e" },
  { id: "city", label: "Stadt", color: "#334155" },
  { id: "treasure", label: "Schatz", color: "#ca8a04" },
  { id: "landmark", label: "Stern", color: "#d97706" },
  { id: "fishing", label: "Angeln", color: "#0891b2" },
  { id: "plants", label: "Pflanzen", color: "#15803d" },
  { id: "dungeon", label: "Dungeon", color: "#44403c" },
  { id: "quest", label: "Quest", color: "#1d4ed8" },
  { id: "teleporter", label: "Teleporter", color: "#c026d3" },
  { id: "shop", label: "Shop", color: "#c2410c" },
];

/** One 24×24 family: filled silhouettes, shared 1.5 weight, no letters. */
const PIN_PICTOGRAMS: Record<SpikePinType, string> = {
  danger: `<path fill="currentColor" fill-rule="evenodd" d="M12 2.2 22.6 21.4H1.4L12 2.2Zm0 6.4c.6 0 1.1.5 1.1 1.1v4.6c0 .6-.5 1.1-1.1 1.1s-1.1-.5-1.1-1.1V9.7c0-.6.5-1.1 1.1-1.1Zm0 8.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"/>`,
  boss: `<path fill="currentColor" fill-rule="evenodd" d="M12 2.2c4.9 0 8.6 3.5 8.6 7.8 0 2.2-1 4.1-2.6 5.4v2.4c0 1.1-1 1.9-2.2 1.9H8.2c-1.2 0-2.2-.8-2.2-1.9v-2.4C4.4 14.1 3.4 12.2 3.4 10 3.4 5.7 7.1 2.2 12 2.2ZM8.6 8.6a2 2.1 0 1 0 0 4.2 2 2.1 0 0 0 0-4.2Zm6.8 0a2 2.1 0 1 0 0 4.2 2 2.1 0 0 0 0-4.2ZM12 12.2 10.4 15.4h3.2L12 12.2Zm-2.8 5.4h1.1v1.4H9.2v-1.4Zm2.3 0h1v1.4h-1v-1.4Zm2.2 0h1.1v1.4h-1.1v-1.4Z"/>`,
  house: `<path fill="currentColor" fill-rule="evenodd" d="M12 2.6 2.2 11.2h2.6V21.6h14.4V11.2h2.6L12 2.6ZM10.2 13.4h3.6V21.6h-3.6V13.4Z"/>`,
  city: `<path fill="currentColor" d="M5.8 12.4 2.8 15h.9V21.6h4.4v-6.6h.9L5.8 12.4Z"/><path fill="currentColor" fill-rule="evenodd" d="M12 3.8 8 7.8h1.1V21.6h5.8V7.8H16L12 3.8Zm-1.3 9.4h2.6v8.4h-2.6v-8.4Z"/><path fill="currentColor" d="M18.4 10.2 15.4 13h.9V21.6h4.6V13h.9L18.4 10.2Z"/>`,
  treasure: `<path fill="currentColor" d="M3 8h18c.7 0 1.2.5 1.2 1.1V11.6H1.8V9.1C1.8 8.5 2.3 8 3 8Z"/><path fill="currentColor" fill-rule="evenodd" d="M2.2 12h19.6v8.2c0 .9-.8 1.6-1.7 1.6H3.9c-.9 0-1.7-.7-1.7-1.6V12Zm8.4 1.2h2.8v3.1c0 .6-.6 1.1-1.4 1.1s-1.4-.5-1.4-1.1v-3.1Z"/><path fill="currentColor" d="M11.1 8h1.8v13.2h-1.8z"/>`,
  landmark: `<path fill="currentColor" d="M12 2 14.7 8.8H22l-5.6 4.2 2.1 7-6.5-4.4-6.5 4.4 2.1-7L2 8.8h7.3L12 2Z"/>`,
  fishing: `<path fill="currentColor" fill-rule="evenodd" d="M2.4 12C4.2 7 9.2 4.8 14.6 7.2L22.2 5.8 19 12l3.2 6.2-7.6-1.4C9.2 19.2 4.2 17 2.4 12Zm4.8-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>`,
  plants: `<path fill="currentColor" d="M17.8 2.4c3.4 4.4 2.8 11.4-1.6 15.2-2.6 2.2-6.2 1.6-7.1-1-1.2-4.4 3.6-11.4 8.7-14.2Z"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M10.4 17C9.2 18.8 7.8 20.4 6.6 21.4"/>`,
  dungeon: `<path fill="currentColor" fill-rule="evenodd" d="M2 21.4 3.4 13.2 7 8.2 10.4 5.2 12 4.2l1.8 1.2 3.4 3 3.4 5 1.4 8H2Zm6.4 0v-6.4c0-2 1.5-3.6 3.6-3.6s3.6 1.6 3.6 3.6v6.4H8.4Z"/>`,
  quest: `<path fill="currentColor" fill-rule="evenodd" d="M6.4 4.4h10.8c1 0 1.8.8 1.8 1.8v1.1c.6.3 1 .9 1 1.6v8.6c0 1.3-1.1 2.3-2.4 2.3H7.4C6 19.8 4.8 18.7 4.8 17.3V6.2c0-1 .8-1.8 1.6-1.8Zm.8 2.8h10.2V6.4H7.2v.8Zm1.4 2.8h7.6v1.3H8.6V10Zm0 2.8h6v1.3h-6V12.8Z"/>`,
  teleporter: `<defs><linearGradient id="spike-gal-grad" x1="12%" y1="88%" x2="88%" y2="12%"><stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient><clipPath id="spike-gal-clip"><circle cx="12" cy="12" r="10"/></clipPath></defs><circle cx="12" cy="12" r="10" fill="url(#spike-gal-grad)"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#spike-gal-clip)"><path d="M12.7 11.5 13.3 11.7 13.8 12.4 13.9 13.3 13.5 14.4 12.5 15.3 11.1 15.7 9.4 15.5 7.8 14.4 6.7 12.7 6.4 10.4 7.1 8.1 8.8 6 11.3 4.7 14.4 4.5 17.4 5.7 19.9 8.1 21.3 11.5"/><path d="M11.3 12.5 10.7 12.3 10.2 11.6 10.1 10.7 10.5 9.6 11.5 8.7 12.9 8.3 14.6 8.5 16.2 9.6 17.3 11.3 17.6 13.6 16.9 15.9 15.2 18 12.7 19.3 9.6 19.5 6.6 18.3 4.1 15.9 2.7 12.5"/></g><g fill="#fff"><circle cx="7.2" cy="7.6" r=".7"/><circle cx="16.8" cy="8.2" r=".55"/><circle cx="16.2" cy="16.4" r=".6"/></g>`,
  shop: `<path fill="currentColor" d="M7.6 8.8c0-1.7 1.1-3 2.2-3 .5 0 .9.2 1.2.6.5-1.2 1.7-2 2.8-2 1.4 0 2.6 1.5 2.6 3.2 0 .4 0 .8-.1 1.2H7.7c0-.3-.1-.6-.1-1Z"/><rect fill="currentColor" x="5.2" y="8.3" width="13.6" height="2.3" rx="1.15"/><path fill="currentColor" d="M5.8 10.5h12.4l1.1 9.3c.12 1-.7 1.9-1.7 1.9H6.4c-1 0-1.82-.9-1.7-1.9l1.1-9.3Z"/><circle cx="12" cy="16.1" r="3.55" fill="#fde68a"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M12 13.7v4.8M13.6 14.5c.05-.85-1.4-1.15-2.2-.35M10.5 17.6c.15.9 1.5 1.15 2.25.3"/>`,
};

export function isSpikePinType(value: string): value is SpikePinType {
  return (SPIKE_PIN_TYPES as readonly string[]).includes(value);
}

export function pinTypeMeta(id: SpikePinType): SpikePinTypeMeta {
  const found = SPIKE_PIN_TYPE_META.find((item) => item.id === id);
  if (!found) throw new Error(`Unbekannter Pin-Typ: ${id}`);
  return found;
}

export function pinTypePictogram(id: SpikePinType): string {
  return PIN_PICTOGRAMS[id];
}

export function pinTypeIconUrl(id: SpikePinType): string {
  const { color } = pinTypeMeta(id);
  const pictogram =
    id === "teleporter"
      ? `<svg x="13.2" y="10.2" width="21.6" height="21.6" viewBox="0 0 24 24">${pinTypePictogram(id)}</svg>`
      : `<circle cx="24" cy="21" r="11" fill="#fff7ed"/>
    <svg x="15" y="12" width="18" height="18" viewBox="0 0 24 24" color="${color}">${pinTypePictogram(id)}</svg>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
    <path d="M24 2c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34C44 11 35 2 24 2z" fill="${color}" stroke="#0f172a" stroke-width="2"/>
    ${pictogram}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function pinMarkerHtml(id: SpikePinType, locked: boolean): string {
  const lock = locked
    ? `<span class="spike-pin-lock" aria-hidden="true"></span>`
    : "";
  return `<div class="spike-pin-hit">${lock}<img src="${pinTypeIconUrl(id)}" alt="" width="48" height="58"></div>`;
}
