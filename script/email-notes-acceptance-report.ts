import os from "node:os";

export type EvidenceRow = { test: string; status: "PASS" | "FAIL" | "BLOCKED"; detail: string };
export type GatewayHttpEvent = {
  method: "POST" | "GET"; started_at: string; http_status?: number;
  request_id?: string; transport_error?: string; safe_error_code?: string;
  validation_fields?: string[]; job_id?: string;
};

function safeIdentifier(value: unknown, secret: string) {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,96}$/.test(value) &&
    !(secret && value.includes(secret)) ? value : undefined;
}

/** Consume only unexpected-status bodies, which the strict client will reject anyway. */
export async function captureSafeFailureMetadata(response: Response, event: GatewayHttpEvent, secret: string) {
  const mapped: Record<number, string> = { 401: "authentication_rejected", 403: "permission_denied",
    404: "route_not_found", 405: "method_not_allowed", 415: "unsupported_media_type",
    422: "request_validation_failed", 429: "rate_limited", 500: "gateway_internal_error",
    502: "bad_gateway", 503: "service_unavailable", 504: "upstream_timeout" };
  event.safe_error_code = mapped[response.status] || "unexpected_http_status";
  if (!response.body) return;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32768) return;
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const code = safeIdentifier(data?.error?.code ?? data?.code, secret);
    if (code) event.safe_error_code = code;
    event.request_id ||= safeIdentifier(data?.request_id, secret);
    if (typeof data?.job_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.job_id) &&
      !data.job_id.includes(secret || "\0")) event.job_id = data.job_id;
    if (Array.isArray(data?.detail)) {
      const fields = data.detail.slice(0, 20).flatMap((item: any) =>
        Array.isArray(item?.loc) ? item.loc.map((v: unknown) => safeIdentifier(v, secret)).filter(Boolean) : []);
      if (fields.length) event.validation_fields = [...new Set(fields)] as string[];
    }
  } catch { /* Never print raw provider data or parser errors. */ }
  finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Five requested result groups; PASS means the isolated backend flow, not deployed UI. */
export function buildControlledReport(rows: EvidenceRow[], events: GatewayHttpEvent[], syntheticNote?: string) {
  const find = (test: string) => rows.find(row => row.test === test);
  const phase = (test: string, method: "POST" | "GET") => ({
    http_status: events.filter(event => event.method === method).at(-1)?.http_status ?? null,
    status: find(test)?.status ?? "BLOCKED",
    result: find(test)?.detail ?? "Not executed.",
    requests: events.filter(event => event.method === method),
  });
  const required = ["gateway_post", "gateway_get", "postgres_email_binding", "unapproved_draft",
    "language_review", "manual_approval_and_audit", "production_flag", "production_files", "production_process"];
  const failed = required.filter(test => find(test)?.status !== "PASS");
  if (events.filter(event => event.method === "POST").length !== 1 ||
    events.find(event => event.method === "POST")?.http_status !== 202) failed.push("post_http_evidence");
  if (events.filter(event => event.method === "GET").at(-1)?.http_status !== 200) failed.push("get_http_evidence");
  const executionFailed = rows.some(row => row.status === "FAIL");
  return {
    post: phase("gateway_post", "POST"),
    get: { ...phase("gateway_get", "GET"), ...(syntheticNote ? { synthetic_note: syntheticNote } : {}) },
    end_to_end: { status: !failed.length && !executionFailed ? "PASS" : "FAIL",
      scope: "Synthetic Gateway job and original CRM backend service in a separate test database; not signed-in production UI.",
      incomplete_checks: failed },
    error_and_fix: {
      findings: rows.filter(row => row.status !== "PASS" && row.test !== "signed_in_crm_ui"),
      previous_post_evidence: "Unavailable to this runner; does not block this newly authorized test.",
      performed: "Existing shared Gateway preload; single-POST guard and safe HTTP diagnostics. No authentication bypass or production routing change.",
    },
    production_crm: {
      host: os.hostname(),
      writes_deploys_restarts_performed: false,
      files: find("production_files")?.status ?? "BLOCKED",
      process: find("production_process")?.status ?? "BLOCKED",
      feature_flag: find("production_flag")?.status ?? "BLOCKED",
    },
  };
}
