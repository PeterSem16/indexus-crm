import type { Express, RequestHandler } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { taskRequestTypes, taskGroups } from "@shared/schema";
import { assertTaskRecipientAllowed } from "./task-assignment-access";

const input = z.object({
  name: z.string().trim().min(1).max(200),
  groupIds: z.array(z.string().trim().min(1).max(100)).max(30),
  userIds: z.array(z.string().trim().min(1).max(100)).max(30),
  enabled: z.boolean(),
});

export function registerTaskRequestTypeRoutes(app: Express, auth: RequestHandler, admin: RequestHandler, database: typeof db = db) {
  app.get("/api/task-request-types", auth, async (_req, res) => {
    try {
      res.json(await database.select().from(taskRequestTypes).where(eq(taskRequestTypes.deleted, false)).orderBy(asc(taskRequestTypes.sortOrder), asc(taskRequestTypes.name)));
    } catch { res.status(500).json({ error: "Failed to load request types" }); }
  });
  const save: RequestHandler = async (req, res) => {
    const parsed = input.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request type" }); return; }
    try {
      const data = { ...parsed.data, groupIds: [...new Set(parsed.data.groupIds)], userIds: [...new Set(parsed.data.userIds)] };
      const result = await database.transaction(async tx => {
        if (data.groupIds.length) {
          const found = await tx.select({ id: taskGroups.id }).from(taskGroups).where(inArray(taskGroups.id, data.groupIds));
          if (found.length !== data.groupIds.length) throw new Error("Unknown group");
        }
        for (const id of data.userIds) await assertTaskRecipientAllowed(tx, id);
        if (req.params.id) {
          const [row] = await tx.update(taskRequestTypes).set({ ...data, updatedAt: new Date() }).where(and(eq(taskRequestTypes.id, req.params.id), eq(taskRequestTypes.deleted, false))).returning();
          return row;
        }
        const [row] = await tx.insert(taskRequestTypes).values(data).returning();
        return row;
      });
      if (!result) { res.status(404).json({ error: "Request type not found" }); return; }
      res.json(result);
    } catch { res.status(400).json({ error: "Recipients must be active, approved users or existing groups" }); }
  };
  app.post("/api/task-request-types", auth, admin, save);
  app.put("/api/task-request-types/:id", auth, admin, save);
  app.delete("/api/task-request-types/:id", auth, admin, async (req, res) => {
    try {
      const [row] = await database.update(taskRequestTypes).set({ deleted: true, updatedAt: new Date() }).where(eq(taskRequestTypes.id, req.params.id)).returning();
      if (!row) { res.status(404).json({ error: "Request type not found" }); return; }
      res.sendStatus(204);
    } catch { res.status(500).json({ error: "Failed to delete request type" }); }
  });
}
