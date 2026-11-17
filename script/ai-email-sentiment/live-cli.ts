/** Standalone operator tool: same preload/API/adapter as email.monitoring. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Client } from "pg";
import { parse } from "dotenv";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { createGatewayPilot, hash, PilotError } from "./gateway-client";
import { assertExistingRuntime, makePreflight, telemetryState } from "./live-preflight";
import { runSequentialRegression } from "./live-runner";
declare const SENTIMENT_OPERATOR_ENTRY: boolean;
const require = createRequire(path.join(process.cwd(), "package.json"));
const { readProductionSnapshot } = require(path.resolve("script/ai-email-monitoring-b1/b11-check.cjs"));
const APP = "/var/www/indexus-crm";
function readPrivate(file?: string) {
  if (!file) throw new PilotError("private_evidence_file_required");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) || stat.size > 65536)
      throw new PilotError("unsafe_evidence_file");
    return JSON.parse(fs.readFileSync(fd, "utf8"));
  } finally { fs.closeSync(fd); }
}
function output(file?: string) {
  if (!file) throw new PilotError("private_output_required");
  const parent = fs.lstatSync(path.dirname(path.resolve(file)));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() || (parent.mode & 0o077))
    throw new PilotError("private_output_directory_required");
  return fs.openSync(file, "wx", 0o600);
}
export async function main(argv = process.argv.slice(2)) {
  const command = argv.shift() ?? "prepare", args: Record<string, string> = {};
  while (argv.length) {
    const name = argv.shift()!, value = argv.shift();
    if (!["--window-file", "--monitor-file", "--output"].includes(name) || !value ||
      value.startsWith("--") || Object.hasOwn(args, name)) throw new PilotError("invalid_arguments");
    args[name] = value;
  }
  if (command === "prepare") return makePreflight({});
  if (!["preflight", "regress"].includes(command)) throw new PilotError("unknown_command");
  assertExistingRuntime(); // Before any network, config, credentials or production snapshot.
  const env = parse(fs.readFileSync(path.join(APP, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    throw new PilotError("database_configuration_conflict");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) throw new PilotError("existing_database_configuration_required");
  const snapshot = () => readProductionSnapshot({ Client, connectionString, catalog: Object.keys(AI_SERVICES) });
  const window = args["--window-file"] ? readPrivate(args["--window-file"]) : undefined;
  const monitor = async () => {
    try { return readPrivate(args["--monitor-file"]); } catch { return null; }
  };
  const client = createGatewayPilot();
  const before = await snapshot();
  let discovery = false;
  try { await client.inspect(); discovery = true; } catch { /* Fail closed, no retries. */ }
  const after = await snapshot(), baselineHash = hash(JSON.stringify(after));
  const preflight = { ...makePreflight({ discovery, routingUnchanged: hash(JSON.stringify(before)) === baselineHash,
    window, telemetry: await monitor() }), analyzerSha256: client.analyzerSha256,
    routingSnapshotSha256: baselineHash };
  if (command === "preflight") {
    if (args["--output"]) {
      const fd = output(args["--output"]);
      try { fs.writeSync(fd, client.stringifySafe(preflight) + "\n"); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
    }
    return preflight;
  }
  if (preflight.outcome !== "READY_FOR_ISOLATED_SEQUENCE")
    throw new PilotError("preflight_not_ready_no_inference");
  const fd = output(args["--output"]);
  const write = (value: unknown) => { fs.writeSync(fd, client.stringifySafe(value) + "\n"); fs.fsyncSync(fd); };
  const controller = new AbortController(), stop = () => controller.abort();
  const expires = Date.parse(preflight.windowEndsAt!);
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    // Same corpus/window/source can never be silently re-run in this private evidence directory.
    const runId = hash(JSON.stringify({ corpus: preflight.corpusSha256, window, analyzer: client.analyzerSha256 }));
    const marker = path.join(path.dirname(path.resolve(args["--output"]!)), `sentiment-${runId}.started`);
    const claimed = fs.openSync(marker, "wx", 0o600);
    try { fs.writeSync(claimed, new Date().toISOString() + "\n"); fs.fsyncSync(claimed); }
    finally { fs.closeSync(claimed); }
    write({ kind: "preflight", preflight });
    const observe = async () => {
      const end = Date.now() + 5 * 60_000;
      let source: string | null = null;
      while (Date.now() < end) {
        const state = await monitor();
        if (controller.signal.aborted || Date.now() >= expires || !telemetryState(state).safe) return false;
        if (source && state.sourceReference !== source) return false;
        source = state.sourceReference;
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, end - Date.now())));
      }
      return true;
    };
    if (!await observe() || hash(JSON.stringify(await snapshot())) !== baselineHash) {
      const blocked = { outcome: "BLOCKED", inferenceAttempts: 0, reason: "baseline_not_verified" };
      write({ kind: "summary", ...blocked }); return blocked;
    }
    const report = await runSequentialRegression({ client, preflight, approved: true, monitor,
      readRoutingSnapshot: snapshot, signal: controller.signal,
      onCase: async value => write({ kind: "case", value }) });
    const postObservationComplete = await observe();
    const routingUnchanged = hash(JSON.stringify(await snapshot())) === baselineHash;
    const summary = { ...report, postObservationComplete, routingUnchanged };
    write({ kind: "summary", ...summary }); return summary;
  } catch {
    const blocked = { outcome: "REVIEW_REQUIRED", inferenceAttempts: client.attempts(),
      reason: "operator_run_stopped_no_retry", productionImpact: "NOT_VERIFIED" };
    write({ kind: "summary", ...blocked }); return blocked;
  } finally {
    client.disarm(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    fs.closeSync(fd);
  }
}
if (typeof SENTIMENT_OPERATOR_ENTRY !== "undefined" && SENTIMENT_OPERATOR_ENTRY) {
  main().then(value => {
    console.log(JSON.stringify(value, null, 2));
    if (value.outcome !== "READY_FOR_ISOLATED_SEQUENCE") process.exitCode = 2;
  }).catch(error => {
    console.log(JSON.stringify({ outcome: "BLOCKED", inferenceAllowed: false,
      code: error instanceof PilotError ? error.message : "local_check_failed" }));
    process.exitCode = 2;
  });
}
