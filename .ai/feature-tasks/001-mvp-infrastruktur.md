# 001 – MVP-Umfang & Infrastruktur-Entscheidung

## Kontext & Ziel

WorldCraft ist eine selbst gehostete Webapp für D&D-Gruppen, die einen Teil der Funktionen von World Anvil abbildet: Welten, Artikel, interaktive Karten, Quests, Charaktere und Chat.

**Ziel dieses Plans** ist es, eine geeignete technische Infrastruktur auszuwählen, zu verproben und als Projektnorm festzuhalten. Am Ende steht:

1. je eine dokumentierte Entscheidung (ADR) für Backend, Frontend, Karten-Bibliothek und Editor,
2. lauffähige Prototypen (Spikes), die die riskantesten MVP-Funktionen erst lokal und anschließend gemeinsam in einem Smoketest auf dem echten Server (Staging) beweisen,
3. ein Datenmodell-Entwurf für alle MVP-Funktionen,
4. Projektnormen im `.ai`-Ordner, auf denen die Folgepläne aufbauen.

**Nicht Ziel dieses Plans:**
- die vollständige Umsetzung der MVP-Funktionen (eigener Folgeplan),
- der MCP-Server für Claude (eigener Plan `002`, siehe Abgrenzung). Dieser Plan stellt lediglich sicher, dass die gewählte Infrastruktur ihn später trägt.

### Rahmenbedingungen

- Betrieb auf dem eigenen Server des Projektinhabers, Bereitstellung über **Coolify**.
- Anmeldung ausschließlich über **Discord-Login** (keine eigenen Passwörter).
- Nutzerkreis: private D&D-Gruppe(n), keine öffentliche Registrierung mit großem Nutzeraufkommen.

### MVP-Funktionsumfang

Die folgenden Funktionen definieren, was die Infrastruktur tragen können muss. Umgesetzt werden sie erst im Folgeplan für die MVP-Funktionen. Das **fachliche Datenmodell** mit allen Eigenschaften, Regeln und Löschregeln steht in `.ai/architecture/datenmodell-fachlich.md`. Bei Abweichungen gilt das fachliche Datenmodell.

| # | Funktion | Kurzbeschreibung |
|---|---|---|
| F1 | **Welten & Universen** | Die **Welt** ist der oberste Container. Zu ihr gehören Mitgliedschaften, Artikel, Quests, Chat und Universen. Der Benutzer, der eine Welt erstellt, ist ihr **Game Master**. Eine Welt enthält ein oder mehrere **Universen**. Ein Universum hat einen Namen, eine Beschreibung und im MVP genau eine Karte; das Datenmodell erlaubt aber mehrere Karten pro Universum. Ein Benutzer kann mehrere Welten erstellen und Mitglied in mehreren Welten sein. |
| F2 | **Artikel** | Ein Artikel besteht aus Titel, optionalem **Titelbild** und formatiertem Text. Der Text wird mit dem **Artikel-Editor** bearbeitet und kann andere Artikel, Charaktere, Quests und Universen per **Erwähnung** (`@Name`, mit Teilwortsuche und Kategorie-Anzeige) verlinken. Jede Erwähnung wird als **Relation** gespeichert. Zusätzlich kann die Spielleitung **manuelle Relationen** mit eigener Bezeichnung anlegen (z. B. „ist verfeindet mit“). Jeder Artikel, jede Quest, jeder Pin, jeder Charakter und jedes Universum zeigt seine **verknüpften Elemente**; ein Klick auf einen verknüpften Pin öffnet die Karte an dessen Position. |
| F3 | **Artikel-Vorlagen** | Vordefinierte Artikeltypen, die dem Artikel zusätzliche strukturierte Felder geben. Konkrete Typen und Felder legt der Folgeplan fest. Dieser Plan stellt nur sicher, dass das Datenmodell typabhängige Zusatzfelder unterstützt (siehe T-006). |
| F4 | **Karten** | Hochgeladenes Kartenbild als Hintergrund einer frei zoom- und verschiebbaren Fläche („Whiteboard“). Jede Karte gehört zu genau einem Universum. Im MVP hat jedes Universum genau eine Karte (siehe F1). |
| F5 | **Pins & Charakter-Marker** | **Pins** sind Markierungen auf einer Karte mit einem der 12 **Pin-Typen**. Sie sind per Drag & Drop frei verschiebbar und haben einen Titel (Klartext, Pflicht) und eine Beschreibung (Rich-Text, darf leer sein). Nur die Beschreibung enthält Erwähnungen, die den Pin mit beliebig vielen Artikeln, Quests und Charakteren verknüpfen. **Charakter-Marker** (Profilbild und Name) zeigen mitgebrachte Charaktere auf einer Karte. Sie werden vom Besitzer oder der Spielleitung platziert und sind für alle Mitglieder sichtbar. Änderungen an Pins und Markern sind für alle gleichzeitig Anwesenden live sichtbar: **nach dem Drop**, nicht während des Ziehens (Festlegung Projektinhaber 2026-09-22). |
| F6 | **Mitglieder & Rollen** | Jedes Mitglied einer Welt hat genau eine **Rolle**: Game Master, Master oder Player. Die Rolle hängt am Benutzer, nicht an einem Charakter. Game Master ist immer der Ersteller der Welt; es gibt genau einen, und die Rolle ist im MVP nicht übertragbar. Der Game Master lädt per Einladungslink ein. Jeder Benutzer mit gültigem Einladungslink darf der Welt beitreten und wird dabei Player. Nur der Game Master kann Player zu Master ernennen, Master zu Player zurückstufen und Mitglieder entfernen. |
| F7 | **Quests** | Eigene Inhaltsart mit Titel, Beschreibung (Rich-Text mit Erwähnungen), Status (offen / aktiv / abgeschlossen / gescheitert) und beteiligten Charakteren. Auftraggeber, Orte usw. werden über Erwähnungen oder manuelle Relationen verknüpft. |
| F8 | **Charaktere** | Ein Charakter gehört genau einem Benutzer und existiert **unabhängig von Welten**. Der Benutzer kann ihn in eine oder mehrere Welten **mitbringen**. Ein Benutzer kann in einer Welt **mehrere Charaktere gleichzeitig** spielen. Jeder mitgebrachte Charakter spielt mit, einen Aktiv-Schalter gibt es nicht. Ein Charakter hat einen **Charakterbogen ohne Kampfwerte**: Name, Profilbild, Klasse (Freitext), die sechs Attribute, die 18 Fertigkeiten (ungeübt / geübt / Expertise), Persönlichkeitsmerkmale, Ideale, Bindungen, Makel, Bio (Rich-Text) und bis zu 10 Bildanhänge. |
| F9 | **Tagebuch / Geheimnisse** | Einträge eines Charakters, jeweils **einer Welt zugeordnet**, in die der Charakter mitgebracht wurde. Die Sichtbarkeit ist **pro Eintrag** wählbar: `privat` (nur der Besitzer des Charakters) oder `mit Spielleitung geteilt` (Besitzer + Game Master + Master dieser Welt). |
| F10 | **Chat mit Würfeln** | Gruppenchat pro Welt zwischen allen Mitgliedern, live. Würfelbefehle (z. B. `/roll 2d6+3`) werden serverseitig ausgewertet, und das Ergebnis erscheint für alle im Chat. Nachrichten erscheinen unter dem Benutzer, sind nicht bearbeitbar und können vom Autor bzw. von der Spielleitung gelöscht werden, Würfelwürfe nie. |

