import { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";
import {
  ariSettings, insertAriSettingsSchema,
  inboundQueues, insertInboundQueueSchema,
  queueMembers, insertQueueMemberSchema,
  ivrMessages, insertIvrMessageSchema,
  inboundCallLogs,
  agentQueueStatus,
  users,
  customers,
} from "@shared/schema";
import { or, like, ilike } from "drizzle-orm";
import { AriClient, initializeAriClient, getAriClient, destroyAriClient } from "./lib/ari-client";
import { QueueEngine, initializeQueueEngine, getQueueEngine, destroyQueueEngine } from "./lib/queue-engine";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { STORAGE_PATHS, DATA_ROOT } from "./config/storage-paths";

const ivrUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(DATA_ROOT, "ivr-audio");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `ivr-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = [".wav", ".mp3", ".ogg", ".gsm"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

export function registerInboundRoutes(app: Express, requireAuth: any): void {

  // ============ ARI SETTINGS ============

  app.get("/api/ari-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await db.select().from(ariSettings).limit(1);
      if (settings.length === 0) {
        return res.json({
          host: "", port: 8088, protocol: "http",
          username: "", password: "", appName: "indexus-crm",
          wsProtocol: "ws", wsPort: 8088, isEnabled: false,
        });
      }
      const s = { ...settings[0] };
      (s as any).password = s.password ? "••••••••" : "";
      res.json(s);
    } catch (error) {
      console.error("Error fetching ARI settings:", error);
      res.status(500).json({ error: "Failed to fetch ARI settings" });
    }
  });

  app.put("/api/ari-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const body = req.body;
      const existing = await db.select().from(ariSettings).limit(1);

      if (body.password === "••••••••" && existing.length > 0) {
        body.password = existing[0].password;
      }

      if (existing.length > 0) {
        const updated = await db.update(ariSettings)
          .set({ ...body, updatedAt: new Date(), updatedBy: user.id })
          .where(eq(ariSettings.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      } else {
        const created = await db.insert(ariSettings)
          .values({ ...body, updatedBy: user.id })
          .returning();
        res.json(created[0]);
      }
    } catch (error) {
      console.error("Error updating ARI settings:", error);
      res.status(500).json({ error: "Failed to update ARI settings" });
    }
  });

  app.post("/api/ari-settings/test", requireAuth, async (req: Request, res: Response) => {
    try {
      const { host, port, protocol, username, password, appName } = req.body;

      const existing = await db.select().from(ariSettings).limit(1);
      const actualPassword = password === "••••••••" && existing.length > 0
        ? existing[0].password : password;

      const client = new AriClient({
        host, port, protocol, username,
        password: actualPassword, appName: appName || "indexus-crm",
        wsProtocol: "ws", wsPort: port,
      });

      const result = await client.testConnection();
      res.json(result);
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });

  app.post("/api/ari-settings/connect", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const settings = await db.select().from(ariSettings).limit(1);
      if (settings.length === 0 || !settings[0].isEnabled) {
        return res.status(400).json({ error: "ARI is not configured or enabled" });
      }

      const s = settings[0];
      const client = initializeAriClient({
        host: s.host, port: s.port, protocol: s.protocol,
        username: s.username, password: s.password,
        appName: s.appName, wsProtocol: s.wsProtocol, wsPort: s.wsPort,
      });

      await client.connect();

      const engine = initializeQueueEngine(client);
      await engine.start();

      setupQueueEngineWebSocketEvents(engine);

      res.json({ success: true, message: "Connected to Asterisk ARI" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ari-settings/disconnect", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      destroyQueueEngine();
      destroyAriClient();
      res.json({ success: true, message: "Disconnected from Asterisk ARI" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ari-settings/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const client = getAriClient();
      const engine = getQueueEngine();
      res.json({
        ariConnected: client?.isConnected || false,
        queueEngineRunning: engine !== null,
      });
    } catch (error) {
      res.json({ ariConnected: false, queueEngineRunning: false });
    }
  });

  // ============ INBOUND QUEUES ============

  app.get("/api/inbound-queues", requireAuth, async (req: Request, res: Response) => {
    try {
      const queues = await db.select().from(inboundQueues).orderBy(desc(inboundQueues.priority));

      const engine = getQueueEngine();
      const enriched = queues.map(q => {
        const stats = engine?.getQueueStats(q.id) || { waiting: 0, active: 0, agents: 0 };
        return { ...q, stats };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching inbound queues:", error);
      res.status(500).json({ error: "Failed to fetch queues" });
    }
  });

  app.get("/api/inbound-queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const queue = await db.select().from(inboundQueues).where(eq(inboundQueues.id, req.params.id)).limit(1);
      if (!queue[0]) return res.status(404).json({ error: "Queue not found" });

      const members = await db.select({
        member: queueMembers,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          role: users.role,
        },
      })
        .from(queueMembers)
        .leftJoin(users, eq(queueMembers.userId, users.id))
        .where(eq(queueMembers.queueId, req.params.id));

      const engine = getQueueEngine();
      const stats = engine?.getQueueStats(req.params.id) || { waiting: 0, active: 0, agents: 0 };

      const memberStates = members.map(m => {
        const agentState = engine?.getAgentState(m.member.userId);
        return {
          ...m.member,
          user: m.user,
          agentStatus: agentState?.status || "offline",
          callsHandled: agentState?.callsHandled || 0,
        };
      });

      res.json({ ...queue[0], members: memberStates, stats });
    } catch (error) {
      console.error("Error fetching queue:", error);
      res.status(500).json({ error: "Failed to fetch queue" });
    }
  });

  app.post("/api/inbound-queues", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const created = await db.insert(inboundQueues).values(req.body).returning();
      res.status(201).json(created[0]);
    } catch (error) {
      console.error("Error creating queue:", error);
      res.status(500).json({ error: "Failed to create queue" });
    }
  });

  app.put("/api/inbound-queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const updated = await db.update(inboundQueues)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(inboundQueues.id, req.params.id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "Queue not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating queue:", error);
      res.status(500).json({ error: "Failed to update queue" });
    }
  });

  app.delete("/api/inbound-queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      await db.delete(inboundQueues).where(eq(inboundQueues.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting queue:", error);
      res.status(500).json({ error: "Failed to delete queue" });
    }
  });

  // ============ QUEUE MEMBERS ============

  app.post("/api/inbound-queues/:queueId/members", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { userId, penalty, skills } = req.body;

      const existing = await db.select().from(queueMembers)
        .where(and(eq(queueMembers.queueId, req.params.queueId), eq(queueMembers.userId, userId)));
      if (existing.length > 0) {
        return res.status(409).json({ error: "User is already a member of this queue" });
      }

      const created = await db.insert(queueMembers).values({
        queueId: req.params.queueId,
        userId,
        penalty: penalty || 0,
        skills: skills || [],
      }).returning();

      res.status(201).json(created[0]);
    } catch (error) {
      console.error("Error adding queue member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.put("/api/queue-members/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const updated = await db.update(queueMembers)
        .set(req.body)
        .where(eq(queueMembers.id, req.params.id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "Member not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating queue member:", error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/queue-members/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      await db.delete(queueMembers).where(eq(queueMembers.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing queue member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ============ IVR MESSAGES ============

  app.get("/api/ivr-messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const messages = await db.select().from(ivrMessages).orderBy(asc(ivrMessages.name));
      res.json(messages);
    } catch (error) {
      console.error("Error fetching IVR messages:", error);
      res.status(500).json({ error: "Failed to fetch IVR messages" });
    }
  });

  app.post("/api/ivr-messages", requireAuth, ivrUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const filePath = (req as any).file
        ? path.relative(process.cwd(), (req as any).file.path)
        : null;

      const created = await db.insert(ivrMessages).values({
        name: req.body.name,
        type: req.body.type || "welcome",
        filePath,
        textContent: req.body.textContent,
        language: req.body.language || "sk",
        countryCode: req.body.countryCode,
      }).returning();

      res.status(201).json(created[0]);
    } catch (error) {
      console.error("Error creating IVR message:", error);
      res.status(500).json({ error: "Failed to create IVR message" });
    }
  });

  app.put("/api/ivr-messages/:id", requireAuth, ivrUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const updateData: any = {
        name: req.body.name,
        type: req.body.type,
        textContent: req.body.textContent,
        language: req.body.language,
        countryCode: req.body.countryCode,
        isActive: req.body.isActive === "true" || req.body.isActive === true,
        updatedAt: new Date(),
      };

      if ((req as any).file) {
        updateData.filePath = path.relative(process.cwd(), (req as any).file.path);
      }

      const updated = await db.update(ivrMessages)
        .set(updateData)
        .where(eq(ivrMessages.id, req.params.id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "IVR message not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating IVR message:", error);
      res.status(500).json({ error: "Failed to update IVR message" });
    }
  });

  app.delete("/api/ivr-messages/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      await db.delete(ivrMessages).where(eq(ivrMessages.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting IVR message:", error);
      res.status(500).json({ error: "Failed to delete IVR message" });
    }
  });

  // ============ AGENT STATUS (for inbound queue) ============

  app.get("/api/agent-queue-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const engine = getQueueEngine();
      if (engine) {
        const states = engine.getAllAgentStates();
        const userIds = states.map(s => s.userId);
        const userList = userIds.length > 0
          ? await db.select({ id: users.id, name: users.name, username: users.username })
              .from(users).where(inArray(users.id, userIds))
          : [];
        const userMap = new Map(userList.map(u => [u.id, u]));

        res.json(states.map(s => ({
          ...s,
          userName: userMap.get(s.userId)?.name || userMap.get(s.userId)?.username || "Unknown",
        })));
      } else {
        const states = await db.select({
          status: agentQueueStatus,
          user: { id: users.id, name: users.name, username: users.username },
        })
          .from(agentQueueStatus)
          .leftJoin(users, eq(agentQueueStatus.userId, users.id));

        res.json(states.map(s => ({
          userId: s.status.userId,
          status: s.status.status,
          currentCallId: s.status.currentCallId,
          callsHandled: s.status.callsHandled,
          userName: s.user?.name || s.user?.username || "Unknown",
        })));
      }
    } catch (error) {
      console.error("Error fetching agent queue status:", error);
      res.status(500).json({ error: "Failed to fetch agent status" });
    }
  });

  app.post("/api/agent-queue-status/update", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { status } = req.body;

      if (!["available", "busy", "break", "wrap_up", "offline"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const engine = getQueueEngine();
      if (engine) {
        await engine.updateAgentStatus(user.id, status, null);
      } else {
        const existing = await db.select().from(agentQueueStatus).where(eq(agentQueueStatus.userId, user.id));
        if (existing.length > 0) {
          await db.update(agentQueueStatus)
            .set({ status, updatedAt: new Date() })
            .where(eq(agentQueueStatus.userId, user.id));
        } else {
          await db.insert(agentQueueStatus).values({
            userId: user.id,
            status,
            loginAt: status !== "offline" ? new Date() : null,
          });
        }
      }

      res.json({ success: true, status });
    } catch (error) {
      console.error("Error updating agent status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.post("/api/agent-queue-status/end-wrap-up", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const engine = getQueueEngine();
      if (engine) {
        await engine.agentEndedWrapUp(user.id);
      } else {
        await db.update(agentQueueStatus)
          .set({ status: "available", updatedAt: new Date() })
          .where(eq(agentQueueStatus.userId, user.id));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error ending wrap-up:", error);
      res.status(500).json({ error: "Failed to end wrap-up" });
    }
  });

  // ============ INBOUND CALL LOGS ============

  app.get("/api/inbound-call-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { queueId, status, from, to, limit: limitStr } = req.query;
      const limitNum = Math.min(parseInt(limitStr as string) || 100, 500);

      let query = db.select().from(inboundCallLogs).orderBy(desc(inboundCallLogs.createdAt)).limit(limitNum);

      if (queueId) {
        query = query.where(eq(inboundCallLogs.queueId, queueId as string)) as any;
      }

      const logs = await query;
      res.json(logs);
    } catch (error) {
      console.error("Error fetching inbound call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  app.get("/api/inbound-call-logs/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const { queueId, from, to } = req.query;

      const conditions = [];
      if (queueId) conditions.push(eq(inboundCallLogs.queueId, queueId as string));
      if (from) conditions.push(gte(inboundCallLogs.createdAt, new Date(from as string)));
      if (to) conditions.push(lte(inboundCallLogs.createdAt, new Date(to as string)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const total = await db.select({ count: sql<number>`count(*)` }).from(inboundCallLogs).where(whereClause);
      const answered = await db.select({ count: sql<number>`count(*)` }).from(inboundCallLogs)
        .where(and(whereClause, eq(inboundCallLogs.status, "completed")));
      const abandoned = await db.select({ count: sql<number>`count(*)` }).from(inboundCallLogs)
        .where(and(whereClause, eq(inboundCallLogs.status, "abandoned")));
      const avgWait = await db.select({ avg: sql<number>`avg(wait_duration_seconds)` }).from(inboundCallLogs).where(whereClause);
      const avgTalk = await db.select({ avg: sql<number>`avg(talk_duration_seconds)` }).from(inboundCallLogs)
        .where(and(whereClause, eq(inboundCallLogs.status, "completed")));

      res.json({
        totalCalls: Number(total[0]?.count || 0),
        answeredCalls: Number(answered[0]?.count || 0),
        abandonedCalls: Number(abandoned[0]?.count || 0),
        avgWaitTime: Math.round(Number(avgWait[0]?.avg || 0)),
        avgTalkTime: Math.round(Number(avgTalk[0]?.avg || 0)),
        answerRate: total[0]?.count ? Math.round((Number(answered[0]?.count || 0) / Number(total[0].count)) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching inbound stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ============ QUEUE ENGINE EVENTS → WEBSOCKET ============

  app.get("/api/inbound-queues/waiting-calls", requireAuth, async (req: Request, res: Response) => {
    try {
      const engine = getQueueEngine();
      if (!engine) {
        return res.json([]);
      }
      res.json(engine.getWaitingCalls());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch waiting calls" });
    }
  });

  app.post("/api/inbound-calls/:callId/answer", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const engine = getQueueEngine();
      if (!engine) {
        return res.status(503).json({ error: "Queue engine not running" });
      }

      await engine.agentAnsweredCall(req.params.callId, user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/inbound-calls/:callId/complete", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const engine = getQueueEngine();
      if (!engine) {
        return res.status(503).json({ error: "Queue engine not running" });
      }

      await engine.agentCompletedCall(req.params.callId, user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/inbound-calls/:callId/hangup", requireAuth, async (req: Request, res: Response) => {
    try {
      const callLog = await db.select().from(inboundCallLogs)
        .where(eq(inboundCallLogs.id, req.params.callId)).limit(1);

      if (!callLog[0]) return res.status(404).json({ error: "Call not found" });

      const client = getAriClient();
      if (client && callLog[0].ariChannelId) {
        try {
          await client.hangupChannel(callLog[0].ariChannelId, "normal");
        } catch {}
      }

      await db.update(inboundCallLogs)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(inboundCallLogs.id, req.params.callId));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/lookup-phone", requireAuth, async (req: Request, res: Response) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) return res.status(400).json({ error: "Phone number required" });

      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");
      const shortPhone = normalizedPhone.replace(/^\+?\d{1,3}/, "");

      const results = await db.select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        mobile: customers.mobile,
        country: customers.country,
      }).from(customers).where(
        or(
          sql`REPLACE(REPLACE(REPLACE(${customers.phone}, ' ', ''), '-', ''), '(', '') LIKE ${'%' + shortPhone.slice(-7)}`,
          sql`REPLACE(REPLACE(REPLACE(${customers.mobile}, ' ', ''), '-', ''), '(', '') LIKE ${'%' + shortPhone.slice(-7)}`,
          sql`REPLACE(REPLACE(REPLACE(${customers.mobile2}, ' ', ''), '-', ''), '(', '') LIKE ${'%' + shortPhone.slice(-7)}`
        )
      ).limit(1);

      if (results.length === 0) return res.json(null);

      const c = results[0];
      res.json({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone || c.mobile,
        country: c.country,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/queue-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const memberships = await db.select({
        queueId: queueMembers.queueId,
        isActive: queueMembers.isActive,
      }).from(queueMembers).where(eq(queueMembers.userId, userId));

      if (memberships.length === 0) return res.json({ queues: [] });

      const queueIds = memberships.filter(m => m.isActive).map(m => m.queueId);
      if (queueIds.length === 0) return res.json({ queues: [] });

      const queueList = await db.select().from(inboundQueues)
        .where(and(inArray(inboundQueues.id, queueIds), eq(inboundQueues.isActive, true)));

      const queueData = queueList.map(q => ({
        id: q.id,
        name: q.name,
        waiting: 0,
        activeAgents: 0,
        strategy: q.strategy,
      }));

      res.json({ queues: queueData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

function setupQueueEngineWebSocketEvents(engine: QueueEngine): void {
  const getWs = async () => {
    const { inboundCallWs } = await import("./lib/inbound-call-ws");
    return inboundCallWs;
  };

  engine.on("call-queued", (data) => {
    console.log(`[QueueEngine] Call queued: ${data.callerNumber} in ${data.queueName} (pos: ${data.position})`);
  });

  engine.on("call-assigned", async (data) => {
    console.log(`[QueueEngine] Call assigned: ${data.callerNumber} → agent ${data.agentId}`);
    const ws = await getWs();
    ws.notifyInboundCall(data.agentId, {
      callId: data.callId,
      callerNumber: data.callerNumber,
      callerName: data.callerName,
      queueName: data.queueName,
      queueId: data.queueId,
      waitTime: data.waitTime || 0,
      channelId: data.channelId || "",
    });
  });

  engine.on("call-answered", (data) => {
    console.log(`[QueueEngine] Call answered: ${data.callerNumber} by agent ${data.agentId}`);
  });

  engine.on("call-completed", (data) => {
    console.log(`[QueueEngine] Call completed: ${data.callId}, talk: ${data.talkDuration}s`);
  });

  engine.on("call-abandoned", async (data) => {
    console.log(`[QueueEngine] Call abandoned: ${data.callerNumber}, reason: ${data.reason}`);
    if (data.assignedAgentId) {
      const ws = await getWs();
      ws.notifyCallCancelled(data.assignedAgentId, data.callId);
    }
  });

  engine.on("call-timeout", async (data) => {
    console.log(`[QueueEngine] Call timeout: ${data.callerNumber}`);
    if (data.assignedAgentId) {
      const ws = await getWs();
      ws.notifyCallCancelled(data.assignedAgentId, data.callId);
    }
  });

  engine.on("agent-status-changed", (data) => {
    console.log(`[QueueEngine] Agent ${data.userId} → ${data.status}`);
  });
}
