import { getAuthUrl, isMcpEnabled } from "@/lib/env";

export default function McpHelpPage() {
  const endpoint = `${getAuthUrl()}/mcp`;
  const enabled = isMcpEnabled();

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>WorldCraft mit einer KI verbinden</h1>
      <div className="card stack">
        <p>
          Über MCP kann eine verbundene KI die Inhalte lesen und – mit deiner Zustimmung – anlegen und ändern, die dein WorldCraft-Konto in ausdrücklich freigegebenen Welten sehen bzw. schreiben darf. Gelöscht wird nie.
        </p>
        <ol className="stack" style={{ paddingLeft: 20 }}>
          <li>Du brauchst ein KI-Konto, das eigene MCP-/Custom-Connector-Server unterstützt. Öffne dort die Einstellungen für Connector-Server.</li>
          <li>Füge als Server-Adresse <code>{endpoint}</code> ein.</li>
          <li>Starte die Anmeldung und bestätige die Berechtigungsabfrage mit deinem WorldCraft-Konto. Für Schreiben wählst du den Scope „Lesen und Schreiben“.</li>
          <li>Aktiviere in der gewünschten Welt unter Welt-Einstellungen „KI-Zugriff (MCP) erlauben“.</li>
          <li>Frage die KI zunächst nach deinen verfügbaren Welten und nenne bei weiteren Fragen die passende Welt.</li>
        </ol>
        <p>
          In Claude Code kannst du die Verbindung mit <code>claude mcp add --transport http worldcraft {endpoint}</code> anlegen und anschließend den Browser-Login abschließen.
        </p>

        <h2 style={{ fontSize: 18, marginTop: 8 }}>Was die KI schreiben darf</h2>
        <p>
          Mit Schreibzugriff darf die KI Artikel, Quests, Kapitel, den Quest-Notizblock, Monster und Universen anlegen und ändern sowie Relationen und Sichtbarkeit setzen – immer im Rahmen deiner Rechte in der App. Pins, Charaktere, Marker, Karten und Kartenbilder, Tagebuch, Chat, Mitglieder und Einladungen bleiben ausgeschlossen. Einstellungen (Welt-Freigabe, Hauptschalter, verbundene Anwendungen) bleiben der App vorbehalten.
        </p>
        <p>
          Neue Inhalte starten mit der Sichtbarkeit <strong>nur ich</strong>. Ausnahme: Universen starten mit <strong>nur Spielleitung</strong>, wie in der App. Eine andere Sichtbarkeit setzt die KI nur auf ausdrücklichen Wunsch und nur nach Bestätigung.
        </p>
        <p>
          Änderungen an bestehendem Inhalt, neue Relationen und Sichtbarkeitswechsel brauchen eine Bestätigung: Die KI zeigt dir zuerst eine Vorschau; erst wenn du zustimmst, führt sie die Änderung aus. So bleibt nichts unbemerkt überschrieben. Claude zeigt dir vorher, was sich ändert (vorher → nachher), und danach, was gespeichert wurde. Nur leere Stub-Artikel sind davon ausgenommen; Bild-Ersetzen braucht ebenfalls eine Bestätigung.
        </p>
        <p>
          Für Bilder erzeugt die KI einen einmaligen Upload-Link (15 Minuten, einmal nutzbar). In Claude Code kann die KI die Datei selbst über den Link hochladen; in claude.ai öffnest du den Link im Browser und wählst die Datei dort. Die KI löscht weder Inhalte noch Relationen, Kapitel oder Bilder.
        </p>

        <p className="small muted">
          Die KI sieht genau das, was du in der App siehst, in Welten, die der Game Master freigegeben hat. Als Spielleitung schließt das auch Inhalte „nur Spielleitung“ sowie eigene Inhalte „nur ich“ ein. Nicht freigegebene Welten, Kartenbilder und Koordinaten bleiben ausgeschlossen.
        </p>
        <p className="small muted">
          Chat und Tagebücher werden nie über MCP übertragen. Du kannst die Verbindung jederzeit im Weltmenü deiner Welt unter „Verbundene Anwendungen“ widerrufen; die KI kann danach nicht mehr auf deine Welt zugreifen.
        </p>
        {!enabled ? <p className="error-text">Die MCP-Schnittstelle ist auf diesem Server momentan nicht aktiviert. Bitte wende dich an die Administration.</p> : null}
      </div>
    </>
  );
}
