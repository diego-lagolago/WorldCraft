/**
 * Reproducible local fixture for the MCP suite (Plan 002 T-002).
 *
 * Run only against the local development database:
 *   node --env-file=.env scripts/seed-mcp-test-world.mjs
 *
 * The fixture deliberately creates the four test-login identities, so the
 * existing `/api/test-login` endpoint can issue a local session for each one.
 * Never point it at production.
 */

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const TEST_USERS = [
  ["test-gm", "Test GM", "test-gm@localhost"],
  ["test-master", "Test Master", "test-master@localhost"],
  ["test-player-a", "Test Player A", "test-player-a@localhost"],
  ["test-player-b", "Test Player B", "test-player-b@localhost"],
  ["test-rate-limit", "Test Rate Limit", "test-rate-limit@localhost"],
];
const [GM, MASTER, PLAYER_A, PLAYER_B, RATE_LIMIT_USER] = TEST_USERS.map(([id]) => id);
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1xQAAAABJRU5ErkJggg==",
  "base64",
);

function doc(text, mention) {
  const content = [];
  if (text) content.push({ type: "text", text });
  if (mention) {
    content.push({
      type: "mention",
      attrs: { id: mention.id, kind: mention.kind, label: mention.label, mentionSuggestionChar: "@" },
    });
  }
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

function source(kind, id) {
  return {
    source_kind: kind,
    source_article_id: kind === "article" ? id : null,
    source_quest_id: kind === "quest" ? id : null,
    source_character_id: kind === "character" ? id : null,
    source_pin_id: kind === "pin" ? id : null,
    source_universe_id: kind === "universe" ? id : null,
    source_monster_id: kind === "monster" ? id : null,
  };
}

function target(kind, id) {
  return {
    target_kind: kind,
    target_article_id: kind === "article" ? id : null,
    target_quest_id: kind === "quest" ? id : null,
    target_character_id: kind === "character" ? id : null,
    target_pin_id: kind === "pin" ? id : null,
    target_universe_id: kind === "universe" ? id : null,
    target_monster_id: kind === "monster" ? id : null,
  };
}

function productionGuard() {
  if (process.env.APP_ENV === "production") {
    throw new Error("Der MCP-Testwelt-Seed darf nicht gegen die Produktivumgebung laufen.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");
}

async function cleanFixture(sql, storageRoot) {
  const discordIds = TEST_USERS.map(([id]) => id);
  const existingUsers = await sql`
    SELECT id FROM users WHERE discord_id = ANY(${discordIds}::text[])
  `;
  const userIds = existingUsers.map(({ id }) => id);
  if (userIds.length === 0) return;
  const stored = await sql`
    SELECT storage_key FROM files WHERE created_by = ANY(${userIds}::text[])
  `;

  await sql.begin(async (tx) => {
    await tx`DELETE FROM worlds WHERE created_by = ANY(${userIds}::text[])`;
    await tx`DELETE FROM characters WHERE owner_id = ANY(${userIds}::text[])`;
    await tx`DELETE FROM files WHERE created_by = ANY(${userIds}::text[])`;
    await tx`DELETE FROM sessions WHERE user_id = ANY(${userIds}::text[])`;
    await tx`DELETE FROM accounts WHERE user_id = ANY(${userIds}::text[])`;
    await tx`DELETE FROM users WHERE id = ANY(${userIds}::text[])`;
  });

  await Promise.all(
    stored.map(({ storage_key: key }) =>
      unlink(path.join(storageRoot, key)).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      }),
    ),
  );
}

async function addImage(sql, storageRoot, createdBy) {
  const id = randomUUID();
  const storageKey = `files/${id}.png`;
  await mkdir(path.join(storageRoot, "files"), { recursive: true });
  await writeFile(path.join(storageRoot, storageKey), fixturePng);
  await sql`
    INSERT INTO files (id, storage_key, mime, byte_size, width_px, height_px, created_by)
    VALUES (${id}, ${storageKey}, 'image/png', ${fixturePng.length}, 1, 1, ${createdBy})
  `;
  return id;
}

