import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { parseSettings } from "../../server/lib/ai/settings-policy";
import { THREE_SERVICE_PROFILES } from "../../server/lib/ai/three-services-profile";

const fail = (code: string): never => { throw Error(code); };
export const hash = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
/** Preserve current monitoring/sentiment routes. Never impose the historical B4 "all OpenAI" state. */
export function configurationSnapshot(row: any) {
  if (!row || !Number.isSafeInteger(row.version) || row.version < 1)
    fail("THREE_CONFIGURATION_UNAVAILABLE");
  const value = parseSettings(row.value);
  const routes = Object.keys(AI_SERVICES).sort().map(id => ({
    id, ...(value.routes[id] ?? { provider: "openai", model: null, enabled: true }),
  }));
  for (const id of Object.keys(THREE_SERVICE_PROFILES)) {
    const route = routes.find(r => r.id === id)!;
    if (route.provider !== "openai" || !route.enabled) fail("THREE_TARGET_MUST_REMAIN_OPENAI");
  }
  return {
    version: row.version, gatewayEnabled: value.gateway.enabled, total: routes.length,
    openai: routes.filter(r => r.provider === "openai").length,
    internal: routes.filter(r => r.provider === "internal").length,
    enabled: routes.filter(r => r.enabled).length,
    routesSha256: hash(JSON.stringify(routes)),
    // Hash the original persisted representation, not the normalized parser result.
    fullConfigurationSha256: hash(JSON.stringify(stable(row.value))),
  };
}
export async function readCurrentSnapshot(connectionString: string, ClientType: typeof Client = Client) {
  const db = new ClientType({
    connectionString, application_name: "indexus-three-services-read-only",
    connectionTimeoutMillis: 8000,
    options: "-c default_transaction_read_only=on -c statement_timeout=8000",
  });
  try {
    await db.connect();
    await db.query("BEGIN READ ONLY");
    if ((await db.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on")
      fail("THREE_DATABASE_NOT_READ_ONLY");
    const result = await db.query("SELECT version,value FROM ai_router_configuration WHERE singleton=true");
    if (result.rows.length !== 1) fail("THREE_CONFIGURATION_UNAVAILABLE");
    return configurationSnapshot(result.rows[0]);
  } finally {
    await db.query("ROLLBACK").catch(() => {});
    await db.end().catch(() => {});
  }
}

/** Only recover the known original runner's zero-byte, pre-first-save failure.
 * That pinned runner synchronously saved a nonempty report before any Gateway call.
 * Do not generalize this proof to interrupted/nonempty/unknown runs.
 */
const KNOWN_OLD_SOURCES: Readonly<Record<string, string>> = Object.freeze({
  "run.ts": "1aa51db528aa931698d0ab106ef5f594ef2566c5c5bec442887f10b5438a721f",
  "source.ts": "6efa9e3c0847e2b0b2233fedc609df354770281d37029573fc1fd4591fd76974",
});
export function reserveKnownPreInferenceRecovery(
  app: string, output: string, uid: number,
  /** Unit fixtures only; the operator CLI always uses the pinned original hashes. */
  expectedSources = KNOWN_OLD_SOURCES,
) {
  const marker = path.join(app, "data/internal-ai-three-services-81.started");
  const privateFile = (file: string) => {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077))
      fail("THREE_RECOVERY_UNSAFE_FILE");
    return st;
  };
  const originalMarker = fs.readFileSync(marker);
  privateFile(marker);
  let claimed: any;
  try { claimed = JSON.parse(originalMarker.toString("utf8")); }
  catch { fail("THREE_RECOVERY_INVALID_ORIGINAL_MARKER"); }
  if (claimed.output !== output || typeof claimed.startedAt !== "string")
    fail("THREE_RECOVERY_MARKER_OUTPUT_MISMATCH");
  if (privateFile(output).size !== 0 || fs.existsSync(output + ".pending"))
    fail("THREE_RECOVERY_NOT_PROVEN_BEFORE_FIRST_CASE");
  for (const [file, expected] of Object.entries(expectedSources)) {
    const source = path.join(path.dirname(output), "source/script/ai-three-services", file);
    const st = fs.lstatSync(source);
    if (!st.isFile() || st.isSymbolicLink() || st.uid !== uid ||
        hash(fs.readFileSync(source)) !== expected)
      fail("THREE_RECOVERY_ORIGINAL_RUNNER_NOT_VERIFIED");
  }
  // Keep both the original marker and empty evidence. A separate atomic claim
  // prevents parallel/repeated recoveries, even under a different tool directory.
  const receipt = {
    kind: "KNOWN_ZERO_BYTE_PRE_INFERENCE_RECOVERY", recoveredAt: new Date().toISOString(),
    originalMarkerSha256: hash(originalMarker), originalOutputSha256: hash(""),
    originalSources: expectedSources, priorInferenceAttempts: 0,
  };
  const fd = fs.openSync(marker + ".recovery-started", "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(receipt) + "\n"); }
  finally { fs.closeSync(fd); }
  fs.copyFileSync(output, output + ".empty-before-recovery", fs.constants.COPYFILE_EXCL);
  return receipt;
}

/** Never print arbitrary provider messages, paths, credentials, stack or SQL. */
export function safeFailureCode(error: any) {
  const message = typeof error?.message === "string" ? error.message : "";
  if (/^(THREE_|B1_|B4_)[A-Z0-9_]+$/.test(message)) return message;
  const codes = ["ENOENT", "EACCES", "EEXIST", "ENOTDIR", "ENOSPC", "EROFS",
    "ECONNREFUSED", "ETIMEDOUT", "28P01", "28000", "3D000", "42P01", "42703", "42501",
    "53300", "57P03", "gateway_config_invalid", "route_invalid", "settings_invalid"];
  return codes.includes(error?.code) ? error.code : "THREE_UNCLASSIFIED_STARTUP_FAILURE";
}
