/**
 * T-011 — wiederholbare Rechte-API-Tests.
 * Meldet die vier Seed-Benutzer per Test-Login an und prüft die Rechtematrix per fetch.
 *
 * Voraussetzung: ENABLE_TEST_LOGIN=true, Dev-Server, Migrationen.
 *   npm run dev
 *   npm run test:rechte
 */

import assert from "node:assert/strict";
import { afterAll, describe, it } from "vitest";

const BASE = (process.env.RECHTE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Json = Record<string, unknown>;

type Session = {
  cookie: string;
  user: { id: string; name: string; discordId: string };
};

type ApiResponse = { status: number; data: Json };

async function login(discordId: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/test-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
    },
    body: JSON.stringify({ discordId }),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(
      `Test-Login ${discordId} fehlgeschlagen (${res.status}): ${JSON.stringify(data)}. Läuft der Dev-Server mit ENABLE_TEST_LOGIN=true?`,
    );
  }
  const cookies = res.headers.getSetCookie().map((entry) => entry.split(";")[0]);
  if (cookies.length === 0) {
    throw new Error(`Test-Login ${discordId} lieferte kein Session-Cookie.`);
  }
  const user = data.user as Session["user"] | undefined;
  if (!user?.id) throw new Error(`Test-Login ${discordId} ohne user.id.`);
  return { cookie: cookies.join("; "), user };
}

async function api(
  session: Session,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      cookie: session.cookie,
      origin: BASE,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
}

function ids(list: unknown, key = "id"): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => String((item as Json)[key]));
}

