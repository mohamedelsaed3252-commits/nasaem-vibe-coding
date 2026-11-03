import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
export const isLocalMode = process.env.NASAEM_LOCAL_MODE === "true";

if (!isLocalMode && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dataDir =
  process.env.NASAEM_DATA_DIR ?? path.resolve(process.cwd(), "nasaem-data");
const localClient = isLocalMode ? new PGlite(dataDir) : null;
export const pool = isLocalMode
  ? null
  : new Pool({ connectionString: process.env.DATABASE_URL });
const localDatabase = localClient
  ? drizzlePglite(localClient, { schema })
  : null;
const postgresDatabase = pool ? drizzlePostgres(pool, { schema }) : null;

export const db = (localDatabase ?? postgresDatabase)! as NonNullable<
  typeof postgresDatabase
>;

export async function initializeDatabase(): Promise<void> {
  if (!localClient || !localDatabase) return;
  await localClient.waitReady;
  await migratePglite(localDatabase, {
    migrationsFolder:
      process.env.NASAEM_MIGRATIONS_DIR ??
      path.resolve(process.cwd(), "lib/db/drizzle"),
  });
}

export * from "./schema";