### Rechtematrix (MVP, pro Welt)

Grundsatz: Master dürfen alles, was der Game Master darf, **außer Mitglieder zu verwalten** (Personen hinzufügen oder entfernen, Rollen ändern) **und die Welt zu löschen**. Player dürfen Inhalte der Welt nur ansehen und verwalten lediglich ihre eigenen Charaktere, Tagebucheinträge und Chat-Beiträge.

| Aktion | Game Master | Master | Player |
|---|:-:|:-:|:-:|
| Welt löschen | ✅ | – | – |
| Einladungslinks erstellen und widerrufen (Personen hinzufügen) | ✅ | – | – |
| Player zu Master ernennen, Master zu Player zurückstufen | ✅ | – | – |
| Mitglieder entfernen (außer den Game Master) | ✅ | – | – |
| Welt-Einstellungen, Universen, Karten, Artikel, Quests, Pins, manuelle Relationen erstellen, bearbeiten, löschen | ✅ | ✅ | – |
| Veröffentlichte Artikel, Quests, Universen, Karten und Pins ansehen (bei Karten und Pins nur, wenn auch alle übergeordneten Ebenen veröffentlicht sind) | ✅ | ✅ | ✅ |
| Inhalte mit Status `nur Spielleitung` ansehen | ✅ | ✅ | – |
| In die Welt mitgebrachte Charaktere mit Charakterbogen ansehen und ihre Marker auf der Karte sehen | ✅ | ✅ | ✅ |
| Eigene Charaktere anlegen, bearbeiten und in die Welt mitbringen | ✅ | ✅ | ✅ |
| Marker eigener mitgebrachter Charaktere auf einer sichtbaren Karte platzieren, verschieben, entfernen | ✅ | ✅ | ✅ |
| Marker fremder Charaktere platzieren, verschieben, entfernen | ✅ | ✅ | – |
| Tagebucheinträge `mit Spielleitung geteilt` fremder Charaktere dieser Welt lesen | ✅ | ✅ | – |
| Tagebucheinträge `privat` fremder Charaktere lesen | – | – | – |
| Chat lesen & schreiben, würfeln, eigene Nachrichten löschen (außer Würfelwürfe) | ✅ | ✅ | ✅ |
| Fremde Chat-Nachrichten löschen (außer Würfelwürfe) | ✅ | ✅ | – |

### Artikel-Editor (festgelegt)

- **Titelbild:** höchstens ein Bild pro Artikel, außerhalb des Textes, über dem Artikel angezeigt. Formate JPG, PNG, WebP, maximal 10 MB.
- **Text:** Rich-Text **ohne Bilder im Text**. Erlaubte Formatierungen: Überschriften (Ebene 2 und 3), fett, kursiv, unterstrichen, durchgestrichen, Aufzählung, nummerierte Liste, Zitat, Trennlinie, externer Link, Erwähnung (`@Name`).
- **Nicht erlaubt:** Bilder, Tabellen und eingebettete Medien im Text. Beim Einfügen aus der Zwischenablage werden solche Elemente verworfen.
- **Bibliothek:** TipTap (siehe T-005).

### Abgrenzung (nicht in diesem Plan bzw. nicht im MVP)

- **MCP-Server für Claude:** eigener Plan `.ai/feature-tasks/002-mcp-server.md` (bereits erstellt, wird nach diesem Plan umgesetzt; T-013 gleicht ihn mit den Ergebnissen dieses Plans ab). Dieser Plan berücksichtigt ihn nur über das Bewertungskriterium *MCP-Tauglichkeit* in T-002 und über explizit gespeicherte Relationen in T-006.
- **Backlog:** KI-Chat innerhalb der App (bräuchte einen API-Key mit Abrechnung nach Verbrauch), eigene Vorlagen, Kampfwerte und Statblocks (Trefferpunkte, Rüstungsklasse, Stufe, Zauber, Inventar), Zeitleisten, Kalender, Stammbäume, Themes, private Chat-Nachrichten, öffentliche (anonyme) Weltansicht, Bilder im Artikeltext, **Backup & Wiederherstellung** (automatisches tägliches Backup von Datenbank **und** allen hochgeladenen Dateien an ein externes Ziel, inkl. getesteter Wiederherstellung; ehemals T-012). Bis dahin gibt es kein Backup: Staging-Daten gelten als verlierbar.

## Begriffe & Systeme

