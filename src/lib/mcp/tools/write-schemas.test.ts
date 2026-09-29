import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { fieldsFor, type FieldArt } from "../field-catalog";
import { createFieldSchemas, createFieldsInput, FIELD_TYPE_KEYS, parseFelder, updateFieldSchemas } from "./write-schemas";

describe("MCP write field schemas", () => {
  it("CR-011: derived create and update schemas stay strict", () => {
    const questId = "00000000-0000-4000-8000-000000000000";
    expect(createFieldSchemas.kapitel.safeParse({ quest_id: questId, titel: "x", fremd: 1 }).success).toBe(false);
    expect(updateFieldSchemas.artikel.safeParse({ unbekannt: "x" }).success).toBe(false);
    expect(updateFieldSchemas.kapitel.safeParse({ quest_id: questId }).success).toBe(false);
    expect(updateFieldSchemas.welt.safeParse({ name: "Neu" }).success).toBe(true);
  });

  it("CR-017 / 012 T-005: names unknown and invalid fields with path and valid keys", () => {
    expect(() => parseFelder(updateFieldSchemas.artikel, { unbekannt: "x" }, "artikel"))
      .toThrow("Unbekanntes Feld „felder.unbekannt“. Gültige Felder: titel, vorlagentyp, vorlagenfelder, text.");
    expect(() => parseFelder(updateFieldSchemas.artikel, { sichtbarkeit: "veröffentlicht" }, "artikel")).toThrow("„felder.sichtbarkeit“");
    expect(() => parseFelder(updateFieldSchemas.quest, { status: "egal" }, "quest"))
      .toThrow("Feld „felder.status“ hat den ungültigen Wert „egal“. Erlaubte Werte: offen, aktiv, abgeschlossen, gescheitert.");
  });

  it("012 T-005: names the write key for display labels and known mistakes from E2E-Lauf 1", () => {
    expect(() => parseFelder(updateFieldSchemas.monster, { Gefahrenstufe: "hoch" }, "monster"))
      .toThrow("„Gefahrenstufe“ ist ein Anzeige-Label; der Schreibschlüssel ist `gefahr`.");
    expect(() => parseFelder(updateFieldSchemas.artikel, { seltenheit: "Gewöhnlich" }, "artikel"))
      .toThrow("der Schreibschlüssel ist `vorlagenfelder.Seltenheit`");
    expect(() => parseFelder(updateFieldSchemas.notizblock, { inhalt: "x" }, "notizblock"))
      .toThrow("Statt „inhalt“ bitte den Schreibschlüssel `text` verwenden.");
    expect(() => parseFelder(updateFieldSchemas.monster, { boss: "ja" }, "monster"))
      .toThrow("Feld „felder.boss“ muss true oder false sein.");
  });

  it("exposes strict catalog-derived field objects as an anyOf schema", () => {
    const json = z.toJSONSchema(createFieldsInput) as { anyOf: { additionalProperties?: boolean; description?: string }[] };
    expect(json.anyOf).toHaveLength(5);
    expect(json.anyOf.every((entry) => entry.additionalProperties === false)).toBe(true);
    expect(json.anyOf.map((entry) => entry.description)).toContain("Felder für art = artikel.");
  });

  it("Review 012 CR-005: hand-written field types match the field catalog", () => {
    for (const [art, keys] of Object.entries(FIELD_TYPE_KEYS) as [FieldArt, readonly string[]][]) {
      const catalog = new Set([...fieldsFor("anlegen", art), ...fieldsFor("aendern", art)].map((field) => field.key));
      expect(new Set(keys), art).toEqual(catalog);
    }
  });
});
