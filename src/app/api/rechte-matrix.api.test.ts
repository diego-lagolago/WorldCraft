/**
 * Plan 001 T-011 rights matrix against product APIs (Plan 003 T-015).
 * Requires: ENABLE_TEST_LOGIN=true and a running `npm run dev`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
let inviteCode = "";
let hauptUniverse = "";
let hiddenUniverse = "";
let publicMap = "";
let hiddenMap = "";
let publicPin = "";
let charA1 = "";
let charA2 = "";
let charB = "";
let journalPrivate = "";
let journalShared = "";
let articlePublished = "";
let articleHidden = "";
let markerA1 = "";
let markerA2 = "";
let markerB = "";
let membershipByUser = new Map<string, string>();

const w = (path = "") => `/api/worlds/${worldId}${path}`;

async function refreshMembers() {
  const res = await api<{ members: { membershipId: string; userId: string; role: string }[] }>(
    gm,
    "GET",
    w("/members"),
  );
  expect(res.status).toBe(200);
  membershipByUser = new Map(res.data.members.map((row) => [row.userId, row.membershipId]));
}

async function uploadMap(session: TestSession, universeId: string, name: string) {
  const form = new FormData();
  form.set("universeId", universeId);
  form.set("name", name);
  form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  const res = await fetch(`${BASE}${w("/map")}`, {
    method: "POST",
    headers: { cookie: session.cookie, origin: BASE },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { map?: { id: string }; error?: string };
  return { status: res.status, data };
}

beforeAll(async () => {
  try {
    await fetch(`${BASE}/api/test-login`, { method: "OPTIONS" });
  } catch {
    throw new Error(`Kein Dev-Server unter ${BASE}. Bitte npm run dev, dann npm run test:rechte.`);
  }
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  for (const id of [charA1, charA2, charB]) {
    if (id) await sql`DELETE FROM characters WHERE id = ${id}`;
  }
  await sql.end();
});

describe("T-015 Rechte-Matrix (Produkt-APIs, Plan 001 T-011)", () => {
  it("legt Welt, Einladungen und Rollen an", async () => {
    const created = await api<{ id: string }>(gm, "POST", "/api/worlds", {
      name: `Rechte-Matrix ${Date.now()}`,
    });
    expect(created.status).toBe(201);
    worldId = created.data.id;

    const world = await api<{ universes: { id: string; name: string; visibility: string }[] }>(
      gm,
      "GET",
      `/api/worlds/${worldId}`,
    );
    expect(world.status).toBe(200);
    hauptUniverse = world.data.universes.find((row) => row.name === "Hauptuniversum")?.id ?? "";
    expect(hauptUniverse).toBeTruthy();

    const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "unlimited" });
    expect(invite.status).toBe(201);
    inviteCode = invite.data.code;

    const revoked = await api<{ id: string; code: string }>(gm, "POST", w("/invites"), {
      validity: "unlimited",
    });
    expect(revoked.status).toBe(201);
    expect((await api(gm, "DELETE", w(`/invites/${revoked.data.id}`))).status).toBe(200);
    expect((await api(playerB, "POST", `/api/invites/${revoked.data.code}/join`)).status).toBe(409);

    expect((await api(master, "POST", `/api/invites/${inviteCode}/join`)).status).toBe(200);
    expect((await api(playerA, "POST", `/api/invites/${inviteCode}/join`)).status).toBe(200);
    expect((await api(playerB, "POST", `/api/invites/${inviteCode}/join`)).status).toBe(200);
    await refreshMembers();
    expect(
      (await api(gm, "PATCH", w(`/members/${membershipByUser.get(master.user.id)}`), { role: "master" })).status,
    ).toBe(200);
  });

  it("legt Charaktere, Tagebücher, Artikel, Karten, Marker und Relationen an", async () => {
    const a1 = await api<{ id: string }>(playerA, "POST", "/api/characters", { name: "Aria Eins" });
    const a2 = await api<{ id: string }>(playerA, "POST", "/api/characters", { name: "Aria Zwei" });
    const b1 = await api<{ id: string }>(playerB, "POST", "/api/characters", { name: "Bram" });
    expect(a1.status).toBe(201);
    expect(a2.status).toBe(201);
    expect(b1.status).toBe(201);
    charA1 = a1.data.id;
    charA2 = a2.data.id;
    charB = b1.data.id;

    for (const id of [charA1, charA2]) {
      expect((await api(playerA, "POST", w("/characters"), { characterId: id })).status).toBe(200);
    }
    expect((await api(playerB, "POST", w("/characters"), { characterId: charB })).status).toBe(200);

    const priv = await api<{ id: string }>(playerA, "POST", w(`/characters/${charA1}/journal`), {
      title: "Geheim",
      body: doc("Privates Geheimnis von A"),
      visibility: "private",
    });
    const shared = await api<{ id: string }>(playerA, "POST", w(`/characters/${charA1}/journal`), {
      title: "Geteilt",
      body: doc("Mit Spielleitung geteilt"),
      visibility: "shared_with_gm",
    });
    expect(priv.status).toBe(201);
    expect(shared.status).toBe(201);
    journalPrivate = priv.data.id;
    journalShared = shared.data.id;

    const pub = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Öffentlicher Ort",
      visibility: "published",
    });
    const hid = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Nur SL",
      visibility: "gm_only",
    });
    expect(pub.status).toBe(201);
    expect(hid.status).toBe(201);
    articlePublished = pub.data.article.id;
    articleHidden = hid.data.article.id;

    const map = await uploadMap(gm, hauptUniverse, "Hauptkarte");
    expect(map.status).toBe(201);
    publicMap = map.data.map!.id;
    expect((await api(gm, "PATCH", w("/map"), { mapId: publicMap, visibility: "published" })).status).toBe(200);

    const pin = await api<{ pin: { id: string } }>(gm, "POST", w("/map/pins"), {
      mapId: publicMap,
      pinType: "city",
      title: "Stadt",
      visibility: "published",
      posX: 0.2,
      posY: 0.3,
    });
    expect(pin.status).toBe(201);
    publicPin = pin.data.pin.id;

    const hiddenU = await api<{ id: string }>(gm, "POST", w("/universes"), {
      name: "Nur Spielleitung",
      visibility: "gm_only",
    });
    expect(hiddenU.status).toBe(201);
    hiddenUniverse = hiddenU.data.id;
    const hiddenM = await uploadMap(gm, hiddenUniverse, "Geheime Karte");
    expect(hiddenM.status).toBe(201);
    hiddenMap = hiddenM.data.map!.id;
    expect((await api(gm, "PATCH", w("/map"), { mapId: hiddenMap, visibility: "published" })).status).toBe(200);
    expect(
      (
        await api(gm, "POST", w("/map/pins"), {
          mapId: hiddenMap,
          pinType: "dungeon",
          title: "Versteckter Pin",
          visibility: "published",
          posX: 0.5,
          posY: 0.5,
        })
      ).status,
    ).toBe(201);

    const m1 = await api<{ marker: { id: string } }>(playerA, "POST", w("/map/markers"), {
      mapId: publicMap,
      characterId: charA1,
      posX: 0.4,
      posY: 0.41,
    });
    const m2 = await api<{ marker: { id: string } }>(playerA, "POST", w("/map/markers"), {
      mapId: publicMap,
      characterId: charA2,
      posX: 0.42,
      posY: 0.43,
    });
    const mb = await api<{ marker: { id: string } }>(playerB, "POST", w("/map/markers"), {
      mapId: publicMap,
      characterId: charB,
      posX: 0.7,
      posY: 0.71,
    });
    expect(m1.status).toBe(201);
    expect(m2.status).toBe(201);
    expect(mb.status).toBe(201);
    markerA1 = m1.data.marker.id;
    markerA2 = m2.data.marker.id;
    markerB = mb.data.marker.id;

    expect(
      (
        await api(gm, "POST", w("/relations"), {
          sourceKind: "article",
          sourceId: articlePublished,
          targetKind: "article",
          targetId: articleHidden,
          label: "hängt zusammen mit",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await api(gm, "POST", w("/relations"), {
          sourceKind: "article",
          sourceId: articlePublished,
          targetKind: "universe",
          targetId: hiddenUniverse,
          label: "liegt in",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await api(gm, "POST", w("/relations"), {
          sourceKind: "character",
          sourceId: charA1,
          targetKind: "article",
          targetId: articlePublished,
          label: "kennt",
        })
      ).status,
    ).toBe(201);
  });

  it("Tagebuch: Player B sieht nichts von A; Staff nur geteilt", async () => {
    const asB = await api<{ entries: { id: string }[] }>(playerB, "GET", w(`/characters/${charA1}/journal`));
    expect(asB.data.entries.map((row) => row.id)).toEqual([]);

    for (const session of [gm, master]) {
      const res = await api<{ entries: { id: string }[] }>(session, "GET", w(`/characters/${charA1}/journal`));
      expect(res.data.entries.map((row) => row.id)).toEqual([journalShared]);
    }

    const asA = await api<{ entries: { id: string }[] }>(playerA, "GET", w(`/characters/${charA1}/journal`));
    expect(asA.data.entries.map((row) => row.id).sort()).toEqual([journalPrivate, journalShared].sort());
  });

  it("Artikel nur Spielleitung: Staff ja, Player nein", async () => {
    const player = await api<{ articles: { id: string }[] }>(playerA, "GET", w("/articles"));
    expect(player.data.articles.map((row) => row.id)).toContain(articlePublished);
    expect(player.data.articles.map((row) => row.id)).not.toContain(articleHidden);
    expect((await api(playerA, "GET", w(`/articles/${articleHidden}`))).status).toBe(404);

    const staff = await api<{ articles: { id: string }[] }>(master, "GET", w("/articles"));
    expect(staff.data.articles.map((row) => row.id)).toContain(articleHidden);
  });

  it("verstecktes Universum: Player sieht Karte/Pins nicht", async () => {
    const playerUnis = await api<{ universes: { id: string }[] }>(playerA, "GET", w("/universes"));
    expect(playerUnis.data.universes.map((row) => row.id)).not.toContain(hiddenUniverse);

    const playerMap = await api<{ map: { id: string } | null; pins: { id: string }[] }>(
      playerA,
      "GET",
      w(`/map?universe=${hiddenUniverse}`),
    );
    expect(playerMap.status).toBe(200);
    expect(playerMap.data.map?.id ?? null).not.toBe(hiddenMap);
    expect(playerMap.data.pins.map((pin) => pin.id)).not.toContain(
      (
        await api<{ pins: { id: string }[] }>(gm, "GET", w(`/map?universe=${hiddenUniverse}`))
      ).data.pins[0]?.id,
    );

    const staffMap = await api<{ map: { id: string } | null; pins: { id: string }[] }>(
      gm,
      "GET",
      w(`/map?universe=${hiddenUniverse}`),
    );
    expect(staffMap.data.map?.id).toBe(hiddenMap);
    expect(staffMap.data.pins.length).toBeGreaterThan(0);
  });

  it("Relationen mit verstecktem Ende nur für Staff", async () => {
    const player = await api<{ items: { id: string; kind: string }[] }>(
      playerA,
      "GET",
      w(`/relations?kind=article&id=${articlePublished}`),
    );
    expect(player.data.items.some((row) => row.id === articleHidden)).toBe(false);
    expect(player.data.items.some((row) => row.id === hiddenUniverse)).toBe(false);

    const staff = await api<{ items: { id: string }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${articlePublished}`),
    );
    expect(staff.data.items.some((row) => row.id === articleHidden)).toBe(true);
    expect(staff.data.items.some((row) => row.id === hiddenUniverse)).toBe(true);
  });

  it("Player dürfen keine Artikel, Pins, Karten, Universen oder manuellen Relationen schreiben", async () => {
    expect((await api(playerA, "POST", w("/articles"), { title: "Unerlaubt" })).status).toBe(403);
    expect((await api(playerA, "PATCH", w(`/articles/${articlePublished}`), { title: "Hack" })).status).toBe(403);
    expect((await api(playerA, "DELETE", w(`/articles/${articlePublished}`))).status).toBe(403);
    expect((await api(playerA, "POST", w("/universes"), { name: "Player-U" })).status).toBe(403);
    expect((await api(playerA, "PATCH", w(`/universes/${hauptUniverse}`), { name: "Hack" })).status).toBe(403);
    expect((await uploadMap(playerA, hauptUniverse, "Zweite")).status).toBe(403);
    expect(
      (
        await api(playerA, "POST", w("/map/pins"), {
          mapId: publicMap,
          pinType: "shop",
          title: "Unerlaubt",
          posX: 0.1,
          posY: 0.1,
        })
      ).status,
    ).toBe(403);
    expect((await api(playerA, "PATCH", w(`/map/pins/${publicPin}`), { title: "Hack" })).status).toBe(403);
    expect((await api(playerA, "DELETE", w(`/map/pins/${publicPin}`))).status).toBe(403);
    expect(
      (
        await api(playerA, "POST", w("/relations"), {
          sourceKind: "article",
          sourceId: articlePublished,
          targetKind: "character",
          targetId: charA1,
          label: "unerlaubt",
        })
      ).status,
    ).toBe(403);
  });

  it("Marker: Player A nur eigene; Master beide; kein zweiter Marker", async () => {
    const own = await api<{ marker: { posX: string } }>(playerA, "PATCH", w(`/map/markers/${markerA1}`), {
      posX: 0.44,
      posY: 0.45,
    });
    expect(own.status).toBe(200);
    expect(Number(own.data.marker.posX)).toBeCloseTo(0.44);

    expect((await api(playerA, "PATCH", w(`/map/markers/${markerB}`), { posX: 0.1, posY: 0.1 })).status).toBe(403);
    expect((await api(master, "PATCH", w(`/map/markers/${markerA2}`), { posX: 0.55, posY: 0.56 })).status).toBe(200);
    expect((await api(master, "PATCH", w(`/map/markers/${markerB}`), { posX: 0.72, posY: 0.73 })).status).toBe(200);

    // Same character again: replace (one marker per character), not 409.
    const replaced = await api<{ marker: { id: string } }>(playerA, "POST", w("/map/markers"), {
      mapId: publicMap,
      characterId: charA1,
      posX: 0.9,
      posY: 0.9,
    });
    expect(replaced.status).toBe(201);
    markerA1 = replaced.data.marker.id;
    const state = await api<{ markers: { id: string; characterId: string }[] }>(
      playerA,
      "GET",
      w(`/map?map=${publicMap}`),
    );
    expect(state.data.markers.filter((row) => row.characterId === charA1)).toHaveLength(1);
  });

  it("kein zweiter GM; Master/Player dürfen nicht einladen oder Rollen ändern", async () => {
    await refreshMembers();
    expect([400, 403]).toContain(
      (await api(gm, "PATCH", w(`/members/${membershipByUser.get(playerA.user.id)}`), { role: "game_master" })).status,
    );
    expect(
      (await api(master, "PATCH", w(`/members/${membershipByUser.get(gm.user.id)}`), { role: "player" })).status,
    ).toBe(403);
    expect((await api(master, "DELETE", w(`/members/${membershipByUser.get(gm.user.id)}`))).status).toBe(403);
    expect((await api(master, "POST", w("/invites"), { validity: "seven_days" })).status).toBe(403);
    expect((await api(playerA, "POST", w("/invites"), { validity: "seven_days" })).status).toBe(403);
    expect(
      (await api(master, "PATCH", w(`/members/${membershipByUser.get(playerB.user.id)}`), { role: "master" })).status,
    ).toBe(403);
    expect((await api(master, "DELETE", w(`/members/${membershipByUser.get(playerB.user.id)}`))).status).toBe(403);
  });

  it("GM ernennt B, stuft zurück und entfernt B", async () => {
    await refreshMembers();
    const bId = membershipByUser.get(playerB.user.id)!;
    expect((await api(gm, "PATCH", w(`/members/${bId}`), { role: "master" })).status).toBe(200);
    expect((await api(gm, "PATCH", w(`/members/${bId}`), { role: "player" })).status).toBe(200);
    expect((await api(gm, "DELETE", w(`/members/${bId}`))).status).toBe(200);
    await refreshMembers();
    expect(membershipByUser.has(playerB.user.id)).toBe(false);
  });

  it("Austritt archiviert ohne Löschen; Snapshot ohne privaten Klartext; Re-Join stellt wieder her", async () => {
    expect((await api(playerA, "POST", w("/leave"))).status).toBe(200);

    const persist = await api<{
      memberships: { userId: string; archivedAt: string | null }[];
      participations: { characterId: string; archivedAt: string | null }[];
      journals: { id: string; visibility: string; bodyFingerprint: string | null; bodyPlain?: string }[];
      markers: { id: string }[];
      relations: { id: string }[];
    }>(gm, "GET", w("/persistence"));
    expect(persist.status).toBe(200);
    expect(persist.data.memberships.find((row) => row.userId === playerA.user.id)?.archivedAt).toBeTruthy();
    expect(
      persist.data.participations
        .filter((row) => [charA1, charA2].includes(row.characterId))
        .every((row) => row.archivedAt),
    ).toBe(true);
    expect(persist.data.journals.some((row) => row.id === journalPrivate)).toBe(true);
    expect(persist.data.journals.some((row) => row.id === journalShared)).toBe(true);
    expect(persist.data.journals.every((row) => !("bodyPlain" in row))).toBe(true);
    const privateRow = persist.data.journals.find((row) => row.id === journalPrivate)!;
    expect(privateRow.visibility).toBe("private");
    expect(privateRow.bodyFingerprint).toBe(`len:${"Privates Geheimnis von A".length}`);
    expect(privateRow.bodyFingerprint).not.toContain("Geheimnis");
    expect(persist.data.markers.some((row) => row.id === markerA1)).toBe(true);

    expect((await api(master, "GET", w(`/characters/${charA1}`))).status).toBe(404);
    expect((await api(gm, "GET", w(`/characters/${charA1}/journal`))).status).toBe(404);

    const mapAfter = await api<{ markers: { id: string }[] }>(master, "GET", w(`/map?universe=${hauptUniverse}`));
    expect(mapAfter.data.markers.some((row) => row.id === markerA1)).toBe(false);

    const rels = await api<{ items: { id: string; kind: string }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${articlePublished}`),
    );
    expect(rels.data.items.some((row) => row.kind === "character" && row.id === charA1)).toBe(false);

    expect((await api(playerA, "POST", `/api/invites/${inviteCode}/join`)).status).toBe(200);
    expect((await api(playerA, "POST", w("/characters"), { characterId: charA1 })).status).toBe(200);
    expect((await api(playerA, "POST", w("/characters"), { characterId: charA2 })).status).toBe(200);

    expect((await api(gm, "GET", w(`/characters/${charA1}`))).status).toBe(200);
    const journals = await api<{ entries: { id: string }[] }>(playerA, "GET", w(`/characters/${charA1}/journal`));
    expect(journals.data.entries.map((row) => row.id).sort()).toEqual([journalPrivate, journalShared].sort());

    const mapRestored = await api<{ markers: { id: string; posX: string; posY: string }[] }>(
      playerA,
      "GET",
      w(`/map?universe=${hauptUniverse}`),
    );
    const restored = mapRestored.data.markers.find((row) => row.id === markerA1);
    expect(restored).toBeTruthy();
    expect(Number(restored!.posX)).toBeCloseTo(0.9);
    expect(Number(restored!.posY)).toBeCloseTo(0.9);

    const relsAfter = await api<{ items: { kind: string; id: string }[] }>(
      playerA,
      "GET",
      w(`/relations?kind=article&id=${articlePublished}`),
    );
    expect(relsAfter.data.items.some((row) => row.kind === "character" && row.id === charA1)).toBe(true);
  });

  it("Master kann die Welt nicht löschen", async () => {
    expect((await api(master, "DELETE", `/api/worlds/${worldId}`)).status).toBe(403);
    expect((await api(gm, "GET", `/api/worlds/${worldId}`)).status).toBe(200);
  });

  it("Vorlagen-Verweis und Stub berühren Rechte (Staff schreibt, Player nicht)", async () => {
    const person = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Stub-Person",
      templateType: "person",
      visibility: "gm_only",
    });
    expect(person.status).toBe(201);
    const [row] = await sql`SELECT first_edited_at FROM articles WHERE id = ${person.data.article.id}`;
    expect(row.first_edited_at).toBeNull();
    expect((await api(playerA, "PATCH", w(`/articles/${person.data.article.id}`), { title: "Hack" })).status).toBe(
      403,
    );
    expect(
      (
        await api(gm, "PATCH", w(`/articles/${person.data.article.id}`), {
          templateFields: { occupation: "Schmied" },
        })
      ).status,
    ).toBe(200);
  });
});
