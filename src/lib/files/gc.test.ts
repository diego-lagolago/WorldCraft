import { describe, expect, it } from "vitest";
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, type AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { FILE_REFERENCE_COLUMNS, files } from "@/db/schema";

function columnKey(column: AnyPgColumn): string {
  return `${getTableName(column.table as typeof files)}.${column.name}`;
}

/** Every Drizzle column with a foreign key to `files.id`. */
function schemaFileFkColumns(): AnyPgColumn[] {
  const columns: AnyPgColumn[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    for (const fk of getTableConfig(value).foreignKeys) {
      const ref = fk.reference();
      if (ref.foreignTable === files) {
        columns.push(...ref.columns);
      }
    }
  }
  return columns;
}

describe("FILE_REFERENCE_COLUMNS (APP-FILE-GC)", () => {
  it("covers every schema foreign key to files.id", () => {
    const fromSchema = schemaFileFkColumns().map(columnKey).sort();
    const fromGc = [...FILE_REFERENCE_COLUMNS].map(columnKey).sort();
    expect(fromGc).toEqual(fromSchema);
  });
});
