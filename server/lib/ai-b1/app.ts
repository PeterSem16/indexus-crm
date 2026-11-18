import express, { type RequestHandler } from "express";
import session from "express-session";
import { createHash, timingSafeEqual } from "node:crypto";
import type { JobPool } from "../ai-jobs/store";
import { registerAIJobRoutes } from "../ai-jobs/routes";
import { createAIJobRuntime } from "../ai-jobs/runtime";
import { validateJobSource, taskContext } from "../ai-jobs/context";
import { jobView } from "../ai-jobs/store";
import { JobError } from "../ai-jobs/policy";
import { registerTaskResolutionDraftRoute } from "../task-resolution-draft-route";
import { LANGUAGES } from "../../../script/ai-three-services/corpus";

const camel = (row: any): any => Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]));
type B1Config = { sessionSecret: string; uiPassword: string };

/**
 * Original built INDEXUS frontend + narrow acceptance API, not registerRoutes().
 * Intentionally imports no production HTTP bootstrap, mailbox monitor, automation,
 * telephony, notification sender or arbitrary record routes.
 */
export function createB1App(pool: JobPool, config: B1Config, stage: "checklist" | "resolution" | "summary") {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = req.headers.host;
    if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
      return void res.status(403).json({ errorCode: "b1_loopback_host_required" });
    if (!["GET", "HEAD"].includes(req.method) && req.headers.origin &&
        req.headers.origin !== `http://${host}`)
      return void res.status(403).json({ errorCode: "b1_same_origin_required" });
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.use(session({ name: "indexus-b1", secret: config.sessionSecret,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "strict", secure: false, maxAge: 2 * 60 * 60_000 } }));
  const user = { id: "b1-operator", username: "b1-operator", fullName: "Syntetický operátor B1",
    email: "b1@example.test", role: "admin", roleId: null, isActive: true, assignedCountries: ["SK"],
    authMethod: "local", sipEnabled: false, showSipPhone: false, showNotificationBell: false,
    showEmailQueue: false, nexusEnabled: false, landingPage: "/tasks" };
  const requireAuth: RequestHandler = (req, res, next) => {
    if ((req as any).session?.user?.id !== user.id) { res.sendStatus(401); return; }
    next();
  };
  let failedLogins = 0, loginWindow = Date.now();
  app.post("/api/auth/check-auth-method", (_req, res) => res.json({ authMethod: "local" }));
  app.get("/api/sip-settings", (_req, res) => res.json({ enabled: false }));
  app.post("/api/auth/login", (req, res) => {
    if (Date.now() - loginWindow > 60000) { failedLogins = 0; loginWindow = Date.now(); }
    if (failedLogins >= 5) return void res.sendStatus(429);
    const password = req.body?.password;
    const hash = (text: string) => createHash("sha256").update(text).digest();
    if (req.body?.username !== user.username || typeof password !== "string" ||
      password.length > 1024 || !timingSafeEqual(hash(password), hash(config.uiPassword))) {
      failedLogins++; return void res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.regenerate(error => {
      if (error) return void res.sendStatus(503);
      (req as any).session.user = user;
      req.session.save(error => error ? res.sendStatus(503) : res.json({ user }));
    });
  });
  app.get("/api/auth/me", requireAuth, (_req, res) => res.json({ user }));
  app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ success: true })));
  app.post("/api/auth/heartbeat", requireAuth, (_req, res) => res.json({ success: true }));
  app.use("/api", requireAuth);
  const runtime = createAIJobRuntime(pool);
  const activeService = { checklist: "task.checklist", resolution: "task.resolution", summary: "email.summary" }[stage];
  app.use("/api", (req, res, next) => {
    if (req.path.endsWith("/resolution-draft") && stage !== "resolution" ||
      req.path.endsWith("/retry") || req.path.endsWith("/checklist/ai") && req.method === "POST") {
      res.status(409).json({ errorCode: "b1_stage_or_retry_requires_review" }); return;
    }
    next();
  });
  registerAIJobRoutes(app, requireAuth, {
    get: runtime.aiJobStore.get, list: runtime.aiJobStore.list, retry: async () => {
      throw new JobError("b1_retry_requires_review");
    },
    mailbox: async () => { throw new JobError("b1_test_mailbox_not_configured", 503); },
    authorize: (job, id) => validateJobSource(pool, job, id),
    create: (id, input) => {
      if (input.service !== activeService) throw new JobError("b1_stage_not_approved");
      if (input.service === "email.summary") throw new JobError("b1_test_mailbox_not_configured", 503);
      return runtime.enqueueTaskJob(input.service, input.entityId, id, input.locale);
    },
  });
  const wrap = (fn: (req: any, res: any) => Promise<unknown>): RequestHandler =>
    (req, res) => { void fn(req, res).catch(error => {
      res.status(error instanceof JobError ? error.status : 503)
        .json({ errorCode: error instanceof JobError ? error.code : "b1_request_failed" });
    }); };
  const tasks = async () => (await pool.query("SELECT * FROM tasks ORDER BY created_at")).rows.map(camel);
  app.get("/api/tasks", wrap(async (_req, res) => res.json(await tasks())));
  app.get("/api/tasks/my", wrap(async (_req, res) => res.json(await tasks())));
  app.post("/api/tasks", wrap(async (req, res) => {
    const input = req.body ?? {}, sk = LANGUAGES[0];
    if (stage !== "checklist" || input.title !== sk.titles[0] || input.description !== sk.requests[0] ||
      input.country !== "SK" || input.assignedUserId !== user.id || input.customerId ||
      (input.tags?.length ?? 0) || (input.attachments?.length ?? 0))
      throw new JobError("b1_original_synthetic_case_required", 400);
    await pool.query(`INSERT INTO tasks(id,title,description,assigned_user_id,created_by_user_id,country)
      VALUES('b1-checklist-sk-1',$1,$2,$3,$3,'SK') ON CONFLICT(id) DO NOTHING`,
    [sk.titles[0], sk.requests[0], user.id]);
    const job = await runtime.enqueueTaskJob("task.checklist", "b1-checklist-sk-1", user.id);
    res.status(202).json({ ...(await tasks())[0], jobId: job.id, job: jobView(job) });
  }));
  app.patch("/api/tasks/:id", wrap(async (req, res) => {
    await taskContext(pool, req.params.id, user.id);
    if (Object.keys(req.body).some(k => k !== "status") || !["pending", "in_progress"].includes(req.body.status))
      throw new JobError("b1_task_edit_not_supported", 400);
    await pool.query("UPDATE tasks SET status=$1,updated_at=now() WHERE id=$2", [req.body.status, req.params.id]);
    res.json((await tasks()).find(t => t.id === req.params.id));
  }));
  app.get("/api/tasks/assignment-options", (_req, res) => res.json({ users: [user], groups: [], canResolve: true }));
  app.get("/api/task-settings/access", (_req, res) => res.json({ canManage: false }));
  app.get("/api/users", (_req, res) => res.json([user]));
  app.get("/api/tasks/people", (_req, res) => res.json([user]));
  // Tasks live inside Omni's original shell. Its empty personal metadata must
  // retain the real collection shapes; this does not connect any mailbox.
  for (const suffix of ["ms365-available-mailboxes", "email-tags", "email-tag-assignments",
    "email-signatures", "mailbox-colors", "chat-messages", "sharepoint/sites"])
    app.get(`/api/users/b1-operator/${suffix}`, (_req, res) => res.json([]));
  app.get("/api/users/b1-operator/ms365-folders", (_req, res) => res.json({ connected: false, folders: [], inboxId: null }));
  app.get("/api/users/b1-operator/email-signatures/personal", (_req, res) => res.json(null));
  app.get("/api/users/b1-operator/ms365-unread-counts", (_req, res) => res.json({ total: 0, mailboxes: [] }));
  for (const url of ["/api/roles", "/api/task-groups", "/api/customers", "/api/customers/lookup",
    "/api/chat/conversations", "/api/notifications", "/api/departments",
    "/api/hospitals/lookup", "/api/clinics/lookup", "/api/config/health-insurance",
    "/api/products", "/api/product-sets"])
    app.get(url, (_req, res) => res.json([])); // These collections have no records in this isolated pilot.
  app.get("/api/tasks/:id/checklist", wrap(async (req, res) => {
    await taskContext(pool, req.params.id, user.id);
    res.json((await pool.query("SELECT * FROM task_checklist_items WHERE task_id=$1 ORDER BY position,id",
      [req.params.id])).rows.map(camel));
  }));
  app.get("/api/tasks/:id/checklist/ai", wrap(async (req, res) => {
    await taskContext(pool, req.params.id, user.id);
    res.json(await runtime.queuedChecklistState(req.params.id, { actorId: user.id, readOnly: true }));
  }));
  app.patch("/api/task-checklist/:id", wrap(async (req, res) => {
    if (stage !== "resolution" || typeof req.body.done !== "boolean" ||
      Object.keys(req.body).some(k => k !== "done")) throw new JobError("b1_checklist_review_required");
    const row = (await pool.query(`UPDATE task_checklist_items SET
      done_at=CASE WHEN $2 THEN now() ELSE NULL END,
      done_by_user_id=CASE WHEN $2 THEN $3 ELSE NULL END WHERE id=$1 RETURNING *`,
    [req.params.id, req.body.done, user.id])).rows[0];
    if (!row) throw new JobError("checklist_not_found", 404);
    res.json(camel(row));
  }));
  registerTaskResolutionDraftRoute(app, requireAuth, {
    getTask: async id => (await tasks()).find(t => t.id === id),
    canAccessTask: async (_user, id) => { await taskContext(pool, id, user.id); return true; },
    getChecklist: async id => (await pool.query("SELECT * FROM task_checklist_items WHERE task_id=$1 ORDER BY position,id", [id])).rows.map(camel),
  });
  app.use("/api", (_req, res) => res.status(404).json({ errorCode: "b1_api_not_in_scope" }));
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.status === 400 ? 400 : 503).json({ errorCode: "b1_request_failed" });
  });
  return app;
}
