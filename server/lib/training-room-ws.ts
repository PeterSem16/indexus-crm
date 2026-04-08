import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPPORTED_LANGUAGES: Record<string, string> = {
  sk: "Slovak",
  cs: "Czech",
  hu: "Hungarian",
  ro: "Romanian",
  it: "Italian",
  de: "German",
  pl: "Polish",
  en: "English",
  hr: "Croatian",
  si: "Slovenian",
  rs: "Serbian",
  ua: "Ukrainian",
  bg: "Bulgarian",
  fr: "French",
  es: "Spanish",
  at: "German (Austrian)",
};

interface RoomParticipant {
  ws: WebSocket;
  userId: string;
  userName: string;
  language: string;
  audioChunks: Buffer[];
  vadSilenceCount: number;
  isSpeaking: boolean;
}

interface TranslationRoom {
  id: string;
  participants: Map<string, RoomParticipant>;
  createdAt: Date;
  transcriptHistory: TranscriptEntry[];
}

interface TranscriptEntry {
  speaker: string;
  speakerName: string;
  original: string;
  originalLang: string;
  translation: string;
  targetLang: string;
  timestamp: number;
}

const VAD_SILENCE_THRESHOLD = 3;
const MIN_AUDIO_CHUNKS = 2;

class TrainingRoomWebSocketService {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, TranslationRoom> = new Map();
  private processingLock: Set<string> = new Set();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

