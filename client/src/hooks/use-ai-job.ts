import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AIJobService, AIJobView } from "@shared/ai-jobs";
export const activeAIJob = (job: AIJobView | null | undefined) => job?.status === "pending" || job?.status === "processing";
export class AIJobFailure extends Error {
  constructor(readonly job: AIJobView) { super("ai_job_failed"); }
}
export async function findAIJob(input: { service: AIJobService; entityId: string; locale?: string; mailbox?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams({ service: input.service, entityId: input.entityId, limit: "1" });
  if (input.locale) query.set("locale", input.locale);
  if (input.mailbox) query.set("mailbox", input.mailbox);
  const response = await fetch(`/api/ai/jobs?${query}`, { credentials: "include", signal });
  if (!response.ok) throw new Error("ai_jobs_unavailable");
  const body = await response.json();
  if (!Array.isArray(body.jobs)) throw new Error("invalid_jobs_response");
  if (body.jobs[0] && (body.jobs[0].service !== input.service || body.jobs[0].entityId !== input.entityId))
    throw new Error("ai_job_identity_changed");
  return body.jobs[0] as AIJobView | undefined;
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 5000);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
export async function waitForAIJob(initial: AIJobView, signal: AbortSignal, changed: (job: AIJobView) => void) {
  let job = initial;
  changed(job);
  while (activeAIJob(job)) {
    await pause(signal);
    const response = await fetch(`/api/ai/jobs/${encodeURIComponent(job.id)}`, { credentials: "include", signal });
    if (!response.ok) throw new Error("ai_job_unavailable");
    const body = await response.json();
    if (!body.job || body.job.id !== initial.id || body.job.service !== initial.service || body.job.entityId !== initial.entityId)
      throw new Error("ai_job_identity_changed");
    job = body.job;
    changed(job);
  }
  if (job.status !== "completed" || !job.result) throw new AIJobFailure(job);
  return job.result;
}
/** Recovery is read-only: opening a record never POSTs another inference. */
export function useAIJobHistory(input: { service: AIJobService; entityId?: string; ownerId?: string; mailbox?: string; locale?: string }) {
  const query = new URLSearchParams({ service: input.service, entityId: input.entityId ?? "", limit: "1" });
  if (input.mailbox) query.set("mailbox", input.mailbox);
  if (input.locale) query.set("locale", input.locale);
  const queryClient = useQueryClient();
  const queryKey = ["/api/ai/jobs", input.ownerId, input.service, input.entityId, input.mailbox, input.locale];
  const result = useQuery<{ jobs: AIJobView[] }>({
    queryKey,
    enabled: !!input.entityId && !!input.ownerId,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/ai/jobs?${query}`, { credentials: "include", signal });
      if (!response.ok) throw new Error("ai_jobs_unavailable");
      return response.json();
    },
    refetchInterval: query => !query.state.error && activeAIJob(query.state.data?.jobs[0]) ? 5000 : false,
  });
  return { ...result, acceptJob: (job: AIJobView) => {
    if (job.service !== input.service || job.entityId !== input.entityId) throw new Error("ai_job_identity_changed");
    queryClient.setQueryData(queryKey, { jobs: [job] });
  } };
}
