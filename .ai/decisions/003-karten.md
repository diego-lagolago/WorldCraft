# ADR-003: Karten-/Whiteboard-Bibliothek

**Status:** Freigegeben durch den Projektinhaber am 2026-09-22 (Option A – Leaflet `CRS.Simple`). Zusätzlich: primäre Nutzung am **Handy** (nicht nur Tablet).
**Datum:** 2026-09-22
**Betrifft:** Plan `.ai/feature-tasks/001-mvp-infrastruktur.md` (T-004, T-009)
**Setzt voraus:** ADR-001 (TypeScript-Backend, SSE nach Drop), ADR-002 (Next.js / React)

## Kontext

F4/F5: Ein hochgeladenes Kartenbild (im Spike 8000 × 6000 px) ist der zoom- und verschiebbare Hintergrund. Darauf liegen 12 Pin-Typen mit eigenen Icons plus Charakter-Marker (Profilbild und Name). Positionen sind relativ zum Bild, unabhängig von der Zoomstufe. Klick auf einen Pin öffnet ein Popup mit Link; die Karten-URL mit Pin-ID zentriert und hebt den Pin hervor. Touch (Handy und Tablet) muss funktionieren. Primäre Nutzung ist das **Handy** (Projektinhaber 2026-09-22). Nach dem Drop (nicht während des Ziehens) erscheint die neue Position in anderen offenen Browsern innerhalb von 1 Sekunde.

Betrieb selbst gehostet über Coolify, private D&D-Gruppe, keine kostenpflichtigen Pro-SDKs als Pflicht.

Bewertung gemäß *Vorgehen bei Architekturentscheidungen* in Plan `001`. Alle Kriterien Gewicht 1.

## Kandidaten

### A – Leaflet mit `CRS.Simple`

Open-Source-Kartenbibliothek. `CRS.Simple` ist das offizielle Muster für **nicht-geographische** Karten (Spielkarten, gescannte Bilder): Bild als `L.imageOverlay`, Marker in Bildkoordinaten, `minZoom` unter 0.

**Eignung für WorldCraft:** Genau der MVP-Fall „großes Bild + Pins“. `L.icon` / `L.divIcon` für 12 Pin-Typen und Charakter-Marker (HTML: Bild + Name). `bindPopup` für Titel/Link. `draggable: true` plus Event `dragend` trifft die Nach-Drop-Regel: erst dann Position speichern und per SSE senden; in Browser B `marker.setLatLng(...)`. Pinch-Zoom und Touch-Drag sind Map-Optionen (`touchZoom` / `pinchZoom`, `dragging`). Koordinaten: Overlay-Bounds = Bildpixel, gespeichert als `{ x, y }` relativ zum Bild; Zoom ändert die Marker-LatLng nicht. Next.js: Client Component, Leaflet per `useEffect` oder `react-leaflet`. BSD-2-Clause, kein License-Key. Kein Vitura-Code (Vitura hat keine Karte).

### B – Konva (`react-konva`)

2D-Canvas mit Bild, Shapes und Drag. Offizielle React-Anbindung.

**Eignung für WorldCraft:** Pins als `Image`/`Group`, `draggable`, `onDragEnd` für Nach-Drop. Position ist natürlich `x/y` auf dem Bild-Node. Charakter-Marker als Gruppe aus Bild+Text. Zoom/Pan über Stage-`scale`/`position` muss selbst gebaut werden, inkl. Pinch. Popups sind HTML über der Canvas, nicht eingebaut. 8000 × 6000 als eine `Konva.Image` ist für Canvas schwer (bekannte Performance-Grenze; Maintainer rät zu Kacheln oder `cache({ pixelRatio })` beim Rauszoomen). MIT, `react-konva` zu ADR-002. Mehr Eigenbau als Leaflet für eine Funktion, die Leaflet schon als „game map“ dokumentiert.

### C – tldraw

Fertiges React-Whiteboard (Zoom, Pan, Touch, Shapes, optional Multiplayer via `@tldraw/sync`).

