# Features (Produktkatalog)

**Status:** Lebender Katalog — **verbindlich nachzuziehen**, wenn sich die Produktoberfläche ändert (siehe [conventions.md](conventions.md) § Features-Katalog).  
**Quellen:** Plan `001` F1–F10, Plan `003` MVP, Fachmodell, nachgezogene UX.  
**Nicht enthalten:** geplante, noch nicht gebaute Features (siehe Abschnitt *Geplant*).

Status-Spalte: **shipped** = produktiv nutzbar; **MVP** = Teil des MVP-Umfangs (meist ebenfalls shipped).

---

## Auth & Zugang

| Feature | Was es tut | Status |
|---|---|---|
| Discord-Login | Anmelden per Discord-OAuth (Scopes identify + email); Session same-origin | MVP / shipped |
| Discord-Allowlist | Nur IDs in `ALLOWED_DISCORD_IDS`; nicht erlaubte ID → klare Fehlermeldung (kein stiller Fail) | shipped |
| Test-Login | Seed-User lokal bei `ENABLE_TEST_LOGIN=true`; auf Prod nie (404 / Start-Guard) | MVP / shipped |
| Abmelden | Beendet die Sitzung | MVP / shipped |

## Shell & Navigation

| Feature | Was es tut | Status |
|---|---|---|
| App-Shell | Chrome nach Login: Weltkontext, Topbar, Mobile Bottom-Bar / Desktop-Sidebar | MVP / shipped |
| Vier Tabs | Kampagne · Karte · Chat · Menü (Reihenfolge und Labels fest) | MVP / shipped |
| Chat verdeckt Bar | Im Chat blendet der Composer die Bottom-Bar aus | MVP / shipped |
| Onboarding | Angemeldet ohne Welt: Welt anlegen oder Einladung einlösen | MVP / shipped |
| Versionsbadge | App-Version unten links, hellgrau lesbar (`package.json`, z. B. 0.1.1+) | shipped |

## Welten & Mitglieder

| Feature | Was es tut | Status |
|---|---|---|
| Welten | Anlegen, bearbeiten, löschen (nur GM); Name, Beschreibung ohne `@`, optionales Titelbild | MVP F1 / shipped |
| Universen | Mehrere pro Welt; Name, Beschreibung mit `@`, Reihenfolge, Sichtbarkeit; mehrere Karten pro Universum | MVP F1 / shipped |
| Mitglieder & Rollen | GM / Master / Player; Rollen ändern und entfernen nur GM; Austreten archiviert | MVP F6 / shipped |
| Einladungslinks | GM erzeugt Links (1 Tag / 7 Tage / unbegrenzt), widerrufbar; Beitritt inkl. Reaktivierung | MVP F6 / shipped |

## Kampagne (Hub)

| Feature | Was es tut | Status |
|---|---|---|
| Kampagnen-Hub | Welt wechseln, Universen, Artikel-/Quest-Listen, Live-Suche | MVP / shipped |
| Weltsuche | Suche in der Welt (Artikel, Quests, Charaktere, Pins, Universen); kein Tagebuch | MVP / shipped |

## Artikel & Editor

| Feature | Was es tut | Status |
|---|---|---|
| Artikel | Titel, Titelbild, Rich-Text, dreistufige Sichtbarkeit; Default `nur ich` | MVP F2 / Plan 004 / shipped |
| Vorlagen | Typen Person / Ort / Organisation / Gegenstand / ohne; strukturierte Felder | MVP F3 / shipped |
| TipTap-Editor | Erlaubte Formatierungen laut Plan 001; Paste ohne Bilder/Tabellen | MVP / shipped |
| Erwähnungen (`@`) | Teilwortsuche mit Kategorie; Bestätigen per Enter, Tab oder Klick; Stub rot → blau | MVP F2 / shipped |
| Stub-Artikel | Über `@` angelegt; `first_edited_at` erst bei echtem Inhalt | MVP / shipped |

## Relationen

