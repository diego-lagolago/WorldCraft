# Erwähnungen (`@`)

**Status:** Produktregel (Projektinhaber 2026-09-22). Vollständig verbindlich.
**Bezug:** Fachmodell 2.4 in `.ai/architecture/datenmodell-fachlich.md` (Stand heute: nur vorhandene Titel suchen). ADR-004.
**Dieses Dokument erweitert 2.4.** Das Fachmodell bleibt unverändert (eingefroren ohne Inhaber-Freigabe). `first_edited_at` / Stub-Flag: geplante Erweiterung, noch nicht im Fachmodell.

## Verbindlich: Anlegen, wenn nichts passt

`@` sucht weiter nach bestehenden Artikeln, Quests, Charakteren und Universen (2.4). Titel dürfen Leerzeichen enthalten.

Technik: TipTap-Suggestion mit `allowSpaces: true`. Bestätigen per **Enter**, **Tab** oder **Klick**, nicht per Leertaste.

Ablauf:

1. Tippen z. B. `@Tore von Wer` — kein Treffer.
2. Weiter tippen zu `@Tore von Wertheim`.
3. Bleibt es ohne Treffer, bietet die Liste **„Neuen Artikel anlegen“** mit genau diesem Namen an.

## Verbindlich: Query nur von `@` bis zur Einfügemarke

Die Suchanfrage ist **nur der Text zwischen `@` und der Caret-Position**. Nie „alles nach `@` im Absatz“.

Beispiel. Satz: `Die Gruppe muss sich zu den Toren von Wertheim begeben`. Die Nutzerin setzt `@` → `… zu den @Toren von Wertheim begeben`.

- Steht die Marke direkt hinter `@` oder mitten im gewünschten Titel, gehört `begeben` **nicht** zur Query. Der Rest des Satzes bleibt normaler Text.
- Steht die Marke am **Satzende** hinter `@`, wird die Query zu lang; das Popup zeigt diesen langen Titel. Zurücklöschen bis `Tore(n) von Wertheim`, dann Enter.

Kein automatisches Umwickeln schon vorhandener Wörter.

## Verbindlich: Stub-Artikel und Farbe (Entscheidung Projektinhaber 2026-09-22)

**A – Stub-Flag / `first_edited_at`.** Beim Anlegen über `@` entsteht **sofort** eine Artikel-Zeile. Die Erwähnung bleibt **rot**, bis der Artikel einmal wirklich bearbeitet wurde (`first_edited_at` oder gleichwertiges Stub-Flag). **Blau** = wurde editiert / hat echten Inhalt. **Rot** = noch keine lesbare Seite (einschließlich Stubs).

## Später (nicht MVP-jetzt)

**„Auswahl zur Erwähnung machen“** — markierten Text nachträglich zur Erwähnung machen. Nur Backlog, siehe `.ai/backlog.md`.
