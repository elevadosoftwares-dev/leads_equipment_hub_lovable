// Small query helpers on top of db.server.ts. Server-only.
import { request, sql } from "./db.server";

export type Params = Record<string, unknown>;

/** Binds @name parameters. Types are inferred from the JS values (string, number, boolean, Date, null). */
function bind(req: sql.Request, params: Params) {
  for (const [name, value] of Object.entries(params)) req.input(name, value ?? null);
  return req;
}

const GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
const LOCAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Makes FOR JSON output look like the API the UI was written against: ids in lower case and
 * DATETIME2 values (stored as UTC) marked with "Z". DATE columns already come back as "YYYY-MM-DD".
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => {
        if (typeof v === "string" && GUID.test(v)) return [key, v.toLowerCase()];
        if (typeof v === "string" && LOCAL_TIMESTAMP.test(v)) return [key, `${v}Z`];
        return [key, normalize(v)];
      }),
    );
  }
  return value;
}

/**
 * Runs a SELECT as `FOR JSON PATH, INCLUDE_NULL_VALUES` and returns the parsed rows. Nested
 * objects come from sub-queries, e.g.
 *   (SELECT s.id, s.name FROM dbo.sites s WHERE s.id = r.site_id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS site
 * wrapped in JSON_QUERY(...) so they are embedded as objects rather than strings.
 */
export async function selectJson<T>(query: string, params: Params = {}): Promise<T[]> {
  const req = bind(await request(), params);
  const { recordset } = await req.query(`${query} FOR JSON PATH, INCLUDE_NULL_VALUES`);
  // SQL Server splits long JSON results across several rows of one column.
  const json = recordset.map((row) => Object.values(row)[0] as string).join("");
  return json ? (normalize(JSON.parse(json)) as T[]) : [];
}

/** Like selectJson, for queries that return a single row (or none). */
export async function selectOneJson<T>(query: string, params: Params = {}): Promise<T | null> {
  return (await selectJson<T>(query, params))[0] ?? null;
}

/** Runs a statement with bound parameters and returns rows affected per statement. */
export async function execute(statement: string, params: Params = {}) {
  const req = bind(await request(), params);
  const result = await req.query(statement);
  return result;
}

// Table and column names below always come from server code, never from the client.

/** INSERTs the given columns and returns the new row's id. */
export async function insertRow(table: string, row: Params): Promise<string> {
  const cols = Object.keys(row);
  const { recordset } = await execute(
    `INSERT INTO dbo.${table} (${cols.join(", ")}) OUTPUT INSERTED.id VALUES (${cols.map((c) => `@${c}`).join(", ")})`,
    row,
  );
  return String(recordset[0]?.id ?? "").toLowerCase();
}

/** UPDATEs the given columns of one row. Throws when the row no longer exists. */
export async function updateRow(
  table: string,
  id: string,
  row: Params,
  extraSet = "",
): Promise<void> {
  const sets = Object.keys(row).map((c) => `${c} = @${c}`);
  if (extraSet) sets.push(extraSet);
  const { rowsAffected } = await execute(
    `UPDATE dbo.${table} SET ${sets.join(", ")} WHERE id = @__id`,
    { ...row, __id: id },
  );
  if (!rowsAffected[0]) throw new Error("This record no longer exists.");
}

export async function deleteRow(table: string, id: string): Promise<void> {
  await execute(`DELETE FROM dbo.${table} WHERE id = @id`, { id });
}
