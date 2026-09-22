/**
 * Applies pending *.sql files in src/db/migrations (or /app/migrations in Docker).
 * Already-applied files are recorded in schema_migrations and skipped.
 */

import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pathArg = process.argv.slice(2).find((a) => !a.startsWith("--"));

function resolveMigrationsDir() {
  if (pathArg) return resolve(pathArg);
  const devPath = join(__dirname, "../src/db/migrations");
  if (existsSync(devPath)) return devPath;
  return join(__dirname, "migrations");
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL ist nicht gesetzt — siehe .env.example");
  process.exit(1);
}

const MIGRATIONS_DIR = resolveMigrationsDir();
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = await sql`SELECT filename FROM schema_migrations ORDER BY filename`;
  const appliedSet = new Set(applied.map((r) => r.filename));

  const allFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = allFiles.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log("[migrate] Nichts zu tun — alle Migrationen sind angewendet.");
  } else {
    for (const file of pending) {
      const content = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      });
      console.log(`[migrate] Angewendet: ${file}`);
    }
    console.log(`[migrate] Fertig — ${pending.length} Migration(en) angewendet.`);
  }
} catch (err) {
  console.error("[migrate] Fehlgeschlagen:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await sql.end();
}
