/**
 * Creates the production demo world for the MCP walkthrough.
 *
 * Run manually from a trusted machine after signing in as a game master:
 *   WORLDCRAFT_URL=https://worldcraft.lagolago.at \
 *   WORLDCRAFT_SESSION='better-auth.session_token=…' \
 *   node scripts/seed-demo-world.mjs
 *
 * The script never prints the session and refuses to touch an existing
 * "MCP-Demo" world. It intentionally uses the public product API only.
 */

const worldName = "MCP-Demo";
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1xQAAAABJRU5ErkJggg==",
  "base64",
);

function rich(text, mention) {
  const content = text ? [{ type: "text", text }] : [];
  if (mention) content.push({ type: "mention", attrs: { id: mention.id, kind: mention.kind, label: mention.label, mentionSuggestionChar: "@" } });
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

function config() {
  const baseUrl = process.env.WORLDCRAFT_URL?.replace(/\/$/, "");
  const session = process.env.WORLDCRAFT_SESSION;
  let url;
  try { url = new URL(baseUrl); } catch { throw new Error("WORLDCRAFT_URL muss eine gültige URL sein."); }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) throw new Error("WORLDCRAFT_URL muss https:// verwenden (lokal ist nur http://localhost erlaubt).");
  if (!session?.trim()) throw new Error("WORLDCRAFT_SESSION fehlt. Bitte nur den Cookie-Wert einer eigenen GM-Sitzung setzen.");
  return { baseUrl, session };
}

