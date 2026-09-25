# Backlog

Kurze, undatierte Restpunkte. Kein Ersatz für Pläne unter `.ai/feature-tasks/`.

## 2026-09-25 – MCP: Schreiben (Folgeplan zu `002`)

**→ Übernommen in Plan [`011`](feature-tasks/011-mcp-schreibend.md) (2026-09-25).**

**Quelle:** Projektinhaber beim Klären von Plan `002` (D1, D6, D15).

Eigener Plan, sobald das Lesen über MCP auf Produktion wie erwartet läuft. Grundlagen legt ADR-005 (Plan `002` T-001 Punkt 7) fest: Scope `worlds:write`, Schreibrechte genau wie in der App (Players etwa nur Notizblock und eigener Charakter), neue Inhalte starten mit `nur ich`, **kein Löschen**, Audit-Log mit Herkunft „MCP“, Umwandlung Markdown → TipTap-JSON inkl. Erwähnungen.

**Bilder hochladen:** Kein Base64 im Werkzeugaufruf. Das Modell kann die Bytes eines Bildes aus dem Chat nicht selbst ausgeben, und die Größe übersteigt jede Ausgabegrenze. Stattdessen ein **einmaliger Upload-Link**: Ein Werkzeug erzeugt für Benutzer, Welt und Ziel (z. B. Titelbild von Artikel X) ein kurzlebiges Upload-Ticket (10–15 Minuten, einmal nutzbar, nur als Hash gespeichert). Der Endpunkt bedient zwei Arten von Aufrufern (Plan `002` D17): Menschen im Browser (`GET` zeigt eine Upload-Seite) und Programme/Agents (`POST` mit `multipart/form-data` ohne Cookie, Antwort JSON). Ob ein Agent selbstständig hochlädt, hängt dann nur von ihm ab: Claude Code etwa per `curl -F`; claude.ai nur, wenn Code-Ausführung aktiv ist und ihr Netzwerkzugang die WorldCraft-Domain erlaubt; sonst gibt der Agent dem Benutzer den Link. Prüfung und Speicherung wie beim heutigen Upload (JPG/PNG/WebP, 10/20 MB, Tabelle `files`, Rechte über die Rechteschicht). Optional prüfen: die clientspezifische Dateiübergabe von ChatGPT (Datei als Download-Link an das Werkzeug), dann serverseitiger Abruf nur von freigegebenen Hosts, mit Größenlimit und Typprüfung (Schutz gegen SSRF).

## 2026-09-25 – Pills/Badges projektweit standardisieren

**Quelle:** Projektinhaber im Plan-Review des Code-Reviews zu Plan `009` (CR-005, `.ai/code-review-009-vorlagenfelder-und-rasse-2026-09-24.md`).

Pills/Badges werden heute an vielen Stellen direkt als `<span className="badge …">` mit eigener Logik gebaut: Seltenheit (`MonsterRarityPill`, dazu die `item`-/Gültigkeitsprüfung doppelt in `ArticleFields.tsx` und `ArticleList.tsx`), Quest- und Kapitelstatus (`QuestList.tsx`, `QuestChapters.tsx`, Quest-Seite), Sichtbarkeit (`VisibilityBadge` in `src/components/world/display.tsx`), Vorlagentyp (Artikelseite), Einladungsstatus, „gesperrt“ auf der Karte, Thread-Zähler im Chat. Ziel: gemeinsame Pill-Komponente(n) plus reine Helfer, die aus Typ und Wert entscheiden, ob und welche Pill erscheint (z. B. `itemRarityOf(templateType, value): MonsterRarity | null`), damit die Entscheidungslogik unit-testbar ist und nicht je Komponente wiederholt wird. Offen für den Plan: eine generische `Pill`-Komponente vs. je Fachbereich eine, Benennung der CSS-Klassen (`.badge.*` in `src/app/globals.css`), Abgleich mit dem UI-Prototyp.

## 2026-09-24 – Kategorien in Tagebüchern

**Quelle:** Projektinhaber.

