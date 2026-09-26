import { getAuthUrl, isMcpEnabled } from "@/lib/env";

export default function McpHelpPage() {
  const endpoint = `${getAuthUrl()}/mcp`;
  const enabled = isMcpEnabled();

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>WorldCraft mit einer KI verbinden</h1>
      <div className="card stack">
        <p>
          Über MCP kann eine verbundene KI nur die Inhalte lesen, die dein WorldCraft-Konto in ausdrücklich freigegebenen Welten sehen darf. Sie kann keine Inhalte verändern.
        </p>
        <ol className="stack" style={{ paddingLeft: 20 }}>
          <li>Du brauchst ein KI-Konto, das eigene MCP-/Custom-Connector-Server unterstützt. Öffne dort die Einstellungen für Connector-Server.</li>
          <li>Füge als Server-Adresse <code>{endpoint}</code> ein.</li>
          <li>Starte die Anmeldung und bestätige die Berechtigungsabfrage mit deinem WorldCraft-Konto.</li>
          <li>Aktiviere in der gewünschten Welt unter Welt-Einstellungen „KI-Zugriff (MCP) erlauben“.</li>
          <li>Frage die KI zunächst nach deinen verfügbaren Welten und nenne bei weiteren Fragen die passende Welt.</li>
        </ol>
        <p>
          In Claude Code kannst du die Verbindung mit <code>claude mcp add --transport http worldcraft {endpoint}</code> anlegen und anschließend den Browser-Login abschließen.
        </p>
        <p className="small muted">
          Beim ersten Verbinden sieht die KI nur Weltname, deine Rolle und deine eigenen Charaktere. Nicht freigegebene Welten, unveröffentlichte Inhalte, Kartenbilder und Koordinaten bleiben ausgeschlossen.
        </p>
        <p className="small muted">
          Chat und Tagebücher werden nie über MCP übertragen. Du kannst die Verbindung jederzeit in den WorldCraft-Kontoeinstellungen unter „Verbundene Anwendungen“ widerrufen; die KI kann danach nicht mehr auf deine Welt zugreifen.
        </p>
        {!enabled ? <p className="error-text">Die MCP-Schnittstelle ist auf diesem Server momentan nicht aktiviert. Bitte wende dich an die Administration.</p> : null}
      </div>
    </>
  );
}
