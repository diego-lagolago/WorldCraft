import { escapeHtml } from "@/lib/html";

export function characterMarkerHtml(name: string, portraitUrl: string | null): string {
  const portrait = portraitUrl
    ? `<img class="av" src="${escapeHtml(portraitUrl)}" alt="">`
    : `<span class="av">${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  return `<div class="map-character">${portrait}<span class="nm">${escapeHtml(name)}</span></div>`;
}
