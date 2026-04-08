import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Languages,
  Users,
  MessageSquare,
  Send,
  Loader2,
  Radio,
  Download,
  Archive,
  FileText,
  Paperclip,
  X,
  Image as ImageIcon,
  FileIcon,
  Eye,
  BrainCircuit,
  History,
  Copy,
  Link,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

const PARTICIPANT_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", border: "border-blue-300 dark:border-blue-700", bubble: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", bubbleBg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", border: "border-emerald-300 dark:border-emerald-700", bubble: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bubbleBg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
  { bg: "bg-violet-100 dark:bg-violet-900/40", border: "border-violet-300 dark:border-violet-700", bubble: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", bubbleBg: "bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", border: "border-amber-300 dark:border-amber-700", bubble: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", bubbleBg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
  { bg: "bg-rose-100 dark:bg-rose-900/40", border: "border-rose-300 dark:border-rose-700", bubble: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", bubbleBg: "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", border: "border-cyan-300 dark:border-cyan-700", bubble: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300", bubbleBg: "bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700", bubble: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", bubbleBg: "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-300 dark:border-indigo-700", bubble: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", bubbleBg: "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800" },
];

interface TranscriptEntry {
  speaker: string;
  speakerName: string;
  original: string;
  originalLang: string;
  translation: string;
  targetLang: string;
  timestamp: number;
  attachment?: { url: string; originalName: string; mimetype: string };
}

interface Participant {
  userId: string;
  userName: string;
  language: string;
}

