import { Pool } from "pg";

declare global {
  var __ludoPool: Pool | undefined;
}

function getConnectionString(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

export function getDb(): Pool {
  if (!globalThis.__ludoPool) {
    globalThis.__ludoPool = new Pool({
      connectionString: getConnectionString(),
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis.__ludoPool;
}
