/** HTML of the upload page (011 T-008); kept apart from the route's checks (011 Review 2 CR-003). */

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function uploadPageHtml(input: {
  label: string;
  title: string;
  expiresAt: Date;
  maxMb: number;
  error?: string;
  success?: boolean;
  receipt?: string;
}) {
  const expiry = input.expiresAt.toLocaleString("de-DE", { timeZone: "Europe/Vienna" });
  const body = input.success
    ? `<p class="ok">Bild hochgeladen. Du kannst dieses Fenster schließen.</p>${
      input.receipt ? `<pre>${escapeHtml(input.receipt.split("\n").slice(1).join("\n"))}</pre>` : ""
    }`
    : `
      <p>Ziel: <strong>${escapeHtml(input.label)}</strong> – ${escapeHtml(input.title)}</p>
      <p>Gültig bis: ${escapeHtml(expiry)}</p>
      <p>Erlaubt: JPEG, PNG oder WebP, höchstens ${input.maxMb}&nbsp;MB.</p>
      ${input.error ? `<p class="err">${escapeHtml(input.error)}</p>` : ""}
      <form method="post" enctype="multipart/form-data">
        <label for="datei">Bilddatei</label>
        <input id="datei" name="datei" type="file" accept="image/jpeg,image/png,image/webp" required />
        <button type="submit">Hochladen</button>
      </form>`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorldCraft Upload</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 1.25rem; background: #e7e5e4; color: #1c1917; }
    main { max-width: 28rem; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    label { display: block; margin: 1rem 0 0.35rem; font-weight: 600; }
    pre { white-space: pre-wrap; font: inherit; background: #fff; padding: 0.75rem; border-radius: 0.5rem; }
    input[type=file] { width: 100%; }
    button { margin-top: 1rem; width: 100%; padding: 0.75rem 1rem; font-size: 1rem; border: 0; border-radius: 0.5rem; background: #1c1917; color: #fff; }
    .err { color: #9f1239; }
    .ok { color: #166534; }
  </style>
</head>
<body>
  <main>
    <h1>Bild hochladen</h1>
    ${body}
  </main>
</body>
</html>`;
}
