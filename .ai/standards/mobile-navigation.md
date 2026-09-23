# Mobile-Navigation (Bottom Bar)

**Status:** Verbindliche Produktnorm für die App-Chrome (Projektinhaber 2026-09-22). Als Produkt-Shell gebaut in Plan 003 T-006.
**Bezug:** `.ai/standards/mobile-first.md`, Plan `.ai/feature-tasks/001-mvp-infrastruktur.md`.
**Vorbild (Vitura/Teinei):** `MobileNavigation` — `Teinei/src/components/app/mobile-navigation.tsx` (`fixed inset-x-0 bottom-0`, Safe-Area-Padding, `md:hidden`); Auswahl-Logik in `Teinei/src/lib/mobile-navigation.ts`; Einbindung über `Sidebar`, Layout-Padding `pb-24` und `h-dvh` in `Teinei/src/app/(app)/layout.tsx`.

## Regel

WorldCraft hat auf dem Handy eine **angeheftete Navigationsleiste am unteren Bildschirmrand** (pinned / `position: fixed` analog Vitura). Desktop folgt aus dem Mobil-Layout (siehe Mobile-First).

## Vier Einträge (verbindlich)

| # | Label     | Zweck |
|---|-----------|--------|
| 1 | **Kampagne** | Welt / Universum wählen |
| 2 | **Karte**     | Kontext: aktuelles Universum |
| 3 | **Chat**      | Kontext: aktuelle Welt |
| 4 | **Menü**      | Burger-Menü; weitere Funktionen später |

Reihenfolge und Labels sind festgelegt. Icons (festgelegt in Plan 003 T-006, Projektinhaber 2026-09-23, wie im UI-Prototyp): 🌍 Kampagne · 🗺️ Karte · 💬 Chat · ☰ Menü. Routen: Plan 003 *Informationsarchitektur*. Umsetzung: `src/components/shell/` (Bottom-Bar bis 767 px, ab 768 px dauerhafte Seitenleiste).

## Überschreiben nur durch Chat

Die Bottom-Bar bleibt sichtbar, außer wenn das **Chatfenster / der Composer** aktiv den unteren Bereich belegt. Dann wird die Navigation **überschrieben bzw. verdeckt** („Wird nur von Chatfenster überschrieben“). Andere Oberflächen (Karte, Menü, Weltwahl) verstecken die Bar nicht dauerhaft.

## Abgrenzung

- Kein Umbau der Spike-Seiten oder des laufenden Chat-Composers nur wegen dieser Norm.
- Umsetzung als App-Chrome später (MVP-Folge / Shell-Task); bis dahin reicht die Dokumentation.