describe("T-011 Rechteprüfung auf Datenebene", () => {
  let gm: Session;
  let master: Session;
  let playerA: Session;
  let playerB: Session;
  let worldId = "";
  let inviteValid = "";
  let inviteRevokedId = "";
  let inviteRevokedCode = "";
  let charA1 = "";
  let charA2 = "";
  let charB = "";
  let journalPrivate = "";
  let journalShared = "";
  let articlePublished = "";
  let articleHidden = "";
  let hauptUniverse = "";
  let hiddenUniverse = "";
  let publicMap = "";
  let hiddenMap = "";
  let publicPin = "";
  let hiddenUniversePin = "";
  let markerA1 = "";
  let markerA2 = "";
  let markerB = "";
  let relHiddenArticle = "";
  let relHiddenUniverse = "";
  let relCharacter = "";

  it("meldet die vier Seed-Benutzer an und legt die Welt an", async () => {
    try {
      await fetch(`${BASE}/api/test-login`, { method: "OPTIONS" });
    } catch {
      throw new Error(
        `Kein Dev-Server unter ${BASE}. Bitte \`npm run dev\` starten, dann \`npm run test:rechte\`.`,
      );
    }

    gm = await login("test-gm");
    master = await login("test-master");
    playerA = await login("test-player-a");
    playerB = await login("test-player-b");

    const created = await api(gm, "POST", "/api/spike/rechte/worlds", {
      name: `Rechte-Spike ${Date.now()}`,
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    worldId = String((created.data.world as Json).id);

    const world = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}`);
    assert.equal(world.status, 200);
    assert.equal((world.data.world as Json).createdBy, gm.user.id);
    assert.equal(world.data.role, "game_master");

    const geo = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/universes`);
    const universes = geo.data.universes as Json[];
    assert.equal(universes.length, 1);
    assert.equal(universes[0].name, "Hauptuniversum");
    assert.equal(universes[0].visibility, "published");
    hauptUniverse = String(universes[0].id);
  });

  it("gültiger Einladungslink macht Player; widerrufener wird abgelehnt", async () => {
    const valid = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/invites`, {
      validity: "unlimited",
    });
    assert.equal(valid.status, 201, JSON.stringify(valid.data));
    inviteValid = String((valid.data.invite as Json).code);

    const revoked = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/invites`, {
      validity: "unlimited",
    });
    assert.equal(revoked.status, 201);
    inviteRevokedId = String((revoked.data.invite as Json).id);
    inviteRevokedCode = String((revoked.data.invite as Json).code);
    const revoke = await api(gm, "POST", `/api/spike/rechte/invites/${inviteRevokedId}/revoke`);
    assert.equal(revoke.status, 200);

    const blocked = await api(
      playerB,
      "POST",
      `/api/spike/rechte/invites/${inviteRevokedCode}/join`,
    );
    assert.equal(blocked.status, 403);

    const masterJoin = await api(master, "POST", `/api/spike/rechte/invites/${inviteValid}/join`);
    assert.equal(masterJoin.status, 200);
    assert.equal((masterJoin.data.membership as Json).role, "player");

    const aJoin = await api(playerA, "POST", `/api/spike/rechte/invites/${inviteValid}/join`);
    assert.equal(aJoin.status, 200);
    assert.equal((aJoin.data.membership as Json).role, "player");

    const bJoin = await api(playerB, "POST", `/api/spike/rechte/invites/${inviteValid}/join`);
    assert.equal(bJoin.status, 200);
    assert.equal((bJoin.data.membership as Json).role, "player");

    const promoteMaster = await api(
      gm,
      "PATCH",
      `/api/spike/rechte/worlds/${worldId}/members/${master.user.id}`,
      { role: "master" },
    );
    assert.equal(promoteMaster.status, 200, JSON.stringify(promoteMaster.data));
    assert.equal((promoteMaster.data.member as Json).role, "master");
  });

  it("legt Charaktere, Tagebücher, Artikel, Karten, Marker und Relationen an", async () => {
    const a1 = await api(playerA, "POST", "/api/spike/rechte/characters", { name: "Aria Eins" });
    const a2 = await api(playerA, "POST", "/api/spike/rechte/characters", { name: "Aria Zwei" });
    const b1 = await api(playerB, "POST", "/api/spike/rechte/characters", { name: "Bram" });
    assert.equal(a1.status, 201);
    assert.equal(a2.status, 201);
    assert.equal(b1.status, 201);
    charA1 = String((a1.data.character as Json).id);
    charA2 = String((a2.data.character as Json).id);
    charB = String((b1.data.character as Json).id);

    for (const characterId of [charA1, charA2]) {
      const brought = await api(
        playerA,
        "POST",
        `/api/spike/rechte/worlds/${worldId}/characters/${characterId}`,
      );
      assert.equal(brought.status, 201, JSON.stringify(brought.data));
    }
    assert.equal(
      (await api(playerB, "POST", `/api/spike/rechte/worlds/${worldId}/characters/${charB}`))
        .status,
      201,
    );

    const priv = await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/journals`, {
      characterId: charA1,
      title: "Geheim",
      body: "Privates Geheimnis von A",
      visibility: "private",
    });
    const shared = await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/journals`, {
      characterId: charA1,
      title: "Geteilt",
      body: "Mit Spielleitung geteilt",
      visibility: "shared_with_gm",
    });
    assert.equal(priv.status, 201, JSON.stringify(priv.data));
    assert.equal(shared.status, 201);
    journalPrivate = String((priv.data.journal as Json).id);
    journalShared = String((shared.data.journal as Json).id);

    const pub = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/articles`, {
      title: "Öffentlicher Ort",
      visibility: "published",
    });
    const hid = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/articles`, {
      title: "Nur SL",
      visibility: "gm_only",
    });
    assert.equal(pub.status, 201);
    assert.equal(hid.status, 201);
    articlePublished = String((pub.data.article as Json).id);
    articleHidden = String((hid.data.article as Json).id);

    const map = await api(gm, "POST", `/api/spike/rechte/universes/${hauptUniverse}/maps`, {
      name: "Hauptkarte",
      visibility: "published",
    });
    assert.equal(map.status, 201, JSON.stringify(map.data));
    publicMap = String((map.data.map as Json).id);

    const pin = await api(gm, "POST", `/api/spike/rechte/maps/${publicMap}/pins`, {
      pinType: "city",
      title: "Stadt",
      visibility: "published",
      posX: 0.2,
      posY: 0.3,
    });
    assert.equal(pin.status, 201);
    publicPin = String((pin.data.pin as Json).id);

    const hiddenU = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/universes`, {
      name: "Nur Spielleitung",
      visibility: "gm_only",
    });
    assert.equal(hiddenU.status, 201);
    hiddenUniverse = String((hiddenU.data.universe as Json).id);
    const hiddenM = await api(gm, "POST", `/api/spike/rechte/universes/${hiddenUniverse}/maps`, {
      name: "Geheime Karte",
      visibility: "published",
    });
    assert.equal(hiddenM.status, 201);
    hiddenMap = String((hiddenM.data.map as Json).id);
    const hiddenPin = await api(gm, "POST", `/api/spike/rechte/maps/${hiddenMap}/pins`, {
      pinType: "dungeon",
      title: "Versteckter Pin",
      visibility: "published",
      posX: 0.5,
      posY: 0.5,
    });
    assert.equal(hiddenPin.status, 201);
    hiddenUniversePin = String((hiddenPin.data.pin as Json).id);
    const hiddenMarker = await api(gm, "POST", `/api/spike/rechte/maps/${hiddenMap}/markers`, {
      characterId: charA1,
      posX: 0.11,
      posY: 0.22,
    });
    assert.equal(hiddenMarker.status, 201, JSON.stringify(hiddenMarker.data));

    const m1 = await api(playerA, "POST", `/api/spike/rechte/maps/${publicMap}/markers`, {
      characterId: charA1,
      posX: 0.4,
      posY: 0.41,
    });
    const m2 = await api(playerA, "POST", `/api/spike/rechte/maps/${publicMap}/markers`, {
      characterId: charA2,
      posX: 0.42,
      posY: 0.43,
    });
    const mb = await api(playerB, "POST", `/api/spike/rechte/maps/${publicMap}/markers`, {
      characterId: charB,
      posX: 0.7,
      posY: 0.71,
    });
    assert.equal(m1.status, 201, JSON.stringify(m1.data));
    assert.equal(m2.status, 201);
    assert.equal(mb.status, 201);
    markerA1 = String((m1.data.marker as Json).id);
    markerA2 = String((m2.data.marker as Json).id);
    markerB = String((mb.data.marker as Json).id);

    const r1 = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/relations`, {
      sourceKind: "article",
      sourceId: articlePublished,
      targetKind: "article",
      targetId: articleHidden,
      label: "hängt zusammen mit",
    });
    const r2 = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/relations`, {
      sourceKind: "article",
      sourceId: articlePublished,
      targetKind: "universe",
      targetId: hiddenUniverse,
      label: "liegt in",
    });
    const r3 = await api(gm, "POST", `/api/spike/rechte/worlds/${worldId}/relations`, {
      sourceKind: "character",
      sourceId: charA1,
      targetKind: "article",
      targetId: articlePublished,
      label: "kennt",
    });
    assert.equal(r1.status, 201, JSON.stringify(r1.data));
    assert.equal(r2.status, 201);
    assert.equal(r3.status, 201);
    relHiddenArticle = String((r1.data.relation as Json).id);
    relHiddenUniverse = String((r2.data.relation as Json).id);
    relCharacter = String((r3.data.relation as Json).id);
  });

  it("Player B sieht keine Tagebücher von A; GM/Master nur geteilte", async () => {
    const asB = await api(playerB, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    assert.equal(asB.status, 200);
    const bIds = ids(asB.data.journals);
    assert.equal(bIds.includes(journalPrivate), false);
    assert.equal(bIds.includes(journalShared), false);

    const asGm = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    const gmIds = ids(asGm.data.journals);
    assert.equal(gmIds.includes(journalPrivate), false);
    assert.equal(gmIds.includes(journalShared), true);

    const asMaster = await api(master, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    const masterIds = ids(asMaster.data.journals);
    assert.equal(masterIds.includes(journalPrivate), false);
    assert.equal(masterIds.includes(journalShared), true);

    const asA = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    const aIds = ids(asA.data.journals);
    assert.equal(aIds.includes(journalPrivate), true);
    assert.equal(aIds.includes(journalShared), true);
  });

  it("GM/Master sehen Artikel nur Spielleitung, Player nicht", async () => {
    const asPlayer = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/articles`);
    const playerIds = ids(asPlayer.data.articles);
    assert.equal(playerIds.includes(articlePublished), true);
    assert.equal(playerIds.includes(articleHidden), false);

    const asGm = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/articles`);
    const gmIds = ids(asGm.data.articles);
    assert.equal(gmIds.includes(articleHidden), true);
    const asMaster = await api(master, "GET", `/api/spike/rechte/worlds/${worldId}/articles`);
    assert.equal(ids(asMaster.data.articles).includes(articleHidden), true);
  });

  it("verstecktes Universum liefert Playern weder Karte noch Pins/Marker", async () => {
    const asPlayer = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/universes`);
    const playerUniverses = asPlayer.data.universes as Json[];
    assert.equal(
      playerUniverses.some((universe) => universe.id === hiddenUniverse),
      false,
    );
    const publicGeo = playerUniverses.find((universe) => universe.id === hauptUniverse);
    assert.ok(publicGeo);
    const maps = publicGeo.maps as Json[];
    assert.equal(maps.some((map) => map.id === publicMap), true);
    assert.equal(
      maps.flatMap((map) => map.pins as Json[]).some((pin) => pin.id === publicPin),
      true,
    );
    assert.equal(
      maps.flatMap((map) => map.pins as Json[]).some((pin) => pin.id === hiddenUniversePin),
      false,
    );

    const asGm = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/universes`);
    const gmUniverses = asGm.data.universes as Json[];
    const hidden = gmUniverses.find((universe) => universe.id === hiddenUniverse);
    assert.ok(hidden);
    const hiddenMaps = hidden.maps as Json[];
    assert.equal(hiddenMaps.some((map) => map.id === hiddenMap), true);
    assert.equal(
      hiddenMaps.flatMap((map) => map.pins as Json[]).some((pin) => pin.id === hiddenUniversePin),
      true,
    );
  });

  it("Relationen mit verstecktem Ende nur für Spielleitung", async () => {
    const asPlayer = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/relations`);
    const playerIds = ids(asPlayer.data.relations);
    assert.equal(playerIds.includes(relHiddenArticle), false);
    assert.equal(playerIds.includes(relHiddenUniverse), false);
    assert.equal(playerIds.includes(relCharacter), true);

    const asGm = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/relations`);
    const gmIds = ids(asGm.data.relations);
    assert.equal(gmIds.includes(relHiddenArticle), true);
    assert.equal(gmIds.includes(relHiddenUniverse), true);
    const asMaster = await api(master, "GET", `/api/spike/rechte/worlds/${worldId}/relations`);
    assert.equal(ids(asMaster.data.relations).includes(relHiddenArticle), true);
  });

  it("Player dürfen keine Artikel, Pins, Karten, Universen oder manuellen Relationen ändern", async () => {
    const article = await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/articles`, {
      title: "Unerlaubt",
    });
    assert.equal(article.status, 403);
    assert.equal(
      (await api(playerA, "PATCH", `/api/spike/rechte/articles/${articlePublished}`, {
        title: "Hack",
      })).status,
      403,
    );
    assert.equal(
      (await api(playerA, "DELETE", `/api/spike/rechte/articles/${articlePublished}`)).status,
      403,
    );
    assert.equal(
      (await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/universes`, {
        name: "Player-Universum",
      })).status,
      403,
    );
    assert.equal(
      (await api(playerA, "PATCH", `/api/spike/rechte/universes/${hauptUniverse}`, {
        name: "Hack",
      })).status,
      403,
    );
    assert.equal(
      (await api(playerA, "POST", `/api/spike/rechte/universes/${hauptUniverse}/maps`, {
        name: "Zweite Karte",
      })).status,
      403,
    );
    assert.equal(
      (await api(playerA, "PATCH", `/api/spike/rechte/maps/${publicMap}`, { name: "Hack" })).status,
      403,
    );
    assert.equal((await api(playerA, "DELETE", `/api/spike/rechte/maps/${publicMap}`)).status, 403);
    assert.equal(
      (await api(playerA, "POST", `/api/spike/rechte/maps/${publicMap}/pins`, {
        pinType: "shop",
        title: "Unerlaubt",
        posX: 0.1,
        posY: 0.1,
      })).status,
      403,
    );
    assert.equal(
      (await api(playerA, "PATCH", `/api/spike/rechte/pins/${publicPin}`, { title: "Hack" })).status,
      403,
    );
    assert.equal((await api(playerA, "DELETE", `/api/spike/rechte/pins/${publicPin}`)).status, 403);
    assert.equal(
      (await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/relations`, {
        sourceKind: "article",
        sourceId: articlePublished,
        targetKind: "character",
        targetId: charA1,
        label: "unerlaubt",
      })).status,
      403,
    );
  });

  it("Player A verschiebt nur den eigenen Marker; Master beide", async () => {
    const own = await api(playerA, "PATCH", `/api/spike/rechte/markers/${markerA1}`, {
      posX: 0.44,
      posY: 0.45,
    });
    assert.equal(own.status, 200, JSON.stringify(own.data));
    assert.equal((own.data.marker as Json).posX, 0.44);

    const foreign = await api(playerA, "PATCH", `/api/spike/rechte/markers/${markerB}`, {
      posX: 0.1,
      posY: 0.1,
    });
    assert.equal(foreign.status, 403);

    const masterMoveA = await api(master, "PATCH", `/api/spike/rechte/markers/${markerA2}`, {
      posX: 0.55,
      posY: 0.56,
    });
    const masterMoveB = await api(master, "PATCH", `/api/spike/rechte/markers/${markerB}`, {
      posX: 0.72,
      posY: 0.73,
    });
    assert.equal(masterMoveA.status, 200);
    assert.equal(masterMoveB.status, 200);
  });

  it("zweiter Marker für denselben Charakter auf derselben Karte wird abgelehnt", async () => {
    const second = await api(playerA, "POST", `/api/spike/rechte/maps/${publicMap}/markers`, {
      characterId: charA1,
      posX: 0.9,
      posY: 0.9,
    });
    assert.equal(second.status, 409);
  });

  it("kein zweiter GM; Master kann GM nicht entfernen oder zurückstufen", async () => {
    const secondGm = await api(
      gm,
      "PATCH",
      `/api/spike/rechte/worlds/${worldId}/members/${playerA.user.id}`,
      { role: "game_master" },
    );
    assert.equal(secondGm.status, 403);

    const demote = await api(
      master,
      "PATCH",
      `/api/spike/rechte/worlds/${worldId}/members/${gm.user.id}`,
      { role: "player" },
    );
    assert.equal(demote.status, 403);
    const remove = await api(
      master,
      "DELETE",
      `/api/spike/rechte/worlds/${worldId}/members/${gm.user.id}`,
    );
    assert.equal(remove.status, 403);
  });

  it("Master und Player dürfen nicht einladen, Rollen ändern oder entfernen", async () => {
    assert.equal(
      (await api(master, "POST", `/api/spike/rechte/worlds/${worldId}/invites`)).status,
      403,
    );
    assert.equal(
      (await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/invites`)).status,
      403,
    );
    assert.equal(
      (
        await api(
          master,
          "PATCH",
          `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`,
          { role: "master" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api(
          playerA,
          "PATCH",
          `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`,
          { role: "master" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await api(master, "DELETE", `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`))
        .status,
      403,
    );
    assert.equal(
      (await api(playerA, "DELETE", `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`))
        .status,
      403,
    );
  });

  it("GM ernennt B zum Master, stuft zurück und entfernt B", async () => {
    const promote = await api(
      gm,
      "PATCH",
      `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`,
      { role: "master" },
    );
    assert.equal(promote.status, 200);
    const demote = await api(
      gm,
      "PATCH",
      `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`,
      { role: "player" },
    );
    assert.equal(demote.status, 200);
    const remove = await api(
      gm,
      "DELETE",
      `/api/spike/rechte/worlds/${worldId}/members/${playerB.user.id}`,
    );
    assert.equal(remove.status, 200);
    const members = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/members`);
    const userIds = (members.data.members as Json[]).map((row) => row.userId);
    assert.equal(userIds.includes(playerB.user.id), false);
  });

  it("Player A tritt aus: nichts gelöscht, andere sehen A nicht; Re-Join stellt alles wieder her", async () => {
    const leave = await api(playerA, "POST", `/api/spike/rechte/worlds/${worldId}/leave`);
    assert.equal(leave.status, 200);

    const persist = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/_persistence`);
    assert.equal(persist.status, 200, JSON.stringify(persist.data));
    const memberships = persist.data.memberships as Json[];
    const aMembership = memberships.find((row) => row.userId === playerA.user.id);
    assert.ok(aMembership?.archivedAt);
    const parts = persist.data.participations as Json[];
    assert.ok(parts.filter((row) => [charA1, charA2].includes(String(row.characterId))).every((row) => row.archivedAt));
    assert.ok((persist.data.journals as Json[]).some((row) => row.id === journalPrivate));
    assert.ok((persist.data.journals as Json[]).some((row) => row.id === journalShared));
    assert.ok((persist.data.markers as Json[]).some((row) => row.id === markerA1));
    assert.ok((persist.data.relations as Json[]).some((row) => row.id === relCharacter));

    const chars = await api(master, "GET", `/api/spike/rechte/worlds/${worldId}/characters`);
    const charIds = ids(chars.data.characters);
    assert.equal(charIds.includes(charA1), false);
    assert.equal(charIds.includes(charA2), false);

    const journals = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    const journalIds = ids(journals.data.journals);
    assert.equal(journalIds.includes(journalPrivate), false);
    assert.equal(journalIds.includes(journalShared), false);

    const geo = await api(master, "GET", `/api/spike/rechte/worlds/${worldId}/universes`);
    const markers = (geo.data.universes as Json[])
      .flatMap((universe) => universe.maps as Json[])
      .flatMap((map) => map.markers as Json[]);
    assert.equal(markers.some((marker) => marker.id === markerA1), false);

    const rels = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/relations`);
    assert.equal(ids(rels.data.relations).includes(relCharacter), false);

    const rejoin = await api(playerA, "POST", `/api/spike/rechte/invites/${inviteValid}/join`);
    assert.equal(rejoin.status, 200);
    assert.equal((rejoin.data.membership as Json).role, "player");

    const bring1 = await api(
      playerA,
      "POST",
      `/api/spike/rechte/worlds/${worldId}/characters/${charA1}`,
    );
    const bring2 = await api(
      playerA,
      "POST",
      `/api/spike/rechte/worlds/${worldId}/characters/${charA2}`,
    );
    assert.equal(bring1.status, 201);
    assert.equal(bring2.status, 201);

    const afterChars = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}/characters`);
    assert.equal(ids(afterChars.data.characters).includes(charA1), true);
    const afterJournals = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/journals`);
    assert.equal(ids(afterJournals.data.journals).includes(journalPrivate), true);
    assert.equal(ids(afterJournals.data.journals).includes(journalShared), true);
    const afterGeo = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/universes`);
    const afterMarkers = (afterGeo.data.universes as Json[])
      .flatMap((universe) => universe.maps as Json[])
      .flatMap((map) => map.markers as Json[]);
    const restored = afterMarkers.find((marker) => marker.id === markerA1);
    assert.ok(restored);
    assert.equal(restored.posX, 0.44);
    assert.equal(restored.posY, 0.45);
    const afterRels = await api(playerA, "GET", `/api/spike/rechte/worlds/${worldId}/relations`);
    assert.equal(ids(afterRels.data.relations).includes(relCharacter), true);
  });

  it("Master kann die Welt nicht löschen", async () => {
    const attempt = await api(master, "DELETE", `/api/spike/rechte/worlds/${worldId}`);
    assert.equal(attempt.status, 403);
    const still = await api(gm, "GET", `/api/spike/rechte/worlds/${worldId}`);
    assert.equal(still.status, 200);
  });

  afterAll(async () => {
    if (worldId && gm) {
      await api(gm, "DELETE", `/api/spike/rechte/worlds/${worldId}`);
    }
  });
});