- **ADR (Architecture Decision Record)**: Kurzes Entscheidungsdokument unter `.ai/decisions/NNN-titel.md` mit den Abschnitten *Kontext*, *Kandidaten* (mindestens drei, je mit Eignungsbegründung), *Bewertung* (Tabelle gegen die Kriterien), *Entscheidung*, *Gegenprüfung*, *Konsequenzen*. Inhalt gemäß *Vorgehen bei Architekturentscheidungen*.
- **Spike**: Zeitlich begrenzter, bewusst verwerfbarer Prototyp, der eine technische Frage beantwortet. Ablage: Der Editor-Spike (T-005) liegt als eigenständige Mini-App unter `spikes/editor/`. Die Spikes T-008 bis T-011 werden **direkt im Grundgerüst aus T-007** gebaut, damit sie Login, Datenbank und Deployment teilen. Ihre Seiten liegen unter der Route `/spike/<name>` (z. B. `/spike/karte`, `/spike/chat`), ihr Code in klar als Spike gekennzeichneten Ordnern (z. B. `src/spike/<name>/`). Der Discord-Login aus T-008 bleibt dauerhaft bestehen. Die Spike-Seiten aus T-009 bis T-011 baut der Folgeplan aus oder entfernt sie. Jeder Spike ist **lokal lauffähig** (siehe *Lokale Entwicklungsumgebung*). **Abnahme in zwei Stufen:** Die Spikes T-008 bis T-011 werden nacheinander lokal entwickelt, und ihre Abnahmekriterien werden zunächst lokal erfüllt. Danach werden alle zusammen im **Smoketest T-014** auf Staging abgenommen. Ein Spike gilt erst als bestanden, wenn beide Stufen erfüllt sind.
- **Coolify**: Selbst gehostete Plattform (Open Source), die Anwendungen aus einem Git-Repository als Docker-Container baut, deployt und mit HTTPS-Domain versieht.
- **Discord-Login (OAuth2)**: Anmeldung über ein Discord-Konto. Erfordert eine Anwendung im Discord Developer Portal mit Client-ID, Client-Secret und registrierter Redirect-URL. Benötigte Scopes: `identify` (Pflicht) und optional `email`. Für reines Login ist keine Prüfung oder Verifizierung durch Discord nötig.
- **Realtime**: Übertragung von Änderungen an alle verbundenen Browser ohne Neuladen, z. B. über WebSockets oder Server-Sent Events. Wird für Chat und Pin-Verschiebung benötigt.
- **Relation**: Gespeicherte, gerichtete Verbindung zwischen zwei Inhalten (Artikel, Quest, Charakter, Pin, Universum). **Automatische** Relationen entstehen aus Erwähnungen, Vorlagenfeldern und Quest-Beteiligungen; **manuelle** Relationen legt die Spielleitung mit eigener Bezeichnung an. Grundlage für die verknüpften Elemente und den späteren MCP-Server.
- **Erwähnung**: Verweis auf einen Artikel, eine Quest, einen Charakter oder ein Universum im Rich-Text, eingefügt über `@` mit Teilwortsuche (Definition in `.ai/architecture/datenmodell-fachlich.md`, Abschnitt 2.4).
- **Welt**: Oberster Container einer Spielrunde mit Mitgliedern, Artikeln, Quests, Chat und Universen. Die Welt ist nur das logische Objekt (die Gruppe) für die Geschichte: Sie ist weder erwähnbar noch Quelle oder Ziel einer Relation, und ihre Beschreibung enthält keine Erwähnungen.
- **Universum**: Teilbereich einer Welt (z. B. eine Ebene, ein Kontinent oder eine Dimension), der die Karte(n) enthält. Im MVP genau eine Karte pro Universum.
- **Game Master**: Ersteller einer Welt mit vollen Rechten. Pro Welt genau einer, im MVP nicht übertragbar.
- **Master**: Rolle mit allen Rechten des Game Masters außer der Mitgliederverwaltung (Personen hinzufügen oder entfernen, Rollen ändern) und dem Löschen der Welt. Pro Welt beliebig viele.
- **Player**: Rolle, die Inhalte der Welt nur ansieht. Verwaltet eigene Charaktere, Tagebucheinträge und Chat-Beiträge.
- **Einladungslink**: Vom Game Master erzeugter, widerrufbarer Link. Jeder angemeldete Benutzer, der ihn öffnet, darf der Welt als Player beitreten.
- **Charakter-Marker**: Darstellung eines mitgebrachten Charakters (Profilbild und Name) auf einer Karte. Pro Karte und Charakter höchstens ein Marker mit eigener Position.
- **Spielleitung**: Sammelbegriff für Game Master und alle Master einer Welt.
- **Mitbringen**: Einen eigenen, weltunabhängigen Charakter einer Welt zuordnen, in der der Benutzer Mitglied ist.
- **Pin-Typen (12)**: Gefahr, Boss, Haus, Stadt, Schatz, Stern (Sehenswürdigkeit), Angeln, Pflanzen, Dungeon, Quest, Teleporter, Shop.
- **Artikel-Editor**: Rich-Text-Editor für den Artikeltext mit dem im Abschnitt *Artikel-Editor (festgelegt)* definierten Funktionsumfang.
- **TipTap**: Open-Source-Rich-Text-Editor auf Basis von ProseMirror. Der Kern ist frameworkunabhängig, Anbindungen gibt es für React, Vue und Svelte. Speichert Inhalte als JSON.
- **MCP (Model Context Protocol)**: Offenes Protokoll, über das Claude Werkzeuge externer Anwendungen aufruft. Wird in Plan `002` umgesetzt. Hier nur als Bewertungskriterium relevant.
- **Lokale Entwicklungsumgebung**: Betrieb der App auf dem Rechner des Projektinhabers. Datenbank und ggf. Backend-Dienste starten per `docker compose up` (Docker ist installiert). Das Frontend läuft über seinen Dev-Server. Konfiguration über eine lokale `.env`-Datei (nicht im Repository) nach Vorlage `.env.example` (im Repository, ohne echte Werte). Discord-Login lokal über eine zusätzliche Redirect-URL `http://localhost:<port>/…` in der Discord-Anwendung, weitere Benutzer über den Test-Login.
- **Staging**: Eigene Coolify-Umgebung mit eigener Subdomain für Tests. Sie ist von der späteren Produktivumgebung getrennt.
- **Test-Login**: Zusätzlicher Anmeldeweg ausschließlich für Staging und lokale Entwicklung. Er meldet einen vordefinierten Testbenutzer (Seed-Benutzer) ohne Discord an und liefert eine normale Sitzung. Aktiv nur, wenn die Umgebungsvariable `ENABLE_TEST_LOGIN=true` gesetzt ist. Die Anwendung verweigert den Start, wenn `ENABLE_TEST_LOGIN=true` in der Produktivumgebung gesetzt ist. Wird in T-008 gebaut und von T-009, T-010 und T-011 für die zusätzlichen Testbenutzer genutzt.

## Relevante Normen

- `.ai/architecture/datenmodell-fachlich.md`: fachliches Datenmodell (Entitäten, Eigenschaften, Regeln, Löschregeln, Rechte je Entität). Verbindliche Grundlage für T-005, T-006 und T-011.

Weitere Normen legt dieser Plan an: ADRs unter `.ai/decisions/`, Projektnormen durch T-013.

## Globale Abhängigkeiten

- Zugang zum eigenen Server mit laufender Coolify-Instanz (liefert der Projektinhaber).
- Eine Domain bzw. Subdomain, die auf den Server zeigt.
- Ein Discord-Konto des Projektinhabers zum Anlegen der Discord-Anwendung.
- Ein Git-Hosting, auf das Coolify zugreifen kann (z. B. GitHub, GitLab oder Gitea). Die Auswahl erfolgt in T-001.

