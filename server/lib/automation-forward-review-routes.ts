import type { Express, Request, RequestHandler } from "express";
import { and, eq, inArray, or, sql, ilike } from "drizzle-orm";
import { db } from "../db";
import { customers, tasks, users } from "../../shared/schema";
import { approveForwardInvoice } from "../../shared/automation-forward-review";
import { scopePredicate } from "./automation-update-record";

type Access = {
  canAccess: (req: Request, task: typeof tasks.$inferSelect) => Promise<boolean>;
  canApprove: (req: Request, task: typeof tasks.$inferSelect) => boolean;
};
class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Each query and write is scoped to both the actor AND the persisted task country. */
export function registerForwardReviewRoutes(app: Express, requireAuth: RequestHandler, access: Access) {
  const route = (handler: (req: any, res: any) => Promise<void>): RequestHandler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      const status = error instanceof ReviewError ? error.status : 500;
      res.status(status).json({ error: error instanceof ReviewError ? error.message : "forward_review_failed" });
    }
  };
  async function taskFor(req: any, executor: any = db, locked = false) {
    let query = executor.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1);
    if (locked) query = query.for("update");
    const [task] = await query;
    if (!task || !await access.canAccess(req, task)) throw new ReviewError(404, "forward_review_not_found");
    return task as typeof tasks.$inferSelect;
  }
  async function actorFor(req: any, task: typeof tasks.$inferSelect) {
    const [actor] = await db.select({ id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive })
      .from(users).where(and(eq(users.id, req.session.user.id), eq(users.isActive, true)));
    if (!actor) throw new ReviewError(403, "forward_review_denied");
    try { return { actor, scope: scopePredicate("customer", customers, actor, task.country ? [task.country] : null) }; }
    catch { throw new ReviewError(403, "forward_review_denied"); }
  }
  const projection = {
    id: customers.id, country: customers.country,
    label: sql<string>`trim(concat_ws(' ', ${customers.firstName}, ${customers.lastName}, ${customers.internalId}))`,
  };
  function requireReview(task: typeof tasks.$inferSelect) {
    if (!task.forwardReview || task.forwardReview.version !== 1) throw new ReviewError(404, "forward_review_not_found");
    return task.forwardReview;
  }
  function exactBody(req: any, field: string) {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, field))
      throw new ReviewError(400, "forward_review_invalid");
  }
  app.get("/api/tasks/:id/forward-review", requireAuth, route(async (req, res) => {
    const task = await taskFor(req);
    if (!task.forwardReview) { res.json({ review: null }); return; }
    const { scope } = await actorFor(req, task);
    const ids = Array.from(new Set([...task.forwardReview.candidateIds, ...(task.customerId ? [task.customerId] : [])]));
    const records = ids.length ? await db.select(projection).from(customers)
      .where(and(scope, inArray(customers.id, ids))) : [];
    const attachedIds = new Set(task.attachments.map(file => file.id));
    res.json({ review: { ...task.forwardReview, invoices: task.forwardReview.invoices.filter(invoice => attachedIds.has(invoice.attachmentId)) },
      customer: records.find(row => row.id === task.customerId) || null,
      candidates: records.filter(row => task.forwardReview!.candidateIds.includes(row.id)),
      canApprove: access.canApprove(req, task) });
  }));
  app.get("/api/tasks/:id/forward-review/customers", requireAuth, route(async (req, res) => {
    const task = await taskFor(req);
    requireReview(task);
    const { scope } = await actorFor(req, task);
    if (typeof req.query.q !== "string") throw new ReviewError(400, "forward_review_invalid");
    const q = req.query.q.trim().slice(0, 100);
    if (q.length < 2) { res.json({ records: [] }); return; }
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const records = await db.select(projection).from(customers).where(and(scope, or(
      ilike(projection.label, pattern), ilike(customers.email, pattern), ilike(customers.email2, pattern),
      ilike(customers.phone, pattern), ilike(customers.mobile, pattern), ilike(customers.mobile2, pattern),
    ))).orderBy(customers.lastName, customers.firstName, customers.id).limit(20);
    res.json({ records });
  }));
  app.patch("/api/tasks/:id/forward-review/customer", requireAuth, route(async (req, res) => {
    exactBody(req, "customerId");
    if (req.body.customerId !== null && (typeof req.body.customerId !== "string" || !req.body.customerId.trim() || req.body.customerId.length > 100))
      throw new ReviewError(400, "forward_review_invalid");
    await db.transaction(async tx => {
      const task = await taskFor(req, tx, true);
      requireReview(task);
      const { scope } = await actorFor(req, task);
      let country = task.country;
      if (req.body.customerId !== null) {
        const [customer] = await tx.select({ id: customers.id, country: customers.country }).from(customers)
          .where(and(scope, eq(customers.id, req.body.customerId))).for("share").limit(1);
        if (!customer) throw new ReviewError(404, "forward_review_customer_unavailable");
        // Narrow formerly shared work; never broaden country scope when clearing a link.
        country ||= customer.country;
      }
      await tx.update(tasks).set({ customerId: req.body.customerId, country, updatedAt: new Date() }).where(eq(tasks.id, task.id));
    });
    res.json({ ok: true });
  }));
  app.post("/api/tasks/:id/forward-review/approval", requireAuth, route(async (req, res) => {
    exactBody(req, "attachmentId");
    if (typeof req.body.attachmentId !== "string" || !req.body.attachmentId.trim() || req.body.attachmentId.length > 100)
      throw new ReviewError(400, "forward_review_invalid");
    await db.transaction(async tx => {
      const task = await taskFor(req, tx, true);
      const review = requireReview(task);
      await actorFor(req, task);
      if (!access.canApprove(req, task)) throw new ReviewError(403, "forward_review_approval_denied");
      if (!review.invoices.some(invoice => invoice.attachmentId === req.body.attachmentId)
          || !task.attachments.some(file => file.id === req.body.attachmentId))
        throw new ReviewError(404, "forward_review_invoice_missing");
      const updated = approveForwardInvoice(review, req.body.attachmentId, req.session.user.id, new Date().toISOString());
      await tx.update(tasks).set({ forwardReview: updated, updatedAt: new Date() }).where(eq(tasks.id, task.id));
    });
    res.json({ ok: true });
  }));
}