interface ArchiveRecord {
  id: string;
  roomId: string;
  title: string;
  aiSummary: string | null;
  participants: string;
  createdAt: string;
  archivedByUserName: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export default function TrainingRoomPage({ initialRoomId }: { initialRoomId?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [myLanguage, setMyLanguage] = useState("sk");
  const [roomId, setRoomId] = useState(initialRoomId || "");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [speakingUserId, setSpeakingUserId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [textMessage, setTextMessage] = useState("");

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; name: string; mimetype: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [archivesDialogOpen, setArchivesDialogOpen] = useState(false);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<any>(null);

  const participantColorMap = useRef<Map<string, number>>(new Map());
  const nextColorIndex = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialRoomId && initialRoomId !== roomId && connectionStatus === "disconnected") {
      setRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const getParticipantColor = useCallback((userId: string) => {
    if (!participantColorMap.current.has(userId)) {
      participantColorMap.current.set(userId, nextColorIndex.current % PARTICIPANT_COLORS.length);
      nextColorIndex.current++;
    }
    return PARTICIPANT_COLORS[participantColorMap.current.get(userId)!];
  }, []);

  const connectToRoom = useCallback(() => {
    if (!roomId.trim()) {
      toast({ title: "Zadajte Room ID", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Nie ste prihlásený", variant: "destructive" });
      return;
    }

    setConnectionStatus("connecting");
    participantColorMap.current.clear();
    nextColorIndex.current = 0;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const userName = user.fullName || user.username || "Unknown";
    const wsUrl = `${protocol}//${window.location.host}/ws/training-room?userId=${user.id}&userName=${encodeURIComponent(userName)}&language=${myLanguage}&roomId=${encodeURIComponent(roomId.trim())}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
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
      setConnectionStatus("disconnected");
      setParticipants([]);
      setSpeakingUserId(null);
      stopAudioCapture();
      if (event.code !== 1000) {
        toast({ title: "Odpojený", description: `Training Room odpojený (kód: ${event.code})`, variant: "destructive" });
      }
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
      toast({ title: "Chyba pripojenia", variant: "destructive" });
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
          attachment: msg.attachment,
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
      case "attachment":
        setTranscript(prev => [...prev, {
          speaker: msg.speaker,
          speakerName: msg.speakerName,
          original: msg.originalName || "Príloha",
          originalLang: msg.originalLang || "",
          translation: "",
          targetLang: "",
          timestamp: msg.timestamp || Date.now(),
          attachment: { url: msg.url, originalName: msg.originalName, mimetype: msg.mimetype },
        }]);
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
    setAiSummary(null);
  }, []);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
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
    } catch {
      toast({ title: "Nepodarilo sa pristúpiť k mikrofónu", variant: "destructive" });
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopAudioCapture(); else startAudioCapture();
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

  const handleUploadAttachment = useCallback(async (file: File) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/training-room/upload-attachment", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      wsRef.current.send(JSON.stringify({
        type: "attachment",
        url: data.url,
        originalName: data.originalName,
        mimetype: data.mimetype,
      }));

      setTranscript(prev => [...prev, {
        speaker: user?.id || "",
        speakerName: user?.fullName || user?.username || "Unknown",
        original: data.originalName,
        originalLang: myLanguage,
        translation: "",
        targetLang: "",
        timestamp: Date.now(),
        attachment: { url: data.url, originalName: data.originalName, mimetype: data.mimetype },
      }]);

      toast({ title: "Príloha nahraná" });
    } catch {
      toast({ title: "Chyba pri nahrávaní prílohy", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  }, [user, myLanguage]);

  const generateAiSummary = useCallback(async () => {
    if (transcript.length === 0) return;
    setSummaryLoading(true);
    try {
      const res = await apiRequest("POST", "/api/training-room/generate-summary", {
        transcript,
        roomId,
        participants,
      });
      const data = await res.json();
      setAiSummary(data.summary);
      setSummaryDialogOpen(true);
    } catch {
      toast({ title: "Chyba pri generovaní zápisu", variant: "destructive" });
    } finally {
      setSummaryLoading(false);
    }
  }, [transcript, roomId, participants]);

  const downloadSummary = useCallback(() => {
    if (!aiSummary) return;
    const blob = new Blob([aiSummary], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zapis-training-${roomId}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aiSummary, roomId]);

  const exportTranscript = useCallback(() => {
    const lines = transcript.map(t => {
      const time = new Date(t.timestamp).toLocaleTimeString();
      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === t.originalLang);
      if (t.attachment) {
        return `[${time}] ${langInfo?.flag || ""} ${t.speakerName}: [Príloha: ${t.attachment.originalName}]`;
      }
      return `[${time}] ${langInfo?.flag || ""} ${t.speakerName}:\n  ${t.original}${t.translation && t.translation !== t.original ? `\n  → ${t.translation}` : ""}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-room-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, roomId]);

  const archiveToServer = useCallback(async () => {
    if (transcript.length === 0) return;
    setArchiving(true);
    try {
      const attachmentUrls = transcript
        .filter(t => t.attachment)
        .map(t => t.attachment!.url);

      await apiRequest("POST", "/api/training-room/archive", {
        roomId,
        transcript,
        aiSummary,
        participants,
        attachments: attachmentUrls,
      });
      toast({ title: "Archivované", description: "Tréningová komunikácia bola uložená na server" });
    } catch {
      toast({ title: "Chyba pri archivácii", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  }, [transcript, roomId, aiSummary, participants]);

  const loadArchives = useCallback(async () => {
    setArchivesLoading(true);
    try {
      const res = await fetch("/api/training-room/archives", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setArchives(data);
      }
    } catch { /* ignore */ } finally {
      setArchivesLoading(false);
    }
  }, []);

  const viewArchive = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/training-room/archives/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        data.transcript = typeof data.transcript === "string" ? JSON.parse(data.transcript) : data.transcript;
        data.participants = typeof data.participants === "string" ? JSON.parse(data.participants) : data.participants;
        setViewingArchive(data);
      }
    } catch {
      toast({ title: "Chyba pri načítaní archívu", variant: "destructive" });
    }
  }, []);

  const getLangInfo = (code: string) => SUPPORTED_LANGUAGES.find(l => l.code === code);
  const isMe = (userId: string) => userId === user?.id;

  const isImageFile = (mimetype: string) => mimetype?.startsWith("image/");

  return (
    <div className="flex h-full gap-3 p-2" data-testid="training-room-page">
      <div className="flex flex-col w-72 gap-3 shrink-0">
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Languages className="h-4 w-4" />
              Training Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-3 pb-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Môj jazyk</label>
              <Select value={myLanguage} onValueChange={changeLanguage} disabled={connectionStatus === "connected" && isRecording}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-language">
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
              <label className="text-xs font-medium mb-1 block">Room ID</label>
              <Input
                data-testid="input-room-id"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                placeholder="napr. training-sk-it"
                disabled={connectionStatus === "connected"}
                className="h-8 text-xs"
              />
            </div>

            {connectionStatus === "disconnected" ? (
              <Button data-testid="button-connect" onClick={connectToRoom} className="w-full h-8 text-xs" disabled={!roomId.trim()}>
                <Phone className="h-3.5 w-3.5 mr-1.5" />
                Pripojiť sa
              </Button>
            ) : connectionStatus === "connecting" ? (
              <Button disabled className="w-full h-8 text-xs">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Pripájam...
              </Button>
            ) : (
              <div className="space-y-1.5">
                <Button data-testid="button-toggle-mic" onClick={toggleRecording} variant={isRecording ? "destructive" : "default"} className="w-full h-8 text-xs">
                  {isRecording ? <><MicOff className="h-3.5 w-3.5 mr-1.5" />Zastaviť</> : <><Mic className="h-3.5 w-3.5 mr-1.5" />Mikrofón</>}
                </Button>
                <Button data-testid="button-disconnect" onClick={disconnectFromRoom} variant="outline" className="w-full h-8 text-xs">
                  <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
                  Odpojiť sa
                </Button>
                <Separator className="my-1" />
                <label className="text-[10px] font-medium text-muted-foreground block">Pozvať účastníkov</label>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[11px]"
                    data-testid="button-copy-room-name"
                    onClick={() => {
                      navigator.clipboard.writeText(roomId);
                      toast({ title: "Room ID skopírované", description: roomId });
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Room ID
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[11px]"
                    data-testid="button-copy-link"
                    onClick={() => {
                      const link = `${window.location.origin}/email?tab=training-room&room=${encodeURIComponent(roomId)}`;
                      navigator.clipboard.writeText(link);
                      toast({ title: "Link skopírovaný", description: "Zdieľajte ho s účastníkmi" });
                    }}
                  >
                    <Link className="h-3 w-3 mr-1" />
                    Odkaz
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Účastníci ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {participants.length === 0 ? (
              <p className="text-xs text-muted-foreground">Žiadni účastníci</p>
            ) : (
              <div className="space-y-1.5">
                {participants.map(p => {
                  const langInfo = getLangInfo(p.language);
                  const color = getParticipantColor(p.userId);
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between p-2 rounded-lg border ${color.bg} ${
                        speakingUserId === p.userId ? "border-green-500 ring-1 ring-green-400" : color.border
                      }`}
                      data-testid={`participant-${p.userId}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${color.bubble} shrink-0`} />
                        {speakingUserId === p.userId && (
                          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                        )}
                        <span className={`text-xs font-medium ${color.text}`}>
                          {p.userName}
                          {isMe(p.userId) && <span className="opacity-60"> (ja)</span>}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5">
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
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" onClick={generateAiSummary} disabled={summaryLoading} className="w-full text-xs h-8" data-testid="button-ai-summary">
              {summaryLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />}
              AI Zápis z tréningu
            </Button>
            <Button variant="outline" size="sm" onClick={archiveToServer} disabled={archiving} className="w-full text-xs h-8" data-testid="button-archive">
              {archiving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />}
              Archivovať na server
            </Button>
            <Button variant="outline" size="sm" onClick={exportTranscript} className="w-full text-xs h-8" data-testid="button-export">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Stiahnuť prepis
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setArchivesDialogOpen(true); loadArchives(); }}
          className="w-full text-xs h-8 text-muted-foreground"
          data-testid="button-view-archives"
        >
          <History className="h-3.5 w-3.5 mr-1.5" />
          Archív tréningov
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Živý prepis s prekladom
          </CardTitle>
          {connectionStatus === "connected" && (
            <Badge variant="outline" className="text-green-600 border-green-300 text-[10px]">
              <Radio className="h-2.5 w-2.5 mr-1 animate-pulse" />
              Pripojený
            </Badge>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Languages className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-base font-medium">Training Room</p>
                <p className="text-xs mt-1">Pripojte sa k miestnosti a zapnite mikrofón</p>
                <p className="text-[11px] mt-2 max-w-md text-center">
                  Hovorte vo svojom jazyku — ostatní účastníci uvidia preklad v reálnom čase.
                </p>
              </div>
            ) : (
              transcript.map((entry, idx) => {
                const langInfo = getLangInfo(entry.originalLang);
                const mine = isMe(entry.speaker);
                const color = getParticipantColor(entry.speaker);

                if (entry.attachment) {
                  return (
                    <div key={idx} className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`transcript-entry-${idx}`}>
                      <div className={`max-w-[75%] rounded-lg p-3 border ${mine ? "bg-primary/5 border-primary/20" : color.bubbleBg}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`h-2 w-2 rounded-full ${color.bubble} shrink-0`} />
                          <span className={`text-[11px] font-medium ${color.text}`}>{entry.speakerName}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {isImageFile(entry.attachment.mimetype) ? (
                          <button
                            onClick={() => setAttachmentPreview({ url: entry.attachment!.url, name: entry.attachment!.originalName, mimetype: entry.attachment!.mimetype })}
                            className="block rounded-md overflow-hidden border hover:opacity-90 transition-opacity cursor-pointer"
                            data-testid={`attachment-preview-${idx}`}
                          >
                            <img src={entry.attachment.url} alt={entry.attachment.originalName} className="max-w-[280px] max-h-[200px] object-contain" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setAttachmentPreview({ url: entry.attachment!.url, name: entry.attachment!.originalName, mimetype: entry.attachment!.mimetype })}
                            className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                            data-testid={`attachment-file-${idx}`}
                          >
                            <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate">{entry.attachment.originalName}</span>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`transcript-entry-${idx}`}>
                    <div className={`max-w-[75%] rounded-lg p-3 border ${mine ? "bg-primary text-primary-foreground border-primary" : color.bubbleBg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {!mine && <div className={`h-2 w-2 rounded-full ${color.bubble} shrink-0`} />}
                        <span className={`text-[11px] font-medium ${mine ? "opacity-80" : color.text}`}>
                          {langInfo?.flag} {entry.speakerName}
                        </span>
                        <span className={`text-[10px] ${mine ? "opacity-50" : "text-muted-foreground"}`}>
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{entry.original}</p>
                      {entry.translation && entry.translation !== entry.original && (
                        <>
                          <Separator className={`my-1.5 ${mine ? "bg-primary-foreground/20" : ""}`} />
                          <p className={`text-xs ${mine ? "opacity-80" : "text-muted-foreground"}`}>
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
              <div className="p-2 flex gap-2 items-center shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadAttachment(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachment}
                  data-testid="button-attach-file"
                >
                  {uploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Input
                  data-testid="input-text-message"
                  value={textMessage}
                  onChange={e => setTextMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendTextMessage()}
                  placeholder="Napíšte správu..."
                  className="flex-1 h-8 text-xs"
                />
                <Button data-testid="button-send-text" onClick={sendTextMessage} size="icon" className="h-8 w-8 shrink-0" disabled={!textMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-violet-500" />
              AI Zápis z tréningu
            </DialogTitle>
            <DialogDescription>
              Automaticky vygenerovaný zápis z tréningovej komunikácie
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none p-1 whitespace-pre-wrap">
              {aiSummary || "Žiadny zápis"}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={downloadSummary} disabled={!aiSummary} data-testid="button-download-summary">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Stiahnuť zápis
            </Button>
            <Button variant="outline" size="sm" onClick={() => { archiveToServer(); setSummaryDialogOpen(false); }} disabled={archiving} data-testid="button-archive-summary">
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archivovať
            </Button>
            <Button size="sm" onClick={() => setSummaryDialogOpen(false)}>Zavrieť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attachmentPreview} onOpenChange={() => setAttachmentPreview(null)}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileIcon className="h-4 w-4" />
              {attachmentPreview?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
            {attachmentPreview && isImageFile(attachmentPreview.mimetype) ? (
              <img src={attachmentPreview.url} alt={attachmentPreview.name} className="max-w-full max-h-[60vh] object-contain rounded" />
            ) : attachmentPreview?.mimetype === "application/pdf" ? (
              <iframe src={attachmentPreview.url} className="w-full h-[60vh] rounded border" title={attachmentPreview.name} />
            ) : (
              <div className="text-center space-y-3">
                <FileIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">{attachmentPreview?.name}</p>
                <a href={attachmentPreview?.url} download={attachmentPreview?.name} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Download className="h-3.5 w-3.5" />
                  Stiahnuť súbor
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={archivesDialogOpen} onOpenChange={setArchivesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-teal-500" />
              Archív tréningov
            </DialogTitle>
          </DialogHeader>
          {viewingArchive ? (
            <div className="flex-1 overflow-auto space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setViewingArchive(null)} className="text-xs">
                  ← Späť na zoznam
                </Button>
                <Badge variant="secondary" className="text-[10px]">{viewingArchive.roomId}</Badge>
              </div>
              <div className="text-sm font-medium">{viewingArchive.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(viewingArchive.createdAt).toLocaleString("sk-SK")} • {viewingArchive.archivedByUserName}
              </div>
              {viewingArchive.aiSummary && (
                <div className="border rounded-lg p-3 bg-violet-50/50 dark:bg-violet-950/20">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 mb-2">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    AI Zápis
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-xs">{viewingArchive.aiSummary}</div>
                </div>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="text-xs font-medium">Prepis komunikácie</div>
                {Array.isArray(viewingArchive.transcript) && viewingArchive.transcript.map((entry: any, idx: number) => (
                  <div key={idx} className="text-xs border rounded p-2">
                    <span className="font-medium">{entry.speakerName}</span>
                    <span className="text-muted-foreground ml-2">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <p className="mt-0.5">{entry.original}</p>
                    {entry.translation && entry.translation !== entry.original && (
                      <p className="text-muted-foreground mt-0.5">→ {entry.translation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[55vh]">
              {archivesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : archives.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Žiadne archivované tréningy</p>
              ) : (
                <div className="space-y-2">
                  {archives.map(arc => {
                    let participantNames = "";
                    try {
                      const parsed = typeof arc.participants === "string" ? JSON.parse(arc.participants) : arc.participants;
                      participantNames = parsed.map((p: any) => p.userName).join(", ");
                    } catch { /* ignore */ }
                    return (
                      <button
                        key={arc.id}
                        onClick={() => viewArchive(arc.id)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        data-testid={`archive-${arc.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{arc.title}</span>
                          <Badge variant="secondary" className="text-[10px]">{arc.roomId}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{new Date(arc.createdAt).toLocaleString("sk-SK")}</span>
                          <span>{arc.archivedByUserName}</span>
                          {participantNames && <span className="truncate max-w-[200px]">{participantNames}</span>}
                          {arc.aiSummary && (
                            <Badge variant="outline" className="text-[9px] h-4 text-violet-500 border-violet-300">
                              <BrainCircuit className="h-2.5 w-2.5 mr-0.5" />
                              AI
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
