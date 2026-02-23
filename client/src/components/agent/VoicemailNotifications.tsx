import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Voicemail,
  Play,
  Pause,
  Phone,
  Clock,
  X,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface VoicemailNotificationsProps {
  queueIds: string[];
  onCallback: (phoneNumber: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VoicemailItem({ msg, onCallback, onMarkRead }: {
  msg: any;
  onCallback: (phone: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/voicemail-messages/${msg.id}/audio`);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        onMarkRead(msg.id);
      };
      audioRef.current.onerror = () => {
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [msg.id, isPlaying, onMarkRead]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-800/50 bg-card transition-all"
      data-testid={`voicemail-notif-${msg.id}`}
    >
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant={isPlaying ? "secondary" : "ghost"}
          className="shrink-0"
          onClick={handlePlay}
          data-testid={`btn-play-vm-${msg.id}`}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate" data-testid={`text-vm-caller-${msg.id}`}>
              {msg.callerName || msg.callerNumber}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {formatDuration(msg.durationSeconds)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            {msg.callerName && <span>{msg.callerNumber}</span>}
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatTime(msg.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="default"
            onClick={() => onCallback(msg.callerNumber)}
            data-testid={`btn-callback-vm-${msg.id}`}
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            Zavolať
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onMarkRead(msg.id)}
            title="Označiť ako prečítané"
            data-testid={`btn-dismiss-vm-${msg.id}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {msg.transcriptText && (
        <>
          <button
            className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5 hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Prepis
          </button>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-amber-200 dark:border-amber-800">
              {msg.transcriptText}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MinimizedVoicemailBadge({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="fixed top-4 right-[500px] z-[99] animate-in slide-in-from-top-2 duration-200" data-testid="voicemail-notif-minimized">
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-600 text-white shadow-lg transition-all cursor-pointer group"
        data-testid="btn-expand-voicemail"
      >
        <div className="relative">
          <Voicemail className="h-4 w-4" />
          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
        </div>
        <span className="text-sm font-semibold">{count}</span>
        <Maximize2 className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

export function VoicemailNotifications({ queueIds, onCallback }: VoicemailNotificationsProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const prevCountRef = useRef(0);

  const queryKey = ["/api/voicemail-messages", "agent-unread-all"];

  const { data: messages = [] } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      if (queueIds.length === 0) return [];
      const params = new URLSearchParams({
        status: "unread",
      });
      const res = await fetch(`/api/voicemail-messages?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: queueIds.length > 0,
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/voicemail-messages/${id}`, { status: "read" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleMarkRead = useCallback((id: string) => {
    markReadMutation.mutate(id);
  }, [markReadMutation]);

  useEffect(() => {
    if (messages.length > prevCountRef.current && isMinimized) {
      setIsMinimized(false);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isMinimized]);

  if (queueIds.length === 0) return null;

  if (messages.length === 0) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/4 z-[99]" data-testid="voicemail-empty-indicator">
        <div className="flex items-center gap-2 bg-card border rounded-full px-3 py-1.5 shadow-md text-muted-foreground text-xs">
          <Voicemail className="h-3.5 w-3.5" />
          <span>Žiadne nové odkazy</span>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return <MinimizedVoicemailBadge count={messages.length} onClick={() => setIsMinimized(false)} />;
  }

  return (
    <div className="fixed top-4 left-4 z-[99] w-[400px] animate-in slide-in-from-top-4 duration-300" data-testid="voicemail-notif-overlay">
      <Card className="shadow-2xl border-2 border-amber-500/50" data-testid="voicemail-notif-panel">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-600/10 to-amber-500/5 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="relative">
                <Voicemail className="h-4 w-4 text-amber-600" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              </div>
              Nepočúvané odkazy
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {messages.length} {messages.length === 1 ? "odkaz" : messages.length < 5 ? "odkazy" : "odkazov"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMinimized(true)}
                title="Minimalizovať"
                data-testid="btn-minimize-voicemail"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className={messages.length > 4 ? "h-[320px]" : ""}>
            <div className="space-y-2">
              {messages.map((msg: any) => (
                <VoicemailItem
                  key={msg.id}
                  msg={msg}
                  onCallback={onCallback}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
