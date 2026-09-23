# 006 – Monster-Marker, Stecknadel-Marker und Kartenfilter

## Kontext & Ziel

Auf Karten stehen heute Pins (Stecknadel-Symbole je Pin-Typ) und Charakter-Marker (runder Avatar mit Name). Der runde Avatar lässt nicht erkennen, auf welchen Punkt er genau zeigt. Außerdem fehlen Monster auf der Karte und eine Möglichkeit, Inhalte auszublenden.

**Ziel dieses Plans** (Wünsche des Projektinhabers, 2026-09-23):

1. **Monster-Marker:** Die Spielleitung setzt Monster (Plan `005`) auf Karten. Der Picker listet nur Monster.
2. **Stecknadel-Format** für Charakter- und Monster-Marker: Die Spitze zeigt exakt auf die gespeicherte Position, wie bei Pins.
3. **Kartenfilter:** Charaktere, Monster und jeder der 12 Pin-Typen lassen sich ein- und ausblenden.

**Nicht Ziel dieses Plans:**

- Änderungen an Pins selbst (Typen, Symbole, Sperren). **Ausnahme:** die Anker-Korrektur nach K8.
- Eine Liste der Vorkommen eines Monsters auf seiner Detailseite.
- Filter nach Sichtbarkeit oder Owner.

## Entscheidungen (Projektinhaber, 2026-09-23, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| K1 | Wie viele Marker pro Monster? | **Beliebig viele**, auch mehrere auf derselben Karte. Jeder Marker ist ein Vorkommen (z. B. 3 × Schattenwolf). |
| K2 | Wer platziert, wer sieht Monster-Marker? | Nur die Spielleitung platziert, verschiebt und entfernt. Jeder Marker hat eine **eigene dreistufige Sichtbarkeit** (Start immer `nur ich`, siehe K6; Owner = Platzierender). Sichtbar nur, wenn zusätzlich Monster und Karte sichtbar sind (`APP-VIS-INHERIT`). |
| K3 | Umfang des Kartenfilters | Chips für **Charaktere**, **Monster** und jeden der **12 Pin-Typen** in einem Filter-Sheet. Auswahl wird **pro Gerät gemerkt**. |
| K4 | Aussehen der Marker | **Stecknadel mit Bild im Nadelkopf** (Profilbild bzw. Initialen). Farbe: **Monster immer schwarz, Charaktere immer Gold.** Der Name bleibt unter der Nadel. |
| K5 | Echtzeit für Monster-Marker (Plan-Review, 2026-09-23) | **Immer live, wie Charakter-Marker.** Ereignisse `map.monsterMarker` und `map.monsterMarker.deleted` nach dem bestehenden Muster (`map.marker` / `map.marker.deleted` in `src/lib/map/repository.ts`: nur Art, IDs und `layers`; Server filtert nach Sichtbarkeit). Ändern sich Name, Bild oder Sichtbarkeit eines Monsters oder wird es gelöscht (CASCADE), sendet das Monster-Repository für jede betroffene Karte `map.updated`; der Client lädt den Kartenzustand neu. |
| K6 | Was ist an einem Monster-Marker änderbar? (Plan-Review, 2026-09-23) | **Das zugeordnete Monster ist unveränderlich.** Änderbar sind nur Position (Drag) und Sichtbarkeit. Falsch angelegt → löschen und neu setzen. Neue Monster-Marker starten **immer** mit `nur ich` (`owner_only`); beim Anlegen gibt es keine Sichtbarkeitsauswahl. So legt die Spielleitung Marker vorab zurecht und veröffentlicht sie, wenn sie im Spiel auslösen. |
| K7 | Was sieht ein Player beim Antippen? (Plan-Review, 2026-09-23) | **Nur-Lese-Sheet**: Bild, Name, Seltenheits-Pill, Link „Zum Monster“, keine Aktionen. Gleiches Monster-Marker-Sheet wie für die Spielleitung, Aktionen per Rollenweiche ausgeblendet. Der Link ist nie tot: Sieht ein Player den Marker, sieht er wegen `APP-VIS-INHERIT` auch das Monster. |
| K8 | Anker der Nadelspitze (Plan-Review, 2026-09-23) | **Zentral korrigieren, Pins eingeschlossen.** Befund: Die Pin-Grafik ist 48 × 58 mit Spitze bei (24, 56) (`src/lib/map/pin-types.ts`, `pinTypeIconUrl`), Leaflet bekommt aber `iconSize [56, 72]` / `iconAnchor [28, 70]` (`use-leaflet-map.ts`) → Pin-Spitzen sitzen heute ca. 14 px über und 4 px links der gespeicherten Position. Gemeinsame Konstante (z. B. `PIN_ICON = { size: [48, 58], anchor: [24, 56] }` in `src/lib/map/`) für Pins, Charakter- und Monster-Marker; Namensbeschriftung liegt außerhalb dieses Rahmens (absolut positioniert unter der Spitze). Keine Datenmigration: gespeichert wird der Anker. Bestehende Pins rutschen einmalig optisch auf ihre gespeicherte Stelle. |

