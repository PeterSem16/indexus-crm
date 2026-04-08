import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSip } from "@/contexts/sip-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Languages,
  Users,
  MessageSquare,
  Send,
  Loader2,
  Radio,
  Copy,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_LANGUAGES = [
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "cs", label: "Čeština", flag: "🇨🇿" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ua", label: "Українська", flag: "🇺🇦" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
];

interface TranscriptEntry {
  speaker: string;
  speakerName: string;
  original: string;
  originalLang: string;
  translation: string;
  targetLang: string;
  timestamp: number;
}

interface Participant {
  userId: string;
  userName: string;
  language: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export default function TrainingRoomPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [myLanguage, setMyLanguage] = useState("sk");
  const [roomId, setRoomId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [speakingUserId, setSpeakingUserId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [textMessage, setTextMessage] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const connectToRoom = useCallback(() => {
    console.log("[TrainingRoom] connectToRoom called, roomId:", roomId, "user:", user?.id);
    if (!roomId.trim()) {
      toast({ title: "Zadajte Room ID", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Nie ste prihlásený", variant: "destructive" });
      return;
    }

    setConnectionStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const userName = user.fullName || user.username || "Unknown";
    const wsUrl = `${protocol}//${window.location.host}/ws/training-room?userId=${user.id}&userName=${encodeURIComponent(userName)}&language=${myLanguage}&roomId=${encodeURIComponent(roomId.trim())}`;

    console.log("[TrainingRoom] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[TrainingRoom] WS connected successfully");
      setConnectionStatus("connected");
      toast({ title: "Pripojený", description: `Training Room: ${roomId}` });

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 25000);
      (ws as any)._pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {
        console.error("[TrainingRoom] WS parse error:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("[TrainingRoom] WS closed, code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      setConnectionStatus("disconnected");
      setParticipants([]);
      setSpeakingUserId(null);
      stopAudioCapture();
      if (event.code !== 1000) {
        toast({ title: "Odpojený", description: `Training Room odpojený (kód: ${event.code})`, variant: "destructive" });
      }
    };

    ws.onerror = (err) => {
      console.error("[TrainingRoom] WebSocket error:", err);
      setConnectionStatus("disconnected");
      toast({ title: "Chyba pripojenia", description: "Nepodarilo sa pripojiť k Training Room serveru", variant: "destructive" });
    };
  }, [roomId, user, myLanguage]);

  const handleWsMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case "connected":
        setParticipants(msg.participants || []);
        if (msg.history?.length > 0) {
          setTranscript(msg.history);
        }
        break;
      case "participant-joined":
        setParticipants(prev => {
          if (prev.find(p => p.userId === msg.userId)) return prev;
          return [...prev, { userId: msg.userId, userName: msg.userName, language: msg.language }];
        });
        break;
      case "participant-left":
        setParticipants(prev => prev.filter(p => p.userId !== msg.userId));
        break;
      case "transcript":
        setTranscript(prev => [...prev, {
          speaker: msg.speaker,
          speakerName: msg.speakerName,
          original: msg.original,
          originalLang: msg.originalLang,
          translation: msg.translation,
          targetLang: msg.targetLang,
          timestamp: msg.timestamp,
        }]);
        break;
      case "speaking":
        setSpeakingUserId(msg.userId);
        break;
      case "stopped-speaking":
        setSpeakingUserId(prev => prev === msg.userId ? null : prev);
        break;
      case "language-changed":
        setParticipants(prev => prev.map(p =>
          p.userId === msg.userId ? { ...p, language: msg.language } : p
        ));
        break;
    }
  }, []);

  const disconnectFromRoom = useCallback(() => {
    stopAudioCapture();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
    setParticipants([]);
    setTranscript([]);
  }, []);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        wsRef.current.send(JSON.stringify({ type: "audio-chunk", data: base64 }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
    } catch (e: any) {
      console.error("[TrainingRoom] Mic access error:", e);
      toast({ title: "Nepodarilo sa pristúpiť k mikrofónu", variant: "destructive" });
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopAudioCapture();
    } else {
      startAudioCapture();
    }
  }, [isRecording, startAudioCapture, stopAudioCapture]);

  const sendTextMessage = useCallback(() => {
    if (!textMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "text-message", text: textMessage.trim() }));

    setTranscript(prev => [...prev, {
      speaker: user?.id || "",
      speakerName: user?.fullName || user?.username || "Unknown",
      original: textMessage.trim(),
      originalLang: myLanguage,
      translation: "",
      targetLang: "",
      timestamp: Date.now(),
    }]);