async function request(baseUrl, session, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: session,
      origin: baseUrl,
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path}: ${body.error ?? response.statusText}`);
  return body;
}

async function upload(baseUrl, session, kind, worldId, targetId) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("worldId", worldId);
  if (targetId) form.set("targetId", targetId);
  form.set("image", new Blob([tinyPng], { type: "image/png" }), `${kind}.png`);
  await request(baseUrl, session, "/api/files", { method: "POST", body: form });
}

async function main() {
  const { baseUrl, session } = config();
  const existing = await request(baseUrl, session, "/api/worlds");
  if (existing.worlds?.some((world) => world.name === worldName)) {
    throw new Error(`Die Welt „${worldName}“ existiert bereits. Es wurden keine Daten verändert.`);
  }

  const world = await request(baseUrl, session, "/api/worlds", {
    method: "POST",
    body: JSON.stringify({ name: worldName, description: rich("Eine kleine veröffentlichte Welt zum Ausprobieren der WorldCraft-MCP-Verbindung.") }),
  });
  const worldId = world.id;
  await request(baseUrl, session, `/api/worlds/${worldId}`, { method: "PATCH", body: JSON.stringify({ mcpEnabled: true }) });
  await upload(baseUrl, session, "world_title", worldId);

  const race = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({ title: "Nebelgeborene", templateType: "race", visibility: "published", body: rich("Ein Volk, das die kalten Nebel der Nebelmark kennt.") }),
  });

  const burg = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({
      title: "Burg Rabenstein",
      templateType: "place",
      templateFields: { kind: "building", danger: "dangerous", reputation: "neutral" },
      visibility: "published",
      body: rich("Die alte Grenzfeste wacht über den Pass der Nebelmark."),
    }),
  });
  await upload(baseUrl, session, "article_title", worldId, burg.article.id);

  const organisation = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({
      title: "Schattenhand",
      templateType: "organization",
      templateFields: { kind: "cult", size: "up_to_50", danger: "deadly", seat: { kind: "article", id: burg.article.id } },
      visibility: "published",
      body: rich("Eine verschlossene Bruderschaft, die nach dem Amulett sucht."),
    }),
  });
  const person = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({
      title: "Esten Falkenauge",
      templateType: "person",
      templateFields: { aliases: "Der graue Bote", occupation: "Kundschafter", race: { kind: "article", id: race.article.id }, status: "alive", location: { kind: "article", id: burg.article.id }, organization: { kind: "article", id: organisation.article.id } },
      visibility: "published",
      body: rich("Esten kennt die Geheimwege der Burg Rabenstein."),
    }),
  });

  const amulett = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({
      title: "Amulett der Dämmerung",
      templateType: "item",
      templateFields: { quest: true, rarity: "rare" },
      visibility: "published",
      body: rich("Das Amulett ist der Schlüssel zu den Katakomben von Rabenstein.", { id: burg.article.id, kind: "article", label: "Burg Rabenstein" }),
    }),
  });
  const geheim = await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({
      title: "Geheimer Plan der Schattenhand",
      templateType: "organization",
      visibility: "gm_only",
      body: rich("Dieser Artikel ist bewusst nur für die Spielleitung sichtbar.", { id: burg.article.id, kind: "article", label: "Burg Rabenstein" }),
    }),
  });

  await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({ title: "Wegzehrung", templateType: "item", templateFields: { kind: "mundane", rarity: "common", quest: false }, visibility: "published", body: rich("Praktische Vorräte für den Marsch durch die Nebelmark.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/articles`, {
    method: "POST",
    body: JSON.stringify({ title: "Chronik der Nebelmark", templateType: "none", visibility: "published", body: rich("Eine unvollständige Sammlung alter Reiseberichte.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/relations`, {
    method: "POST",
    body: JSON.stringify({ sourceKind: "article", sourceId: burg.article.id, targetKind: "article", targetId: person.article.id, label: "wird erkundet von", counterLabel: "erkundet" }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/relations`, {
    method: "POST",
    body: JSON.stringify({ sourceKind: "article", sourceId: burg.article.id, targetKind: "article", targetId: geheim.article.id, label: "birgt Hinweise auf", counterLabel: "hat Hinweise bei" }),
  });

  const quest = await request(baseUrl, session, `/api/worlds/${worldId}/quests`, {
    method: "POST",
    body: JSON.stringify({
      title: "Das verschwundene Amulett",
      status: "active",
      visibility: "published",
      description: rich("Findet das Amulett der Dämmerung, bevor die Schattenhand Rabenstein erreicht.", { id: amulett.article.id, kind: "article", label: "Amulett der Dämmerung" }),
    }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/quests/${quest.quest.id}/chapters`, {
    method: "POST",
    body: JSON.stringify({ title: "Spur im Nebel", visibility: "published", body: rich("Die Spur führt über den alten Pass nach Burg Rabenstein.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/quests/${quest.quest.id}/chapters`, {
    method: "POST",
    body: JSON.stringify({ title: "Der geheime Zugang", visibility: "gm_only", body: rich("Nur die Spielleitung kennt den Zugang durch die Katakomben.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/quests/${quest.quest.id}/notes`, {
    method: "PUT",
    body: JSON.stringify({ version: 0, bodyJson: rich("Notiz für alle Beteiligten: Beim Westtor nach dem Rabenwappen suchen.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/quests`, {
    method: "POST",
    body: JSON.stringify({ title: "Die Rückkehr des Nebelwolfs", status: "open", visibility: "published", description: rich("Die Dörfer bitten um Hilfe gegen die Wölfe."), }),
  });

  const monster = await request(baseUrl, session, `/api/worlds/${worldId}/monsters`, {
    method: "POST",
    body: JSON.stringify({ name: "Nebelwolf", kind: "beast", rarity: "uncommon", danger: "dangerous", size: "medium", visibility: "published", habitatArticleId: burg.article.id, bio: rich("Ein Rudeljäger, der in den Nebeln um Rabenstein lauert.") }),
  });
  await upload(baseUrl, session, "monster_portrait", worldId, monster.monster.id);
  await request(baseUrl, session, `/api/worlds/${worldId}/monsters`, {
    method: "POST",
    body: JSON.stringify({ name: "Grabwächter", kind: "undead", rarity: "rare", danger: "deadly", size: "large", visibility: "published", habitatArticleId: burg.article.id, bio: rich("Ein untoter Wächter der Katakomben.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/monsters`, {
    method: "POST",
    body: JSON.stringify({ name: "Nebelkrähe", kind: "beast", rarity: "common", danger: "harmless", size: "tiny", visibility: "published", bio: rich("Ein Bote, der den Reisenden folgt.") }),
  });

  const map = await request(baseUrl, session, `/api/worlds/${worldId}/map`, {
    method: "POST",
    body: JSON.stringify({ universeId: world.universeId, name: "Nebelmark" }),
  });
  await upload(baseUrl, session, "map", worldId, map.map.id);
  await request(baseUrl, session, `/api/worlds/${worldId}/map/pins`, {
    method: "POST",
    body: JSON.stringify({ mapId: map.map.id, pinType: "landmark", title: "Burg Rabenstein", description: rich("Eine alte Festung über dem Pass."), posX: 0.52, posY: 0.42, visibility: "published" }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/map/pins`, {
    method: "POST",
    body: JSON.stringify({ mapId: map.map.id, pinType: "quest", title: "Westtor", description: rich("Hier beginnt die Suche nach dem Rabenwappen.", { id: quest.quest.id, kind: "quest", label: "Das verschwundene Amulett" }), posX: 0.36, posY: 0.63, visibility: "published" }),
  });

  const secretUniverse = await request(baseUrl, session, `/api/worlds/${worldId}/universes`, {
    method: "POST",
    body: JSON.stringify({ name: "Katakomben", visibility: "gm_only", description: rich("Die geheimen Ebenen unter Burg Rabenstein.") }),
  });
  const secretMap = await request(baseUrl, session, `/api/worlds/${worldId}/map`, {
    method: "POST",
    body: JSON.stringify({ universeId: secretUniverse.id, name: "Unter der Burg" }),
  });
  await upload(baseUrl, session, "map", worldId, secretMap.map.id);
  await request(baseUrl, session, `/api/worlds/${worldId}/map/pins`, {
    method: "POST",
    body: JSON.stringify({ mapId: secretMap.map.id, pinType: "dungeon", title: "Versiegelte Pforte", description: rich("Der Zugang zu den tieferen Katakomben."), posX: 0.47, posY: 0.58, visibility: "gm_only" }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/map/pins`, {
    method: "POST",
    body: JSON.stringify({ mapId: secretMap.map.id, pinType: "treasure", title: "Reliktkammer", description: rich("Der mögliche Aufbewahrungsort des Amuletts."), posX: 0.66, posY: 0.31, visibility: "gm_only" }),
  });

  const character = await request(baseUrl, session, "/api/characters", {
    method: "POST",
    body: JSON.stringify({ name: "MCP-Demoheld", class: "Waldläufer", attributes: { str: 12, dex: 16, con: 13, int: 10, wis: 14, cha: 8 }, bio: rich("Ein Kundschafter der Nebelmark.") }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/characters`, { method: "POST", body: JSON.stringify({ characterId: character.id }) });
  await request(baseUrl, session, `/api/worlds/${worldId}/characters/${character.id}/journal`, {
    method: "POST", body: JSON.stringify({ title: "Privat", body: rich("GEHEIMTEST privat"), visibility: "private" }),
  });
  await request(baseUrl, session, `/api/worlds/${worldId}/characters/${character.id}/journal`, {
    method: "POST", body: JSON.stringify({ title: "Für die Spielleitung", body: rich("GEHEIMTEST geteilt"), visibility: "shared_with_gm" }),
  });
  const chat = await request(baseUrl, session, `/api/worlds/${worldId}/chat`);
  const channelId = chat.channels?.[0]?.id;
  if (!channelId) throw new Error("Der Standard-Chatkanal konnte nicht angelegt werden.");
  await request(baseUrl, session, `/api/worlds/${worldId}/chat`, { method: "POST", body: JSON.stringify({ channelId, body: "CHATTEST darf über MCP niemals erscheinen." }) });

  console.log(`MCP-Demo wurde angelegt: ${baseUrl}/w/${worldId}`);
  console.log("Teste anschließend in Claude: Welche offenen Quests gibt es? Wo liegt Burg Rabenstein? Welche Quest-Gegenstände sind relevant?");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo-Seed fehlgeschlagen.");
  process.exitCode = 1;
});