**Eignung für WorldCraft:** Bedienung und Touch sind stark. Pins wären Custom Shapes auf einer Infinite Canvas; das Kartenbild eine Shape im Hintergrund. Position relativ zum Bild muss gegen tldraw-Page-Koordinaten abgebildet werden. Live-Sync von tldraw ist ein CRDT der ganzen Fläche, nicht ein einzelnes Drop-Event — das widerspricht ADR-002 (SSE nach Drop) und würde entweder zu viel synchronisieren oder gegen das Produkt arbeiten. **Lizenz:** Default nur Development. Produktion braucht License-Key (Trial, Commercial oder discretionary Hobby). Hobby: Wasserzeichen „made with tldraw“, Ausstellung ungewiss. Staging mit echten Nutzern zählt laut tldraw-Lizenz als Production Environment. Für selbst gehostetes WorldCraft ohne Vendor-Key ungeeignet, unabhängig von der technischen Qualität.

## Lizenzprüfung

| Kandidat | Lizenz | Produktiv, selbst gehostet | Quelle |
|---|---|---|---|
| A Leaflet | BSD-2-Clause | Ja, ohne Key, Copyright-Hinweis behalten | https://github.com/Leaflet/Leaflet/blob/master/LICENSE |
| B Konva / react-konva | MIT | Ja, ohne Key | https://github.com/konvajs/konva/blob/master/LICENSE |
| C tldraw SDK | tldraw License (source available, nicht permissiv) | Nur mit Trial-/Commercial-/Hobby-Key; Default-Lizenz verbietet Production; Hobby mit Wasserzeichen, discretionary | https://tldraw.dev/community/license · https://github.com/tldraw/tldraw/blob/main/LICENSE.md |

## Bewertung

| # | Kriterium | A Leaflet | B Konva | C tldraw |
|---|---|:-:|:-:|:-:|
| 1 | Zoom/Pan bei 8000 × 6000 px | 4 | 3 | 5 |
| 2 | Ziehbare Pins, 12 eigene Icons | 5 | 5 | 3 |
| 3 | Klick → Popup mit Link | 5 | 3 | 3 |
| 4 | Touch (Tablet) | 5 | 3 | 5 |
| 5 | Position relativ zum Bild, zoomunabhängig | 5 | 5 | 3 |
| 6 | Lizenz (selbst gehosteter Produktivbetrieb) | 5 | 5 | 1 |
| 7 | Live-Sync nach Drop (SSE) | 5 | 5 | 2 |
| 8 | Verfügbarkeit für Next.js / React (ADR-002) | 5 | 5 | 5 |
| | **Summe** | **39** | **34** | **27** |

### Begründungen

**1 Zoom/Pan 8000 × 6000**
- A 4: Offizielles ImageOverlay + `CRS.Simple` + `minZoom < 0`. Das Bild bleibt ein DOM-Image (CSS-Transform), nicht eine Canvas-Textur. 48 Megapixel muss der Browser trotzdem dekodieren; bei Ruckeln im Spike ggf. eine verkleinerte Anzeigevariante oder Kacheln nachlegen.
- B 3: Eine volle `Konva.Image` in dieser Größe ist ein bekanntes Canvas-Problem; Workaround Kacheln/`cache` ist Extraaufwand vor dem Spike.
- C 5: Infinite-Canvas-Zoom/Pan ist Kernfunktion.

**2 Pins und 12 Icons**
- A 5: `L.icon({ iconUrl, iconSize, iconAnchor })` pro Pin-Typ; Marker `draggable`.
- B 5: 12 Images oder Sprite, `draggable: true`.
- C 3: Custom Shapes und Tools, gegen die Whiteboard-UI; Standard-Shapes sind keine Map-Pins.

**3 Popup mit Link**
- A 5: `bindPopup` / `openPopup`; Deep-Link `map.setView` + `openPopup` für T-009 Kriterium (6).
- B 3: HTML-Overlay selbst positionieren (Stage-Koordinaten → CSS).
- C 3: eigene UI über dem Editor, nicht pin-first.

**4 Touch**
- A 5: `touchZoom`/`pinchZoom` und Marker-Drag sind in der API; Touch-Fixes seit Leaflet 1.7.
- B 3: Pointer-Events ja, Pinch-to-Zoom und Konflikt „Karte schieben vs. Pin ziehen“ selbst lösen.
- C 5: Tablet ist erstklassig.