Tagebucheinträge (`/w/[worldId]/journal/[characterId]`) sollen Kategorien bekommen. **Detailplanung folgt** durch den Projektinhaber — vorher nichts umsetzen. Offen u. a.: feste oder frei definierbare Kategorien, eine oder mehrere pro Eintrag, Filter in der Tagebuchansicht.

## 2026-09-24 – Chat: Threads archivieren

**Quelle:** Projektinhaber.

Threads sollen sich archivieren lassen, analog zur bestehenden Kanalarchivierung (Plan `003` T-012). `chat_threads` hat heute **kein** `archived_at` (nur Kanäle haben es; ein Thread ist nur über einen archivierten Kanal gesperrt, `resolveScope` in `src/lib/chat/repository.ts`). Braucht also eine Migration. Offen für den Plan: wer darf archivieren (Spielleitung, Thread-Ersteller?), Wiederherstellen, Anzeige archivierter Threads unter dem Kanal.

## 2026-09-24 – Monster-Marker-Sheet vertiefen

**Quelle:** Projektinhaber beim lokalen Smoketest von Plan `006`.

Das bestehende Monster-Marker-Sheet genügt vorerst mit Name, Seltenheit und Link „Zum Monster“. Später prüfen, welche zusätzlichen Details aus dem Monsterblatt direkt auf der Karte wirklich hilfreich sind, ohne das Sheet zu überladen. Erst als eigene UX-Entscheidung bzw. Plan bearbeiten.

## 2026-09-24 – Versteckte Verweise kryptisch darstellen

**Quelle:** Projektinhaber im Plan-Review des Code-Reviews zu Plan `005` (CR-012, `.ai/code-review-005-monster-bestiarium-2026-09-24.md`).

Verweise auf Inhalte, die der Betrachter nicht sehen darf (unsichtbar oder unbekannt), sollen nicht einfach verschwinden, sondern in einer **kryptischen Schrift / Platzhalter-Glyphen** erscheinen – verschleiert, aber mit dem Gefühl „da ist etwas“. Betrifft einheitlich: `@`-Erwähnungen im Lesemodus (heute Zustand `plain` = gespeichertes Label als Klartext, `RichTextView.tsx`), Lebensraum am Monster (heute „–“), Artikel-Vorlagenfelder mit Verweisen, ggf. „Verknüpft“.

Offen für den eigenen Plan: Der echte Name darf den Client nicht erreichen (Server ersetzt Label/Titel durch Platzhalter; Länge fix oder echt?), Umgang mit dem in `body_json`/`bio_json` gespeicherten Label, Schrift/Glyphen im Prototyp festlegen, Verhältnis zu Stub-Erwähnungen. Erst Prototyp, dann Plan.

## 2026-09-24 – Fähigkeiten mit Angriffs-/Wirkungsart taggen

**Quelle:** Projektinhaber beim Prototyp-Review Plan `006` (2026-09-24).

Fähigkeiten (Charakterblatt und Monsterblatt) sollen **getagged** werden nach Art der Wirkung. Erste grobe Kategorien (Beispiel):

- physischer Schaden
- Magie-Schaden
- Debuff
- Buff
- Heilung

Später feinere Unterscheidungen denkbar (scharfer Schaden, stumpfer Schaden / blunt, Pfeile, Speere, …). **Granularität** und genaue Tag-Liste werden im Backlog bzw. einem eigenen Plan geklärt — nicht im laufenden Plan `006`. Gilt für Charaktere und Monster gleichermaßen (gemeinsames Blatt).

## 2026-09-23 – Owner verlässt die Welt

**Quelle:** Projektinhaber beim Anlegen von Plan `004` (dreistufige Sichtbarkeit Owner / Spielleitung / veröffentlicht).

