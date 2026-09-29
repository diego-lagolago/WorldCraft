import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * Optimistic-lock condition for an MCP `stand`. Stands are millisecond ISO strings,
 * while `defaultNow()` stores microseconds, so the column is compared at millisecond precision.
 */
export function matchesExpectedUpdatedAt(column: AnyColumn, expected: Date | undefined): SQL[] {
  if (!expected) return [];
  return [sql`date_trunc('milliseconds', ${column}) = ${expected.toISOString()}::timestamptz`];
}
