/** Bottom bar / side rail (mobile-navigation.md): labels and order are fixed. */
export const NAV_TABS = [
  { id: "campaign", label: "Kampagne", icon: "🌍", path: "" },
  { id: "map", label: "Karte", icon: "🗺️", path: "/map" },
  { id: "chat", label: "Chat", icon: "💬", path: "/chat" },
  { id: "menu", label: "Menü", icon: "☰", path: "/menu" },
] as const;

export type NavTabId = (typeof NAV_TABS)[number]["id"];

const MENU_SECTIONS = new Set(["menu", "characters", "journal"]);

export function worldPath(worldId: string, tabPath = ""): string {
  return `/w/${worldId}${tabPath}`;
}

/** Which tab a pathname belongs to. World-independent pages (`/characters`) count as Menü. */
export function activeNavTab(pathname: string): NavTabId {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "w") return "menu";
  const section = parts[2];
  if (!section) return "campaign";
  if (section === "map") return "map";
  if (section === "chat") return "chat";
  if (MENU_SECTIONS.has(section)) return "menu";
  return "campaign";
}

/** Only the chat composer covers the bottom bar (mobile-navigation.md). */
export function isChatFocus(pathname: string): boolean {
  return activeNavTab(pathname) === "chat";
}
