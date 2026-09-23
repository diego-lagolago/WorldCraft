# Backlog

Kurze, undatierte Restpunkte. Kein Ersatz für Pläne unter `.ai/feature-tasks/`.

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
