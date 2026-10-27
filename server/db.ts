import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionOptions = { connectionString: process.env.DATABASE_URL };
export const pool = new Pool(connectionOptions);

// Admission locks outlive individual queries. They MUST NOT occupy the query
// pool: a pool-capacity burst of handlers would hold every connection while
// waiting for those same connections to run its business queries.
export const callbackAdmissionPool = new Pool({
  ...connectionOptions,
  max: 4,
  connectionTimeoutMillis: 10000,
  application_name: "indexus-callback-admission",
});
callbackAdmissionPool.on("error", () => {
  console.error("[db] Callback admission connection lost");
});

// PostgreSQL can terminate an idle connection during a database restart or
// maintenance operation. node-postgres emits that event on the pool; without
// a listener Node treats it as an unhandled EventEmitter error and exits the
// whole application. The dead client is discarded by pg-pool and the next
// query will establish a fresh connection.
pool.on("error", (error) => {
  console.error("[db] Idle PostgreSQL client error:", error.message);
});

export const db = drizzle(pool, { schema });
