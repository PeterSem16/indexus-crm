import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// PostgreSQL can terminate an idle connection during a database restart or
// maintenance operation. node-postgres emits that event on the pool; without
// a listener Node treats it as an unhandled EventEmitter error and exits the
// whole application. The dead client is discarded by pg-pool and the next
// query will establish a fresh connection.
pool.on("error", (error) => {
  console.error("[db] Idle PostgreSQL client error:", error.message);
});

export const db = drizzle(pool, { schema });