Offen: Was passiert mit Datensätzen (Artikel, Quests, Kapitel, Pins), deren Owner aus der Welt austritt oder entfernt wird — besonders mit Sichtbarkeit `nur ich`, die danach niemand mehr sieht. Denkbar: Owner geht auf den Game Master über, Datensätze werden auf `nur Spielleitung` gehoben, oder sie bleiben unsichtbar bis zur Reaktivierung. Ebenso offen: Owner übertragen. Plan `004` ändert beim Austritt nichts (Mitgliedschaft wird wie bisher nur archiviert).

## 2026-09-22 – Karten-Zoom (T-009 Spike `/spike/karte`)

**Quelle:** Projektinhaber nach Abnahme Pin setzen/bearbeiten (UX bleibt).

Zoom ist weiter **gestuft**, nicht stärker als zuvor. Gewünscht:

- weiches Zoomen per Scroll/Pinch (`zoomSnap: 0` / gebrochene Zoomstufen), **oder**
- deutlich größere Schritte (aktuell ca. **10 Scrolls** für wenig Zoom).

Phone-first. Nicht weiter im laufenden Plan 001 nachschärfen.

## 2026-09-22 – Erwähnungen: Artikel anlegen aus `@`

**Quelle:** Projektinhaber. **Norm:** `.ai/standards/erwaehnungen.md` (erweitert Modell 2.4, Fachmodell unangetastet).

Verbindlich dort: Query nur `@`→Caret; `allowSpaces`; Anlegen, wenn kein Treffer. **Entscheidung Projektinhaber 2026-09-22: Variante A** — Zeile sofort, Erwähnung rot bis zur ersten Bearbeitung (`first_edited_at` / Stub-Flag); blau = hat Inhalt. Siehe `.ai/standards/erwaehnungen.md`.

Später, nicht MVP-jetzt: **„Auswahl zur Erwähnung machen“** (markierten Text nachträglich zur Erwähnung machen).

## 2026-09-23 – Erwähnungen in der Charakter-Bio

**Quelle:** Projektinhaber während Plan 003 T-008. Im MVP ist die Bio ohne Erwähnungen (`APP-BIO-NO-MENTIONS`), weil ein Charakter keiner Welt gehört und `@` eine Welt zum Suchen braucht. Später klären: Suche im Weltkontext der Seite oder Weltauswahl im Editor, Relationen nur in Welten mit aktiver Teilnahme; dann Fachmodell 3.8, `datenmodell.md` (`APP-REL-RECALC`) und „Verknüpft“ am Charakter anpassen.

## 2026-09-22 – Chat: Channel-Verwaltung & Thread-UX

**Erledigt in Plan `003` T-012** (2026-09-23). Kanalverwaltung und eingerückte Threads mit Chevron liegen in der Produktroute `/w/[worldId]/chat`.

Ursprünglich: Projektinhaber während T-010. Infrastruktur (Tabellen, Default-Kanal, Thread anlegen) lag im Spike `/spike/chat`. Fachmodell bleibt welt-scoped; die Abweichung steht in `datenmodell.md` Abschnitt 13 B, nicht in `datenmodell-fachlich.md`.

Umgesetzt wird dort:

- **Kanalverwaltung:** anlegen, umbenennen, Reihenfolge, archivieren, wiederherstellen (Spielleitung).
- **Thread-UX:** eingerückt unter dem Kanal, Chevron zum Auf- und Zuklappen.

## 2026-09-22 – Mobile Bottom-Navigation (App-Chrome)

**Quelle:** Projektinhaber. **Norm:** `.ai/standards/mobile-navigation.md` (Bezug Mobile-First).

Angepinnte Leiste unten: Kampagne, Karte, Chat, Menü. Wird nur vom Chatfenster überschrieben. Vorbild Vitura `MobileNavigation`. Shell später bauen — nicht im laufenden Spike nachziehen.

## Bereits im Plan 001 genannt (Abgrenzung)

KI-Chat in der App, eigene Vorlagen, Kampfwerte/Statblocks, Zeitleisten, Kalender, Stammbäume, Themes, private Chat-Nachrichten, öffentliche Weltansicht, Bilder im Artikeltext, Backup & Wiederherstellung (ehemals T-012).
