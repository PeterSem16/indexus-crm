import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { virtualAgentConfigs, virtualAgentConversations, customers } from "@shared/schema";
import { eq, or, ilike } from "drizzle-orm";
import type { AriClient, AriEvent } from "./ari-client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ConversationTurn {
  role: "assistant" | "user";
  content: string;
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
}

export class VirtualAgentEngine {
  private ariClient: AriClient;
  private activeSessions: Map<string, VirtualAgentSession> = new Map();

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

    const session: VirtualAgentSession = {
      configId: config.id,
      queueId,
      channelId,
      callerNumber,
      callerName,
      customerId,
      conversationId: conversation.id,
      turns: [],
      turnCount: 0,
      startTime: Date.now(),
      channelGone: false,
    };

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

  private async runConversationLoop(
    session: VirtualAgentSession,
    config: typeof virtualAgentConfigs.$inferSelect
  ): Promise<void> {
    console.log(`[VirtualAgent] Starting conversation with ${session.callerNumber} (config: ${config.name})`);

    try {
      const chInfo = await this.ariClient.getChannel(session.channelId);
      if (chInfo?.state !== "Up") {
        await this.ariClient.answerChannel(session.channelId);
      }
    } catch {
      console.log(`[VirtualAgent] Channel ${session.channelId} not available, aborting`);
      return;
    }

    await new Promise(r => setTimeout(r, 500));
    if (session.channelGone) return;

    const greetingAudio = await this.generateTTS(config.greetingText, config.ttsVoice, session.channelId);
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

      const aiResponse = await this.generateResponse(session, config, userSpeech);
      if (session.channelGone || !aiResponse) break;

      session.turns.push({ role: "assistant", content: aiResponse });
      session.turnCount++;

      console.log(`[VirtualAgent] Turn ${session.turnCount}: AI responds: "${aiResponse.substring(0, 100)}..."`);

      const responseAudio = await this.generateTTS(aiResponse, config.ttsVoice, session.channelId);
      if (!responseAudio || session.channelGone) break;

      await this.playAudioFile(session.channelId, responseAudio);
      if (session.channelGone) break;
    }

    if (!session.channelGone) {
      const farewellAudio = await this.generateTTS(config.farewellText, config.ttsVoice, session.channelId);
      if (farewellAudio && !session.channelGone) {
        await this.playAudioFile(session.channelId, farewellAudio);
      }
      await new Promise(r => setTimeout(r, 1000));
      try { await this.ariClient.hangupChannel(session.channelId, "normal"); } catch {}
    }
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
        maxSilenceSeconds: config.silenceTimeoutSeconds || 3,
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

      await new Promise(r => setTimeout(r, 1000));

      let audioBuffer: Buffer | null = null;

      try {
        const { downloadVoicemailRecordingFromAsterisk } = await import("./asterisk-audio-sync");
        const { DATA_ROOT } = await import("../config/storage-paths");
        const tmpDir = path.join(DATA_ROOT, "virtual-agent-tmp");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const sftpResult = await downloadVoicemailRecordingFromAsterisk(recordingName, tmpDir);
        if (sftpResult.success && sftpResult.localPath) {
          audioBuffer = fs.readFileSync(sftpResult.localPath);
          try { fs.unlinkSync(sftpResult.localPath); } catch {}
        }
      } catch {}

      if (!audioBuffer) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await new Promise(r => setTimeout(r, 500 + attempt * 500));
            audioBuffer = await this.ariClient.downloadStoredRecording(recordingName);
            break;
          } catch {}
        }
      }

      if (!audioBuffer || audioBuffer.length < 1000) {
        console.log(`[VirtualAgent] Recording too small or failed, possibly silence`);
        return null;
      }

      try { await this.ariClient.deleteStoredRecording(recordingName); } catch {}

      const tmpPath = path.join("/tmp", `${recordingName}.wav`);
      fs.writeFileSync(tmpPath, audioBuffer);

      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpPath),
          model: "whisper-1",
          language: config.language === "sk" ? "sk" : config.language === "cs" ? "cs" : config.language === "hu" ? "hu" : "en",
        });

        const text = (transcription as any).text || (transcription as unknown as string);
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
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: `${config.systemPrompt}\n\nDôležité pravidlá:\n- Odpovedaj stručne, maximálne 2-3 vety.\n- Volajúci číslo: ${session.callerNumber}\n- Ak volajúci chce spätné volanie, potvrď to.\n- Na konci konverzácie zhrň zozbierané informácie.`
        },
      ];

      for (const turn of session.turns) {
        messages.push({ role: turn.role, content: turn.content });
      }
      messages.push({ role: "user", content: userSpeech });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || null;
    } catch (err) {
      console.error(`[VirtualAgent] GPT response error:`, err);
      return null;
    }
  }

  private async generateTTS(
    text: string,
    voice: string,
    channelId: string
  ): Promise<string | null> {
    try {
      const ttsVoice = (voice || "nova") as "nova" | "shimmer" | "alloy" | "coral" | "sage" | "onyx" | "echo" | "fable" | "ash";
      const mp3Response = await openai.audio.speech.create({
        model: "tts-1",
        voice: ttsVoice,
        input: text,
        response_format: "mp3",
      });

      const { DATA_ROOT } = await import("../config/storage-paths");
      const ttsDir = path.join(DATA_ROOT, "virtual-agent-tts");
      if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });

      const fileName = `va-tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const mp3Path = path.join(ttsDir, `${fileName}.mp3`);
      const wavPath = path.join(ttsDir, `${fileName}.wav`);

      const arrayBuffer = await mp3Response.arrayBuffer();
      fs.writeFileSync(mp3Path, Buffer.from(arrayBuffer));

      const { execSync } = await import("child_process");
      try {
        execSync(`ffmpeg -i "${mp3Path}" -ar 8000 -ac 1 -sample_fmt s16 -acodec pcm_s16le "${wavPath}" -y 2>/dev/null`);
      } catch {
        console.warn(`[VirtualAgent] FFmpeg conversion failed, trying direct upload`);
        fs.copyFileSync(mp3Path, wavPath);
      }

      try { fs.unlinkSync(mp3Path); } catch {}

      try {
        const { syncVoicemailGreetingToAsterisk } = await import("./asterisk-audio-sync");
        const result = await syncVoicemailGreetingToAsterisk(wavPath, fileName);
        if (result.success) {
          console.log(`[VirtualAgent] Uploaded TTS to Asterisk: ${fileName}`);
        } else {
          console.warn(`[VirtualAgent] SFTP upload failed: ${result.error}`);
        }
      } catch (err) {
        console.warn(`[VirtualAgent] SFTP upload failed:`, err instanceof Error ? err.message : err);
      }

      try { fs.unlinkSync(wavPath); } catch {}

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
