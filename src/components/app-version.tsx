import packageJson from "../../package.json";

/** Global app version badge (package.json). Non-interactive, bottom-right. */
export function AppVersion() {
  return (
    <p className="app-version" aria-hidden="true">
      v{packageJson.version}
    </p>
  );
}
