# ADR-004: Artikel-Editor (TipTap)

**Status:** Festgeschrieben (Sonderfall Plan `001`: TipTap ist vom Projektinhaber vorgegeben). Gegenüberstellung und Gegenprüfung gemäß *Vorgehen bei Architekturentscheidungen*; die Wahl wird nicht neu getroffen.
**Datum:** 2026-09-22
**Betrifft:** Plan `.ai/feature-tasks/001-mvp-infrastruktur.md` (T-005), Abschnitt *Artikel-Editor (festgelegt)*
**Setzt voraus:** ADR-002 (Next.js / React), fachliches Datenmodell Abschnitt 2.3 und 2.4

## Kontext

Der Artikeltext (und gleichartig: Questbeschreibung, Pinbeschreibung, Charakter-Bio, Tagebuch, Universumsbeschreibung) ist Rich-Text **ohne Bilder im Text**. Erlaubt: Überschriften 2 und 3, fett, kursiv, unterstrichen, durchgestrichen, Aufzählung, nummerierte Liste, Zitat, Trennlinie, externer Link, Erwähnung (`@`). Nicht erlaubt: Bilder, Tabellen, eingebettete Medien; beim Einfügen aus der Zwischenablage werden sie verworfen, der übrige Text bleibt. Die Weltbeschreibung nutzt denselben Editor **ohne** Erwähnungen.

Speicherung: TipTap-JSON plus abgeleiteter Klartext für die Suche. Nur Open-Source-Erweiterungen, keine TipTap-Pro-Pakete.

Vitura (`Teinei`) nutzt bereits `@tiptap/react` 3.30 mit StarterKit, Link, Image, Placeholder. WorldCraft übernimmt das Muster, **ohne** Image-Extension (Titelbild liegt außerhalb des Textes).

## Kandidaten

Die Entscheidung TipTap steht. Die beiden Alternativen dienen der Gegenprüfung, ob ein Ausschlusskriterium greift (z. B. benötigte Funktion nur als kostenpflichtige Pro-Erweiterung).

### A – TipTap (festgelegt)

Headless-Editor auf ProseMirror. Offizielle React-Anbindung `@tiptap/react`. JSON-Dokumentmodell.

**Eignung für WorldCraft:** Schema lässt sich auf genau die erlaubten Nodes/Marks beschränken (StarterKit ohne Code/H1, plus Underline, Link, Mention). `@tiptap/extension-mention` ist MIT und deckt `@` mit eigener Suggestion-UI und Attributen (`id`, `label`, `art`) ab — kein Pro. `transformPastedHTML` / `handlePaste` verwerfen Bild und Tabelle. `getJSON()` / `setContent(json)` für Speichern und identisches Reload. Ohne Mention-Extension bleibt `@` normales Zeichen (Weltbeschreibung). Next.js: `'use client'`, `immediatelyRender: false` (offizielle SSR-Anleitung). Vitura-Toolbar und EditorProps sind übertragbar.

### B – Lexical (Meta)

Eigenes Editor-Framework, MIT, React-first. JSON-State, Nodes selbst definieren.

**Eignung für WorldCraft:** Schema ohne Image/Table-Nodes ist machbar, Paste über die Clipboard-Pakete. Mentions existieren als Pattern (Custom Decorator Nodes), nicht als fertige `@`-Suche mit Kategorie. Kein Nutzen aus Vitura. Höherer Eigenbau für Toolbar, Paste-Sanitize und Erwähnungssuche nach Modell 2.4. Lizenzlich unproblematisch, aber kein Grund, die Vorgabe TipTap zu kippen.

### C – BlockNote

Block-Editor auf TipTap/ProseMirror, Standard-UI im Notion-Stil. Kern MPL-2.0; `xl-*`-Pakete GPL/kommerziell.

**Eignung für WorldCraft:** Bilder und andere Blöcke sind Default und müssen aus dem Schema entfernt werden. Mentions als Inline-Content extra. Speicherung ist BlockNote-JSON, nicht TipTap-JSON — Folgeplan und MCP (`inhalt_lesen` → Markdown aus TipTap-JSON) müssten eine zweite Abbildung pflegen. Fertige UI widerspricht der knappen Werkzeugleiste (genau die erlaubten Formatierungen). Zusätzliche Schicht über TipTap ohne Gewinn für F2.