**5 Bildrelative Koordinaten**
- A 5: Bounds = Bildgröße in Pixeln; gespeichert `{ x, y }`; `setLatLng` unabhängig vom Zoom. Achtung: Leaflet-Paare sind `[y, x]` (northing, easting) — Wrapper wie im Tutorial.
- B 5: `x/y` auf dem Bild-Node, Zoom ist Stage-Scale.
- C 3: Page-Koordinaten der Infinite Canvas; Bild ist eine Shape, die verschiebbar sein kann, wenn man sie nicht hart als Hintergrund sperrt.

**6 Lizenz**
- A 5: BSD-2-Clause, Coolify-Produktion ohne Drittanbieter.
- B 5: MIT, ebenso.
- C 1: Production ohne Key verboten; Hobby unsicher und mit Wasserzeichen; Commercial ist Kosten/Vendor. Unvereinbar mit „nur Open-Source-Erweiterungen“-Geist des Plans (T-005 analog) und mit Staging als echte Nutzerumgebung.

**7 Live-Sync nach Drop**
- A 5: Speichern in `dragend`, SSE, in anderen Clients `setLatLng`. Kein `drag`-Stream. Charakter-Marker analog.
- B 5: `onDragEnd` → dieselben Events.
- C 2: `@tldraw/sync` synchronisiert die Fläche; Einzel-Pin-Drop über eigene SSE würde gegen Store/Undo von tldraw laufen.

**8 Next.js / React**
- A 5: Client Component; Leaflet in `useEffect` (SSR-sicher) oder `react-leaflet`.
- B 5: `react-konva`, Client-only wie Vitura-TipTap.
- C 5: React 18/19, Client-only.

## Entscheidung

**Gewählt: A – Leaflet mit `CRS.Simple`.**

Höchste Summe (39). Die Bibliothek ist für Spielkarten-Bilder dokumentiert, liefert Pins, Popups, Touch und `dragend` ohne License-Key und passt zu Nach-Drop-SSE. Konva ist die bessere Zeichenfläche, aber die schlechtere Karte (Canvas-Größe, Pinch, Popup). tldraw ist lizenzrechtlich für selbst gehostete Produktion ohne Key nicht tragbar und über-synchronisiert.

**Freigabe:** Der Projektinhaber hat Option A am 2026-09-22 bestätigt, unter der Vorgabe primärer Nutzung am Handy. Leaflet bleibt die mobilfreundlichste der drei Optionen (Pinch-Zoom, Pan, Marker, Popups).

Anbindung in T-009: Next.js Client Component, Leaflet direkt (nicht zwingend `react-leaflet`, dessen aktuelle Install-Doku React-Release-Candidates nennt). Koordinaten immer als relative Anteile `{ x, y }` gemäß fachlichem Modell 2.7 speichern, Leaflet-`LatLng` nur in der View.

## Gegenprüfung

### (a) Stärkste Argumente gegen A

1. **Ein 8000 × 6000-JPEG als einzelnes Overlay** kann Decode/RAM belasten. Leaflet löst das nicht magisch; T-009 muss flüssiges Zoom/Pan belegen, sonst Kacheln oder eine Anzeige-Maximalbreite.
2. **`[y, x]` vs. `{ x, y }`:** leicht falsch herum gespeichert; Tests und ein Wrapper sind Pflicht.
3. **react-leaflet vs. Vanilla:** Binding-Versionen zu React 19 können nachhinken; Vanilla in `useEffect` ist weniger „React-idiomatisch“, aber robuster.

### (b) Stärkstes Argument für die zweitbeste Option (B Konva)

Volle Kontrolle über Zeichenreihenfolge, Character-Marker als Canvas-Gruppe, MIT, `onDragEnd` analog, keine LatLng-Semantik. Wenn Leaflet bei 8000 × 6000 im Spike ruckelt, ist Konva mit gekacheltem Bild der natürliche Plan-B (dann T-009/T-014 und dieses ADR laut T-002/T-013-Stopp bei No-Go).