**Vorgehen bei Architekturentscheidungen:** Gilt für die ADRs aus T-002 bis T-004 und für jede weitere Architekturentscheidung, die während der Umsetzung fällt (z. B. Speicherung polymorpher Inhaltsverweise und Suche in T-006, Realtime-Mechanismus in T-009/T-010). Solche Entscheidungen werden im jeweiligen ADR oder, wenn sie kein eigenes ADR rechtfertigen, im Ergebnisdokument der Aufgabe in derselben Struktur festgehalten. Sonderfall Editor-Wahl in T-005: TipTap ist vom Projektinhaber festgelegt (er nutzt es bereits in einem anderen Projekt). ADR-004 enthält trotzdem die Gegenüberstellung mit mindestens zwei Alternativen und die Gegenprüfung nach Schritt 1–4. Die Entscheidung wird dadurch nicht neu getroffen. Stellt die Gegenprüfung jedoch ein Ausschlusskriterium fest (z. B. benötigte Funktion nur als kostenpflichtige Pro-Erweiterung), wird das dem Projektinhaber als Rückfrage vorgelegt.
1. **Mindestens drei geeignete Optionen** benennen. Die im Plan genannten Kandidaten sind der Ausgangspunkt. Erweist sich einer davon als ungeeignet, wird er mit Begründung ersetzt. Weitere geeignete Optionen dürfen ergänzt werden.
2. **Eignung je Option begründen:** Warum passt genau diese Option für WorldCraft? Konkreter Bezug auf Rahmenbedingungen, MVP-Funktionen (F1–F10), Rechtematrix, fachliches Datenmodell und den Server aus T-001, nicht nur allgemeine Vorzüge.
3. **Bewerten und empfehlen** gegen die Kriterien der Aufgabe: je Kriterium 1–5 Punkte mit einer Begründung in einem Satz, Gewichtung 1, sofern die Aufgabe nichts anderes festlegt. Die höchste gewichtete Summe ist der Vorschlag. Weicht die Empfehlung davon ab, wird das begründet.
4. **Gegenprüfung der eigenen Empfehlung** (Abschnitt *Gegenprüfung*): (a) die stärksten Argumente gegen die empfohlene Option, (b) das stärkste Argument für die zweitbeste Option, (c) jede Tatsachenbehauptung, auf der die Empfehlung beruht (Funktionsumfang, Lizenz, Version, Ressourcenbedarf), mit Link auf offizielle Dokumentation oder Quelle belegt, (d) Vereinbarkeit mit allen bereits getroffenen Entscheidungen. Hält die Empfehlung der Gegenprüfung nicht stand, wird sie geändert und die Änderung begründet.

**Manuelle Schritte:** Aufgaben mit dem Unterpunkt *👤 Manuelle Schritte (Projektinhaber)* enthalten Handlungen, die nur der Projektinhaber ausführen kann (Zugang zu Server, Coolify, Git-Hosting, Discord Developer Portal). Die KI bereitet dafür alles vor, was ohne Zugang möglich ist (Anleitung, Liste der Variablennamen, Dokumentvorlage). Danach pausiert `/plan-run` und setzt die Aufgabe erst fort, wenn der Projektinhaber die Erledigung im Chat bestätigt. Secrets (Client-Secret, Passwörter, Tokens) werden nie im Chat übermittelt. Der Projektinhaber trägt sie selbst in Coolify bzw. in die lokale `.env` ein.

## Aufgaben

### T-001: Bestandsaufnahme Server & Coolify – Won't do
- **Status: Won't do** (vom Projektinhaber am 2026-09-22 übersprungen). Die ID T-001 bleibt reserviert und wird nicht neu vergeben. Server-Eckdaten werden in diesem Plan nicht erfasst. T-002 bewertet Kriterium 5 (Ressourcenbedarf / Coolify) gegen die Rahmenbedingungen dieses Plans (selbst gehostet, Coolify, private D&D-Gruppe) statt gegen gemessene Serverwerte.
- Beschreibung: Die Eckdaten des Zielservers erfassen und in `.ai/infrastructure/server.md` dokumentieren: Coolify-Version, CPU-Kerne, RAM, freier Speicherplatz, Betriebssystem, bereits laufende Dienste, verfügbare (Sub-)Domains, vorhandenes Backup-Ziel (z. B. S3-kompatibler Speicher) und das Git-Hosting, das an Coolify angebunden ist bzw. wird.
- 👤 Manuelle Schritte (Projektinhaber):
  - Die Eckdaten aus Server und Coolify-Oberfläche ablesen und im Chat mitteilen (oder direkt in die von der KI vorbereitete Vorlage `.ai/infrastructure/server.md` eintragen).
  - Git-Hosting und Staging-Subdomain festlegen.
- Abhängigkeiten: keine
- Abnahmekriterium: `.ai/infrastructure/server.md` existiert und enthält zu jedem der genannten Punkte einen konkreten Wert oder ausdrücklich „nicht vorhanden“. Git-Hosting und Staging-Subdomain sind festgelegt.

### T-002: Backend-Ansatz entscheiden (ADR-001)
- [x] Beschreibung: Die drei Kandidaten bewerten und die Entscheidung als `.ai/decisions/001-backend.md` festhalten.
  - **A – PocketBase**: einzelnes Binary mit SQLite, integriertem Discord-OAuth2, Realtime-Abonnements, Dateispeicher und Zugriffsregeln pro Datensatz.
  - **B – Supabase (selbst gehostet)**: PostgreSQL mit Row-Level-Security, Realtime, Storage und Discord-Login. Besteht aus mehreren Containern.
  - **C – Eigenes TypeScript-Backend**: Node.js, PostgreSQL, ORM (Drizzle), Auth-Bibliothek mit Discord-Provider (z. B. Better Auth) und WebSocket-Server (z. B. Socket.IO).

  Bewertungskriterien, jeweils mit 1–5 Punkten und einer Begründung in einem Satz:
  1. Discord-Login
  2. Realtime für Chat und Pins
  3. Dateispeicher für Kartenbilder bis 20 MB und Titelbilder bis 10 MB
  4. Rechteprüfung auf Datenebene, inkl. Rollen pro Welt, der Regel „genau ein Game Master“ und der Sichtbarkeit einzelner Tagebucheinträge
  5. Ressourcenbedarf und Betrieb auf dem Server aus T-001 via Coolify
  6. Backup & Wiederherstellung
  7. Typsicherheit und Entwicklerfreundlichkeit
  8. Anbieterbindung
  9. **MCP-Tauglichkeit**: Kann die App mit diesem Backend in Plan `002` als OAuth-2.1-Autorisierungsserver für einen Claude-Connector auftreten (fertige Bibliothek oder Plugin vs. Eigenbau), und lassen sich die Rechteprüfungen für Oberfläche und MCP-Werkzeuge gemeinsam nutzen? Kriterium 9 zählt **doppelt**, weil ein Eigenbau der OAuth-Seite der größte Aufwandstreiber von Plan `002` ist.