## Funktionsumfang (verbindlich)

| Erlaubt | Nicht erlaubt |
|---|---|
| `heading` Stufe 2 und 3 | `heading` 1, 4–6 |
| `bold`, `italic`, `underline`, `strike` | Code, Codeblock |
| `bulletList`, `orderedList` | Tabellen |
| `blockquote`, `horizontalRule` | Bilder, Video, iframe, eingebettete Medien |
| `link` (nur `http`/`https`) | Bilder im Text; Titelbild ist ein separates Feld |
| `mention` (`@`, konfigurierbar abschaltbar) | |

Zwischenablage: HTML wird vor dem Einfügen bereinigt (Bilder/Tabellen/Medien entfernt bzw. Tabelle durch sichtbaren Zelltext ersetzt). Reine Bild-Clipboard-Items werden verworfen.

## TipTap-Erweiterungen (nur OSS / MIT)

| Paket | Rolle |
|---|---|
| `@tiptap/pm` | ProseMirror |
| `@tiptap/react` | React-Anbindung (ADR-002 / Spike Vite) |
| `@tiptap/starter-kit` | Paragraph, Bold, Italic, Strike, Listen, Quote, Trennlinie, Heading — konfiguriert: `heading.levels: [2, 3]`, `code: false`, `codeBlock: false` |
| Underline (in StarterKit v3 enthalten) | Unterstrichen — kein separates Paket, sonst doppelt registriert (CR-022) |
| Link (in StarterKit v3 enthalten) | Externer Link, über `StarterKit.configure({ link: { openOnClick: false, protocols: ["http","https"], isAllowedUri } })`; nur http/https (CR-022) |
| `@tiptap/extension-mention` | Erwähnung |
| `@tiptap/suggestion` | Peer von Mention, Vorschlagsliste |
| `@tiptap/extension-placeholder` | optional, Platzhaltertext |

Nicht verwendet: Collaboration, Comments, UniqueID, AI, Snapshot und alle `@tiptap-pro/*` bzw. Cloud-Dienste.

Anbindung Next.js (Produkt, T-007+): Client Component wie Vitura `src/components/ui/rich-text-editor.tsx`, `immediatelyRender: false`. Spike T-005: eigenständige Vite-App unter `spikes/editor/` mit derselben Extension-Liste.

## Speicherformat

- **Kanonisch:** TipTap-JSON (`editor.getJSON()`), Dokumentknoten `doc` mit `content`.
- **Erwähnung im JSON:** Node `mention` mit `attrs.id` (Inhalts-ID), `attrs.kind` (`article` \| `quest` \| `character` \| `universe`, Teilmenge von `CONTENT_KINDS`; Pins sind nicht erwähnbar), `attrs.label` (Titel zum Zeitpunkt des Einfügens; Anzeige später gemäß Modell 2.4 der aktuelle Titel). Geändert 2026-09-23 von `art` mit deutschen Werten auf `kind` (CR-022, Plan 003 T-005); der Spike nutzt noch `art`.
- **Klartext:** serverseitiger Walker `plainTextOf` in `src/lib/editor/rich-text.ts` (Erwähnungen mit Titel, ohne `@`), für Volltextsuche.
- **Extraktion:** Funktion `extractMentions(json)` → `{ kind, id }[]` in Dokumentreihenfolge, Grundlage für automatische Relationen.
- **Serverseitig:** Jedes Speichern läuft durch `sanitizeRichDoc` (nur erlaubte Nodes/Marks, Links nur http/https, Modus ohne Erwähnungen lehnt Erwähnungen ab).

## Lizenzhinweise

| Software | Lizenz | Quelle (Abruf 2026-09-22) |
|---|---|---|
| TipTap Core und genannte Extensions | MIT | https://github.com/ueberdosis/tiptap · https://www.npmjs.com/package/@tiptap/extension-mention |
| Lexical | MIT | https://github.com/facebook/lexical |
| BlockNote (Kern) | MPL-2.0; XL-Pakete GPL-3.0 / kommerziell | https://github.com/TypeCellOS/BlockNote |
| ProseMirror | MIT | über `@tiptap/pm` |

Kein Ausschlusskriterium: Mention, Link, Underline und Paste-Hooks sind OSS. Pro wäre nur nötig für Kollaboration/AI, die WorldCraft nicht braucht.

