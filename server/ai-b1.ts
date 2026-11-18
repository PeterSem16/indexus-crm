// Separate, explicit B1 entry. Never import server/index or production routes.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pg from "pg";
import policy from "../ops/ai-jobs-b1/policy.cjs";
import { assertPrivateSpace } from "../ops/ai-jobs-b1/space-policy.cjs";

async function main() {
  const root = process.env.INDEXUS_B1_ROOT;
  if (!root) throw Error("B1_LAUNCHER_REQUIRED");
  policy.assert(root === path.join(os.homedir(), "INDEXUS-AI-B1") &&
    fs.realpathSync(process.cwd()) === path.join(root, "source") &&
    os.hostname().split(".")[0].toUpperCase() === "CORPCRM01" && process.getuid!() === 1001 &&
    !process.env.REPL_ID && !process.env.REPLIT_DEV_DOMAIN &&
    process.env.INDEXUS_AI_ROUTER_MODE === "routed" &&
    process.env.INDEXUS_AI_GATEWAY_ENABLED === "true", "B1_LAUNCHER_REQUIRED");
  const config = policy.readPrivate(root);
  assertPrivateSpace(root);
  const probe = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try { await probe.connect(); await policy.assertDatabase(probe, config); } finally { await probe.end(); }
  // No application modules/pools are loaded until the actual DB identity passes.
  const { pool } = await import("./db");
  const { runB1 } = await import("./lib/ai-b1/run");
  await runB1(pool, config, process.argv[2]);
}
main().catch(error => { console.error(policy.safeError(error)); process.exitCode = 1; });
