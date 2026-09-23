import { describe, expect, it } from "vitest";
import { CONTENT_KINDS } from "@/lib/authz";
import {
  MENTIONABLE_KINDS,
  escapeLikePattern,
  isMentionableKind,
  mentionCategoryLabel,
  rankMentionHits,
  type MentionHit,
} from "./mentions";

function article(title: string, templateType = "none"): MentionHit {
  return { kind: "article", id: title, title, templateType };
}

describe("mention kinds", () => {
  it("are CONTENT_KINDS without pins (CR-022); include monster (Plan 005 T-007)", () => {
    for (const kind of MENTIONABLE_KINDS) expect(CONTENT_KINDS).toContain(kind);
    expect(MENTIONABLE_KINDS).toContain("monster");
    expect(isMentionableKind("pin")).toBe(false);
    expect(isMentionableKind("artikel")).toBe(false);
    expect(isMentionableKind("article")).toBe(true);
    expect(isMentionableKind("monster")).toBe(true);
  });
});

describe("mentionCategoryLabel", () => {
  it("adds the template to articles", () => {
    expect(mentionCategoryLabel(article("Wertheim", "place"))).toBe("Artikel · Ort");
    expect(mentionCategoryLabel(article("Notiz"))).toBe("Artikel");
    expect(mentionCategoryLabel({ kind: "universe" })).toBe("Universum");
    expect(mentionCategoryLabel({ kind: "character" })).toBe("Charakter");
    expect(mentionCategoryLabel({ kind: "monster" })).toBe("Monster");
  });
});

describe("rankMentionHits", () => {
  it("puts word-start hits first, then alphabetical", () => {
    const hits = [article("Burgtor"), article("Tore von Wertheim"), article("Alte Tore"), article("Stor")];
    expect(rankMentionHits(hits, "tor").map((hit) => hit.title)).toEqual([
      "Alte Tore",
      "Tore von Wertheim",
      "Burgtor",
      "Stor",
    ]);
  });

  it("is case-insensitive, filters non-matches and keeps at most 10", () => {
    const hits = Array.from({ length: 14 }, (_, i) => article(`Ort ${String(i).padStart(2, "0")}`));
    hits.push(article("Anderes"));
    const ranked = rankMentionHits(hits, "ORT");
    expect(ranked).toHaveLength(10);
    expect(ranked.every((hit) => hit.title.startsWith("Ort"))).toBe(true);
  });

  it("returns alphabetical hits for an empty query", () => {
    expect(rankMentionHits([article("b"), article("a")], " ").map((hit) => hit.title)).toEqual(["a", "b"]);
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});