- Abhängigkeiten: T-001
- **Stopp (Freigabe erforderlich):** Nach Fertigstellung von ADR-001 pausiert `/plan-run` und legt dem Projektinhaber die Entscheidung mit Empfehlung und Gegenprüfung vor. Abhängige Aufgaben (T-003, T-006, T-007) starten erst nach ausdrücklicher Freigabe im Chat. Entscheidet sich der Projektinhaber für eine andere Option, wird das ADR entsprechend angepasst und der Grund darin dokumentiert.
- Abnahmekriterium: ADR-001 folgt dem *Vorgehen bei Architekturentscheidungen* (inkl. Eignungsbegründung je Kandidat und Abschnitt *Gegenprüfung* mit Quellen) und enthält die ausgefüllte Bewertungstabelle für alle Kandidaten (Kriterium 9 doppelt gewichtet) und genau eine gewählte Option mit Begründung und Konsequenzen. Scheitert einer der Spikes T-005, T-008 bis T-011 oder der Smoketest T-014 am gewählten Backend, wird ADR-001 überarbeitet und der Grund darin dokumentiert. Welche Folgeaufgaben dann wiederholt werden, regelt der Stopp bei No-Go in T-013 (wird ein Scheitern schon vor T-013 festgestellt, gilt dasselbe Vorgehen sofort).

### T-003: Frontend-Framework entscheiden (ADR-002)
- [x] Beschreibung: Die Kandidaten **Next.js (React)**, **SvelteKit** und **React + Vite (Single-Page-App)** bewerten und die Entscheidung als `.ai/decisions/002-frontend.md` festhalten. Kriterien: Zusammenspiel mit dem Backend aus ADR-001, Verfügbarkeit der Karten-Bibliothek (T-004) und einer TipTap-Anbindung (T-005) für das Framework, Deployment als Container auf Coolify, Typsicherheit (TypeScript), Aufwand für Realtime-Anbindung, Größe des Ökosystems.
- Abhängigkeiten: T-002
- **Stopp (Freigabe erforderlich):** Nach Fertigstellung von ADR-002 pausiert `/plan-run` und legt dem Projektinhaber die Entscheidung mit Empfehlung und Gegenprüfung vor. Abhängige Aufgaben (T-004, T-005, T-007) starten erst nach ausdrücklicher Freigabe im Chat. Entscheidet sich der Projektinhaber für eine andere Option, wird das ADR entsprechend angepasst und der Grund darin dokumentiert.
- Abnahmekriterium: ADR-002 folgt dem *Vorgehen bei Architekturentscheidungen* (inkl. Eignungsbegründung je Kandidat und Abschnitt *Gegenprüfung* mit Quellen), enthält die Bewertungstabelle aller Kandidaten und genau eine gewählte Option. Die Wahl ist mit ADR-001 vereinbar, und das ist im Abschnitt *Konsequenzen* begründet.

### T-004: Karten-/Whiteboard-Bibliothek entscheiden (ADR-003)
- [x] Beschreibung: Die Kandidaten bewerten und die Entscheidung als `.ai/decisions/003-karten.md` festhalten.
  - **Leaflet** mit `CRS.Simple`: Kartenbild als Bild-Ebene, ziehbare Marker mit eigenen Icons.
  - **Konva** (bzw. `react-konva` / `svelte-konva`): freie Zeichenfläche mit Bild-Hintergrund.
  - **tldraw**: fertiges Whiteboard. Das Lizenzmodell für den selbst gehosteten Produktivbetrieb ist ausdrücklich zu prüfen.

  Kriterien: flüssiges Zoomen und Verschieben bei einem Kartenbild von 8000 × 6000 px, ziehbare Pins mit 12 eigenen Icons, Klick auf einen Pin öffnet ein Popup mit Link, Touch-Bedienung (Tablet), Speicherung der Pin-Position unabhängig von der Zoomstufe (Koordinaten relativ zum Bild), Lizenz, Eignung für die Live-Synchronisation von Positionen, Verfügbarkeit für das Framework aus ADR-002.
- Abhängigkeiten: T-003
- **Stopp (Freigabe erforderlich):** Nach Fertigstellung von ADR-003 pausiert `/plan-run` und legt dem Projektinhaber die Entscheidung mit Empfehlung und Gegenprüfung vor. Abhängige Aufgaben (T-009) starten erst nach ausdrücklicher Freigabe im Chat. Entscheidet sich der Projektinhaber für eine andere Option, wird das ADR entsprechend angepasst und der Grund darin dokumentiert.
- Abnahmekriterium: ADR-003 folgt dem *Vorgehen bei Architekturentscheidungen* (inkl. Eignungsbegründung je Kandidat und Abschnitt *Gegenprüfung* mit Quellen), enthält die Bewertungstabelle, das Ergebnis der Lizenzprüfung für jeden Kandidaten (mit Link auf die Lizenz) und genau eine gewählte Option.

### T-005: Artikel-Editor festschreiben & verproben (ADR-004)
- [x] Beschreibung: Die bereits getroffene Entscheidung für **TipTap** als `.ai/decisions/004-editor.md` dokumentieren. Enthalten sein müssen: eine Gegenüberstellung von TipTap mit mindestens zwei geeigneten Alternativen (z. B. Lexical, Plate/Slate, BlockNote) samt Gegenprüfung gemäß *Vorgehen bei Architekturentscheidungen* (Sonderfall Editor), der Funktionsumfang laut Abschnitt *Artikel-Editor (festgelegt)*, die dafür nötigen TipTap-Erweiterungen, die TipTap-Anbindung für das Framework aus ADR-002, das Speicherformat (TipTap-JSON plus abgeleiteter Klartext für die Suche) sowie Lizenzhinweise. Nur Open-Source-Erweiterungen sind zulässig, keine kostenpflichtigen Pro-Erweiterungen. Danach einen Spike unter `spikes/editor/` bauen, der den Editor mit genau diesem Funktionsumfang zeigt.
- Abhängigkeiten: T-003
- Abnahmekriterium: (1) ADR-004 existiert mit allen genannten Inhalten. (2) Die Werkzeugleiste im Spike bietet genau die erlaubten Formatierungen. (3) Wird ein Bild oder eine Tabelle aus der Zwischenablage (z. B. aus einer Webseite oder Word) eingefügt, erscheint im Editor kein Bild und keine Tabelle, der übrige Text bleibt erhalten. (4) `@` öffnet eine Vorschlagsliste aus Testdaten (Artikel, Charaktere, Quests, Universen) gemäß Abschnitt 2.4 des fachlichen Datenmodells: Mit den Testdaten „Gottschleim“ (Artikel) und „Töte den Gottschleim“ (Quest) liefert `@schleim` beide Einträge, jeweils mit Kategorie. Nach dem Speichern liefert eine Funktion die Liste aller erwähnten Inhaltsverweise (Art + ID). (5) Gespeichertes JSON lässt sich neu laden und wird identisch dargestellt. (6) Der Editor lässt sich per Konfiguration ohne Erwähnungen betreiben (für die Weltbeschreibung): `@` öffnet dann keine Vorschlagsliste, alle übrigen Formatierungen bleiben verfügbar.

