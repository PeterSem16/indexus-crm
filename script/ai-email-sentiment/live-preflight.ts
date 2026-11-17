import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { GATEWAY_URL } from "../../server/lib/ai/settings-policy";
import { EMAIL_SENTIMENT_MODEL } from "../../server/lib/ai/email-sentiment-profile";
import { hash, PilotError } from "./gateway-client";
import { regressionCases } from "./regression-corpus";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { assertRuntime } = require(path.resolve("script/ai-email-monitoring-b1/runtime.cjs"));
export function assertExistingRuntime() {
  if (process.platform !== "linux" || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
    process.getuid?.() !== 1001 || process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN)
    throw new PilotError("existing_CORPCRM01_operator_runtime_required");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new PilotError("tls_verification_required");
  try { assertRuntime(process.env); } catch { throw new PilotError("existing_monitoring_preload_required"); }
}
export interface WindowEvidence {
  checkedAt: string; reference: string; noteContractCompatible: boolean;
  startsAt: string; endsAt: string;
}
export interface Telemetry {
  observedAt: string; sourceReference: string; available: boolean;
  otherServicesHealthy: boolean; resourceTelemetryAvailable: boolean; criticalResourceAlarm: boolean;
  newErrors: number; newTimeouts: number; backlog: number; backlogLimit: number;
  samples: number; baselineSamples: number; p95Ms: number | null; baselineP95Ms: number | null;
}
export function telemetryState(value: unknown, now = Date.now()) {
  const data = value as Partial<Telemetry> | null;
  const time = Date.parse(data?.observedAt ?? "");
  const fields = ["newErrors", "newTimeouts", "backlog", "backlogLimit", "samples", "baselineSamples"] as const;
  if (!data || data.available !== true || !data.sourceReference || typeof data.sourceReference !== "string" ||
    data.sourceReference.length > 120 || !Number.isFinite(time) || time > now || now - time > 10_000 ||
    data.resourceTelemetryAvailable !== true || typeof data.otherServicesHealthy !== "boolean" ||
    typeof data.criticalResourceAlarm !== "boolean" ||
    fields.some(key => !Number.isSafeInteger(data[key]) || data[key]! < 0))
    return { state: "NOT_VERIFIED", safe: false, latencyImpact: "NOT_VERIFIED" } as const;
  const sufficient = data.samples! >= 20 && data.baselineSamples! >= 20;
  const latencyKnown = sufficient && typeof data.p95Ms === "number" && Number.isFinite(data.p95Ms) &&
    data.p95Ms >= 0 && typeof data.baselineP95Ms === "number" &&
    Number.isFinite(data.baselineP95Ms) && data.baselineP95Ms > 0;
  const latencySafe = !sufficient || (latencyKnown && data.p95Ms! <= data.baselineP95Ms! * 1.2);
  return { state: "PRODUCER_REPORTED", safe: data.otherServicesHealthy === true &&
    data.criticalResourceAlarm === false && data.newErrors === 0 && data.newTimeouts === 0 &&
    data.backlog! <= data.backlogLimit! && latencySafe,
    latencyImpact: latencyKnown ? (latencySafe ? "WITHIN_LIMIT" : "OVER_LIMIT") : "NOT_VERIFIED" } as const;
}
export const corpusSha256 = () => hash(JSON.stringify(regressionCases));
export function makePreflight(options: {
  discovery?: boolean; routingUnchanged?: boolean; telemetry?: unknown; window?: unknown; now?: number;
}) {
  const now = options.now ?? Date.now(), e = options.window as Partial<WindowEvidence> | undefined;
  const start = Date.parse(e?.startsAt ?? ""), end = Date.parse(e?.endsAt ?? "");
  const checked = Date.parse(e?.checkedAt ?? "");
  const validEvidence = e?.reference && typeof e.reference === "string" && e.reference.length <= 120 &&
    Number.isFinite(checked) && checked <= now && now - checked <= 15 * 60_000;
  const window = validEvidence && Number.isFinite(start) && Number.isFinite(end) &&
    start <= now && end > now && end - start <= 20 * 60_000 ? "OPERATOR_ATTESTED" : "NOT_VERIFIED";
  const contract = validEvidence && e?.noteContractCompatible === true ? "OPERATOR_ATTESTED" : "NOT_VERIFIED";
  const telemetry = telemetryState(options.telemetry, now);
  return { format: "email.sentiment.existing-api.v1", checkedAt: new Date(now).toISOString(),
    baseURL: GATEWAY_URL, model: EMAIL_SENTIMENT_MODEL, corpusSha256: corpusSha256(),
    api: options.discovery === undefined ? "NOT_VERIFIED" : options.discovery ? "PASS" : "FAIL",
    routingUnchanged: options.routingUnchanged === true ? "PASS" : "NOT_VERIFIED",
    noteContract: contract, telemetry, window,
    windowEndsAt: window === "OPERATOR_ATTESTED" ? e!.endsAt! : null,
    outcome: options.discovery && options.routingUnchanged && telemetry.safe &&
      window === "OPERATOR_ATTESTED" && contract === "OPERATOR_ATTESTED" ? "READY_FOR_ISOLATED_SEQUENCE" : "BLOCKED",
    inferenceAllowed: false, inferenceAttempts: 0, productionActivationAllowed: false,
    transport: "EXISTING_GATEWAY_ADAPTER", phaseBAllowed: false };
}
export type Preflight = ReturnType<typeof makePreflight>;
