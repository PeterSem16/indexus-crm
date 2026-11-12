"use strict";
// This module has no filesystem writer, PM2 mutator, inference or admin API writer.
const https = require("node:https");
const path = require("node:path");
const H = require("./ai-gateway-host.cjs");
const P = require("./ai-gateway-policy.cjs");
const MODEL = "indexus-document-audio:latest";
const ENDPOINTS = ["health/ready", "v1/models", "indexus/v1/capabilities"];
const LIMIT = 256 * 1024;
function discovery(models, capabilities) {
  const record = v => !!v && typeof v === "object" && !Array.isArray(v);
  const id = v => typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(v);
  P.ensure(record(models) && models.object === "list" && Array.isArray(models.data) &&
    models.data.every(v => record(v) && id(v.id)) &&
    new Set(models.data.map(v => v.id)).size === models.data.length, "GATEWAY_MODELS_CONTRACT_INVALID");
  P.ensure(record(capabilities) && capabilities.apiVersion === "1" && Array.isArray(capabilities.models),
    "GATEWAY_CAPABILITIES_CONTRACT_INVALID");
  const seen = new Set();
  for (const m of capabilities.models) {
    P.ensure(record(m) && id(m.id) && id(m.revision) && !seen.has(m.id) &&
      ["operations", "inputModalities", "outputFormats"].every(k =>
        Array.isArray(m[k]) && m[k].every(v => typeof v === "string")) &&
      typeof m.streaming === "boolean" &&
      [m.maxInputTokens, m.maxOutputTokens].every(v => v == null || (Number.isSafeInteger(v) && v > 0)),
    "GATEWAY_CAPABILITIES_CONTRACT_INVALID");
    seen.add(m.id);
  }
  const model = capabilities.models.find(m => m.id === MODEL);
  P.ensure(models.data.some(m => m.id === MODEL) && model &&
    model.operations.includes("chat.completions") && model.inputModalities.includes("text") &&
    model.outputFormats.includes("text") && model.outputFormats.includes("json_object"),
  "GATEWAY_REQUIRED_MODEL_OR_FORMAT_UNAVAILABLE");
  return { model: MODEL, advertisedFormats: ["text", "json_object"], apiVersion: "1",
    inferenceTested: false, strictJSONSchemaVerified: false };
}
function getJSON(endpoint, token, transport = https) {
  P.ensure(ENDPOINTS.includes(endpoint), "GATEWAY_ENDPOINT_FORBIDDEN");
  P.ensure(/^[\x21-\x7e]{16,8192}$/.test(token), "TOKEN_FORMAT_REQUIRES_REVIEW");
  return new Promise((resolve, reject) => {
    let done = false, timer, req;
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(timer);
      if (error) { req?.destroy(); reject(error); } else resolve(value);
    };
    const fail = code => { const e = Error(code); e.operatorCode = code; finish(e); };
    try {
      req = transport.request(new URL(endpoint, "https://ai.cordbloodcenter.com/gateway/"), {
        method: "GET", agent: false, rejectUnauthorized: true, minVersion: "TLSv1.2",
        headers: { authorization: "Bearer " + token, accept: "application/json" },
      }, response => {
        response.on("error", () => fail("GATEWAY_RESPONSE_FAILED"));
        response.on("aborted", () => fail("GATEWAY_RESPONSE_FAILED"));
        if (response.statusCode !== 200) {
          response.resume();
          return fail(Number.isInteger(response.statusCode) ?
            "GATEWAY_HTTP_" + response.statusCode : "GATEWAY_HTTP_INVALID");
        }
        let size = 0; const chunks = [];
        response.on("data", chunk => {
          size += chunk.length;
          if (size > LIMIT) { fail("GATEWAY_RESPONSE_TOO_LARGE"); response.destroy(); }
          else chunks.push(Buffer.from(chunk));
        });
        response.on("end", () => {
          if (done) return;
          if (endpoint === "health/ready") return finish(null, null);
          if (!String(response.headers["content-type"] || "").toLowerCase().includes("application/json"))
            return fail("GATEWAY_CONTENT_TYPE_INVALID");
          try { finish(null, JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
          catch { fail("GATEWAY_JSON_INVALID"); }
        });
      });
      req.on("error", () => fail("GATEWAY_TLS_OR_NETWORK_FAILED"));
      timer = setTimeout(() => fail("GATEWAY_TIMEOUT"), 15000);
      req.end();
    } catch { fail("GATEWAY_TLS_OR_NETWORK_FAILED"); }
  });
}
async function run(options) {
  const { sourceRoot, sources } = options;
  const h = options.host || H, p = options.policy || P, get = options.get || getJSON;
  const report = { status: "BLOCKED", scope: "PREFLIGHT_ONLY_AWAITING_EXECUTION_APPROVAL",
    productionChanges: false, restarts: 0, gatewayGETRequests: 0, inferenceRequests: 0,
    tokenPrinted: false, backupCreated: false, rollbackExecuted: false,
    targetAchieved: false, toolDirectory: sourceRoot, checks: {} };
  let stage = "hostAndBaseline";
  try {
    const before = await h.preflight();
    const rows = h.rpc(before.pm2, "list"), row = h.application(rows);
    p.ensure(row.pid === p.C.initialPID && !row.pm2_env.node_args?.length, "LIVE_PM2_BASELINE_CHANGED");
    const managed = { ...row.pm2_env, ...row.pm2_env.env };
    p.ensure(managed.OPENAI_API_KEY === before.env.OPENAI_API_KEY &&
      managed.DATABASE_URL === before.env.DATABASE_URL, "LIVE_PM2_ENVIRONMENT_DIFFERS");
    p.assertNoToken(rows, "unused-synthetic-token-marker");
    report.checks[stage] = { passed: true, pm2Version: before.pm2.version,
      nodeVersion: p.C.nodeVersion, processOnline: true, gatewayEnabledInINDEXUS: false };
    stage = "all65Routes";
    const ids = [...h.file(p.C.root + "/server/lib/ai/service-catalog.ts").bytes.toString()
      .matchAll(/^\s*"([a-z0-9_.]+)":\s*"/gm)].map(m => m[1]);
    p.ensure(ids.length === 65 && new Set(ids).size === 65, "AI_CATALOG_CHANGED");
    p.ensure(h.file(p.C.root + "/server/config/ai-routing.ts").bytes.toString()
      .includes("AI_ROUTING_OVERRIDES: AIRoutingOverrides = Object.freeze({})"), "STATIC_AI_OVERRIDES_CHANGED");
    p.assertRoutes(before.ai);
    report.checks[stage] = { passed: true, openai: 65, internal: 0, modelOverrides: 0,
      providerCallsExecuted: false, routes: ids.map(service => ({ service, provider: "openai", modelOverride: false })) };
    stage = "backupAndRollbackPrerequisites";
    h.disk(); h.noLinks(p.C.backupRoot);
    const existing = h.fileProfile ? h.fileProfile(p.C.backupRoot) : (() => {
      const fs = require("node:fs"), s = fs.lstatSync(p.C.backupRoot, { throwIfNoEntry: false });
      if (!s) return null;
      return { uid: s.uid, gid: s.gid, mode: s.mode & 0o7777, directory: s.isDirectory() };
    })();
    if (existing) {
      p.ensure(existing.directory && existing.uid === 0 && existing.gid === 0 && existing.mode === 0o700,
        "UNSAFE_BACKUP_ROOT");
      h.aclAbsent([p.C.backupRoot]);
    }
    const lock = h.optionalFile ? h.optionalFile(p.C.backupRoot + "/operation.lock") :
      h.file(p.C.backupRoot + "/operation.lock", true);
    p.ensure(!lock, "GATEWAY_OPERATION_LOCKED");
    for (const name of sources) {
      h.file(path.join(sourceRoot, name));
      h.command("/usr/bin/node", ["--check", path.join(sourceRoot, name)]);
    }
    const loaderCases = p.verifyLoader(h.file(path.join(sourceRoot, "ops/ai-gateway/preload.cjs")).bytes.toString());
    h.command("systemd-analyze", ["--version"]);
    report.checks[stage] = { passed: true, approvedDisk: "/dev/sdb1",
      sourcesPresentAndSyntaxChecked: sources.length, loaderSyntheticCases: loaderCases.length,
      rollbackBundleAvailable: true, actualBackupVerified: false, actualRollbackTested: false,
      filesystemWriteProbePerformed: false };
    stage = "tokenAndGateway";
    const original = h.file(p.C.token);
    p.ensure(original.uid === 0 && original.gid === 0 && original.mode === 0o600, "TOKEN_PERMISSIONS_CHANGED");
    const token = original.bytes.toString("utf8").replace(/\r?\n$/, "");
    p.ensure(/^[\x21-\x7e]{16,8192}$/.test(token), "TOKEN_FORMAT_REQUIRES_REVIEW");
    const responses = [];
    for (const endpoint of ENDPOINTS) {
      report.checks[stage] = { passed: false, endpoint };
      report.gatewayGETRequests++;
      responses.push(await get(endpoint, token));
    }
    const gateway = discovery(responses[1], responses[2]);
    report.checks[stage] = { passed: true, TLSCertificateVerified: true, redirectsFollowed: false,
      tokenPermissionsVerified: true, endpointsHTTP200: ENDPOINTS, ...gateway };
    stage = "unchangedAfterChecks";
    h.daemon();
    const afterRows = h.rpc(before.pm2, "list"), after = h.application(afterRows);
    p.ensure(after.pid === row.pid, "WORKER_CHANGED_DURING_PREFLIGHT");
    p.assertPreserved(row, after); p.assertOtherProcesses(rows, afterRows);
    const ai = await h.readAI(before.env); p.assertRoutes(ai);
    p.ensure(p.hash(JSON.stringify(ai)) === p.hash(JSON.stringify(before.ai)), "AI_CONFIGURATION_CHANGED_DURING_PREFLIGHT");
    const dotenv = h.file(p.C.root + "/.env"), tokenAfter = h.file(p.C.token);
    p.ensure(p.hash(dotenv.bytes) === p.hash(before.dotenv.bytes) && dotenv.uid === before.dotenv.uid &&
      dotenv.gid === before.dotenv.gid && dotenv.mode === before.dotenv.mode, "DOTENV_CHANGED_DURING_PREFLIGHT");
    p.ensure(p.hash(tokenAfter.bytes) === p.hash(original.bytes) && tokenAfter.uid === original.uid &&
      tokenAfter.gid === original.gid && tokenAfter.mode === original.mode, "TOKEN_CHANGED_DURING_PREFLIGHT");
    p.ensure(p.hash(h.file(p.C.root + "/dist/index.cjs").bytes) === p.C.backend, "BACKEND_CHANGED");
    h.health();
    report.checks[stage] = { passed: true };
    report.status = "READY";
  } catch (error) {
    report.blockedAt = stage;
    report.blockedBy = /^[A-Z][A-Z0-9_]{2,90}$/.test(error?.operatorCode || "") ?
      error.operatorCode : "PREFLIGHT_CHECK_FAILED";
  }
  return report;
}
module.exports = { run, getJSON, discovery, ENDPOINTS, MODEL, LIMIT };
