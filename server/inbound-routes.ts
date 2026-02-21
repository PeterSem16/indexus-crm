import { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";
import {
  ariSettings, insertAriSettingsSchema,
  inboundQueues, insertInboundQueueSchema,
  queueMembers, insertQueueMemberSchema,
  ivrMessages, insertIvrMessageSchema,
  ivrMenus, insertIvrMenuSchema,
  ivrMenuOptions, insertIvrMenuOptionSchema,
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
          username: "", password: "", appName: "indexus-inbound",
          wsProtocol: "ws", wsPort: 8088, isEnabled: false, autoConnect: false,
          sshPort: 22, sshUsername: "", sshPassword: "", asteriskSoundsPath: "/var/lib/asterisk/sounds/custom",
        });
      }
      const s = { ...settings[0] };
      (s as any).password = s.password ? "••••••••" : "";
      (s as any).sshPassword = s.sshPassword ? "••••••••" : "";
      res.json(s);
    } catch (error) {
      console.error("Error fetching ARI settings:", error);
      res.status(500).json({ error: "Failed to fetch ARI settings" });
    }
  });

  app.put("/api/ari-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const body = req.body;
      const existing = await db.select().from(ariSettings).limit(1);

      let password = body.password;
      if (password === "••••••••" && existing.length > 0) {
        password = existing[0].password;
      }

      let sshPassword = body.sshPassword;
      if (sshPassword === "••••••••" && existing.length > 0) {
        sshPassword = existing[0].sshPassword;
      }

      const settingsData = {
        host: body.host || "",
        port: body.port || 8088,
        protocol: body.protocol || "http",
        username: body.username || "",
        password: password || "",
        appName: body.appName || "indexus-inbound",
        wsProtocol: body.wsProtocol || "ws",
        wsPort: body.wsPort || 8088,
        isEnabled: body.isEnabled ?? false,
        autoConnect: body.autoConnect ?? false,
        sshPort: body.sshPort || 22,
        sshUsername: body.sshUsername || "",
        sshPassword: sshPassword || "",
        asteriskSoundsPath: body.asteriskSoundsPath || "/var/lib/asterisk/sounds/custom",
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      if (existing.length > 0) {
        const updated = await db.update(ariSettings)
          .set(settingsData)
          .where(eq(ariSettings.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      } else {
        const created = await db.insert(ariSettings)
          .values(settingsData)
          .returning();
        res.json(created[0]);
      }
    } catch (error: any) {
      console.error("Error updating ARI settings:", error);
      res.status(500).json({ error: `Failed to update ARI settings: ${error.message || error}` });
    }
  });

  app.post("/api/ari-settings/test", requireAuth, async (req: Request, res: Response) => {
    try {
      const { host, port, protocol, username, password, appName } = req.body;

      const existing = await db.select().from(ariSettings).limit(1);
      const actualPassword = password === "••••••••" && existing.length > 0
        ? existing[0].password : password;

      const wsProtocol = req.body.wsProtocol || (protocol === "https" ? "wss" : "ws");
      const wsPort = req.body.wsPort || port;

      const client = new AriClient({
        host, port, protocol, username,
        password: actualPassword, appName: appName || "indexus-inbound",
        wsProtocol, wsPort,
      });

      const result = await client.testConnection();
      res.json(result);
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });

  app.post("/api/ari-settings/connect", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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

  app.post("/api/ari-settings/sync-audio", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { syncAudioToAsterisk } = await import("./lib/asterisk-audio-sync");
      const result = await syncAudioToAsterisk();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, synced: 0, failed: 0, errors: [error.message] });
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
          fullName: users.fullName,
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
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const data = { ...req.body };
      if (data.welcomeMessageId === "") data.welcomeMessageId = null;
      if (data.holdMusicId === "") data.holdMusicId = null;
      const created = await db.insert(inboundQueues).values(data).returning();
      res.status(201).json(created[0]);
    } catch (error) {
      console.error("Error creating queue:", error);
      res.status(500).json({ error: "Failed to create queue" });
    }
  });

  app.put("/api/inbound-queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const data = { ...req.body };
      if (data.welcomeMessageId === "") data.welcomeMessageId = null;
      if (data.holdMusicId === "") data.holdMusicId = null;
      const updated = await db.update(inboundQueues)
        .set({ ...data, updatedAt: new Date() })
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const filePath = (req as any).file
        ? path.relative(process.cwd(), (req as any).file.path)
        : null;

      const fileObj = (req as any).file;
      const created = await db.insert(ivrMessages).values({
        name: req.body.name,
        type: req.body.type || "welcome",
        source: "upload",
        filePath,
        textContent: req.body.textContent,
        language: req.body.language || "sk",
        countryCode: req.body.countryCode,
        fileSize: fileObj ? fileObj.size : null,
      }).returning();

      if (created[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(created[0].id)).catch(() => {});
      }

      res.status(201).json(created[0]);
    } catch (error) {
      console.error("Error creating IVR message:", error);
      res.status(500).json({ error: "Failed to create IVR message" });
    }
  });

  app.put("/api/ivr-messages/:id", requireAuth, ivrUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
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

      if (updated[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(updated[0].id)).catch(() => {});
      }

      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating IVR message:", error);
      res.status(500).json({ error: "Failed to update IVR message" });
    }
  });

  app.delete("/api/ivr-messages/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
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

  // ============ TTS GENERATION ============

  app.post("/api/ivr-messages/generate-tts", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { name, textContent, voice, language, countryCode, type } = req.body;

      if (!textContent || !textContent.trim()) {
        return res.status(400).json({ error: "Text content is required" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const ttsVoice = voice || "nova";
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: ttsVoice as any,
        input: textContent,
        response_format: "mp3",
      });

      const dir = path.join(DATA_ROOT, "ivr-audio");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filename = `tts-${Date.now()}.mp3`;
      const filePath = path.join(dir, filename);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const gender = ["onyx", "echo", "fable"].includes(ttsVoice) ? "male" : "female";

      const created = await db.insert(ivrMessages).values({
        name: name || `TTS - ${textContent.substring(0, 50)}`,
        type: type || "welcome",
        source: "tts",
        filePath: path.relative(process.cwd(), filePath),
        textContent,
        ttsVoice,
        ttsGender: gender,
        language: language || "sk",
        countryCode: countryCode || null,
        fileSize: buffer.length,
      }).returning();

      if (created[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(created[0].id)).catch(() => {});
      }

      res.status(201).json(created[0]);
    } catch (error: any) {
      console.error("Error generating TTS:", error);
      res.status(500).json({ error: `TTS generation failed: ${error.message}` });
    }
  });

  app.post("/api/ivr-messages/:id/regenerate-tts", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { textContent, voice, language, countryCode, type, name, isActive } = req.body;
      if (!textContent || typeof textContent !== "string" || !textContent.trim()) {
        return res.status(400).json({ error: "Text content is required" });
      }
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      const existing = await db.select().from(ivrMessages).where(eq(ivrMessages.id, req.params.id));
      if (!existing[0]) return res.status(404).json({ error: "IVR message not found" });

      const validVoices = ["nova", "shimmer", "alloy", "onyx", "echo", "fable"];
      const ttsVoice = validVoices.includes(voice) ? voice : "nova";

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: ttsVoice as any,
        input: textContent.trim(),
        response_format: "mp3",
      });

      const dir = path.join(DATA_ROOT, "ivr-audio");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filename = `tts-${Date.now()}.mp3`;
      const filePath = path.join(dir, filename);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const gender = ["onyx", "echo", "fable"].includes(ttsVoice) ? "male" : "female";

      const updated = await db.update(ivrMessages)
        .set({
          name: name.trim(),
          type: type || existing[0].type,
          source: "tts",
          filePath: path.relative(process.cwd(), filePath),
          textContent: textContent.trim(),
          ttsVoice,
          ttsGender: gender,
          language: language || existing[0].language,
          countryCode: countryCode || existing[0].countryCode,
          isActive: isActive !== undefined ? (isActive === true || isActive === "true") : existing[0].isActive,
          fileSize: buffer.length,
          updatedAt: new Date(),
        })
        .where(eq(ivrMessages.id, req.params.id))
        .returning();

      if (updated[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(updated[0].id)).catch(() => {});
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Error regenerating TTS:", error);
      res.status(500).json({ error: `TTS regeneration failed: ${error.message}` });
    }
  });

  app.post("/api/ivr-messages/:id/regenerate-stock-moh", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { stockId, name, countryCode, isActive } = req.body;
      if (!stockId || typeof stockId !== "string") {
        return res.status(400).json({ error: "Stock MOH ID is required" });
      }

      const existing = await db.select().from(ivrMessages).where(eq(ivrMessages.id, req.params.id));
      if (!existing[0]) return res.status(404).json({ error: "IVR message not found" });

      const { generateStockMoh, STOCK_MOH_OPTIONS } = await import("./lib/stock-moh-generator");
      const option = STOCK_MOH_OPTIONS.find(o => o.id === stockId);
      if (!option) {
        return res.status(404).json({ error: "Unknown stock MOH option" });
      }

      const dir = path.join(DATA_ROOT, "ivr-audio");
      const result = await generateStockMoh(stockId, dir);

      const updated = await db.update(ivrMessages)
        .set({
          name: (name && typeof name === "string" && name.trim()) ? name.trim() : option.name,
          type: "hold_music",
          source: "stock",
          filePath: path.relative(process.cwd(), result.filePath),
          textContent: null,
          ttsVoice: null,
          ttsGender: null,
          language: "EN",
          countryCode: countryCode || existing[0].countryCode,
          isActive: isActive !== undefined ? (isActive === true || isActive === "true") : existing[0].isActive,
          duration: result.duration,
          fileSize: result.fileSize,
          updatedAt: new Date(),
        })
        .where(eq(ivrMessages.id, req.params.id))
        .returning();

      if (updated[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(updated[0].id)).catch(() => {});
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Error regenerating stock MOH:", error);
      res.status(500).json({ error: `Stock MOH regeneration failed: ${error.message}` });
    }
  });

  // ============ STOCK MOH LIBRARY ============

  app.get("/api/ivr-messages/stock-moh", requireAuth, async (_req: Request, res: Response) => {
    try {
      const { STOCK_MOH_OPTIONS } = await import("./lib/stock-moh-generator");
      res.json(STOCK_MOH_OPTIONS);
    } catch (error: any) {
      console.error("Error fetching stock MOH options:", error);
      res.status(500).json({ error: "Failed to fetch stock MOH options" });
    }
  });

  app.post("/api/ivr-messages/stock-moh", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { stockId, name, countryCode } = req.body;
      if (!stockId) {
        return res.status(400).json({ error: "Stock MOH ID is required" });
      }

      const { generateStockMoh, STOCK_MOH_OPTIONS } = await import("./lib/stock-moh-generator");
      const option = STOCK_MOH_OPTIONS.find(o => o.id === stockId);
      if (!option) {
        return res.status(404).json({ error: "Unknown stock MOH option" });
      }

      const dir = path.join(DATA_ROOT, "ivr-audio");
      const result = await generateStockMoh(stockId, dir);

      const created = await db.insert(ivrMessages).values({
        name: name || option.name,
        type: "hold_music",
        source: "stock",
        filePath: path.relative(process.cwd(), result.filePath),
        textContent: null,
        ttsVoice: null,
        ttsGender: null,
        language: "EN",
        countryCode: countryCode || null,
        duration: result.duration,
        fileSize: result.fileSize,
      }).returning();

      if (created[0]?.filePath) {
        import("./lib/asterisk-audio-sync").then(m => m.syncSingleAudio(created[0].id)).catch(() => {});
      }

      res.status(201).json(created[0]);
    } catch (error: any) {
      console.error("Error generating stock MOH:", error);
      res.status(500).json({ error: `Stock MOH generation failed: ${error.message}` });
    }
  });

  app.get("/api/ivr-messages/stock-moh/:stockId/preview", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log(`[MOH Preview] Generating preview for: ${req.params.stockId}`);
      const { generateStockMoh, STOCK_MOH_OPTIONS } = await import("./lib/stock-moh-generator");
      const option = STOCK_MOH_OPTIONS.find(o => o.id === req.params.stockId);
      if (!option) {
        return res.status(404).json({ error: "Unknown stock MOH option" });
      }

      const tmpDir = path.join(DATA_ROOT, "ivr-audio", "previews");
      const startTime = Date.now();
      const result = await generateStockMoh(req.params.stockId, tmpDir, 15);
      console.log(`[MOH Preview] Generated ${result.fileSize} bytes in ${Date.now() - startTime}ms`);
      
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", result.fileSize.toString());
      res.setHeader("Cache-Control", "public, max-age=3600");
      const stream = fs.createReadStream(result.filePath);
      stream.pipe(res);
      stream.on("end", () => {
        try { fs.unlinkSync(result.filePath); } catch {}
      });
    } catch (error: any) {
      console.error("Error previewing stock MOH:", error);
      res.status(500).json({ error: "Preview generation failed" });
    }
  });

  // ============ AUDIO PLAYBACK ============

  app.get("/api/ivr-messages/:id/audio", requireAuth, async (req: Request, res: Response) => {
    try {
      const message = await db.select().from(ivrMessages).where(eq(ivrMessages.id, req.params.id)).limit(1);
      if (!message[0] || !message[0].filePath) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      const fullPath = path.resolve(process.cwd(), message[0].filePath);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "Audio file not found on disk" });
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".gsm": "audio/gsm",
      };

      res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(fullPath)}"`);
      fs.createReadStream(fullPath).pipe(res);
    } catch (error) {
      console.error("Error serving audio:", error);
      res.status(500).json({ error: "Failed to serve audio" });
    }
  });

  // ============ IVR MENUS ============

  app.get("/api/ivr-menus", requireAuth, async (req: Request, res: Response) => {
    try {
      const menus = await db.select().from(ivrMenus).orderBy(asc(ivrMenus.name));
      const menusWithOptions = await Promise.all(
        menus.map(async (menu) => {
          const options = await db.select().from(ivrMenuOptions)
            .where(eq(ivrMenuOptions.menuId, menu.id))
            .orderBy(asc(ivrMenuOptions.sortOrder));
          return { ...menu, options };
        })
      );
      res.json(menusWithOptions);
    } catch (error) {
      console.error("Error fetching IVR menus:", error);
      res.status(500).json({ error: "Failed to fetch IVR menus" });
    }
  });

  app.get("/api/ivr-menus/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const menu = await db.select().from(ivrMenus).where(eq(ivrMenus.id, req.params.id)).limit(1);
      if (!menu[0]) return res.status(404).json({ error: "IVR menu not found" });

      const options = await db.select().from(ivrMenuOptions)
        .where(eq(ivrMenuOptions.menuId, menu[0].id))
        .orderBy(asc(ivrMenuOptions.sortOrder));

      res.json({ ...menu[0], options });
    } catch (error) {
      console.error("Error fetching IVR menu:", error);
      res.status(500).json({ error: "Failed to fetch IVR menu" });
    }
  });

  app.post("/api/ivr-menus", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { options, ...menuData } = req.body;
      const created = await db.insert(ivrMenus).values(menuData).returning();
      const menu = created[0];

      if (options && Array.isArray(options) && options.length > 0) {
        await db.insert(ivrMenuOptions).values(
          options.map((opt: any, idx: number) => ({
            ...opt,
            menuId: menu.id,
            sortOrder: opt.sortOrder ?? idx,
          }))
        );
      }

      const fullOptions = await db.select().from(ivrMenuOptions)
        .where(eq(ivrMenuOptions.menuId, menu.id))
        .orderBy(asc(ivrMenuOptions.sortOrder));

      res.status(201).json({ ...menu, options: fullOptions });
    } catch (error: any) {
      console.error("Error creating IVR menu:", error);
      res.status(500).json({ error: `Failed to create IVR menu: ${error.message}` });
    }
  });

  app.put("/api/ivr-menus/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!["admin", "manager"].includes(user.role)) {
        return res.status(403).json({ error: "Admin or manager access required" });
      }

      const { options, ...menuData } = req.body;
      const updated = await db.update(ivrMenus)
        .set({ ...menuData, updatedAt: new Date() })
        .where(eq(ivrMenus.id, req.params.id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "IVR menu not found" });

      if (options && Array.isArray(options)) {
        await db.delete(ivrMenuOptions).where(eq(ivrMenuOptions.menuId, req.params.id));
        if (options.length > 0) {
          await db.insert(ivrMenuOptions).values(
            options.map((opt: any, idx: number) => ({
              ...opt,
              menuId: req.params.id,
              sortOrder: opt.sortOrder ?? idx,
            }))
          );
        }
      }

      const fullOptions = await db.select().from(ivrMenuOptions)
        .where(eq(ivrMenuOptions.menuId, req.params.id))
        .orderBy(asc(ivrMenuOptions.sortOrder));

      res.json({ ...updated[0], options: fullOptions });
    } catch (error: any) {
      console.error("Error updating IVR menu:", error);
      res.status(500).json({ error: `Failed to update IVR menu: ${error.message}` });
    }
  });

  app.delete("/api/ivr-menus/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      await db.delete(ivrMenus).where(eq(ivrMenus.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting IVR menu:", error);
      res.status(500).json({ error: "Failed to delete IVR menu" });
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
          ? await db.select({ id: users.id, fullName: users.fullName, username: users.username })
              .from(users).where(inArray(users.id, userIds))
          : [];
        const userMap = new Map(userList.map(u => [u.id, u]));

        res.json(states.map(s => ({
          ...s,
          userName: userMap.get(s.userId)?.fullName || userMap.get(s.userId)?.username || "Unknown",
        })));
      } else {
        const states = await db.select({
          status: agentQueueStatus,
          user: { id: users.id, fullName: users.fullName, username: users.username },
        })
          .from(agentQueueStatus)
          .leftJoin(users, eq(agentQueueStatus.userId, users.id));

        res.json(states.map(s => ({
          userId: s.status.userId,
          status: s.status.status,
          currentCallId: s.status.currentCallId,
          callsHandled: s.status.callsHandled,
          userName: s.user?.fullName || s.user?.username || "Unknown",
        })));
      }
    } catch (error) {
      console.error("Error fetching agent queue status:", error);
      res.status(500).json({ error: "Failed to fetch agent status" });
    }
  });

  app.post("/api/agent-queue-status/update", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const user = (req.session as any)?.user;
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
      const userId = (req.session as any)?.user?.id;
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

export async function autoConnectAri(): Promise<void> {
  try {
    const settings = await db.select().from(ariSettings).limit(1);
    if (settings.length === 0) {
      console.log("[ARI AutoConnect] No ARI settings configured, skipping");
      return;
    }

    const s = settings[0];
    if (!s.isEnabled) {
      console.log("[ARI AutoConnect] ARI is disabled in settings, skipping");
      return;
    }
    if (!s.autoConnect) {
      console.log("[ARI AutoConnect] Auto-connect is disabled, skipping (use manual Connect button)");
      return;
    }
    if (!s.host || !s.username || !s.password) {
      console.log("[ARI AutoConnect] ARI settings incomplete (missing host/username/password), skipping");
      return;
    }

    console.log(`[ARI AutoConnect] Connecting to Asterisk at ${s.host}:${s.port} (app: ${s.appName})...`);

    const client = initializeAriClient({
      host: s.host, port: s.port, protocol: s.protocol,
      username: s.username, password: s.password,
      appName: s.appName, wsProtocol: s.wsProtocol, wsPort: s.wsPort,
    });

    await client.connect();

    const engine = initializeQueueEngine(client);
    await engine.start();

    setupQueueEngineWebSocketEvents(engine);

    console.log("[ARI AutoConnect] Successfully connected to Asterisk and started queue engine");
  } catch (err: any) {
    console.error("[ARI AutoConnect] Failed to auto-connect:", err.message);
    console.log("[ARI AutoConnect] Will retry via reconnect mechanism or manual Connect button");
  }
}
