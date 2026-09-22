# Spike T-011 — Rechteprüfung auf Datenebene

Keine eigene Oberfläche. Die Rechtematrix aus Plan 001 läuft über Session-Cookies gegen `/api/spike/rechte`.

## Start

Lokal mit Test-Login (nicht in Produktion):

```bash
docker compose up -d
npm run db:migrate
ENABLE_TEST_LOGIN=true npm run dev
```

Zweites Terminal:

```bash
npm run test:rechte
```

Das Skript `src/spike/rechte/run-rechte-tests.ts` meldet `test-gm`, `test-master`, `test-player-a` und `test-player-b` über `/api/test-login` an, legt Welt, Rollen, Charaktere und Einträge selbst an und prüft die Matrix per `fetch` (nicht über die UI).

Unit-Tests der Sichtbarkeitsregeln (ohne Server):

```bash
npm test
```

Andere Basis-URL: `RECHTE_BASE_URL=http://127.0.0.1:3000 npm run test:rechte`.

## API (Auszug)

Session wie beim Test-Login (`Cookie` aus `Set-Cookie`).

| Aktion | Methode |
|---|---|
| Welt anlegen (Aufrufer = Game Master) | `POST /api/spike/rechte/worlds` `{ name }` |
| Einladen / widerrufen / beitreten | `POST …/worlds/:id/invites`, `POST …/invites/:id/revoke`, `POST …/invites/:code/join` |
| Rolle / Entfernen / Austreten | `PATCH …/members/:userId`, `DELETE …/members/:userId`, `POST …/leave` |
| Artikel, Universen, Karten, Pins, Relationen | Staff schreibt; Listen filtern `gm_only` und Vererbung |
| Charaktere mitbringen, Tagebuch, Marker | Besitzer bzw. Staff laut Matrix |
| Persistenz nach Archiv (nur bei Test-Login) | `GET …/worlds/:id/_persistence` |