    server.prependListener("upgrade", (req: any, socket: any, head: any) => {
      const pathname = req.url?.split("?")[0];
      if (pathname === "/ws/training-room") {
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          this.wss!.emit("connection", ws, req);
        });
        socket.end = () => {};
        socket.destroy = () => {};
      }
    });

    this.wss.on("connection", (ws, req) => {
      console.log("[TrainingRoom] New WS connection from:", req.url);
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");
      const userName = url.searchParams.get("userName") || "Unknown";
      const language = url.searchParams.get("language") || "sk";
      const roomId = url.searchParams.get("roomId");

      if (!userId || !roomId) {
        console.log("[TrainingRoom] Missing userId or roomId, closing");
        ws.close(1008, "userId and roomId required");
        return;
      }

      this.joinRoom(roomId, userId, userName, language, ws);

      ws.on("message", (data, isBinary) => {
        this.handleMessage(roomId, userId, data, isBinary);
      });

      ws.on("close", (code, reason) => {
        console.log(`[TrainingRoom] WS closed for ${userName}: code=${code}, reason=${reason?.toString()}`);
        this.leaveRoom(roomId, userId);
      });

      ws.on("error", (err) => {
        console.log(`[TrainingRoom] WS error for ${userName}: ${err.message}`);
        this.leaveRoom(roomId, userId);
      });
    });

    console.log("[TrainingRoom] WebSocket server initialized on /ws/training-room");
  }

  private joinRoom(roomId: string, userId: string, userName: string, language: string, ws: WebSocket) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        participants: new Map(),
        createdAt: new Date(),
        transcriptHistory: [],
      };
      this.rooms.set(roomId, room);
    }

    const participant: RoomParticipant = {
      ws,
      userId,
      userName,
      language,
      audioChunks: [],
      vadSilenceCount: 0,
      isSpeaking: false,
    };

    room.participants.set(userId, participant);

    this.broadcastToRoom(roomId, {
      type: "participant-joined",
      userId,
      userName,
      language,
      participantCount: room.participants.size,
    });

    ws.send(JSON.stringify({
      type: "connected",
      roomId,
      language,
      history: room.transcriptHistory.slice(-50),
      participants: Array.from(room.participants.values()).map(p => ({
        userId: p.userId,
        userName: p.userName,
        language: p.language,
      })),
    }));

    console.log(`[TrainingRoom] ${userName} (${language}) joined room ${roomId} — ${room.participants.size} participants`);
  }

  private leaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    room.participants.delete(userId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[TrainingRoom] Room ${roomId} closed (empty)`);
    } else {
      this.broadcastToRoom(roomId, {
        type: "participant-left",
        userId,
        userName: participant?.userName || "Unknown",
        participantCount: room.participants.size,
      });
    }
  }

  private handleMessage(roomId: string, userId: string, data: any, isBinary?: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (!participant) return;

    if (isBinary) {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      this.handleAudioChunk(room, participant, buffer);
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "audio-chunk" && msg.data) {
        const buffer = Buffer.from(msg.data, "base64");
        this.handleAudioChunk(room, participant, buffer);
      } else if (msg.type === "vad-speech-end") {
        this.processAccumulatedAudio(room, participant);
      } else if (msg.type === "text-message") {
        this.handleTextMessage(room, participant, msg.text);
      } else if (msg.type === "ping") {
        participant.ws.send(JSON.stringify({ type: "pong" }));
      } else if (msg.type === "change-language") {
        participant.language = msg.language;
        this.broadcastToRoom(room.id, {
          type: "language-changed",
          userId: participant.userId,
          userName: participant.userName,
          language: msg.language,
        });
      }
    } catch (e: any) {
      console.error(`[TrainingRoom] Message parse error: ${e.message}`);
    }
  }

  private handleAudioChunk(room: TranslationRoom, participant: RoomParticipant, chunk: Buffer) {
    const energy = this.calculateEnergy(chunk);
    const isSpeech = energy > 500;

    if (isSpeech) {
      participant.isSpeaking = true;
      participant.vadSilenceCount = 0;
      participant.audioChunks.push(chunk);

      this.broadcastToRoom(room.id, {
        type: "speaking",
        userId: participant.userId,
        userName: participant.userName,
      }, participant.userId);
    } else {
      if (participant.isSpeaking) {
        participant.vadSilenceCount++;
        participant.audioChunks.push(chunk);

        if (participant.vadSilenceCount >= VAD_SILENCE_THRESHOLD) {
          participant.isSpeaking = false;
          this.processAccumulatedAudio(room, participant);
        }
      }
    }
  }

  private calculateEnergy(chunk: Buffer): number {
    let sum = 0;
    for (let i = 0; i < chunk.length - 1; i += 2) {
      const sample = chunk.readInt16LE(i);
      sum += sample * sample;
    }
    return Math.sqrt(sum / (chunk.length / 2));
  }

  private async processAccumulatedAudio(room: TranslationRoom, participant: RoomParticipant) {
    if (participant.audioChunks.length < MIN_AUDIO_CHUNKS) {
      participant.audioChunks = [];
      participant.vadSilenceCount = 0;
      return;
    }

    const lockKey = `${room.id}:${participant.userId}`;
    if (this.processingLock.has(lockKey)) return;
    this.processingLock.add(lockKey);

    const audioData = Buffer.concat(participant.audioChunks);
    participant.audioChunks = [];
    participant.vadSilenceCount = 0;

    this.broadcastToRoom(room.id, {
      type: "stopped-speaking",
      userId: participant.userId,
    }, participant.userId);

    try {
      const wavBuffer = this.pcmToWav(audioData, 16000, 1, 16);

      const file = new File([wavBuffer], "audio.wav", { type: "audio/wav" });
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
        language: participant.language === "at" ? "de" : participant.language,
      });

      const originalText = transcription.text?.trim();
      if (!originalText || originalText.length < 2) {
        this.processingLock.delete(lockKey);
        return;
      }

      const otherParticipants = Array.from(room.participants.values()).filter(p => p.userId !== participant.userId);
      if (otherParticipants.length === 0) {
        this.processingLock.delete(lockKey);
        return;
      }

      const targetLanguages = [...new Set(otherParticipants.map(p => p.language))];

      for (const targetLang of targetLanguages) {
        if (targetLang === participant.language) {
          const entry: TranscriptEntry = {
            speaker: participant.userId,
            speakerName: participant.userName,
            original: originalText,
            originalLang: participant.language,
            translation: originalText,
            targetLang,
            timestamp: Date.now(),
          };
          room.transcriptHistory.push(entry);
          this.broadcastToRoom(room.id, { type: "transcript", ...entry });
          continue;
        }

        const sourceLangName = SUPPORTED_LANGUAGES[participant.language] || participant.language;
        const targetLangName = SUPPORTED_LANGUAGES[targetLang] || targetLang;

        const translation = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a professional medical interpreter specializing in cord blood banking terminology. Translate the following ${sourceLangName} text to ${targetLangName}. Keep medical terms accurate. Return ONLY the translation, nothing else.`,
            },
            { role: "user", content: originalText },
          ],
          temperature: 0.2,
          max_tokens: 500,
        });

        const translatedText = translation.choices[0]?.message?.content?.trim() || "";

        const entry: TranscriptEntry = {
          speaker: participant.userId,
          speakerName: participant.userName,
          original: originalText,
          originalLang: participant.language,
          translation: translatedText,
          targetLang,
          timestamp: Date.now(),
        };

        room.transcriptHistory.push(entry);

        this.broadcastToRoom(room.id, { type: "transcript", ...entry });
      }
    } catch (e: any) {
      console.error(`[TrainingRoom] STT/Translate error: ${e.message}`);
      this.broadcastToRoom(room.id, {
        type: "error",
        message: "Translation processing failed",
      });
    } finally {
      this.processingLock.delete(lockKey);
    }
  }

  private async handleTextMessage(room: TranslationRoom, participant: RoomParticipant, text: string) {
    if (!text?.trim()) return;

    const otherParticipants = Array.from(room.participants.values()).filter(p => p.userId !== participant.userId);
    const targetLanguages = [...new Set(otherParticipants.map(p => p.language))];

    for (const targetLang of targetLanguages) {
      let translatedText = text;

      if (targetLang !== participant.language) {
        const sourceLangName = SUPPORTED_LANGUAGES[participant.language] || participant.language;
        const targetLangName = SUPPORTED_LANGUAGES[targetLang] || targetLang;

        try {
          const translation = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Translate the following ${sourceLangName} text to ${targetLangName}. Return ONLY the translation.`,
              },
              { role: "user", content: text },
            ],
            temperature: 0.2,
            max_tokens: 500,
          });
          translatedText = translation.choices[0]?.message?.content?.trim() || text;
        } catch (e: any) {
          console.error(`[TrainingRoom] Text translate error: ${e.message}`);
          translatedText = text;
        }
      }

      const entry: TranscriptEntry = {
        speaker: participant.userId,
        speakerName: participant.userName,
        original: text,
        originalLang: participant.language,
        translation: translatedText,
        targetLang,
        timestamp: Date.now(),
      };

      room.transcriptHistory.push(entry);
      this.broadcastToRoom(room.id, { type: "transcript", ...entry });
    }
  }

  private pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }

  private broadcastToRoom(roomId: string, data: any, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const message = JSON.stringify(data);
    for (const [uid, participant] of room.participants) {
      if (excludeUserId && uid === excludeUserId) continue;
      if (participant.ws.readyState === WebSocket.OPEN) {
        participant.ws.send(message);
      }
    }
  }

  getActiveRooms(): Array<{ id: string; participantCount: number; createdAt: Date }> {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      participantCount: r.participants.size,
      createdAt: r.createdAt,
    }));
  }

  getRoomTranscript(roomId: string): TranscriptEntry[] {
    return this.rooms.get(roomId)?.transcriptHistory || [];
  }
}

export const trainingRoomWs = new TrainingRoomWebSocketService();