### T-006: Datenmodell-Entwurf
- [x] Beschreibung: Das fachliche Datenmodell (`.ai/architecture/datenmodell-fachlich.md`) in ein **technisches Schema** für das Backend aus ADR-001 übersetzen und als `.ai/architecture/datenmodell.md` dokumentieren. Enthalten sein müssen:
  - ein ER-Diagramm (Mermaid) und pro Entität die Tabellen bzw. Collections mit Feldern und technischen Datentypen,
  - eine Zuordnungstabelle „Entität / Eigenschaft im fachlichen Modell → Tabelle / Feld im Schema“,
  - die technische Umsetzung jeder Regel aus dem fachlichen Modell (Constraint, Index, Trigger, Backend-Regel oder Anwendungslogik),
  - die Umsetzung der Löschregeln (Abschnitt 4 des fachlichen Modells),
  - die Umsetzung der Rechte je Entität (Abschnitt 5), inkl. Vererbung der Sichtbarkeit Universum → Karte → Pin/Marker und Sichtbarkeit von Relationen (Quelle **und** Ziel sichtbar),
  - die Speicherung typabhängiger Vorlagenfelder ohne Schemaänderung je Vorlagentyp,
  - die Speicherung polymorpher Inhaltsverweise (Relationen zwischen Artikel, Quest, Charakter, Pin, Universum) mit referentieller Integrität bzw. Aufräumlogik beim Löschen,
  - die Umsetzung der Erwähnungssuche (Teilwort, ohne Groß-/Kleinschreibung, über Artikel, Quests, Charaktere, Universen) und der Volltextsuche.
- Abhängigkeiten: T-002, T-005
- **Stopp (Freigabe erforderlich):** Nach Fertigstellung des Entwurfs pausiert `/plan-run` und legt dem Projektinhaber das Datenmodell zur Prüfung vor. Abhängige Aufgaben (T-011, T-013) starten erst nach ausdrücklicher Freigabe im Chat. Änderungswünsche werden vorher eingearbeitet.
- Abnahmekriterium: (1) Die Zuordnungstabelle deckt **jede** Entität und Eigenschaft des fachlichen Modells ab. Was nicht umgesetzt wird, steht mit Begründung darin. (2) Jede mit „Regel“ gekennzeichnete Aussage des fachlichen Modells hat eine benannte technische Umsetzung. Mindestens „genau ein Game Master = Ersteller“, „höchstens eine Teilnahme pro Charakter und Welt“ und „höchstens ein Charakter-Marker pro Charakter und Karte“ sind auf Datenebene abgesichert (z. B. eindeutiger Teilindex oder Constraint). (3) Das Mermaid-ER-Diagramm wird in einer Markdown-Vorschau fehlerfrei gerendert. (4) Das Schema erlaubt mehrere Karten pro Universum, ohne dass eine Migration nötig wäre. (5) Abweichungen vom fachlichen Modell sind nicht stillschweigend eingebaut, sondern als Rückfrage beim Stopp vorgelegt.

### T-007: Repository, Grundgerüst & Deployment auf Coolify
**Abweichung (Projektinhaber, 2026-09-22):** Git-Hosting ist GitHub (`https://github.com/diego-lagolago/WorldCraft`). Kein separates Staging; Deploy direkt auf `worldcraft.lagolago.at` (Produktion, Option 1). `APP_ENV=production`, `ENABLE_TEST_LOGIN` dort aus. Test-Login-Abnahme bleibt lokal (T-008 / T-011).
- [ ] Beschreibung: Diesen Projektordner (WorldCraft, enthält bereits `.ai/` und ist ein lokales Git-Repository) als Repository auf dem Git-Hosting aus T-001 anlegen und pushen. App-Code, `.ai/` und `spikes/` liegen gemeinsam darin. Das Grundgerüst mit Frontend (ADR-002) und Backend (ADR-001) erstellen und auf der Staging-Subdomain über Coolify bereitstellen. Dazu gehören: automatisches Deployment bei Push auf den Hauptzweig, Umgebungsvariablen in Coolify (keine Secrets im Repository), persistentes Volume für Datenbank und Dateien, HTTPS-Zertifikat. Außerdem die **lokale Entwicklungsumgebung** einrichten: `docker-compose.yml` für Datenbank bzw. Backend-Dienste, `.env.example`, und im `README.md` die Startschritte für lokal.
- 👤 Manuelle Schritte (Projektinhaber):
  - Das Repository auf dem Git-Hosting anlegen und der KI die Remote-URL nennen (oder selbst pushen).
  - In Coolify die Anwendung bzw. Ressourcen anlegen, das Repository verbinden, das automatische Deployment auf dem Hauptzweig aktivieren, die Staging-Subdomain zuweisen und die Volumes anlegen, jeweils nach der Anleitung der KI.
  - Die Umgebungsvariablen aus `.env.example` in Coolify mit echten Werten setzen.
- Abhängigkeiten: T-001, T-002, T-003
- Abnahmekriterium: Die Staging-URL liefert per HTTPS eine Startseite, die einen aus der Datenbank gelesenen Wert anzeigt. Ein Push auf den Hauptzweig löst ohne manuellen Eingriff ein neues Deployment aus. Nach einem Neustart des Containers in Coolify sind Datenbankinhalte und hochgeladene Dateien weiterhin vorhanden. `git grep` findet kein Client-Secret und kein Passwort im Repository. Lokal startet die App nach den Schritten im `README.md` (`docker compose up` plus Dev-Server) und zeigt dieselbe Startseite mit dem Wert aus der lokalen Datenbank.

### T-008: Spike Discord-Login
- [ ] Beschreibung: Eine Discord-Anwendung im Discord Developer Portal anlegen (Scopes `identify` und optional `email`, Redirect-URLs der Staging-Umgebung und der lokalen Entwicklungsumgebung) und die Anmeldung im Grundgerüst aus T-007 einbauen. Beim ersten Login wird ein Benutzer mit Discord-ID, Anzeigename und Avatar-URL angelegt, bei weiteren Logins wiedererkannt. Zusätzlich den **Test-Login** (siehe *Begriffe & Systeme*) einbauen: vier Seed-Benutzer `test-gm`, `test-master`, `test-player-a`, `test-player-b`, jeweils mit Platzhalter-Discord-ID (Präfix `test-`), Anzeigename und ohne Avatar.
- 👤 Manuelle Schritte (Projektinhaber):
  - Im Discord Developer Portal die Anwendung anlegen, die Redirect-URLs für Staging und lokal eintragen (die KI nennt die genauen URLs).
  - Client-ID und Client-Secret in die lokale `.env` und in die Coolify-Umgebungsvariablen eintragen.
