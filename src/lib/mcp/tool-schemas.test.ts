import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { registerMcpTools } from "./tools";

type StandardSchema = {
  "~standard": {
    validate: (value: unknown) => Promise<{ issues?: { path?: PropertyKey[]; message: string }[]; value?: unknown }>;
    jsonSchema: { input: (options: { target: string }) => JsonSchema };
  };
};
type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  anyOf?: JsonSchema[];
  enum?: string[];
  items?: JsonSchema;
};

function registeredTools() {
  const tools: Record<string, { inputSchema: StandardSchema }> = {};
  const server = { registerTool: (name: string, definition: { inputSchema: StandardSchema }) => { tools[name] = definition; } };
  registerMcpTools(server as never, { userId: "user-1", clientId: "client-1" } as never);
  return tools;
}

/** Mirrors what the MCP SDK publishes via tools/list. */
function publishedSchema(name: string): JsonSchema {
  return registeredTools()[name].inputSchema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
}

/** Mirrors the SDK's validation and issue formatting before a handler runs. */
async function sdkValidation(name: string, args: Record<string, unknown>) {
  const result = await registeredTools()[name].inputSchema["~standard"].validate(args);
  return result.issues?.map((issue) => `${issue.path?.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`).join(", ") ?? null;
}

function objectsFor(schema: JsonSchema): JsonSchema[] {
  return schema.anyOf ?? [schema];
}

function fieldObject(schema: JsonSchema, art: string): JsonSchema {
  const entry = objectsFor(schema).find((candidate) => candidate.description === `Felder für art = ${art}.`);
  expect(entry, `felder object for ${art}`).toBeDefined();
  return entry!;
}

function objectVariant(schema: JsonSchema): JsonSchema {
  return (schema.anyOf ?? [schema]).find((candidate) => candidate.properties !== undefined) ?? schema;
}

const ID = "00000000-0000-4000-8000-000000000000";
const updateArgs = { welt: "MCP-Testwelt", id: ID, stand: "stand-1" };

describe("published MCP input schemas (012 T-004)", () => {
  it("(1) inhalt_aendern publishes one strict felder object per art, incl. notizblock text and Seltenheit values", () => {
    const felder = publishedSchema("inhalt_aendern").properties!.felder;
    expect(felder.anyOf).toHaveLength(7);
    expect(felder.anyOf!.every((entry) => entry.additionalProperties === false)).toBe(true);
    expect(Object.keys(fieldObject(felder, "notizblock").properties!)).toEqual(["text"]);

    const article = fieldObject(felder, "artikel").properties!;
    expect(article.vorlagentyp.enum).toEqual(["person", "ort", "organisation", "gegenstand", "rasse", "ohne"]);
    const templates = objectsFor(article.vorlagenfelder);
    const item = templates.find((entry) => entry.description === "Vorlagenfelder für vorlagentyp = gegenstand.");
    expect(item?.additionalProperties).toBe(false);
    expect(item?.properties?.Seltenheit.description).toContain("Anzeige: Seltenheit.");
    expect(item?.properties?.Seltenheit.description).toMatch(/Erlaubte Werte: Gewöhnlich, .*Legendär/);
    expect(Object.keys(item!.properties!)).not.toContain("rarity");
  });

  it("(1) inhalt_anlegen marks only catalog-required fields as required", () => {
    const felder = publishedSchema("inhalt_anlegen").properties!.felder as JsonSchema & { anyOf: (JsonSchema & { required?: string[] })[] };
    const required = Object.fromEntries(felder.anyOf.map((entry) => [entry.description, entry.required ?? []]));
    expect(required["Felder für art = artikel."]).toEqual(["titel"]);
    expect(required["Felder für art = kapitel."]).toEqual(["quest_id", "titel"]);
    expect(required["Felder für art = monster."]).toEqual(["name"]);
  });

  it("(2) rejects an unknown felder key before the handler and names the valid keys", async () => {
    const error = await sdkValidation("inhalt_aendern", { ...updateArgs, art: "notizblock", felder: { inhalt: "Notiz" } });
    expect(error).toContain("Unbekanntes Feld „felder.inhalt“. Statt „inhalt“ bitte den Schreibschlüssel `text` (bei art = notizblock) verwenden.");
    expect(error).toContain("notizblock: text");
  });

  it("(3) accepts German template labels, registry keys (E5) and null to clear", async () => {
    expect(await sdkValidation("inhalt_aendern", {
      ...updateArgs, art: "artikel", felder: { vorlagenfelder: { Seltenheit: "Gewöhnlich" } },
    })).toBeNull();
    expect(await sdkValidation("inhalt_aendern", {
      ...updateArgs, art: "artikel", felder: { vorlagenfelder: { rarity: "common", Besitzer: null } },
    })).toBeNull();
    expect(await sdkValidation("inhalt_aendern", {
      ...updateArgs, art: "artikel", felder: { vorlagenfelder: { Gefahrenstufe: "hoch", Seltenheit: "Selten" } },
    })).toContain("felder");
  });

  it("(4) every tool rejects extra parameters, including nested relation endpoints", async () => {
    const quelle = { art: "artikel", id: ID };
    expect(await sdkValidation("relation_anlegen", {
      welt: "MCP-Testwelt", quelle, ziel: quelle, bezeichnung: "kennt", beschreibung: "extra",
    })).toContain("beschreibung");
    expect(await sdkValidation("relation_anlegen", {
      welt: "MCP-Testwelt", quelle: { ...quelle, typ: "artikel" }, ziel: quelle, bezeichnung: "kennt",
    })).toContain("quelle");
    for (const [name, schema] of Object.entries(registeredTools())) {
      const published = schema.inputSchema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
      expect(published.additionalProperties, name).toBe(false);
    }
  });

  it("(5) inhalt_anlegen still accepts an ignored sichtbarkeit (E4)", async () => {
    expect(await sdkValidation("inhalt_anlegen", {
      welt: "MCP-Testwelt", art: "artikel", felder: { titel: "Neu", sichtbarkeit: "veröffentlicht" },
    })).toBeNull();
  });
});

