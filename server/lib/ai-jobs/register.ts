import type { Express, RequestHandler } from "express";
import { pool } from "../../db";
import { registerAIJobRoutes } from "./routes";
import { aiJobStore, enqueueTaskJob, enqueueEmailJob, retryJob } from "./runtime";
import { validateJobSource } from "./context";
import { JobError } from "./policy";
import { resolveJobMailbox } from "./mailbox";

export function registerAIJobs(app: Express, auth: RequestHandler) {
  registerAIJobRoutes(app, auth, {
    get: aiJobStore.get, list: aiJobStore.list, retry: retryJob,
    authorize: (job, userId) => validateJobSource(pool, job, userId),
    mailbox: async (userId, requested) => {
      return (await resolveJobMailbox(userId, requested)).mailbox;
    },
    create: (userId, input) => input.service === "email.summary"
      ? enqueueEmailJob(userId, input.entityId, input.mailbox, input.locale ?? "sk")
      : enqueueTaskJob(input.service, input.entityId, userId, input.locale),
  });
}
