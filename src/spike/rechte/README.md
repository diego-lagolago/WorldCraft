# Rechteprüfung (Produkt)

Die Rechtematrix aus Plan 001 T-011 läuft gegen die **Produkt-APIs** (Plan 003 T-015), nicht mehr gegen `/api/spike/rechte`.

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

Das führt alle `src/**/*.api.test.ts` aus, darunter `src/app/api/rechte-matrix.api.test.ts` (Plan-001-Matrix) und die feature-spezifischen API-Tests. Persistenz nach Austritt: `GET /api/worlds/:id/persistence` (nur mit Test-Login, ohne Klartext privater Tagebücher — CR-019a).

Andere Basis-URL: `RECHTE_BASE_URL=http://127.0.0.1:3000 npm run test:rechte`.

Der Spike-Code unter `src/spike/rechte/` bleibt bis T-016 ungenutzt und wird dort entfernt.