- Abhängigkeiten: T-007
- Abnahmekriterium (lokal; auf Staging in T-014): In der lokalen Entwicklungsumgebung führt „Mit Discord anmelden“ zur Discord-Freigabeseite und zurück in die App, die dort Anzeigename und Avatar zeigt. Ein zweiter Login mit demselben Discord-Konto erzeugt keinen zweiten Benutzer (prüfbar in der Datenbank). Abmelden beendet die Sitzung: Ein Neuladen zeigt wieder den Login-Button. Test-Login: Mit `ENABLE_TEST_LOGIN=true` lässt sich jeder der vier Seed-Benutzer anmelden, und die Sitzung ist per `curl` nutzbar. Ohne die Variable ist der Test-Login nicht erreichbar (HTTP 404). Mit `ENABLE_TEST_LOGIN=true` in der Produktivkonfiguration startet die Anwendung nicht, sondern bricht mit einer verständlichen Fehlermeldung ab.

### T-009: Spike Karten-Whiteboard mit Pins
- [ ] Beschreibung: Mit der Bibliothek aus ADR-003 eine Seite bauen, auf der ein Kartenbild hochgeladen wird und als zoom- und verschiebbarer Hintergrund erscheint. Pins aller 12 Pin-Typen lassen sich mit Titel (Pflicht) und Beschreibung (optional) platzieren und per Drag & Drop verschieben. Zusätzlich wird ein Charakter-Marker (Profilbild und Name eines Test-Charakters) angezeigt und ist verschiebbar. Positionen von Pins und Markern werden relativ zum Bild gespeichert und per Realtime an alle anderen geöffneten Browser übertragen. Übertragen wird die **Endposition nach dem Drop**, nicht der Zwischenstand während des Ziehens (Projektinhaber 2026-09-22).
- Abhängigkeiten: T-004, T-008
- Abnahmekriterium (lokal; auf Staging in T-014): (1) Ein Testbild mit 8000 × 6000 px lässt sich hochladen und flüssig zoomen und verschieben. (2) Alle 12 Pin-Typen sind mit unterscheidbarem Icon platzierbar. (3) Wird ein Pin oder der Charakter-Marker in Browser A abgelegt (Drop), steht er in Browser B (anderer angemeldeter Benutzer, z. B. per Test-Login) innerhalb von 1 Sekunde an derselben Stelle, ohne Neuladen. Während des Ziehens muss Browser B den Pin nicht mitbewegen. (4) Nach dem Neuladen und bei jeder Zoomstufe stehen Pin und Marker an derselben Bildstelle. (5) Charakter-Marker sind optisch klar von Pins unterscheidbar (Profilbild statt Pin-Icon). (6) Der Aufruf der Karten-URL mit einer Pin-ID als Parameter öffnet die Karte zentriert und gezoomt auf diesen Pin und hebt ihn hervor (Grundlage für „verknüpfte Elemente“). (7) Die Bedienung funktioniert per Touch in der Geräte-Emulation des Browsers (Tablet-Profil).

### T-010: Spike Chat mit Würfeln
- [ ] Beschreibung: Einen einfachen Gruppenchat mit Realtime bauen. Nachrichten, die mit `/roll` beginnen, werden **serverseitig** ausgewertet (Notation `NdM`, `NdM+K`, `NdM-K`, mehrere Terme wie `1d20+1d4+2`; N ≤ 100, M ∈ {2, 4, 6, 8, 10, 12, 20, 100}). Einzelwürfe und Summe werden als Chat-Nachricht gespeichert.
- Abhängigkeiten: T-008
- Abnahmekriterium (lokal; auf Staging in T-014): (1) Eine Nachricht aus Browser A erscheint in Browser B (anderer angemeldeter Benutzer, z. B. per Test-Login) innerhalb von 1 Sekunde. (2) `/roll 2d6+3` erzeugt eine Nachricht mit zwei Einzelwerten zwischen 1 und 6 und der korrekten Summe. (3) Eine ungültige Eingabe (z. B. `/roll 2d7`) erzeugt eine verständliche Fehlermeldung und keinen Wurf. (4) Ein manipulierter Client-Request mit vorgegebenem Würfelergebnis wird ignoriert bzw. abgelehnt. Das Ergebnis entsteht nachweislich auf dem Server. (5) Nach dem Neuladen sind die letzten 50 Nachrichten sichtbar.

### T-011: Spike Rechteprüfung auf Datenebene
- [ ] Beschreibung: Rollen und Rechteprüfung im Backend für folgende Fälle umsetzen und testen: (a) Tagebucheinträge mit Sichtbarkeit `privat` bzw. `mit Spielleitung geteilt`, (b) Artikel mit Status `nur Spielleitung`, (c) Rollenverwaltung: Game Master = Ersteller, Einladen, Ernennen, Zurückstufen und Entfernen nur durch den Game Master, (d) mehrere mitgebrachte Charaktere desselben Benutzers in einer Welt, (e) das Verschieben von Charakter-Markern. Testbenutzer: 1 Game Master, 1 Master, 2 Player (Player A hat zwei mitgebrachte Charaktere, einer davon mit Tagebucheinträgen, Player B einen mitgebrachten Charakter ohne Einträge). Es sind die vier Seed-Benutzer des Test-Logins aus T-008 (`test-gm`, `test-master`, `test-player-a`, `test-player-b`). Das Testskript meldet sie über den Test-Login an und legt Welt, Rollen, Charaktere und Einträge selbst an.
- Abhängigkeiten: T-006, T-008
- Abnahmekriterium (lokal; auf Staging in T-014): Direkte Abfragen an das Backend (nicht über die Oberfläche, z. B. mit `curl` und dem Sitzungstoken des jeweiligen Testbenutzers) liefern genau die Ergebnisse der Rechtematrix:
  - Player B erhält weder `privat`- noch `geteilt`-Einträge von Player A.
  - Game Master und Master erhalten nur die `geteilt`-Einträge.
  - Game Master und Master sehen Artikel mit Status `nur Spielleitung`, die Player nicht.
  - Der Ersteller der Welt ist Game Master. Der Versuch, einen weiteren Benutzer zum Game Master zu machen, wird abgelehnt, ebenso der Versuch eines Masters, den Game Master zu entfernen oder zurückzustufen.
  - Der Game Master kann Player B zum Master ernennen, wieder zurückstufen und aus der Welt entfernen. Der Master kann weder einen Einladungslink erstellen noch eine Rolle ändern noch ein Mitglied entfernen. Player können weder ernennen noch einladen noch entfernen.
  - Ein Benutzer mit gültigem Einladungslink tritt als Player bei. Mit einem widerrufenen Link wird der Beitritt abgelehnt.
  - Tritt Player A aus, wird nichts gelöscht: Seine Mitgliedschaft und Teilnahmen sind archiviert, und keiner der anderen Testbenutzer erhält danach Player As Charaktere, deren Marker, Tagebucheinträge oder Relationen. In der Datenbank sind alle noch vorhanden. Nach erneutem Beitritt über einen gültigen Link (als Player) und erneutem Mitbringen der Charaktere sind Marker (an derselben Position), Tagebucheinträge und Relationen unverändert wieder da.
  - Der Master kann die Welt nicht löschen.
  - Player A kann den Marker seines eigenen Charakters verschieben, nicht aber den von Player B. Der Master kann beide verschieben.
  - Player können keine Artikel, Pins, Karten, Universen oder manuellen Relationen anlegen, ändern oder löschen.
  - Ist ein Universum `nur Spielleitung`, erhalten Player weder dessen Karte noch deren Pins oder Marker, auch wenn diese selbst `veröffentlicht` sind.
  - Eine Relation zwischen einem veröffentlichten und einem versteckten Artikel wird Playern nicht geliefert, der Spielleitung schon. Ebenso wird eine Relation zwischen einem veröffentlichten Artikel und einem Universum mit Status `nur Spielleitung` Playern nicht geliefert.
  - Player A kann für beide eigenen Charaktere je einen Marker auf derselben Karte platzieren. Ein zweiter Marker für denselben Charakter auf derselben Karte wird abgelehnt.

  Die Tests sind als Skript oder automatisierter Test im Spike-Ordner abgelegt und wiederholbar.

