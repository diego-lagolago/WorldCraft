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
    expect(error).toContain("felder enthält unbekannte Schlüssel");
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