## Begriffe & Systeme

Begriffe aus Plan `003`, `004`, `005` und `.ai/architecture/datenmodell-fachlich.md` gelten (Karte, Pin, Pin-Typ, Charakter-Marker, Monster, Owner, dreistufige Sichtbarkeit, Spielleitung, SSE). Zusätzlich:

- **Monster-Marker**: Platzierung eines Monsters auf einer Karte. Tabelle `monster_markers` (`id`, `monster_id` FK `monsters` ON DELETE CASCADE, `map_id` FK `maps` ON DELETE CASCADE, `pos_x`/`pos_y` numeric(8,7) 0–1, `owner_id`, `visibility` `content_visibility`, Protokollfelder). Kein Unique-Constraint (K1).
- **Stecknadel-Marker**: Darstellung eines Charakter- oder Monster-Markers als Stecknadel in Pin-Größe (Grafik 48 × 58 px wie `.pin-hit`): runder Kopf mit Profilbild oder Initialen, Spitze bei (24, 56) exakt auf der Position (Leaflet-`iconAnchor` = Spitze, gemeinsame Konstante nach K8). Rahmen/Nadel **Gold** bei Charakteren, **Schwarz** bei Monstern. Name als Beschriftung darunter.
- **Gold / Schwarz**: Konkrete Farbwerte werden im Prototyp (T-002) festgelegt und als CSS-Variablen `--marker-character` / `--marker-monster` in `src/app/globals.css` übernommen; Gold soll sich vom Akzent-Gelb der Hervorhebung unterscheiden, Schwarz braucht einen hellen Kontur-Rand für dunkle Karten.
- **Monster-Picker**: Auswahl-Sheet beim Platzieren, listet alle für den Betrachter sichtbaren Monster der Welt mit Suche nach Name (Teilwort, ohne Groß-/Kleinschreibung), Bild, Seltenheits-Pill.
- **Kartenfilter**: Filter-Sheet, geöffnet über einen Filter-Button in der Kartenleiste (`.map-top`), mit 14 Chips (Charaktere, Monster, 12 Pin-Typen) und „Alle an“. Ausgeblendete Elemente werden nicht gerendert; sie bleiben erhalten und werden per SSE weiter aktualisiert. Ist mindestens ein Chip aus, zeigt der Filter-Button eine Markierung.
- **Filter-Speicher**: `localStorage`-Schlüssel `worldcraft.mapFilter.<worldId>` mit der Liste der ausgeblendeten Kategorien; Lesen/Schreiben in `try/catch`, bei Fehler gilt „alles an“.

## Relevante Normen

- `.ai/architecture/datenmodell-fachlich.md` — 2.2 Sichtbarkeit, 3.6 Karte, 3.7 Pin, 3.10 Charakter-Marker, Monster (aus Plan `005`), 4 Löschregeln, 5 Rechte.
- `.ai/architecture/datenmodell.md` — 3.7 `pins`, 3.11 `character_markers`, `monsters` (Plan `005`), 5 Regeln (`APP-VIS-INHERIT`, `APP-MARKER-MANUAL`), 8 Löschregeln.
- `.ai/decisions/003-karten.md` — Leaflet, Koordinaten, Marker-Darstellung.
- `.ai/standards/mobile-first.md`, `.ai/standards/mobile-navigation.md`
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit.
- `.ai/roadmap.md` — Arbeitsweise (Prototyp vor Umsetzung, Commit pro Task, nie automatisch pushen).
- `spikes/ui-prototype/index.html` — Design-Referenz; wird in T-002 erweitert.

## Globale Abhängigkeiten

- **Plan `005` abgeschlossen** (Tabelle `monsters`, Profilbild, Seltenheits-Pill, Rechte für Monster).
- Plan `004` abgeschlossen (dreistufige Sichtbarkeit; Karten-Ereignisse tragen nur Art und ID, R5).
- Kartencode: `src/components/map/*`, `src/lib/map/*`, API `src/app/api/worlds/[worldId]/map/*`, SSE `src/app/api/worlds/[worldId]/events/route.ts`.

