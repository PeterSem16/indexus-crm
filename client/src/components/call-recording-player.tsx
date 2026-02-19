import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Download, Mic, Loader2 } from "lucide-react";
import type { CallRecording } from "@shared/schema";

interface CallRecordingPlayerProps {
  callLogId: string | number;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CallRecordingPlayer({ callLogId, compact = false }: CallRecordingPlayerProps) {
  const { data: recordings = [], isLoading } = useQuery<CallRecording[]>({
    queryKey: ["/api/call-recordings", { callLogId: String(callLogId) }],
    queryFn: async () => {
      const res = await fetch(`/api/call-recordings?callLogId=${callLogId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!callLogId,
  });

  if (isLoading) return null;
  if (!recordings.length) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {recordings.map((rec) => (
        <RecordingItem key={rec.id} recording={rec} compact={compact} />
      ))}
    </div>
  );
}

function RecordingItem({ recording, compact }: { recording: CallRecording; compact: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const audioSrc = `/api/call-recordings/${recording.id}/stream`;

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!audioRef.current.paused) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      audio.onloadedmetadata = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        console.error("[Recording] Playback error");
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, audioSrc, updateProgress]);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = recording.filename;
    a.click();
  }, [audioSrc, recording.filename]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5" data-testid={`recording-player-${recording.id}`}>
        <Mic className="h-3 w-3 text-muted-foreground shrink-0" />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={togglePlay} data-testid={`btn-play-recording-${recording.id}`}>
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <div className="flex-1 min-w-0">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={handleSeek}
            className="h-1"
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDownload} data-testid={`btn-download-recording-${recording.id}`}>
          <Download className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-2.5" data-testid={`recording-player-${recording.id}`}>
      <div className="flex items-center gap-2">
        <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium truncate flex-1">{recording.filename}</span>
        {recording.fileSizeBytes && (
          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
            {formatFileSize(recording.fileSizeBytes)}
          </Badge>
        )}
        {recording.analysisStatus === "pending" && (
          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
            Analysis
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={togglePlay} data-testid={`btn-play-recording-${recording.id}`}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <div className="flex-1 min-w-0">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={handleSeek}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleDownload} data-testid={`btn-download-recording-${recording.id}`}>
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