| Feature | Was es tut | Status |
|---|---|---|
| Automatische Relationen | Aus Erwähnungen / Vorlagenfeldern / Quest-Beteiligung neu berechnet | MVP F2 / shipped |
| Manuelle Relationen | Spielleitung: Bezeichnung (+ optionale Gegenbezeichnung) zwischen Inhaltsarten | MVP F2 / shipped |
| „Verknüpft“ | Ein-/ausgehende Relationen auf Artikel, Quest, Charakter, Universum (nicht als Pin-Panel) | MVP F2 / shipped |

## Quests

| Feature | Was es tut | Status |
|---|---|---|
| Quests | Titel, Beschreibung mit `@`, Status offen/aktiv/abgeschlossen/gescheitert, dreistufige Sichtbarkeit; Default `nur ich` | MVP F7 / Plan 004 / shipped |
| Quest-Beteiligte | Mitgebrachte Charaktere zuordnen; erzeugt `participation`-Relationen | MVP F7 / shipped |
| Quest-Kapitel | Geordnete Abschnitte unter der Beschreibung; eigene Sichtbarkeit; Spielleitung legt an/bearbeitet/löscht/verschiebt/schaltet frei; Player sieht nur freigegebene, nummeriert 1…n über Sichtbare | Plan 004 T-008 / shipped |
| Quest-Notizblock | Gemeinsamer Rich-Text pro Quest (alle, die die Quest sehen); Speichern mit Versionskonflikt („Neu laden“); Erwähnungen klickbar, keine Relationen | Plan 004 T-010 / shipped |

## Charaktere & Tagebuch

| Feature | Was es tut | Status |
|---|---|---|
| Charakterbogen | Weltunabhängig: Attribute, Fertigkeiten, Fähigkeiten, Persönlichkeit, Bio, Bilder | MVP F8 / shipped |
| Mitbringen | Charakter in eine/mehrere Welten; mehrere gleichzeitig spielbar | MVP F8 / shipped |
| Tagebuch | Einträge pro Welt; Sichtbarkeit privat oder mit Spielleitung geteilt | MVP F9 / shipped |

## Karte

| Feature | Was es tut | Status |
|---|---|---|
| Mehrere Karten / Universum | Pro Universum beliebig viele Karten; Anlegen leer (ohne Bild), Löschen inkl. Pins/Marker (Kaskade) | shipped (Owner 2026-09-23) |
| Karten-Auswahl | Dropdown oben links: Label `Universum: Karte` (bei SL-only zusätzlich `· SL`); Spielleitung: ＋ anlegen / Papierkorb löschen | shipped |
| Kartenbild | Upload als Whiteboard-Hintergrund (Leaflet `CRS.Simple`); Zoom/Pan; Upload-Icon in der Toolbar (Spielleitung) | MVP F4 / shipped |
| Bild ersetzen | Vor Upload bei bestehendem Bild: Checkbox-Dialog (Bild wird ersetzt, Pins bleiben); erstes Upload ohne Warnung | shipped |
| Pins | 12 Typen; Titel + Rich-Text-Beschreibung; dreistufige Sichtbarkeit (Default `nur ich`); Drag, Sync nach Drop; **pro Karte** (kein Verschieben zwischen Karten) | MVP F5 / Plan 004 / shipped |
| Pin-Mentions | Erwähnungen in der Pin-Beschreibung als blaue Links; kein „Verknüpft“-Panel im Pin-Sheet | shipped |
| Charakter-Marker | Profilbild/Name auf der Karte; Besitzer oder Spielleitung platziert; **höchstens eine Karte weltweit pro Charakter** (Platzieren auf Karte B entfernt Marker von A) | MVP F5 / shipped |
| Pin-Sperre | Sperren/Entsperren nur Spielleitung | shipped |
| Karten-Sichtbarkeit | Auge-Icon in Toolbar (offen = sichtbar, durchgestrichen = nur Spielleitung) | shipped |
| Deep-Link | `/map?pin=` bzw. `/map?map=` zentriert / wählt Karte | MVP F5 / shipped |
| Leerzustand | Ohne Bild: mittiger Prompt + Upload (Spielleitung); Upload-Icon in Toolbar konsistent | shipped |
| Zoom/Scroll | Weiches Zoomen näher am UI-Prototyp (kein extremes Nachziehen) | shipped |

