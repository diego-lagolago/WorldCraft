# Editor-Spike (T-005)

Eigenständige Mini-App für den Artikel-Editor (TipTap), unabhängig vom späteren Next.js-Grundgerüst.

```bash
cd spikes/editor
npm install
npm test
npm run dev
```

Öffnet den Editor mit genau den in Plan `001` erlaubten Formatierungen.

## Abnahme

1. Werkzeugleiste: H2, H3, fett, kursiv, unterstrichen, durchgestrichen, Aufzählung, nummeriert, Zitat, Trennlinie, Link. Kein Bild, keine Tabelle.
2. Einfügen: echten Inhalt mit Bild/Tabelle aus einer Webseite oder Word einfügen, oder den Button **Einfügen simulieren**. Es darf kein Bild und keine Tabelle erscheinen, der Text bleibt.
3. `@schleim` schlägt **Gottschleim** (Artikel · Ort) und **Töte den Gottschleim** (Quest) vor. **Speichern** listet die Inhaltsverweise (Art + ID).
4. **JSON neu laden** stellt denselben Inhalt wieder her.
5. Haken **Erwähnungen aktiv** aus: `@` öffnet keine Liste (Weltbeschreibung).
