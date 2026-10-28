// SQL Server connection pool. Server-only: load inside server handlers with
// `await import("@/server/db.server")` so the driver never reaches the browser bundle.
import sql from "mssql";
// Bundled into the server build as text, so the schema ships with the app.
import schemaSql from "../../database/schema.sql?raw";

export { sql };

/**
 * Parses a Prisma-style SQL Server URL:
 *   sqlserver://HOST[\INSTANCE][:PORT];database=DB;user=USER;password=PASS;encrypt=true;trustServerCertificate=true
 */
function parseDatabaseUrl(url: string): sql.config {
  const match = /^sqlserver:\/\/([^;]+)(;.*)?$/i.exec(url.trim());
  if (!match) throw new Error("DATABASE_URL must start with sqlserver://");

  let host = match[1] ?? "";
  const config: sql.config = {
    server: "",
    options: {},
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };

  const portMatch = /:(\d+)$/.exec(host);
  if (portMatch) {
    config.port = Number(portMatch[1]);
    host = host.slice(0, -portMatch[0].length);
  }
  const slash = host.indexOf("\\");
  if (slash !== -1) {
    config.options!.instanceName = host.slice(slash + 1);
    host = host.slice(0, slash);
  }
  config.server = host;

  const params = new Map<string, string>();
  for (const part of (match[2] ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  const flag = (key: string, fallback: boolean) => {
    const value = params.get(key);
    return value === undefined ? fallback : value.toLowerCase() === "true";
  };

  const database = params.get("database") ?? params.get("initial catalog");
  const user = params.get("user") ?? params.get("username") ?? params.get("user id");
  const password = params.get("password");
  if (database) config.database = database;
  if (user) config.user = user;
  if (password !== undefined) config.password = password;
  config.options!.encrypt = flag("encrypt", true);
  config.options!.trustServerCertificate = flag("trustservercertificate", false);
  return config;
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Missing DATABASE_URL environment variable.");
    poolPromise = connectAndMigrate(parseDatabaseUrl(url)).catch((error) => {
      poolPromise = undefined;
      console.error("[db] Could not connect to SQL Server:", error);
      throw new Error("Could not connect to the database.");
    });
  }
  return poolPromise;
}

/**
 * Connects to the configured database, creating it first if it does not exist, then applies
 * database/schema.sql (idempotent). Pointing DATABASE_URL at a new server or database name
 * therefore needs no manual setup.
 */
async function connectAndMigrate(config: sql.config): Promise<sql.ConnectionPool> {
  if (!config.database) throw new Error("DATABASE_URL has no database=... name.");

  // Migrate over a dedicated single connection, then close it: session settings in the script
  // (e.g. SET NOCOUNT ON, which zeroes rowsAffected) must not leak into the app's pool.
  const migrationConfig = { ...config, pool: { max: 1, min: 0 } };
  let migrator: sql.ConnectionPool;
  try {
    migrator = await new sql.ConnectionPool(migrationConfig).connect();
  } catch (error) {
    // A missing database surfaces only as a generic "Login failed", so ask master whether it
    // exists. If it does, the login failure was real (e.g. wrong password): rethrow it.
    if ((error as { code?: string })?.code !== "ELOGIN") throw error;
    if (!(await createDatabaseIfMissing(config))) throw error;
    migrator = await new sql.ConnectionPool(migrationConfig).connect();
  }
  try {
    for (const batch of schemaSql.split(/^\s*GO\s*$/im)) {
      if (batch.trim()) await migrator.request().batch(batch);
    }
  } finally {
    await migrator.close();
  }

  const pool = await new sql.ConnectionPool(config).connect();
  console.log(`[db] Connected to "${config.database}" on ${config.server}; schema is up to date.`);
  return pool;
}

/** Returns true if the database was missing and has now been created. */
async function createDatabaseIfMissing(config: sql.config): Promise<boolean> {
  const master = await new sql.ConnectionPool({ ...config, database: "master" }).connect();
  try {
    const { recordset } = await master
      .request()
      .input("name", sql.NVarChar(128), config.database)
      .query<{ created: number }>(
        `IF DB_ID(@name) IS NOT NULL
           SELECT 0 AS created;
         ELSE
         BEGIN
           DECLARE @stmt NVARCHAR(400) = N'CREATE DATABASE ' + QUOTENAME(@name);
           EXEC (@stmt);
           SELECT 1 AS created;
         END`,
      );
    const created = recordset[0]?.created === 1;
    if (created) console.log(`[db] Database "${config.database}" did not exist - created it.`);
    return created;
  } finally {
    await master.close();
  }
}

export async function request(): Promise<sql.Request> {
  return (await getPool()).request();
}

/** SQL Server error numbers for unique constraint / primary key violations. */
export function isDuplicateKeyError(error: unknown): boolean {
  const number = (error as { number?: number } | null)?.number;
  return number === 2627 || number === 2601;
}