## Aufgaben

### T-001: Normen nachziehen
- [ ] Beschreibung: K1–K4 in die Normen übernehmen: `datenmodell-fachlich.md` neuer Abschnitt „Monster-Marker“ (Eigenschaften, Rechte, Sichtbarkeit mit Vererbung, Löschregeln: Monster oder Karte löschen → Marker entfallen); `datenmodell.md` Tabelle `monster_markers`; `003-karten.md` Abschnitt zur Stecknadel-Darstellung von Pins und Markern (gemeinsamer Anker an der Spitze nach K8, Farben) und zum Kartenfilter (rein clientseitig, pro Gerät). `roadmap.md`: Plan `006` nach `005` eintragen.
- Abhängigkeiten: keine
- Abnahmekriterium: Die drei Dokumente enthalten K1–K4 mit Datum 2026-09-23; `roadmap.md` listet `006`; kein Widerspruch zu 3.10 (Charakter-Marker bleiben einer pro Charakter).

### T-002: Prototyp erweitern
- [ ] Beschreibung: In `spikes/ui-prototype/index.html`: Charakter-Marker als goldene Stecknadel mit Bild im Kopf; Monster-Marker als schwarze Stecknadel; Monster-Picker beim Platzieren (Spielleitung); Monster-Marker-Sheet (Name, Seltenheits-Pill, Link zum Monster, Sichtbarkeit, Entfernen) für die Spielleitung und als Nur-Lese-Variante für Player (K7); Filter-Button in der Kartenleiste mit Filter-Sheet (14 Chips + „Alle an“). Farbwerte für Gold/Schwarz festlegen. Dem Projektinhaber zeigen, bevor T-005 und T-006 beginnen.
- Abhängigkeiten: T-001
- Abnahmekriterium: Im Prototyp zeigt die Nadelspitze beim Zoomen stabil auf denselben Kartenpunkt; Gold und Schwarz sind auf heller und dunkler Karte erkennbar; mobil (375 px) ohne horizontales Scrollen; Projektinhaber hat den Prototyp im Chat freigegeben (Datum im Plan vermerkt).

### T-003: Schema und Migration
- [ ] Beschreibung: Tabelle `monster_markers` in `src/db/schema.ts` nach *Begriffe* mit Checks `pos_x`/`pos_y` 0–1 und Index auf `map_id`; Migration erzeugen.
- Abhängigkeiten: T-001
- Abnahmekriterium: Migration läuft auf leerer und bestehender lokaler DB; Insert mit `pos_x = 1.5` scheitert; Löschen eines Monsters löscht seine Marker (Integrationstest).

### T-004: API, Rechte und Echtzeit
- [ ] Beschreibung: Routen unter `src/app/api/worlds/[worldId]/map/monster-markers/` (`POST` anlegen mit `monsterId`, `mapId`, `posX`, `posY` – ohne Sichtbarkeit, immer `owner_only` (K6); `PATCH` nur Position und Sichtbarkeit, `monsterId`/`mapId` im Body → 400; `DELETE`) und Aufnahme der sichtbaren Monster-Marker in den Kartenzustand (`src/lib/map/repository.ts`, `types.ts`: neuer `MonsterMarkerDto` mit Monster-Name, Bild-URL, Seltenheit). Rechte über `src/lib/authz`: nur Spielleitung schreibt; Sichtbarkeit nach K2 inkl. Vererbung Monster/Karte; `owner_only` nur durch Owner setzbar (403). SSE nach K5: `map.monsterMarker` und `map.monsterMarker.deleted` mit `layers` wie `map.marker` (R5: nur Art und IDs); zusätzlich `map.updated` für alle Karten mit Markern eines Monsters, wenn sich dessen Name, Bild oder Sichtbarkeit ändert oder es gelöscht wird (Aufruf im Monster-Repository aus Plan `005`).
- Abhängigkeiten: T-003
- Abnahmekriterium: `map.api.test.ts` erweitert: Player `POST` → 403; Marker mit `gm_only` erscheint im Kartenzustand der Spielleitung, nicht beim Player; veröffentlichter Marker eines `gm_only`-Monsters erscheint beim Player nicht; drei Marker desselben Monsters auf einer Karte möglich; `POST` mit `visibility: "published"` legt trotzdem `owner_only` an; `PATCH` mit `monsterId` → 400; Monster auf `owner_only` stellen oder löschen erzeugt `map.updated` für die Karte (Test über Event-Bus). `rechte-matrix.api.test.ts` um `monster_marker` erweitert; `npm run test:rechte` grün.