## Bewertung (informativ; Wahl steht)

Kriterien Gewicht 1, Bezug WorldCraft.

| # | Kriterium | A TipTap | B Lexical | C BlockNote |
|---|---|:-:|:-:|:-:|
| 1 | Exaktes Format-Subset ohne Bild/Tabelle | 5 | 4 | 3 |
| 2 | Erwähnungen nach Modell 2.4 | 5 | 3 | 3 |
| 3 | Paste verwirft Bild/Tabelle | 5 | 4 | 4 |
| 4 | JSON speichern/laden identisch | 5 | 4 | 3 |
| 5 | Betrieb ohne Erwähnungen | 5 | 4 | 3 |
| 6 | Next.js / React (ADR-002) | 5 | 5 | 5 |
| 7 | Nur OSS, kein Pflicht-Pro | 5 | 5 | 4 |
| 8 | Vitura-Transfer | 5 | 1 | 2 |
| | **Summe** | **40** | **30** | **27** |

TipTap führt klar. Kein Ausschlusskriterium gegen TipTap. Die Vorgabe bleibt.

## Entscheidung

**TipTap** mit der Extension-Liste oben, Speicherformat JSON + Klartext, Mention abschaltbar. Spike: `spikes/editor/`.

## Gegenprüfung

### (a) Stärkste Argumente gegen TipTap

1. **Pro-Ökosystem:** Dokumentation vermischt OSS und Cloud/Pro. Risiko, später eine Pro-Extension zu ziehen — durch die geschlossene Paketliste in diesem ADR gebunden.
2. **JSON ist ProseMirror-spezifisch:** MCP Plan `002` wandelt nach Markdown; das ist eine eigene Schicht, Lexical hätte dasselbe Problem anders.
3. **Paste aus Word** ist notorisch unordentlich; Sanitize muss in Tests/Spike bewiesen werden, nicht nur konfiguriert.

### (b) Stärkstes Argument für die zweitbeste Option (Lexical)

Vollständig MIT ohne Vendor-Cloud, React-first, kein Pro-Upsell. Für ein Grünfeld ohne Vitura wäre Lexical eine seriöse Alternative.

Warum trotzdem TipTap: Vorgabe des Inhabers, Vitura, fertige OSS-Mention, JSON das der Folgeplan erwartet, Summe höher, kein Ausschlusskriterium.

### (c) Belegte Tatsachenbehauptungen

Abrufdatum: 2026-09-22.

| Behauptung | Quelle |
|---|---|
| TipTap React, Vite-Beispiel, `immediatelyRender: false` für SSR | https://tiptap.dev/docs/editor/getting-started/install/react |
| Mention-Extension OSS, `npm i @tiptap/extension-mention` + `@tiptap/suggestion` | https://tiptap.dev/docs/editor/extensions/nodes/mention |
| `@tiptap/extension-mention` License MIT | https://www.npmjs.com/package/@tiptap/extension-mention |
| BlockNote Kern MPL-2.0, XL GPL/kommerziell | https://github.com/TypeCellOS/BlockNote |
| BlockNote kann Image-Blöcke aus dem Schema nehmen | https://www.blocknotejs.org/examples/basic/removing-default-blocks |
| Vitura: `@tiptap/react` ^3.30.2, StarterKit, Link, Image | `Teinei/package.json`, `Teinei/src/components/ui/rich-text-editor.tsx` |

### (d) Vereinbarkeit

- ADR-002 Next.js: `@tiptap/react` + Client Component.
- ADR-001/003: kein Konflikt (Editor ist Text, nicht Karte).
- Fachmodell 2.3/2.4: Rich-Text inkl. Erwähnungen; Weltbeschreibung ohne Erwähnungen.
- Plan: keine Pro-Extensions.

Kein Ausschlusskriterium. Vorgabe TipTap bleibt.

## Konsequenzen

- Spike und spätere App teilen Extension-Set und `extractMentions` / `sanitizePastedHtml` / `searchMentions`.
- Titelbild bleibt außerhalb des Editors (Upload-Feld, nicht T-005-Spike).
- Relationen aus Erwähnungen entstehen in T-006/MVP-Plan aus `extractMentions`, nicht im Spike.
- Vitura: Toolbar- und `editorProps`-Muster spicken, Image-Upload-Pfad nicht übernehmen.