Warum trotzdem A: Pinch-Zoom, Popup und Deep-Link sind in Leaflet fertig; die offizielle Doku ist der WorldCraft-Fall; Canvas-Vollbild ist das größere Performance-Risiko, nicht das kleinere.

### (c) Belegte Tatsachenbehauptungen

Abrufdatum: 2026-09-22.

| Behauptung | Quelle |
|---|---|
| Leaflet `CRS.Simple` + `imageOverlay` für Spielkarten, `minZoom` negativ, Koordinaten `[y, x]` | https://leafletjs.com/examples/crs-simple/crs-simple.html |
| `L.imageOverlay(url, bounds)` | https://leafletjs.com/examples/overlays/ |
| Marker `draggable`, Events `drag` / `dragend`; Map `touchZoom` / Pinch | https://leafletjs.com/reference.html |
| `bindPopup` / `openPopup` | https://leafletjs.com/examples/quick-start/ |
| Leaflet BSD-2-Clause | https://github.com/Leaflet/Leaflet/blob/master/LICENSE |
| Konva MIT; Einsatz u. a. Maps; `react-konva` | https://github.com/konvajs/konva/blob/master/LICENSE · https://konvajs.org/docs/ |
| Konva: sehr große Bilder (Beispiel 15000×10000) brauchen Kacheln oder Downscale-Cache | https://stackoverflow.com/questions/71936224/performance-issue-when-dragging-zooming-high-resolution-image-in-konvajs-canvas (Antwort des Maintainers lavrton) |
| tldraw: Produktion nur mit License-Key; Default nur Development; Hobby mit Wasserzeichen | https://tldraw.dev/community/license |
| tldraw LICENSE: Production Environment = Deployment mit Endnutzern, Staging intern nur wenn nicht endnutzerzugänglich | https://github.com/tldraw/tldraw/blob/main/LICENSE.md |
| tldraw SDK braucht React 18 oder 19 | https://tldraw.dev/installation |
| react-leaflet setzt Leaflet voraus, ist Binding nicht Ersatz | https://react-leaflet.js.org/docs/start-installation/ |

### (d) Vereinbarkeit mit bereits getroffenen Entscheidungen

- **ADR-001:** Nach-Drop-Events, kein Drag-Stream. Leaflet `dragend` ist der passende Hook.
- **ADR-002:** Next.js Client Component. Leaflet hat kein SSR; Init nur im Browser.
- **F5 / T-009 (2026-09-22):** Sync nach Drop, nicht während Drag — A und B beide fähig; C unpassend.
- Kein Widerspruch zum fachlichen Datenmodell (Pin-Position relativ zur Karte).

Die Empfehlung bleibt A. Lizenz und Passung zu F4/F5 schließen C aus; B bleibt Fallback, falls T-009 am großen Bild scheitert.

## Konsequenzen

- **T-009** baut `/spike/karte` mit Leaflet `CRS.Simple`, ImageOverlay, 12 `L.icon`, einem `L.divIcon` für den Charakter-Marker, `dragend` → API → SSE → `setLatLng`. Prüfung auch auf dem Handy (Touch-Ziele, Pinch, Speicher für große Bilder). Mobile-First ist verbindliche Produktnorm (`.ai/standards/mobile-first.md`): UI zuerst für ~390 px / einhändig; Desktop folgt daraus.
- **Speicherformat:** `{ x, y }` als Dezimalzahlen 0–1 relativ zu Breite/Höhe des Kartenbilds (fachliches Modell 2.7, mindestens 6 Nachkommastellen). Leaflet-LatLng nur UI.
- **Deep-Link:** Query-Parameter Pin-ID → `fit`/`setView` + Popup/Highlight.
- **Nicht gewählt:** Konva (mehr Eigenbau, Canvas-Risiko auf dem Handy); tldraw (Production-License-Key, Wasserzeichen/Kosten, falsches Sync-Modell).
- **No-Go-Pfad:** Ruckelt 8000 × 6000 in T-009/T-014 unzumutbar (besonders mobil), dieses ADR überarbeiten und Konva (gekachelt) oder eine verkleinerte Anzeigevariante neu bewerten.