**Entscheidung 2026-09-23 (Owner):** Mehrere Karten pro Universum (APP-MAP-MVP-ONE aufgehoben). Pins bleiben kartenspezifisch (`map_id`). Charakter-Marker: `UNIQUE (character_id)` — max. eine aktive Karte pro Charakter. Smoketest: [infrastructure/smoketest.md](infrastructure/smoketest.md) → Multi-Karten (MK.*).

## Chat & Würfel

| Feature | Was es tut | Status |
|---|---|---|
| Gruppenchat | Kanäle, Threads (eingerückt + Chevron), SSE-Realtime; ohne aktiven Kanal Hinweis statt Auto-Anlage | MVP F10 / shipped |
| Kanalverwaltung | Anlegen, umbenennen, Reihenfolge, archivieren/wiederherstellen (Spielleitung) | shipped |
| Composer | Leerzeichen ohne Cursor-Sprung; Absätze (Shift+Enter) in Nachrichten sichtbar | shipped |
| Würfel | Serverseitige Auswertung; Sheet wie Chat-Spike (mehrere Terme, Bonus, Ergebnisfeld); Befehle `/roll` und Alias `/r` | Plan 008 / in Arbeit |
| Nachrichten löschen | Autor oder Spielleitung; Würfel nur Spielleitung (Player nicht); Bestätigungsdialog, Shift = sofort | Plan 007 / shipped |
| Eigene Nachrichten rechts | Gespiegeltes Layout (`msg mine`), Avatar rechts | Plan 007 / shipped |
| Statische Avatare | Discord-GIFs → PNG beim Login und Backfill | Plan 007 / shipped |
| Nachrichten bearbeiten | Nur Autor, Textnachrichten; „(bearbeitet)“; kein Würfelbefehl nachträglich; SSE `chat.message.edited` | Plan 007 / shipped |
| Nachrichten kopieren | Zwischenablage + Toast; Würfel formatiert, Eröffnung = Thread-Titel | Plan 007 / shipped |
| Thread umbenennen | ⋯ in Kanalliste; Ersteller oder Spielleitung; Titel nur in `chat_threads.title` | Plan 007 / shipped |
| Kanal-Aufklapp merken | Cookie `chat-expanded` je Welt, vom Server gerendert (kein Flackern) | Plan 007 / shipped |
| Nachricht hervorheben | Ganze Zeile heller bei Hover/Fokus bzw. Antippen (Schnellaktionen) | Plan 007 / shipped |

## Rechte & Sichtbarkeit

| Feature | Was es tut | Status |
|---|---|---|
| Rechteschicht | Eine TypeScript-Schicht für HTTP, Loader (später MCP); keine Rechte nur in der UI | MVP / shipped |
| Sichtbarkeit | Artikel/Quest/Pin: `nur ich` / `nur Spielleitung` / `veröffentlicht` (Default neu: `nur ich`); Universum/Karte bleiben zweistufig; Vererbung Universum → Karte → Pin | MVP / Plan 004 T-005 / shipped |
| Archivierung | Austritt/Entfernen archiviert Mitgliedschaft, Teilnahmen, Marker, Relationen | MVP / shipped |

## Uploads & Realtime

| Feature | Was es tut | Status |
|---|---|---|
| Datei-Uploads | JPG/PNG/WebP; Limits Karte 20 MB, sonst 10 MB; Volume + Tabelle `files`; Auslieferung nur bei Weltmitgliedschaft bzw. Sichtbarkeit (CR-003) | MVP / shipped |
| SSE-Realtime | Chat und Karte über gemeinsamen Bus; Map-Events serverseitig nach Sichtbarkeit gefiltert (`layers` / APP-VIS-INHERIT); Rollenwechsel und Austritt/Entfernen schließen die Live-Leitung (`membership.changed`); Sync nach Speichern/Drop, nicht während Drag | MVP / shipped |

## Geplant (nicht shipped)

Siehe Pläne unter `.ai/feature-tasks/` und [backlog.md](backlog.md) — u. a. MCP (Plan `002`), Rest Plan `004` (T-011–T-013). Hier nicht als Produktfeatures führen, bis sie gebaut sind.
