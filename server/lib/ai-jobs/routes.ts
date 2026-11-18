import type { Express, Request, RequestHandler } from "express";
import { JobError, isJobService } from "./policy";
import { jobView, type JobRow } from "./store";

export interface AIJobAPI {
  create(userId: string, input: any): Promise<JobRow>;
  get(id: string): Promise<JobRow | undefined>;
  list(userId: string, service?: string, entityId?: string): Promise<JobRow[]>;
  authorize(job: JobRow, userId: string): Promise<unknown>;
  retry(id: string, userId: string): Promise<JobRow>;
  mailbox(userId: string, requested: string): Promise<string>;
}
const validId = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function principal(req: Request): string {
  const id = (req as any).session?.user?.id;
  if (typeof id !== "string" || !id) throw new JobError("forbidden", 403);
  return id;
}
export function registerAIJobRoutes(app: Express, auth: RequestHandler, api: AIJobAPI) {
  const fail = (res: any, error: unknown) => {
    const safe = error instanceof JobError ? error : new JobError("jobs_unavailable", 503);
    return res.status(safe.status).json({ errorCode: safe.code });
  };
  app.post("/api/ai/jobs", auth, async (req, res) => {
    try {
      const input = req.body;
      if (!input || Array.isArray(input) || typeof input !== "object" ||
        Object.keys(input).some(k => !["service", "entityType", "entityId", "locale", "mailbox"].includes(k)) ||
        !isJobService(input.service) || typeof input.entityId !== "string" || !input.entityId || input.entityId.length > 4096 ||
        input.entityType !== (input.service === "email.summary" ? "email" : "task") ||
        (input.locale !== undefined && (typeof input.locale !== "string" || input.locale.length > 20)) ||
        (input.mailbox !== undefined && (typeof input.mailbox !== "string" || input.mailbox.length > 320)))
        throw new JobError("invalid_job_request", 400);
      const job = await api.create(principal(req), input);
      res.status(202).json({ job: jobView(job), jobId: job.id });
    } catch (error) { fail(res, error); }
  });
  app.get("/api/ai/jobs", auth, async (req, res) => {
    try {
      const { service, entityId, limit, mailbox, locale } = req.query;
      if ((service !== undefined && !isJobService(service)) ||
        (entityId !== undefined && (typeof entityId !== "string" || entityId.length > 4096)) ||
        (mailbox !== undefined && (typeof mailbox !== "string" || mailbox.length > 320)) ||
        (locale !== undefined && (typeof locale !== "string" || locale.length > 20)) ||
        (limit !== undefined && (typeof limit !== "string" || !/^\d+$/.test(limit) || +limit < 1 || +limit > 50)))
        throw new JobError("invalid_job_filter", 400);
      const candidates = await api.list(principal(req), service as string | undefined, entityId as string | undefined);
      const scopedMailbox = mailbox === undefined ? undefined : await api.mailbox(principal(req), mailbox as string);
      const jobs = [];
      for (const job of candidates) {
        if (locale && (job.payload.input?.userLocale ?? job.payload.input?.language) !== locale) continue;
        if (scopedMailbox && job.payload.mailbox !== scopedMailbox) continue;
        try { await api.authorize(job, principal(req)); jobs.push(jobView(job)); }
        catch (error) {
          if (!(error instanceof JobError) || ![403, 404, 409].includes(error.status)) throw error;
        }
        if (jobs.length >= Number(limit ?? 25)) break;
      }
      res.json({ jobs }); // No unauthorized totals or raw payloads.
    } catch (error) { fail(res, error); }
  });
  app.get("/api/ai/jobs/:id", auth, async (req, res) => {
    try {
      if (!validId(req.params.id)) throw new JobError("job_not_found", 404);
      const job = await api.get(req.params.id);
      if (!job) throw new JobError("job_not_found", 404);
      await api.authorize(job, principal(req));
      res.json({ job: jobView(job) });
    } catch (error) { fail(res, error); }
  });
  app.post("/api/ai/jobs/:id/retry", auth, async (req, res) => {
    try {
      if (!validId(req.params.id)) throw new JobError("job_not_found", 404);
      if (req.body && (Array.isArray(req.body) || Object.keys(req.body).length))
        throw new JobError("invalid_retry_request", 400);
      const job = await api.retry(req.params.id, principal(req));
      res.status(202).json({ job: jobView(job), jobId: job.id });
    } catch (error) { fail(res, error); }
  });
}
