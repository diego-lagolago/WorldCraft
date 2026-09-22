# Backlog

Kurze, undatierte Restpunkte. Kein Ersatz für Pläne unter `.ai/feature-tasks/`.

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

## 2026-09-22 – Chat: Channel-Verwaltung & Thread-UX

**Quelle:** Projektinhaber während T-010. Infrastruktur (Tabellen, Default-Kanal, Thread anlegen) liegt im Spike `/spike/chat`. Fachmodell bleibt welt-scoped; Erweiterung steht in `src/spike/chat/README.md`, nicht in `datenmodell-fachlich.md`.

Noch offen:

- **Channel-Verwaltung** analog Discord: Kanäle anlegen, umbenennen, Reihenfolge.
- **Thread-UX** über den `+`-Button hinaus (Liste, Sprung aus Nachricht, Schließen, …).

## 2026-09-22 – Mobile Bottom-Navigation (App-Chrome)

**Quelle:** Projektinhaber. **Norm:** `.ai/standards/mobile-navigation.md` (Bezug Mobile-First).

Angepinnte Leiste unten: Weltkugel, Karte, Chat, Menü. Wird nur vom Chatfenster überschrieben. Vorbild Vitura `MobileNavigation`. Shell später bauen — nicht im laufenden Spike nachziehen.

## Bereits im Plan 001 genannt (Abgrenzung)

KI-Chat in der App, eigene Vorlagen, Kampfwerte/Statblocks, Zeitleisten, Kalender, Stammbäume, Themes, private Chat-Nachrichten, öffentliche Weltansicht, Bilder im Artikeltext, Backup & Wiederherstellung (ehemals T-012).
