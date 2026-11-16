import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function makeClient() {
  // postgres.js chỉ kết nối khi có truy vấn đầu tiên, nên build không cần DATABASE_URL.
  // Neon pooled connection (PgBouncer) không hỗ trợ prepared statements.
  return postgres(process.env.DATABASE_URL ?? "postgres://localhost/missing-DATABASE_URL", {
    prepare: false,
    max: 5,
  });
}

const sql = globalForDb.sql ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export * from "./schema";
