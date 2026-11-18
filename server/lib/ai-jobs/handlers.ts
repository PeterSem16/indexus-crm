import { aiClient } from "../ai-router";
import { refreshAIAdminSnapshot, aiAdminSnapshot } from "../ai/admin-runtime";
import { THREE_SERVICE_PROFILES } from "../ai/three-services-profile";
import { withAIJobContext } from "../ai/background-context";
import { generateTaskChecklistWithCompletion } from "../task-ai-checklist";
import { generateTaskResolutionDraftWithCompletion } from "../task-resolution-draft";
import { emailSummaryRequest, emailSummaryResult } from "./summary";
import { validateJobSource } from "./context";
import { JobError } from "./policy";
import type { JobRow, JobSQL } from "./store";

export async function executeJob(sql: JobSQL, job: JobRow, timeoutMs: number, signal: AbortSignal,
  evidence?: (content: string) => Promise<void>) {
  await validateJobSource(sql, job);
  await refreshAIAdminSnapshot();
  const route = aiAdminSnapshot()?.value.routes[job.service];
  if (!route?.enabled || route.provider !== "internal" || route.model !== THREE_SERVICE_PROFILES[job.service].model)
    throw new JobError("pilot_route_not_internal", 503);
  return withAIJobContext(job.service, timeoutMs, async () => {
    const client = aiClient(job.service, { timeout: timeoutMs, maxRetries: 0 });
    const complete = async (body: any) => {
      const started = performance.now();
      const record = async (status: number | null, requestId: unknown) => {
        const safeId = typeof requestId === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(requestId) ? requestId : null;
        await sql.query(`UPDATE ai_jobs SET metrics=metrics || $3::jsonb
          WHERE id=$1 AND worker_id=$2 AND status='processing' AND locked_until>now()`,
        [job.id, job.worker_id, JSON.stringify({ gatewayMs: Math.round(performance.now() - started),
          httpStatus: status, requestId: safeId })]);
      };
      let response;
      try {
        const received = await client.chat.completions.create(body, { signal, maxRetries: 0 }).withResponse();
        response = received.data;
        await record(received.response.status, received.response.headers.get("x-request-id"));
      } catch (error: any) {
        await record(Number.isInteger(error?.status) ? error.status : null, error?.request_id).catch(() => {});
        throw error;
      }
      const content = response.choices[0]?.message?.content;
      if (typeof content === "string") await evidence?.(content);
      if (typeof content !== "string" || !content.trim()) throw new JobError("invalid_output", 422);
      // Only the isolated acceptance entry supplies this sink. Preserve the
      // original provider content before parsing, without changing its request.
      return content;
    };
    if (job.service === "task.checklist") {
      const steps = await generateTaskChecklistWithCompletion(job.payload.task, messages => complete({
        model: "gpt-4o-mini", temperature: 0.2, max_tokens: 1000,
        response_format: { type: "json_object" }, messages,
      }));
      return { steps };
    }
    if (job.service === "task.resolution") {
      let providerError: unknown;
      const result = await generateTaskResolutionDraftWithCompletion(job.payload.input, async messages => {
        try {
          return await complete({ model: "gpt-4o-mini", temperature: 0.2, max_tokens: 400,
            response_format: { type: "json_object" }, messages });
        } catch (error) { providerError = error; throw error; }
      });
      if (providerError) throw providerError;
      if (result.status !== "generated") throw new JobError(result.errorCode, 422);
      return result;
    }
    return emailSummaryResult(await complete(emailSummaryRequest(job.payload.input, true)));
  });
}