    setTextMessage("");
  }, [textMessage, user, myLanguage]);

  const changeLanguage = useCallback((newLang: string) => {
    setMyLanguage(newLang);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "change-language", language: newLang }));
    }
  }, []);

  const exportTranscript = useCallback(() => {
    const lines = transcript.map(t => {
      const time = new Date(t.timestamp).toLocaleTimeString();
      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === t.originalLang);
      return `[${time}] ${langInfo?.flag || ""} ${t.speakerName}:\n  ${t.original}\n  → ${t.translation}\n`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-room-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, roomId]);

  const getLangInfo = (code: string) => SUPPORTED_LANGUAGES.find(l => l.code === code);
  const isMe = (userId: string) => userId === user?.id;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4" data-testid="training-room-page">
      <div className="flex flex-col w-80 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-5 w-5" />
              Training Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Môj jazyk</label>
              <Select value={myLanguage} onValueChange={changeLanguage} disabled={connectionStatus === "connected" && isRecording}>
                <SelectTrigger data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Room ID</label>
              <Input
                data-testid="input-room-id"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                placeholder="napr. training-sk-it"
                disabled={connectionStatus === "connected"}
              />
            </div>

            {connectionStatus === "disconnected" ? (
              <Button
                data-testid="button-connect"
                onClick={connectToRoom}
                className="w-full"
                disabled={!roomId.trim()}
              >
                <Phone className="h-4 w-4 mr-2" />
                Pripojiť sa
              </Button>
            ) : connectionStatus === "connecting" ? (
              <Button disabled className="w-full">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pripájam...
              </Button>
            ) : (
              <div className="space-y-2">
                <Button
                  data-testid="button-toggle-mic"
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "default"}
                  className="w-full"
                >
                  {isRecording ? (
                    <><MicOff className="h-4 w-4 mr-2" />Zastaviť mikrofón</>
                  ) : (
                    <><Mic className="h-4 w-4 mr-2" />Zapnúť mikrofón</>
                  )}
                </Button>
                <Button
                  data-testid="button-disconnect"
                  onClick={disconnectFromRoom}
                  variant="outline"
                  className="w-full"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Odpojiť sa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Účastníci ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadni účastníci</p>
            ) : (
              <div className="space-y-2">
                {participants.map(p => {
                  const langInfo = getLangInfo(p.language);
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between p-2 rounded-lg border ${
                        speakingUserId === p.userId
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : "border-border"
                      }`}
                      data-testid={`participant-${p.userId}`}
                    >
                      <div className="flex items-center gap-2">
                        {speakingUserId === p.userId && (
                          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                        )}
                        <span className="text-sm font-medium">
                          {p.userName}
                          {isMe(p.userId) && <span className="text-muted-foreground"> (ja)</span>}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {langInfo?.flag} {langInfo?.code.toUpperCase()}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {transcript.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportTranscript} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Exportovať prepis
          </Button>
        )}
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Živý prepis s prekladom
          </CardTitle>
          {connectionStatus === "connected" && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Radio className="h-3 w-3 mr-1 animate-pulse" />
              Pripojený
            </Badge>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Languages className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Training Room</p>
                <p className="text-sm mt-1">Pripojte sa k miestnosti a zapnite mikrofón</p>
                <p className="text-xs mt-3 max-w-md text-center">
                  Hovorte vo svojom jazyku — ostatní účastníci uvidia preklad v reálnom čase.
                  Môžete aj písať textové správy.
                </p>
              </div>
            ) : (
              transcript.map((entry, idx) => {
                const langInfo = getLangInfo(entry.originalLang);
                const mine = isMe(entry.speaker);
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                    data-testid={`transcript-entry-${idx}`}
                  >
                    <div className={`max-w-[75%] rounded-lg p-3 ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium opacity-80">
                          {langInfo?.flag} {entry.speakerName}
                        </span>
                        <span className="text-xs opacity-50">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{entry.original}</p>
                      {entry.translation && entry.translation !== entry.original && (
                        <>
                          <Separator className={`my-2 ${mine ? "bg-primary-foreground/20" : ""}`} />
                          <p className={`text-sm ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                            {getLangInfo(entry.targetLang)?.flag} {entry.translation}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          {connectionStatus === "connected" && (
            <>
              <Separator />
              <div className="p-3 flex gap-2">
                <Input
                  data-testid="input-text-message"
                  value={textMessage}
                  onChange={e => setTextMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendTextMessage()}
                  placeholder="Napíšte správu (preloží sa automaticky)..."
                  className="flex-1"
                />
                <Button
                  data-testid="button-send-text"
                  onClick={sendTextMessage}
                  size="icon"
                  disabled={!textMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
