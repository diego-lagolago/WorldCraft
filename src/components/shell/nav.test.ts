import { describe, expect, it } from "vitest";
import { NAV_TABS, activeNavTab, isChatFocus, worldPath } from "./nav";

const W = "11111111-1111-4111-8111-111111111111";

describe("NAV_TABS", () => {
  it("has the four fixed labels in order", () => {
    expect(NAV_TABS.map((tab) => tab.label)).toEqual(["Kampagne", "Karte", "Chat", "Menü"]);
  });
});

describe("activeNavTab", () => {
  it.each([
    [`/w/${W}`, "campaign"],
    [`/w/${W}/articles/x`, "campaign"],
    [`/w/${W}/quests/x`, "campaign"],
    [`/w/${W}/universes/x`, "campaign"],
    [`/w/${W}/map`, "map"],
    [`/w/${W}/chat`, "chat"],
    [`/w/${W}/menu`, "menu"],
    [`/w/${W}/characters`, "menu"],
    [`/w/${W}/journal/c`, "menu"],
    ["/characters", "menu"],
  ])("%s → %s", (path, tab) => {
    expect(activeNavTab(path)).toBe(tab);
  });
});

describe("isChatFocus", () => {
  it("is true only on the chat route", () => {
    expect(isChatFocus(worldPath(W, "/chat"))).toBe(true);
    expect(isChatFocus(worldPath(W, "/map"))).toBe(false);
    expect(isChatFocus(worldPath(W))).toBe(false);
  });
});