### T-014: Smoketest aller Spikes auf Staging
**Abweichung (Projektinhaber, 2026-09-22):** Staging als eigene Coolify-Umgebung entfällt. HTTPS-/Discord-/Pin-/Chat-Prüfungen laufen gegen `worldcraft.lagolago.at`. Test-Login-Abnahme (T-008 / T-011) bleibt **lokal**. Produktion darf `ENABLE_TEST_LOGIN=true` nicht akzeptieren — in Coolify nicht setzen.
- [ ] Beschreibung: Den Stand mit den lokal abgenommenen Spikes T-008 bis T-011 auf den Hauptzweig pushen, sodass Coolify ihn auf Staging bereitstellt (Deployment aus T-007). In den Coolify-Umgebungsvariablen von Staging den Test-Login aktivieren (`ENABLE_TEST_LOGIN=true`). Danach die Abnahmekriterien von T-008, T-009, T-010 und T-011 auf der Staging-URL erneut prüfen und das Ergebnis je Kriterium in `.ai/infrastructure/smoketest.md` festhalten (bestanden / nicht bestanden, bei „nicht bestanden“ mit Beobachtung). Schlägt ein Kriterium nur auf Staging fehl (z. B. Realtime hinter dem Reverse Proxy, Upload-Limit für 20-MB-Kartenbilder), wird die Ursache behoben und der Smoketest für den betroffenen Spike wiederholt.
- 👤 Manuelle Schritte (Projektinhaber):
  - `ENABLE_TEST_LOGIN=true` in den Coolify-Umgebungsvariablen von Staging setzen.
  - Den echten Discord-Login auf Staging mit dem eigenen Konto durchführen (Kriterien aus T-008).
- Abhängigkeiten: T-007, T-008, T-009, T-010, T-011
- Abnahmekriterium: `.ai/infrastructure/smoketest.md` listet jedes Abnahmekriterium von T-008 bis T-011 mit dem Ergebnis auf Staging, und alle sind „bestanden“. Insbesondere funktionieren auf Staging per HTTPS: echter Discord-Login, Hochladen des 8000 × 6000 px großen Testbilds, Live-Übertragung von Pins und Chat zwischen zwei Browsern innerhalb von 1 Sekunde und das Rechte-Testskript aus T-011 gegen die Staging-URL.

### T-012: Backup & Wiederherstellung – entfällt (ins Backlog verschoben)
- Vom Projektinhaber am 2026-09-22 aus diesem Plan gestrichen, siehe *Abgrenzung → Backlog*. Die ID T-012 bleibt reserviert und wird nicht neu vergeben.

### T-013: Projektnormen festhalten & Go/No-Go
- [ ] Beschreibung: Die Ergebnisse als verbindliche Normen für die Folgepläne festhalten:
  - `.ai/tech-stack.md`: gewählte Technologien mit Version und Verweis auf die ADRs.
  - `.ai/conventions.md`: Ordnerstruktur, Namenskonventionen, Sprache von Code und Oberfläche, Umgang mit Secrets, Teststrategie (inkl. Regel: Test-Login nur auf Staging und lokal, nie in Produktion).
  - `.ai/architecture/README.md`: Überblick über die Komponenten und den Datenfluss.

  Danach eine Go/No-Go-Einschätzung am Ende von `.ai/tech-stack.md` ergänzen: Sind die Spikes T-005 und T-008 bis T-011 (lokal und im Smoketest T-014) bestanden?

  Abschließend Plan `.ai/feature-tasks/002-mcp-server.md` gegen die ADRs, das technische Datenmodell (`.ai/architecture/datenmodell.md`), das fachliche Datenmodell und die Projektnormen abgleichen. Veraltete Annahmen (z. B. zu Backend, Relationsarten, Rollen, Charakteren) werden als Liste mit Fundstelle in `.ai/tech-stack.md` unter *Abgleich Plan 002* festgehalten und dem Projektinhaber als Rückfrage vorgelegt. Plan `002` wird dabei nicht eigenmächtig geändert.
- Abhängigkeiten: T-002, T-003, T-004, T-005, T-006, T-008, T-009, T-010, T-011, T-014
- **Stopp bei No-Go (Rückfrage erforderlich):** Lautet die Einschätzung „No-Go“, pausiert `/plan-run` und legt dem Projektinhaber vor: die nicht bestandenen Spikes mit Ursache und einen Vorschlag, welche Aufgaben wiederholt werden sollen (z. B. „ADR-003 neu bewerten, danach T-009 und T-014 wiederholen“). Wiederholt werden nur die Aufgaben, die der Projektinhaber im Chat freigibt. Betrifft die Wiederholung ein ADR, gelten dessen Stopp und das *Vorgehen bei Architekturentscheidungen* erneut. Danach wird T-013 erneut durchgeführt.
- Abnahmekriterium: Alle drei Dateien existieren. Jede Technologie in `tech-stack.md` verweist auf ein ADR. `conventions.md` legt die Sprache der Oberfläche und des Codes ausdrücklich fest. Die Go/No-Go-Einschätzung nennt für jeden Spike „bestanden“ oder „nicht bestanden“ mit Begründung und endet mit „Go“ oder „No-Go“. Der Abschnitt *Abgleich Plan 002* existiert und listet jede gefundene Abweichung mit Fundstelle in Plan `002` und Bezug auf das betroffene ADR bzw. den Abschnitt des Datenmodells, oder vermerkt ausdrücklich „keine Abweichungen“.
