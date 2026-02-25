import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { db } from "../db";
import { virtualAgentConfigs, virtualAgentConversations, customers, communicationMessages, callLogs, users, inboundQueues, ivrMessages } from "@shared/schema";
import { eq, or, ilike, desc, and, sql } from "drizzle-orm";
import type { AriClient, AriEvent } from "./ari-client";
import { syncVoicemailGreetingToAsterisk, prewarmSftpPool, uploadBufferToAsterisk } from "./asterisk-audio-sync";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let _dataRoot: string | null = null;
async function getDataRoot(): Promise<string> {
  if (!_dataRoot) {
    const { DATA_ROOT } = await import("../config/storage-paths");
    _dataRoot = DATA_ROOT;
  }
  return _dataRoot;
}

function downsample24kTo8k(pcm24k: Buffer): Buffer {
  const samples24k = new Int16Array(pcm24k.buffer, pcm24k.byteOffset, pcm24k.length / 2);
  const ratio = 3;
  const outLen = Math.floor(samples24k.length / ratio);
  const samples8k = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    samples8k[i] = samples24k[i * ratio];
  }
  return Buffer.from(samples8k.buffer);
}

function createWavBuffer(pcmData: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

interface ConversationTurn {
  role: "assistant" | "user";
  content: string;
}

interface CustomerContext {
  found: boolean;
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  lastEmail?: { subject: string; sentBy: string; sentAt: string } | null;
  lastCall?: { direction: string; calledBy: string; calledAt: string; durationSeconds: number } | null;
  lastSms?: { direction: string; content: string; sentAt: string; sentBy: string } | null;
}

interface VirtualAgentSession {
  configId: string;
  queueId?: string;
  channelId: string;
  callerNumber: string;
  callerName: string;
  customerId: string | null;
  conversationId: string;
  turns: ConversationTurn[];
  turnCount: number;
  startTime: number;
  channelGone: boolean;
  customerContext: CustomerContext | null;
}

export class VirtualAgentEngine {
  private ariClient: AriClient;
  private activeSessions: Map<string, VirtualAgentSession> = new Map();
  private cachedFarewells: Map<string, string> = new Map();
  private cachedGreetings: Map<string, string> = new Map();
  private currentTtsModel: string = "tts-1";
  private queueMohSoundName: string | null = null;

  constructor(ariClient: AriClient) {
    this.ariClient = ariClient;
  }

  async startConversation(
    channelId: string,
    configId: string,
    callerNumber: string,
    callerName: string,
    customerId: string | null,
    queueId?: string
  ): Promise<void> {
    const [config] = await db.select().from(virtualAgentConfigs)
      .where(eq(virtualAgentConfigs.id, configId)).limit(1);

    if (!config || !config.isActive) {
      console.warn(`[VirtualAgent] Config ${configId} not found or inactive`);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
      return;
    }

    const [conversation] = await db.insert(virtualAgentConversations).values({
      configId: config.id,
      queueId: queueId || null,
      callerNumber,
      callerName: callerName || null,
      customerId,
      status: "active",
      turns: 0,
    }).returning();

    const customerContext = await this.lookupCustomerByPhone(callerNumber, customerId);
    const resolvedCustomerId = customerId || customerContext.customerId || null;

    const session: VirtualAgentSession = {
      configId: config.id,
      queueId,
      channelId,
      callerNumber,
      callerName,
      customerId: resolvedCustomerId,
      conversationId: conversation.id,
      turns: [],
      turnCount: 0,
      startTime: Date.now(),
      channelGone: false,
      customerContext: customerContext.found ? customerContext : null,
    };

    if (resolvedCustomerId && resolvedCustomerId !== customerId) {
      try {
        await db.update(virtualAgentConversations)
          .set({ customerId: resolvedCustomerId })
          .where(eq(virtualAgentConversations.id, conversation.id));
      } catch {}
    }

    this.activeSessions.set(channelId, session);

    const stasisEndHandler = (event: AriEvent) => {
      if (event.channel?.id === channelId) {
        session.channelGone = true;
      }
    };
    const channelDestroyedHandler = (event: AriEvent) => {
      if (event.channel?.id === channelId) {
        session.channelGone = true;
      }
    };
    this.ariClient.on("stasis-end", stasisEndHandler);
    this.ariClient.on("channel-destroyed", channelDestroyedHandler);

    this.prewarmSftpConnection();

    try {
      await this.runConversationLoop(session, config);
    } catch (err) {
      console.error(`[VirtualAgent] Conversation error for ${channelId}:`, err);
    } finally {
      this.ariClient.removeListener("stasis-end", stasisEndHandler);
      this.ariClient.removeListener("channel-destroyed", channelDestroyedHandler);
      this.activeSessions.delete(channelId);
      await this.finalizeConversation(session, config);
    }
  }

  private async lookupCustomerByPhone(callerNumber: string, existingCustomerId: string | null): Promise<CustomerContext> {
    try {
      const normalizedNumbers = this.normalizePhoneVariants(callerNumber);

      let customer: any = null;
      if (existingCustomerId) {
        const [c] = await db.select().from(customers).where(eq(customers.id, existingCustomerId)).limit(1);
        customer = c;
      }

      if (!customer) {
        for (const num of normalizedNumbers) {
          const [c] = await db.select().from(customers).where(or(
            eq(customers.phone, num),
            eq(customers.mobile, num),
            eq(customers.mobile2, num),
          )).limit(1);
          if (c) { customer = c; break; }
        }
      }

      if (!customer) {
        console.log(`[VirtualAgent] No customer found for phone ${callerNumber}`);
        return { found: false };
      }

      console.log(`[VirtualAgent] Customer found: ${customer.firstName} ${customer.lastName} (${customer.id})`);

      const [lastEmail, lastCall, lastSms] = await Promise.all([
        db.select({
          subject: communicationMessages.subject,
          sentAt: communicationMessages.sentAt,
          userId: communicationMessages.userId,
        }).from(communicationMessages)
          .where(and(
            eq(communicationMessages.customerId, customer.id),
            eq(communicationMessages.type, "email"),
          ))
          .orderBy(desc(communicationMessages.createdAt))
          .limit(1),

        db.select({
          direction: callLogs.direction,
          userId: callLogs.userId,
          startedAt: callLogs.startedAt,
          durationSeconds: callLogs.durationSeconds,
        }).from(callLogs)
          .where(eq(callLogs.customerId, customer.id))
          .orderBy(desc(callLogs.startedAt))
          .limit(1),

        db.select({
          direction: communicationMessages.direction,
          content: communicationMessages.content,
          sentAt: communicationMessages.sentAt,
          userId: communicationMessages.userId,
        }).from(communicationMessages)
          .where(and(
            eq(communicationMessages.customerId, customer.id),
            eq(communicationMessages.type, "sms"),
          ))
          .orderBy(desc(communicationMessages.createdAt))
          .limit(1),
      ]);

      const userIds = new Set<string>();
      if (lastEmail[0]?.userId) userIds.add(lastEmail[0].userId);
      if (lastCall[0]?.userId) userIds.add(lastCall[0].userId);
      if (lastSms[0]?.userId) userIds.add(lastSms[0].userId);

      const userMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const usersList = await db.select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(sql`${users.id} IN (${sql.join([...userIds].map(id => sql`${id}`), sql`, `)})`);
        for (const u of usersList) {
          userMap[u.id] = u.fullName;
        }
      }

      const formatDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString("sk-SK") + " " + new Date(d).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }) : "neznámy";

      const ctx: CustomerContext = {
        found: true,
        customerId: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone || customer.mobile || callerNumber,
        country: customer.country,
        lastEmail: lastEmail[0] ? {
          subject: lastEmail[0].subject || "(bez predmetu)",
          sentBy: userMap[lastEmail[0].userId || ""] || "neznámy",
          sentAt: formatDate(lastEmail[0].sentAt),
        } : null,
        lastCall: lastCall[0] ? {
          direction: lastCall[0].direction === "inbound" ? "prichádzajúci" : "odchádzajúci",
          calledBy: userMap[lastCall[0].userId] || "neznámy",
          calledAt: formatDate(lastCall[0].startedAt),
          durationSeconds: lastCall[0].durationSeconds || 0,
        } : null,
        lastSms: lastSms[0] ? {
          direction: lastSms[0].direction === "inbound" ? "prichádzajúca" : "odchádzajúca",
          content: (lastSms[0].content || "").substring(0, 100),
          sentAt: formatDate(lastSms[0].sentAt),
          sentBy: userMap[lastSms[0].userId || ""] || "neznámy",
        } : null,
      };

      return ctx;
    } catch (err) {
      console.error(`[VirtualAgent] Customer lookup error:`, err);
      return { found: false };
    }
  }

  private normalizePhoneVariants(phone: string): string[] {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    const variants = [cleaned, phone];
    if (cleaned.startsWith("+")) {
      variants.push(cleaned.substring(1));
      if (cleaned.startsWith("+421")) {
        variants.push("0" + cleaned.substring(4));
      }
    } else if (cleaned.startsWith("00")) {
      variants.push("+" + cleaned.substring(2));
    } else if (cleaned.startsWith("0")) {
      variants.push("+421" + cleaned.substring(1));
    }
    return [...new Set(variants)];
  }

  private async runConversationLoop(
    session: VirtualAgentSession,
    config: typeof virtualAgentConfigs.$inferSelect
  ): Promise<void> {
    console.log(`[VirtualAgent] Starting conversation with ${session.callerNumber} (config: ${config.name})`);
    this.currentTtsModel = (config as any).ttsModel || "tts-1";

    if (session.queueId) {
      try {
        const [queue] = await db.select({ holdMusicId: inboundQueues.holdMusicId })
          .from(inboundQueues).where(eq(inboundQueues.id, session.queueId)).limit(1);
        if (queue?.holdMusicId) {
          const [holdMsg] = await db.select({ name: ivrMessages.name })
            .from(ivrMessages).where(eq(ivrMessages.id, queue.holdMusicId)).limit(1);
          if (holdMsg) {
            this.queueMohSoundName = holdMsg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            console.log(`[VirtualAgent] Using queue MOH: custom/${this.queueMohSoundName}`);
          }
        }
      } catch {}
    }

    try {
      const chInfo = await this.ariClient.getChannel(session.channelId);
      if (chInfo?.state !== "Up") {
        await this.ariClient.answerChannel(session.channelId);
      }
    } catch {
      console.log(`[VirtualAgent] Channel ${session.channelId} not available, aborting`);
      return;
    }

    await new Promise(r => setTimeout(r, 100));
    if (session.channelGone) return;

    const configSpeed = parseFloat(config.ttsSpeed as any) || 1.05;

    const farewellCacheKey = `${config.id}-farewell`;
    const farewellPromise = !this.cachedFarewells.has(farewellCacheKey)
      ? this.generateTTS(config.farewellText, config.ttsVoice, session.channelId, configSpeed).then(audio => {
          if (audio) this.cachedFarewells.set(farewellCacheKey, audio);
          return audio;
        })
      : Promise.resolve(this.cachedFarewells.get(farewellCacheKey)!);

    const greetingCacheKey = `${config.id}-greeting`;
    let greetingAudio = this.cachedGreetings.get(greetingCacheKey) || null;
    if (!greetingAudio) {
      greetingAudio = await this.generateTTS(config.greetingText, config.ttsVoice, session.channelId, configSpeed);
      if (greetingAudio) this.cachedGreetings.set(greetingCacheKey, greetingAudio);
    }
    if (!greetingAudio || session.channelGone) return;

    await this.playAudioFile(session.channelId, greetingAudio);
    if (session.channelGone) return;

    session.turns.push({ role: "assistant", content: config.greetingText });
    session.turnCount++;

    while (session.turnCount < config.maxTurns * 2 && !session.channelGone) {
      const userSpeech = await this.recordAndTranscribe(session, config);

      if (session.channelGone || !userSpeech) break;

      session.turns.push({ role: "user", content: userSpeech });
      session.turnCount++;

      console.log(`[VirtualAgent] Turn ${session.turnCount}: User said: "${userSpeech.substring(0, 100)}..."`);

      this.playThinkingTone(session.channelId);

      const turnStart = Date.now();
      const aiResponse = await this.generateResponse(session, config, userSpeech);
      if (session.channelGone || !aiResponse) break;
      const gptTime = Date.now() - turnStart;

      session.turns.push({ role: "assistant", content: aiResponse });
      session.turnCount++;

      const ttsStart = Date.now();
      const responseAudio = await this.generateTTS(aiResponse, config.ttsVoice, session.channelId, configSpeed);
      if (!responseAudio || session.channelGone) break;
      const ttsTime = Date.now() - ttsStart;

      console.log(`[VirtualAgent] Turn ${session.turnCount}: GPT=${gptTime}ms, TTS+upload=${ttsTime}ms, total=${Date.now() - turnStart}ms: "${aiResponse.substring(0, 80)}"`);

      await this.stopThinkingTone(session.channelId);

      await this.playAudioFile(session.channelId, responseAudio);
      if (session.channelGone) break;
    }

    if (!session.channelGone) {
      const farewellAudio = await farewellPromise;
      if (farewellAudio && !session.channelGone) {
        await this.playAudioFile(session.channelId, farewellAudio);
      }
      await new Promise(r => setTimeout(r, 200));
      try { await this.ariClient.hangupChannel(session.channelId, "normal"); } catch {}
    }
  }

  private async prewarmSftpConnection(): Promise<void> {
    try {
      await prewarmSftpPool();
    } catch {}
  }

  private async playThinkingTone(channelId: string): Promise<void> {
    try {
      if (this.queueMohSoundName) {
        const pbId = `va-moh-${channelId}-${Date.now()}`;
        this.mohPlaybackId = pbId;
        await this.ariClient.playMedia(channelId, `sound:custom/${this.queueMohSoundName}`, pbId);
      } else {
        await this.ariClient.startMoh(channelId, "default");
      }
    } catch {}
  }

  private mohPlaybackId: string | null = null;

  private async stopThinkingTone(channelId: string): Promise<void> {
    try {
      if (this.mohPlaybackId) {
        try { await this.ariClient.stopPlayback(this.mohPlaybackId); } catch {}
        this.mohPlaybackId = null;
      }
      try { await this.ariClient.stopMoh(channelId); } catch {}
    } catch {}
  }

  private async recordAndTranscribe(
    session: VirtualAgentSession,
    config: typeof virtualAgentConfigs.$inferSelect
  ): Promise<string | null> {
    const recordingName = `va-${session.conversationId}-${session.turnCount}-${Date.now()}`;
    const maxSeconds = config.maxRecordingSeconds || 30;

    try {
      await this.ariClient.startRecordingAdvanced(session.channelId, {
        name: recordingName,
        format: "wav",
        maxSilenceSeconds: config.silenceTimeoutSeconds || 2,
        maxDurationSeconds: maxSeconds,
        beep: false,
        terminateOn: "none",
      });

      await new Promise<void>((resolve) => {
        const maxTimer = setTimeout(() => {
          cleanup();
          resolve();
        }, (maxSeconds + 5) * 1000);

        const recordingHandler = (event: AriEvent) => {
          if (event.recording?.name === recordingName) {
            cleanup();
            resolve();
          }
        };
        const hangupHandler = (event: AriEvent) => {
          if (event.channel?.id === session.channelId) {
            cleanup();
            resolve();
          }
        };

        const cleanup = () => {
          clearTimeout(maxTimer);
          this.ariClient.removeListener("recording-finished", recordingHandler);
          this.ariClient.removeListener("channel-hangup-request", hangupHandler);
          this.ariClient.removeListener("channel-destroyed", hangupHandler);
          this.ariClient.removeListener("stasis-end", hangupHandler);
        };

        this.ariClient.on("recording-finished", recordingHandler);
        this.ariClient.on("channel-hangup-request", hangupHandler);
        this.ariClient.on("channel-destroyed", hangupHandler);
        this.ariClient.on("stasis-end", hangupHandler);
      });

      try { await this.ariClient.stopRecording(recordingName); } catch {}

      if (session.channelGone) return null;

      const dlStart = Date.now();
      let audioBuffer: Buffer | null = null;

      try {
        audioBuffer = await this.ariClient.downloadStoredRecording(recordingName);
      } catch {}

      if (!audioBuffer) {
        try {
          const { downloadVoicemailRecordingFromAsterisk } = await import("./asterisk-audio-sync");
          const dataRoot = await getDataRoot();
          const tmpDir = path.join(dataRoot, "virtual-agent-tmp");
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

          const sftpResult = await downloadVoicemailRecordingFromAsterisk(recordingName, tmpDir);
          if (sftpResult.success && sftpResult.localPath) {
            audioBuffer = fs.readFileSync(sftpResult.localPath);
            try { fs.unlinkSync(sftpResult.localPath); } catch {}
          }
        } catch {}
      }

      if (!audioBuffer) {
        try {
          await new Promise(r => setTimeout(r, 200));
          audioBuffer = await this.ariClient.downloadStoredRecording(recordingName);
        } catch {}
      }

      console.log(`[VirtualAgent] Recording download: ${Date.now() - dlStart}ms, size: ${audioBuffer?.length || 0}`);

      if (!audioBuffer || audioBuffer.length < 1000) {
        console.log(`[VirtualAgent] Recording too small or failed, possibly silence`);
        return null;
      }

      try { await this.ariClient.deleteStoredRecording(recordingName); } catch {}

      const tmpPath = path.join("/tmp", `${recordingName}.wav`);
      fs.writeFileSync(tmpPath, audioBuffer);

      try {
        const sttStart = Date.now();
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpPath),
          model: "whisper-1",
          language: config.language === "sk" ? "sk" : config.language === "cs" ? "cs" : config.language === "hu" ? "hu" : "en",
          response_format: "text",
        });
        console.log(`[VirtualAgent] Whisper STT: ${Date.now() - sttStart}ms`);

        const text = typeof transcription === "string" ? transcription : (transcription as any).text || "";
        try { fs.unlinkSync(tmpPath); } catch {}

        if (!text || text.trim().length < 2) return null;
        return text.trim();
      } catch (err) {
        console.error(`[VirtualAgent] Transcription failed:`, err);
        try { fs.unlinkSync(tmpPath); } catch {}
        return null;
      }
    } catch (err) {
      console.error(`[VirtualAgent] Record/transcribe error:`, err);
      return null;
    }
  }

  private async generateResponse(
    session: VirtualAgentSession,
    config: typeof virtualAgentConfigs.$inferSelect,
    userSpeech: string
  ): Promise<string | null> {
    try {
      let customerInfo = "";
      if (session.customerContext?.found) {
        const ctx = session.customerContext;
        customerInfo = `\nVolajúci: ${ctx.name}, tel: ${ctx.phone}${ctx.email ? `, email: ${ctx.email}` : ""}`;
        if (ctx.lastCall) customerInfo += ` | Posl. hovor: ${ctx.lastCall.calledAt}`;
        if (ctx.lastEmail) customerInfo += ` | Posl. email: "${ctx.lastEmail.subject}"`;
        customerInfo += `\nOslovuj klienta menom.`;
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: `${config.systemPrompt}\nOdpovedaj VEĽMI stručne, max 1-2 krátke vety. Volajúci: ${session.callerNumber}${customerInfo}`
        },
      ];

      for (const turn of session.turns) {
        messages.push({ role: turn.role, content: turn.content });
      }
      messages.push({ role: "user", content: userSpeech });

      const gptModel = (config as any).gptModel || "gpt-4o-mini";
      const gptTemp = parseFloat((config as any).gptTemperature as any) || 0.5;
      const gptMaxTokens = (config as any).gptMaxTokens || 80;

      const stream = await openai.chat.completions.create({
        model: gptModel,
        messages,
        max_tokens: gptMaxTokens,
        temperature: gptTemp,
        stream: true,
      });

      let result = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) result += delta;
      }

      return result || null;
    } catch (err) {
      console.error(`[VirtualAgent] GPT response error:`, err);
      return null;
    }
  }

  private async generateTTS(
    text: string,
    voice: string,
    channelId: string,
    speed?: number
  ): Promise<string | null> {
    const t0 = Date.now();
    try {
      const ttsVoice = (voice || "nova") as "nova" | "shimmer" | "alloy" | "coral" | "sage" | "onyx" | "echo" | "fable" | "ash";
      const ttsSpeed = Math.min(Math.max(speed || 1.05, 0.25), 4.0);
      const ttsResponse = await openai.audio.speech.create({
        model: (this.currentTtsModel as any) || "tts-1",
        voice: ttsVoice,
        input: text,
        response_format: "pcm",
        speed: ttsSpeed,
      });
      const ttsApiTime = Date.now() - t0;

      const arrayBuffer = await ttsResponse.arrayBuffer();
      const pcm24k = Buffer.from(arrayBuffer);

      const pcm8k = downsample24kTo8k(pcm24k);
      const wavBuffer = createWavBuffer(pcm8k, 8000);
      const convTime = Date.now() - t0 - ttsApiTime;

      const fileName = `va-tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        const uploadStart = Date.now();
        const result = await uploadBufferToAsterisk(wavBuffer, fileName);
        const uploadTime = Date.now() - uploadStart;
        if (result.success) {
          console.log(`[VirtualAgent] TTS: api=${ttsApiTime}ms, conv=${convTime}ms, sftp=${uploadTime}ms, total=${Date.now() - t0}ms`);
        } else {
          console.warn(`[VirtualAgent] SFTP upload failed: ${result.error}`);
        }
      } catch (err) {
        console.warn(`[VirtualAgent] SFTP upload failed:`, err instanceof Error ? err.message : err);
      }

      return fileName;
    } catch (err) {
      console.error(`[VirtualAgent] TTS generation failed:`, err);
      return null;
    }
  }

  private async playAudioFile(channelId: string, soundName: string): Promise<void> {
    try {
      const pbId = `va-pb-${channelId}-${Date.now()}`;
      await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
      await this.waitForPlaybackFinished(pbId, 60000);
    } catch (err) {
      console.warn(`[VirtualAgent] Playback failed:`, err instanceof Error ? err.message : err);
    }
  }

  private waitForPlaybackFinished(playbackId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.ariClient.removeListener("playback-finished", handler);
        resolve();
      }, timeoutMs);
      const handler = (event: AriEvent) => {
        if (event.playback?.id === playbackId) {
          clearTimeout(timer);
          this.ariClient.removeListener("playback-finished", handler);
          resolve();
        }
      };
      this.ariClient.on("playback-finished", handler);
    });
  }

  private async finalizeConversation(
    session: VirtualAgentSession,
    config: typeof virtualAgentConfigs.$inferSelect
  ): Promise<void> {
    const durationSeconds = Math.round((Date.now() - session.startTime) / 1000);

    const fullTranscript = session.turns
      .map(t => `${t.role === "assistant" ? "Asistent" : "Volajúci"}: ${t.content}`)
      .join("\n\n");

    let summary = "";
    let sentiment = "neutral";
    let urgency = "medium";
    let keyTopics: string[] = [];
    let callbackRequested = false;
    let callbackNumber: string | null = null;

    if (session.turns.length > 1 && process.env.OPENAI_API_KEY) {
      try {
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Analyzuj nasledujúci prepis rozhovoru medzi virtuálnym asistentom a volajúcim. Vráť JSON s poľami:
- summary (stručné zhrnutie v slovenčine, 2-3 vety)
- sentiment (positive/negative/neutral)
- urgency (low/medium/high)
- keyTopics (pole kľúčových tém)
- callbackRequested (boolean - či volajúci žiada spätné volanie)
- callbackNumber (string alebo null - telefón pre spätné volanie ak bol poskytnutý)
Vráť IBA platný JSON, žiadny iný text.`
            },
            { role: "user", content: fullTranscript }
          ],
          max_tokens: 500,
          temperature: 0.3,
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || "";
        try {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            summary = analysis.summary || "";
            sentiment = analysis.sentiment || "neutral";
            urgency = analysis.urgency || "medium";
            keyTopics = analysis.keyTopics || [];
            callbackRequested = analysis.callbackRequested || false;
            callbackNumber = analysis.callbackNumber || null;
          }
        } catch {}
      } catch (err) {
        console.warn(`[VirtualAgent] Analysis failed:`, err);
      }
    }

    await db.update(virtualAgentConversations)
      .set({
        status: "completed",
        transcript: fullTranscript,
        summary,
        sentiment,
        urgency,
        keyTopics,
        turns: Math.floor(session.turnCount / 2),
        durationSeconds,
        callbackRequested,
        callbackNumber: callbackNumber || session.callerNumber,
      })
      .where(eq(virtualAgentConversations.id, session.conversationId));

    console.log(`[VirtualAgent] Conversation ${session.conversationId} finalized: ${session.turnCount} turns, ${durationSeconds}s, sentiment=${sentiment}, urgency=${urgency}`);

    if (session.customerId) {
      try {
        const { customers } = await import("@shared/schema");
        console.log(`[VirtualAgent] Customer ${session.customerId} had virtual agent conversation ${session.conversationId}`);
      } catch {}
    }
  }
}
