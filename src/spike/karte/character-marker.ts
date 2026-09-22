/** Spike T-009 — Charakter-Marker: Portrait + Name, optisch kein Pin. */

export function characterMarkerHtml(name: string): string {
  return `<div class="spike-character">
    <div class="spike-character-portrait" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r="23" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
        <circle cx="24" cy="18" r="8" fill="#78350f"/>
        <ellipse cx="24" cy="40" rx="14" ry="10" fill="#92400e"/>
        <circle cx="21" cy="17" r="1.6" fill="#fde68a"/>
        <circle cx="27" cy="17" r="1.6" fill="#fde68a"/>
      </svg>
    </div>
    <span class="spike-character-name">${escapeHtml(name)}</span>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
