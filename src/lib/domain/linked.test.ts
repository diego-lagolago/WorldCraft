import { describe, expect, it } from "vitest";
import { groupLinkedItems, linkedGroupLabel, type LinkedItem } from "./linked";

function item(kind: LinkedItem["kind"], title: string, extra: Partial<LinkedItem> = {}): LinkedItem {
  return {
    kind,
    id: title,
    title,
    href: "/",
    originLabels: ["Erwähnung"],
    manualLabel: null,
    ...extra,
  };
}

describe("groupLinkedItems (T-010 (4))", () => {
  it("omits empty groups and splits articles by template", () => {
    const groups = groupLinkedItems([
      item("character", "Aldric"),
      item("article", "Burg", { templateType: "place" }),
      item("article", "Mira", { templateType: "person" }),
      item("universe", "Rauch"),
      item("monster", "Schattenwolf"),
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Orte",
      "Personen",
      "Charaktere",
      "Universen",
      "Monster",
    ]);
    expect(groups.some((group) => group.label === "Pins" || group.label === "Quests")).toBe(false);
  });

  it("labels none-template articles as Artikel", () => {
    expect(linkedGroupLabel("article", "none")).toBe("Artikel");
    expect(linkedGroupLabel("pin")).toBe("Pins");
    expect(linkedGroupLabel("monster")).toBe("Monster");
  });
});