describe("SDK validation errors (012 T-005)", () => {
  it("(1) keeps our German enum text for quest status", async () => {
    const error = await sdkValidation("inhalt_aendern", { ...updateArgs, art: "quest", felder: { status: "Erledigt" } });
    expect(error).toContain("Feld „felder.status“ hat den ungültigen Wert „Erledigt“. Erlaubte Werte: offen, aktiv, abgeschlossen, gescheitert.");
  });

  it("(2) names all six template types for an invalid vorlagentyp", async () => {
    const error = await sdkValidation("inhalt_aendern", { ...updateArgs, art: "artikel", felder: { vorlagentyp: "Waffe" } });
    expect(error).toContain("Feld „felder.vorlagentyp“ hat den ungültigen Wert „Waffe“. Erlaubte Werte: person, ort, organisation, gegenstand, rasse, ohne.");
  });

  it("(4) names felder.boss and true oder false", async () => {
    const error = await sdkValidation("inhalt_aendern", { ...updateArgs, art: "monster", felder: { boss: "ja" } });
    expect(error).toContain("Feld „felder.boss“ muss true oder false sein.");
  });

  it("names the write key for a display label and German texts for fixed enums", async () => {
    expect(await sdkValidation("inhalt_aendern", { ...updateArgs, art: "monster", felder: { Gefahrenstufe: "hoch" } }))
      .toMatch(/„Gefahrenstufe“ ist ein Anzeige-Label; der Schreibschlüssel ist .*`gefahr` \(bei art = monster\)/);
    expect(await sdkValidation("inhalt_aendern", { ...updateArgs, art: "artikel", felder: {}, modus: "anfuegen" }))
      .toContain("Feld „modus“ hat den ungültigen Wert „anfuegen“. Erlaubte Werte: anhaengen, ersetzen.");
    expect(await sdkValidation("relation_anlegen", {
      welt: "MCP-Testwelt", quelle: { art: "charakter", id: ID }, ziel: { art: "artikel", id: ID }, bezeichnung: "kennt",
    })).toContain("Feld „quelle.art“ hat den ungültigen Wert „charakter“.");
  });

  it("012 T-007(6): aenderung_bestaetigen demands the user's explicit consent", () => {
    const tools = registeredTools() as unknown as Record<string, { description: string }>;
    expect(tools.aenderung_bestaetigen.description).toBe(
      "Führt eine Änderung aus, deren Vorschau dem Benutzer gezeigt wurde und der er ausdrücklich zugestimmt hat. Niemals ohne diese Zustimmung aufrufen.",
    );
  });

  it("012 T-009: accepts Ja/Nein as read by inhalt_lesen for yes/no fields", async () => {
    expect(await sdkValidation("inhalt_aendern", { ...updateArgs, art: "monster", felder: { boss: "Ja" } })).toBeNull();
    expect(await sdkValidation("inhalt_aendern", {
      ...updateArgs, art: "artikel", felder: { vorlagenfelder: { "Quest-Gegenstand": "Nein" } },
    })).toBeNull();
  });

  it("Review 012 CR-003: tells a missing value from a wrong type without Zod's English texts", async () => {
    const missing = await sdkValidation("inhalt_anlegen", { welt: "MCP-Testwelt", art: "artikel", felder: {} });
    expect(missing).toContain("Feld „felder.titel“ fehlt.");
    const wrongType = await sdkValidation("inhalt_anlegen", { welt: "MCP-Testwelt", art: "artikel", felder: { titel: 5 } });
    expect(wrongType).toContain("Feld „felder.titel“ muss Text sein.");
    expect(`${missing}${wrongType}`).not.toMatch(/Invalid|expected/);
  });

  it("accepts a partial charakterblatt when creating and changing a monster", async () => {
    expect(await sdkValidation("inhalt_anlegen", {
      welt: "MCP-Testwelt", art: "monster", felder: { name: "Wolf", charakterblatt: { klasse: "Späher" } },
    })).toBeNull();
    expect(await sdkValidation("inhalt_aendern", {
      ...updateArgs, art: "monster", felder: { charakterblatt: { Klasse: "Wächter" } },
    })).toBeNull();
  });

  it("Review 012 CR-004: publishes strict character-sheet details and readable reference targets", () => {
    const monster = fieldObject(publishedSchema("inhalt_aendern").properties!.felder, "monster").properties!;
    const sheet = objectVariant(monster.charakterblatt).properties!;
    expect(Object.keys(sheet.attribute.properties!)).toEqual(["STÄ", "GES", "KON", "INT", "WEI", "CHA"]);
    expect(Object.keys(sheet.fertigkeiten.items.properties!)).toEqual(["name", "stufe", "attribut"]);
    expect(sheet.fertigkeiten.description).toMatch(/untalentiert.*ungeübt.*geübt.*Expertise/);
    expect(monster.lebensraum.description).toContain("Ort-Artikel");
    expect(monster.lebensraum.description).toContain("@\[Titel\]\(artikel:id\)");

    const article = fieldObject(publishedSchema("inhalt_aendern").properties!.felder, "artikel").properties!;
    const templates = objectsFor(article.vorlagenfelder);
    const item = templates.find((entry) => entry.description === "Vorlagenfelder für vorlagentyp = gegenstand.")!;
    expect(item.properties!.Besitzer.description).toContain("Person-Artikel");
    expect(item.properties!.Besitzer.description).toContain("Charakter");
  });
});
