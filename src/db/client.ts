import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ist nicht gesetzt — siehe .env.example");
}

declare global {
  var __postgres_client__: ReturnType<typeof postgres> | undefined;
}

function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured > 0) return configured;
  if (process.env.NODE_ENV === "production") return 10;
  return 1;
}

const client =
  global.__postgres_client__ ??
  postgres(process.env.DATABASE_URL, {
    max: poolMax(),
  });

if (process.env.NODE_ENV !== "production") {
  global.__postgres_client__ = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
/** Connection bound to an open `db.transaction` callback (CR-006). */
export type DbTx = Parameters<Parameters<DB["transaction"]>[0]>[0];