async function addRelation(sql, { worldId, actorId, from, to, origin, templateFieldKey = null, label = null, counterLabel = null }) {
  const s = source(from.kind, from.id);
  const t = target(to.kind, to.id);
  await sql`
    INSERT INTO relations (
      world_id, source_kind, source_article_id, source_quest_id, source_character_id, source_pin_id, source_universe_id, source_monster_id,
      target_kind, target_article_id, target_quest_id, target_character_id, target_pin_id, target_universe_id, target_monster_id,
      origin, template_field_key, label, counter_label, created_by, updated_by
    ) VALUES (
      ${worldId}, ${s.source_kind}, ${s.source_article_id}, ${s.source_quest_id}, ${s.source_character_id}, ${s.source_pin_id}, ${s.source_universe_id}, ${s.source_monster_id},
      ${t.target_kind}, ${t.target_article_id}, ${t.target_quest_id}, ${t.target_character_id}, ${t.target_pin_id}, ${t.target_universe_id}, ${t.target_monster_id},
      ${origin}, ${templateFieldKey}, ${label}, ${counterLabel}, ${actorId}, ${actorId}
    )
  `;
}

async function main() {
  productionGuard();
  const storageRoot = path.resolve(process.env.FILE_STORAGE_PATH ?? "./data/uploads");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    await cleanFixture(sql, storageRoot);

    await sql.begin(async (tx) => {
      for (const [id, name, email] of TEST_USERS) {
        await tx`
          INSERT INTO users (id, name, email, email_verified, discord_id)
          VALUES (${id}, ${name}, ${email}, true, ${id})
        `;
      }
    });

    const burgImageId = await addImage(sql, storageRoot, GM);
    const gmOnlyImageId = await addImage(sql, storageRoot, GM);

    const [world] = await sql`
      INSERT INTO worlds (name, description_json, description_plain, mcp_enabled, created_by, updated_by)
      VALUES ('MCP-Testwelt', ${JSON.stringify(doc("Reproduzierbare MCP-Testdaten."))}::jsonb, 'Reproduzierbare MCP-Testdaten.', true, ${GM}, ${GM})
      RETURNING id
    `;
    const worldId = world.id;
    const [secondWorld] = await sql`
      INSERT INTO worlds (name, description_json, description_plain, mcp_enabled, created_by, updated_by)
      VALUES ('MCP-Zweite-Welt', ${JSON.stringify(doc("Nur für Player B."))}::jsonb, 'Nur für Player B.', false, ${PLAYER_B}, ${PLAYER_B})
      RETURNING id
    `;

    await sql`
      INSERT INTO memberships (world_id, user_id, role, created_by, updated_by) VALUES
      (${worldId}, ${GM}, 'game_master', ${GM}, ${GM}),
      (${worldId}, ${MASTER}, 'master', ${GM}, ${GM}),
      (${worldId}, ${PLAYER_A}, 'player', ${GM}, ${GM}),
      (${worldId}, ${PLAYER_B}, 'player', ${GM}, ${GM}),
      (${worldId}, ${RATE_LIMIT_USER}, 'player', ${GM}, ${GM}),
      (${secondWorld.id}, ${PLAYER_B}, 'game_master', ${PLAYER_B}, ${PLAYER_B})
    `;

    const [publishedUniverse] = await sql`
      INSERT INTO universes (world_id, name, description_json, description_plain, sort_order, visibility, created_by, updated_by)
      VALUES (${worldId}, 'Königreich Rabenmark', ${JSON.stringify(doc("Das sichtbare Königreich."))}::jsonb, 'Das sichtbare Königreich.', 0, 'published', ${GM}, ${GM})
      RETURNING id
    `;
    const [gmOnlyUniverse] = await sql`
      INSERT INTO universes (world_id, name, description_json, description_plain, sort_order, visibility, created_by, updated_by)
      VALUES (${worldId}, 'Verbotene Tiefen', ${JSON.stringify(doc("Nur für die Spielleitung."))}::jsonb, 'Nur für die Spielleitung.', 1, 'gm_only', ${GM}, ${GM})
      RETURNING id
    `;
    const [publishedMap] = await sql`
      INSERT INTO maps (universe_id, name, visibility, created_by, updated_by)
      VALUES (${publishedUniverse.id}, 'Rabenmark-Karte', 'published', ${GM}, ${GM}) RETURNING id
    `;
    await sql`
      INSERT INTO maps (universe_id, name, visibility, created_by, updated_by)
      VALUES (${gmOnlyUniverse.id}, 'Tiefe Karte', 'gm_only', ${GM}, ${GM})
    `;
    const [channel] = await sql`
      INSERT INTO chat_channels (world_id, name, sort_order, created_by, updated_by)
      VALUES (${worldId}, 'Allgemein', 0, ${GM}, ${GM}) RETURNING id
    `;

    const [race] = await sql`
      INSERT INTO articles (world_id, title, template_type, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Rabenblut', 'race', ${JSON.stringify(doc("Eine alte Rasse."))}::jsonb, 'Eine alte Rasse.', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [person] = await sql`
      INSERT INTO articles (world_id, title, template_type, template_fields, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Hauptmann Arin', 'person', ${JSON.stringify({ race: { kind: "article", id: race.id } })}::jsonb, ${JSON.stringify(doc("Der Hauptmann."))}::jsonb, 'Der Hauptmann.', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [guild] = await sql`
      INSERT INTO articles (world_id, title, template_type, title_image_id, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Archiv der Spielleitung', 'organization', ${gmOnlyImageId}, ${JSON.stringify(doc("SLTEST darf nur für die Spielleitung erscheinen."))}::jsonb, 'SLTEST darf nur für die Spielleitung erscheinen.', 'gm_only', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [questItem] = await sql`
      INSERT INTO articles (world_id, title, template_type, template_fields, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Schlüssel von Rabenstein', 'item', ${JSON.stringify({ kind: "artifact", rarity: "rare", quest: true })}::jsonb, ${JSON.stringify(doc("Der Schlüssel öffnet die Burg."))}::jsonb, 'Der Schlüssel öffnet die Burg.', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [burg] = await sql`
      INSERT INTO articles (world_id, title, template_type, template_fields, title_image_id, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Burg Rabenstein', 'place', ${JSON.stringify({ kind: "building", danger: "dangerous", ruler: { kind: "article", id: person.id } })}::jsonb, ${burgImageId}, ${JSON.stringify(doc("Die Burg wird bewacht von ", { id: guild.id, kind: "article", label: "Archiv der Spielleitung" }))}::jsonb, 'Die Burg wird bewacht von Archiv der Spielleitung', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [plainArticle] = await sql`
      INSERT INTO articles (world_id, title, template_type, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Rabenmarkt', 'none', ${JSON.stringify(doc("Ein sichtbarer Artikel."))}::jsonb, 'Ein sichtbarer Artikel.', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    await sql`
      INSERT INTO articles (world_id, title, template_type, template_fields, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Seil der Kundschafter', 'item', ${JSON.stringify({ kind: "mundane", rarity: "common", quest: false })}::jsonb, ${JSON.stringify(doc("Kein Quest-Gegenstand."))}::jsonb, 'Kein Quest-Gegenstand.', 'published', ${GM}, now(), ${GM}, ${GM}) RETURNING id
    `;
    const [masterSecret] = await sql`
      INSERT INTO articles (world_id, title, template_type, body_json, body_plain, visibility, owner_id, first_edited_at, created_by, updated_by)
      VALUES (${worldId}, 'Private Notiz des Masters', 'none', ${JSON.stringify(doc("NURICHTEST: Nur der Master darf diesen Text sehen."))}::jsonb, 'NURICHTEST: Nur der Master darf diesen Text sehen.', 'owner_only', ${MASTER}, now(), ${MASTER}, ${MASTER}) RETURNING id
    `;

    const [character] = await sql`
      INSERT INTO characters (owner_id, name, class, attr_str, attr_dex, attr_con, attr_int, attr_wis, attr_cha, bio_json, bio_plain, created_by, updated_by)
      VALUES (${PLAYER_A}, 'Liora', 'Waldläuferin', 12, 16, 14, 10, 13, 11, ${JSON.stringify(doc("Eine Kundschafterin."))}::jsonb, 'Eine Kundschafterin.', ${PLAYER_A}, ${PLAYER_A}) RETURNING id
    `;
    await sql`
      INSERT INTO world_participations (character_id, world_id, created_by, updated_by)
      VALUES (${character.id}, ${worldId}, ${PLAYER_A}, ${PLAYER_A})
    `;

    const [activeQuest] = await sql`
      INSERT INTO quests (world_id, title, description_json, description_plain, status, visibility, owner_id, created_by, updated_by)
      VALUES (${worldId}, 'Die Rückkehr des Rabens', ${JSON.stringify(doc("Die aktive Quest."))}::jsonb, 'Die aktive Quest.', 'active', 'published', ${GM}, ${GM}, ${GM}) RETURNING id
    `;
    await sql`
      INSERT INTO quest_participants (quest_id, character_id, character_name, created_by, updated_by)
      VALUES (${activeQuest.id}, ${character.id}, 'Liora', ${GM}, ${GM})
    `;
    await sql`
      INSERT INTO quests (world_id, title, description_json, description_plain, status, visibility, owner_id, created_by, updated_by)
      VALUES (${worldId}, 'Der letzte Schwur', ${JSON.stringify(doc("Eine abgeschlossene Quest."))}::jsonb, 'Eine abgeschlossene Quest.', 'completed', 'published', ${GM}, ${GM}, ${GM})
    `;
    await sql`
      INSERT INTO quest_chapters (quest_id, title, body_json, body_plain, position, status, visibility, owner_id, created_by, updated_by) VALUES
      (${activeQuest.id}, 'Ankunft', ${JSON.stringify(doc("Öffentliches Kapitel."))}::jsonb, 'Öffentliches Kapitel.', 0, 'active', 'published', ${GM}, ${GM}, ${GM}),
      (${activeQuest.id}, 'Geheimer Plan', ${JSON.stringify(doc("SLTEST im SL-Kapitel."))}::jsonb, 'SLTEST im SL-Kapitel.', 1, 'open', 'gm_only', ${GM}, ${GM}, ${GM})
    `;
    await sql`
      INSERT INTO quest_notes (quest_id, body_json, body_plain, version, updated_by)
      VALUES (${activeQuest.id}, ${JSON.stringify(doc("Notizblock zur aktiven Quest."))}::jsonb, 'Notizblock zur aktiven Quest.', 1, ${GM})
    `;

    const [visibleMonster] = await sql`
      INSERT INTO monsters (world_id, name, kind, rarity, danger, size, habitat_article_id, visibility, owner_id, bio_json, bio_plain, created_by, updated_by)
      VALUES (${worldId}, 'Rabenwolf', 'beast', 'uncommon', 'dangerous', 'medium', ${burg.id}, 'published', ${GM}, ${JSON.stringify(doc("Jagt nahe Burg Rabenstein."))}::jsonb, 'Jagt nahe Burg Rabenstein.', ${GM}, ${GM}) RETURNING id
    `;
    await sql`
      INSERT INTO monsters (world_id, name, kind, rarity, danger, size, visibility, owner_id, bio_json, bio_plain, created_by, updated_by)
      VALUES (${worldId}, 'Schattenrabe', 'undead', 'rare', 'deadly', 'small', 'gm_only', ${GM}, ${JSON.stringify(doc("SLTEST Monster."))}::jsonb, 'SLTEST Monster.', ${GM}, ${GM}) RETURNING id
    `;
    await sql`
      INSERT INTO monsters (world_id, name, kind, rarity, danger, size, visibility, owner_id, bio_json, bio_plain, created_by, updated_by)
      VALUES (${worldId}, 'Knochenwolf', 'undead', 'common', 'dangerous', 'medium', 'published', ${GM}, ${JSON.stringify(doc("Ein weiteres Untier."))}::jsonb, 'Ein weiteres Untier.', ${GM}, ${GM})
    `;

    const pinRows = await sql`
      INSERT INTO pins (map_id, pin_type, title, description_json, description_plain, pos_x, pos_y, visibility, owner_id, created_by, updated_by) VALUES
      (${publishedMap.id}, 'city', 'Burgtor', ${JSON.stringify(doc("Treffpunkt bei ", { id: burg.id, kind: "article", label: "Burg Rabenstein" }))}::jsonb, 'Treffpunkt bei Burg Rabenstein', 0.2, 0.3, 'published', ${GM}, ${GM}, ${GM}),
      (${publishedMap.id}, 'quest', 'Rabenspuren', ${JSON.stringify(doc("Spuren zur Quest ", { id: activeQuest.id, kind: "quest", label: "Die Rückkehr des Rabens" }))}::jsonb, 'Spuren zur Quest Die Rückkehr des Rabens', 0.4, 0.5, 'published', ${GM}, ${GM}, ${GM}),
      (${publishedMap.id}, 'landmark', 'Alter Turm', ${JSON.stringify(doc("Ein sichtbarer Ort."))}::jsonb, 'Ein sichtbarer Ort.', 0.6, 0.4, 'published', ${GM}, ${GM}, ${GM}),
      (${publishedMap.id}, 'danger', 'Wolfsbau', ${JSON.stringify(doc("Vorsicht vor Wölfen."))}::jsonb, 'Vorsicht vor Wölfen.', 0.8, 0.7, 'published', ${GM}, ${GM}, ${GM})
      RETURNING id, title
    `;
    await sql`
      INSERT INTO character_markers (character_id, map_id, pos_x, pos_y, created_by, updated_by)
      VALUES (${character.id}, ${publishedMap.id}, 0.15, 0.2, ${PLAYER_A}, ${PLAYER_A})
    `;
    await sql`
      INSERT INTO monster_markers (monster_id, map_id, pos_x, pos_y, visibility, owner_id, created_by, updated_by)
      VALUES (${visibleMonster.id}, ${publishedMap.id}, 0.7, 0.2, 'published', ${GM}, ${GM}, ${GM})
    `;

    await sql`
      INSERT INTO journal_entries (character_id, world_id, title, body_json, body_plain, visibility, created_by, updated_by) VALUES
      (${character.id}, ${worldId}, 'Privates Tagebuch', ${JSON.stringify(doc("GEHEIMTEST privat"))}::jsonb, 'GEHEIMTEST privat', 'private', ${PLAYER_A}, ${PLAYER_A}),
      (${character.id}, ${worldId}, 'Geteiltes Tagebuch', ${JSON.stringify(doc("GEHEIMTEST geteilt"))}::jsonb, 'GEHEIMTEST geteilt', 'shared_with_gm', ${PLAYER_A}, ${PLAYER_A})
    `;
    await sql`
      INSERT INTO chat_messages (world_id, channel_id, author_id, body)
      VALUES (${worldId}, ${channel.id}, ${PLAYER_A}, 'CHATTEST darf nie über MCP erscheinen.')
    `;

    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: burg.id }, to: { kind: "article", id: guild.id }, origin: "mention" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: burg.id }, to: { kind: "article", id: guild.id }, origin: "manual", label: "wird bewacht von", counterLabel: "bewacht" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: person.id }, to: { kind: "article", id: race.id }, origin: "template_field", templateFieldKey: "race" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: burg.id }, to: { kind: "article", id: person.id }, origin: "template_field", templateFieldKey: "ruler" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: burg.id }, to: { kind: "article", id: questItem.id }, origin: "manual", label: "bewacht", counterLabel: "wird bewacht von" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: questItem.id }, to: { kind: "article", id: race.id }, origin: "manual", label: "gehört zu", counterLabel: "enthält" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: burg.id }, to: { kind: "article", id: masterSecret.id }, origin: "manual", label: "verbirgt", counterLabel: "ist verborgen in" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "article", id: guild.id }, to: { kind: "article", id: plainArticle.id }, origin: "manual", label: "verwaltet", counterLabel: "wird verwaltet von" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "monster", id: visibleMonster.id }, to: { kind: "article", id: burg.id }, origin: "template_field", templateFieldKey: "habitat" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "quest", id: activeQuest.id }, to: { kind: "character", id: character.id }, origin: "participation" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "pin", id: pinRows[0].id }, to: { kind: "article", id: burg.id }, origin: "mention" });
    await addRelation(sql, { worldId, actorId: GM, from: { kind: "pin", id: pinRows[1].id }, to: { kind: "quest", id: activeQuest.id }, origin: "mention" });

    const counts = await sql`
      SELECT
        (SELECT count(*) FROM worlds WHERE created_by = ANY(${TEST_USERS.map(([id]) => id)}::text[])) AS worlds,
        (SELECT count(*) FROM articles WHERE world_id = ${worldId}) AS articles,
        (SELECT count(*) FROM quests WHERE world_id = ${worldId}) AS quests,
        (SELECT count(*) FROM monsters WHERE world_id = ${worldId}) AS monsters,
        (SELECT count(*) FROM pins WHERE map_id = ${publishedMap.id}) AS pins
    `;
    console.log(`[mcp-seed] Testwelt erstellt: ${JSON.stringify(counts[0])}`);
    console.log("[mcp-seed] Lokale Sitzungen: test-gm, test-master, test-player-a, test-player-b.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(`[mcp-seed] ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
  process.exitCode = 1;
});