### T-005: Stecknadel-Darstellung
- [ ] Beschreibung: `src/lib/map/character-marker.ts` zu einem gemeinsamen Stecknadel-Renderer umbauen (z. B. `markerPinHtml({ name, imageUrl, variant: "character" | "monster" })`); gemeinsame Konstante für Nadelgröße und Anker (K8), genutzt von Pins, Charakter- und Monster-Markern in `use-leaflet-map.ts` (Pin-Icon von `[56, 72]`/`[28, 70]` auf die Konstante umstellen); Namensbeschriftung außerhalb des Icon-Rahmens; CSS mit `--marker-character` / `--marker-monster` aus T-002. Charakter-Marker nutzen die neue Darstellung; Drag-and-Drop funktioniert wie bisher. Eine Hervorhebung von Markern (analog `map-pin-hl`) ist nicht Teil des Plans (Plan-Review 2026-09-23).
- Abhängigkeiten: T-002
- Abnahmekriterium: Unit-Test für den Renderer (Initialen ohne Bild, HTML escaped, Variante setzt Klasse) und für die Konstante (Anker = Spitze der Pin-Grafik); manuell: gespeicherte Position eines Pins und eines Charakters (`pos_x`/`pos_y`) stimmt nach Verschieben und Neuladen pixelgenau mit der Nadelspitze überein, bei Zoomstufe min. und max.

### T-006: Monster platzieren und bearbeiten (UI)
- [ ] Beschreibung: In `MapView.tsx`/`MapSheets.tsx`: Aktion „Monster platzieren“ für die Spielleitung, Monster-Picker nach *Begriffe*, danach Tippen auf die Karte setzt den Marker (gleicher Ablauf wie Pin setzen); Monster-Marker-Sheet mit Name, Seltenheits-Pill, Link `/w/[worldId]/monsters/[monsterId]`, Sichtbarkeitsauswahl (dreistufig, „nur ich“ nur für Owner) und „Entfernen“; Player sehen dasselbe Sheet ohne Sichtbarkeit und „Entfernen“ (K7); Verschieben per Drag für die Spielleitung; Realtime über `use-map-realtime.ts`.
- Abhängigkeiten: T-004, T-005
- Abnahmekriterium: Manuell mit zwei Browsern (Game Master, Player per Test-Login): GM platziert zwei Schattenwölfe, beide stehen „nur ich“ (keine Auswahl beim Anlegen) und sind beim Player unsichtbar; nach „veröffentlicht“ erscheinen sie beim Player ohne Neuladen; Entfernen verschwindet bei beiden; GM benennt das Monster um → Name am Marker ändert sich beim Player ohne Neuladen; Monster-Marker-Sheet bietet keine Möglichkeit, das Monster zu tauschen; Player sieht keine Platzieren-/Bearbeiten-Aktionen; Player tippt veröffentlichten Marker an → Sheet mit Bild, Name, Pill und funktionierendem Link „Zum Monster“.

### T-007: Kartenfilter
- [ ] Beschreibung: Filter-Button in der Kartenleiste und Filter-Sheet nach *Begriffe*; Filterzustand in `use-map-state.ts` (oder eigenem Hook) mit Filter-Speicher; Pins nach Pin-Typ, Charakter- und Monster-Marker nach Gruppe ausblenden. Ein über Deep-Link hervorgehobener Pin (`map-pin-hl`) wird auch bei ausgeblendetem Typ angezeigt.
- Abhängigkeiten: T-002, T-006
- Abnahmekriterium: Manuell: „Monster“ aus → keine Monster-Marker, nach Neuladen weiterhin aus; Pin-Typ „Shop“ aus → nur Shop-Pins weg; „Alle an“ stellt alles her; Filter-Button zeigt Markierung, solange etwas aus ist; in einem privaten Fenster (kein `localStorage`) funktioniert der Filter ohne Fehler in der Konsole. Unit-Test für die Filterfunktion (Kategorie eines Elements → sichtbar ja/nein).

### T-008: Smoketest und Abschlussprüfung
- [ ] Beschreibung: `.ai/infrastructure/smoketest.md` um Punkte für Monster-Marker, Stecknadel-Genauigkeit und Kartenfilter ergänzen; vollständige Testsuite laufen lassen.
- Abhängigkeiten: T-006, T-007
- Abnahmekriterium: Neue Smoketest-Punkte lokal durchlaufen und abgehakt; `npm test`, `npm run test:rechte`, `npm run lint`, `npm run build` grün.
