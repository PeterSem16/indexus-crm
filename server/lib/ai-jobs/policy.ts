import { AI_JOB_SERVICES, type AIJobService } from "../../../shared/ai-jobs";
import { aiAdminSnapshot } from "../ai/admin-runtime";

const switches: Record<AIJobService, string> = {
  "task.checklist": "AI_JOBS_TASK_CHECKLIST_ENABLED",
  "task.resolution": "AI_JOBS_TASK_RESOLUTION_ENABLED",
  "email.summary": "AI_JOBS_EMAIL_SUMMARY_ENABLED",
};
export function isJobService(value: unknown): value is AIJobService {
  return typeof value === "string" && AI_JOB_SERVICES.includes(value as AIJobService);
}
export function aiJobEnabled(service: AIJobService): boolean {
  if (process.env.INDEXUS_AI_ROUTER_MODE === "legacy") return false;
  const override = process.env[switches[service]];
  const settings = aiAdminSnapshot()?.value, route = settings?.routes[service];
  // Once initialized, Configuration is authoritative in BOTH directions.
  // A leftover true flag must not undo switching a service back to OpenAI.
  if (settings) return settings.gateway.enabled === true && route?.enabled === true && route.provider === "internal";
  // Isolated development fixtures without an administration snapshot only.
  return process.env.NODE_ENV !== "production" && override === "true";
}
export function aiJobTimeout(): number {
  const value = Number(process.env.AI_JOBS_GATEWAY_TIMEOUT_MS ?? 120000);
  if (!Number.isInteger(value) || value < 1000 || value > 120000)
    throw new JobError("invalid_worker_timeout", 503);
  return value;
}
export class JobError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
export function jobFailure(error: any): string {
  if (error instanceof JobError) return error.code;
  if (error?.safeCode === "invalid_output") return "invalid_output";
  if (["AbortError", "APIConnectionTimeoutError", "TimeoutError"].includes(error?.name)) return "timeout_outcome_unknown";
  if (error?.code === "ai_internal_model_unavailable") return "model_unavailable";
  const code = error?.code ?? error?.cause?.code;
  if (["ai_internal_invalid_json_response", "ai_internal_invalid_completion"].includes(code)) return "invalid_output";
  if (code === "ai_internal_transport_error") return "connection_failed";
  if (error?.code === "ai_service_disabled") return "service_disabled";
  if (error?.status === 503 || error?.status === 504) return "gateway_unavailable";
  if (error?.status === 422) return "gateway_rejected";
  if (["ECONNREFUSED", "ENOTFOUND"].includes(error?.code)) return "connection_failed";
  return "provider_or_contract_error";
}
