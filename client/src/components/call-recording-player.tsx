import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, Download, Mic, Loader2, ChevronDown, ChevronUp, FileText, Brain, Star, AlertTriangle, CheckCircle2, ListChecks, Tag, RefreshCw, ClipboardCheck, ShieldAlert, SkipBack, SkipForward } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import type { CallRecording } from "@shared/schema";

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

interface CallRecordingPlayerProps {
  callLogId: string | number;
  compact?: boolean;
  onTimeUpdate?: (state: PlaybackState) => void;
}

interface RecordingAnalysis {
  id: string;
  analysisStatus: string;
  transcriptionText: string | null;
  transcriptionLanguage: string | null;
  sentiment: string | null;
  qualityScore: number | null;
  summary: string | null;
  keyTopics: string[] | null;
  actionItems: string[] | null;
  complianceNotes: string | null;
  scriptComplianceScore: number | null;
  scriptComplianceDetails: string | null;
  alertKeywords: string[] | null;
  analyzedAt: string | null;
  analysisResult: any;
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

function SentimentIcon({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const config: Record<string, { color: string; label: string }> = {
    positive: { color: "text-green-600 dark:text-green-400", label: "Pozitívny" },
    neutral: { color: "text-blue-600 dark:text-blue-400", label: "Neutrálny" },
    negative: { color: "text-orange-600 dark:text-orange-400", label: "Negatívny" },
    angry: { color: "text-red-600 dark:text-red-400", label: "Nahnevaný" },
  };
  const c = config[sentiment] || config.neutral;
  return (
    <Badge variant="secondary" className="text-[10px] h-5 gap-1" data-testid={`badge-sentiment-${sentiment}`}>
      <span className={`${c.color} font-semibold`}>{c.label}</span>
    </Badge>
  );
}

function QualityBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const color = score >= 8 ? "text-green-600 dark:text-green-400" : score >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return (
    <Badge variant="secondary" className="text-[10px] h-5 gap-1" data-testid="badge-quality-score">
      <Star className={`h-2.5 w-2.5 ${color}`} />
      <span className={color}>{score}/10</span>
    </Badge>
  );
}

function WaveformSeekBar({
  audioSrc,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  compact = false,
}: {
  audioSrc: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!audioSrc) return;
    let cancelled = false;
    const abortController = new AbortController();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    fetch(audioSrc, { credentials: "include", signal: abortController.signal })
      .then((res) => res.arrayBuffer())
      .then((buffer) => audioContext.decodeAudioData(buffer))
      .then((audioBuffer) => {
        if (cancelled) return;
        const rawData = audioBuffer.getChannelData(0);
        const samples = compact ? 80 : 150;
        const blockSize = Math.floor(rawData.length / samples);
        const data: number[] = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          data.push(sum / blockSize);
        }
        const maxVal = Math.max(...data);
        setWaveformData(data.map((v) => v / (maxVal || 1)));
      })
      .catch(() => {
        if (cancelled) return;
        const samples = compact ? 80 : 150;
        const fakeData: number[] = [];
        for (let i = 0; i < samples; i++) {
          fakeData.push(0.2 + Math.random() * 0.6);
        }
        setWaveformData(fakeData);
      })
      .finally(() => {
        audioContext.close().catch(() => {});
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [audioSrc, compact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    const progressX = progress * w;

    ctx.clearRect(0, 0, w, h);

    const barWidth = w / waveformData.length;
    const gap = Math.max(1, barWidth * 0.2);
    const barDrawWidth = barWidth - gap;
    const minBarHeight = 2;

    const isDark = document.documentElement.classList.contains("dark");

    const playedColor = isDark ? "rgba(220, 38, 38, 0.85)" : "rgba(153, 27, 27, 0.85)";
    const unplayedColor = isDark ? "rgba(120, 120, 130, 0.35)" : "rgba(160, 160, 170, 0.4)";
    const playedTopColor = isDark ? "rgba(239, 68, 68, 1)" : "rgba(185, 28, 28, 1)";
    const unplayedTopColor = isDark ? "rgba(140, 140, 150, 0.5)" : "rgba(180, 180, 190, 0.55)";

    for (let i = 0; i < waveformData.length; i++) {
      const x = i * barWidth + gap / 2;
      const barH = Math.max(minBarHeight, waveformData[i] * (h * 0.85));
      const y = (h - barH) / 2;

      const isPlayed = x + barDrawWidth <= progressX;
      const isPartial = x < progressX && x + barDrawWidth > progressX;

      if (isPlayed) {
        ctx.fillStyle = playedColor;
        ctx.fillRect(x, y, barDrawWidth, barH);
        ctx.fillStyle = playedTopColor;
        ctx.fillRect(x, y, barDrawWidth, Math.min(2, barH));
      } else if (isPartial) {
        const playedW = progressX - x;
        ctx.fillStyle = playedColor;
        ctx.fillRect(x, y, playedW, barH);
        ctx.fillStyle = unplayedColor;
        ctx.fillRect(x + playedW, y, barDrawWidth - playedW, barH);
      } else {
        ctx.fillStyle = unplayedColor;
        ctx.fillRect(x, y, barDrawWidth, barH);
        ctx.fillStyle = unplayedTopColor;
        ctx.fillRect(x, y, barDrawWidth, Math.min(1, barH));
      }
    }

    if (duration > 0 && progress > 0) {
      ctx.fillStyle = isDark ? "rgba(239, 68, 68, 1)" : "rgba(153, 27, 27, 1)";
      const knobRadius = compact ? 5 : 6;
      const knobY = h / 2;
      ctx.beginPath();
      ctx.arc(progressX, knobY, knobRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(progressX, knobY, knobRadius - 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, compact]);

  const getTimeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || duration <= 0) return 0;
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      const t = getTimeFromEvent(e);
      onSeek(t);

      const handleMouseMove = (ev: MouseEvent) => {
        const t2 = getTimeFromEvent(ev);
        onSeek(t2);
      };
      const cleanup = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", cleanup);
        dragCleanupRef.current = null;
      };
      dragCleanupRef.current = cleanup;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", cleanup);
    },
    [getTimeFromEvent, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && duration > 0) {
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          setHoverX(x);
          setHoverTime((x / rect.width) * duration);
        }
      }
    },
    [isDragging, duration]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) setHoverTime(null);
  }, [isDragging]);

  const barHeight = compact ? 32 : 44;

  return (
    <div className="relative w-full" data-testid="waveform-seekbar">
      <div
        ref={containerRef}
        className="relative cursor-pointer select-none"
        style={{ height: barHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: barHeight }}
        />
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-0 h-full w-px bg-foreground/20 pointer-events-none"
            style={{ left: hoverX }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
              {formatTime(hoverTime)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CallRecordingPlayer({ callLogId, compact = false, onTimeUpdate }: CallRecordingPlayerProps) {
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
        <RecordingItem key={rec.id} recording={rec} compact={compact} onTimeUpdate={onTimeUpdate} />
      ))}
    </div>
  );
}

function RecordingItem({ recording, compact, onTimeUpdate }: { recording: CallRecording; compact: boolean; onTimeUpdate?: (state: PlaybackState) => void }) {
  const { user } = useAuth();
  const canReanalyze = user && ["admin", "manager"].includes(user.role);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds || 0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const [showAnalysis, setShowAnalysis] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const audioSrc = `/api/call-recordings/${recording.id}/stream`;

  const { data: analysis, isLoading: analysisLoading } = useQuery<RecordingAnalysis>({
    queryKey: ["/api/call-recordings", recording.id, "analysis"],
    queryFn: async () => {
      const res = await fetch(`/api/call-recordings/${recording.id}/analysis`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return res.json();
    },
    enabled: showAnalysis,
    refetchInterval: (data) => {
      const q = data as unknown as RecordingAnalysis | undefined;
      if (q?.analysisStatus === "processing" || q?.analysisStatus === "pending") return 5000;
      return false;
    },
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/call-recordings/${recording.id}/reanalyze`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-recordings", recording.id, "analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    },
  });

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      const ct = audioRef.current.currentTime;
      setCurrentTime(ct);
      onTimeUpdateRef.current?.({ currentTime: ct, duration: audioRef.current.duration || duration, isPlaying: !audioRef.current.paused });
      if (!audioRef.current.paused) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [duration]);

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
        onTimeUpdateRef.current?.({ currentTime: 0, duration: audio.duration || duration, isPlaying: false });
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
      onTimeUpdateRef.current?.({ currentTime: audioRef.current.currentTime, duration: audioRef.current.duration || duration, isPlaying: false });
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, audioSrc, updateProgress]);


  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = recording.filename;
    a.click();
  }, [audioSrc, recording.filename]);

  const hasAnalysisData = recording.analysisStatus === "completed" || recording.analysisStatus === "processing";
  const isAnalyzing = recording.analysisStatus === "processing" || recording.analysisStatus === "pending";

  const handleSkip = useCallback((seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      onTimeUpdateRef.current?.({ currentTime: newTime, duration, isPlaying });
    }
  }, [duration, isPlaying]);

  const handleWaveformSeek = useCallback((time: number) => {
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      onTimeUpdateRef.current?.({ currentTime: time, duration: audioRef.current.duration || duration, isPlaying });
    }
  }, [duration, isPlaying]);

  const remainingTime = Math.max(0, duration - currentTime);

  if (compact) {
    return (
      <div className="space-y-1" data-testid={`recording-player-${recording.id}`}>
        <div className="rounded-lg bg-muted/40 px-2.5 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Mic className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleSkip(-10)} data-testid={`btn-skip-back-${recording.id}`}>
                <SkipBack className="h-2.5 w-2.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 bg-primary/10 hover:bg-primary/20" onClick={togglePlay} data-testid={`btn-play-recording-${recording.id}`}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleSkip(10)} data-testid={`btn-skip-forward-${recording.id}`}>
                <SkipForward className="h-2.5 w-2.5" />
              </Button>
            </div>
            <span className="text-[10px] text-primary font-mono font-semibold shrink-0">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">/</span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {formatTime(duration)}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleDownload} data-testid={`btn-download-recording-${recording.id}`}>
              <Download className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setShowAnalysis(!showAnalysis)} data-testid={`btn-toggle-analysis-${recording.id}`}>
              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            </Button>
          </div>
          <WaveformSeekBar
            audioSrc={audioSrc}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onSeek={handleWaveformSeek}
            compact={true}
          />
        </div>

        {(recording as any).sentiment && !showAnalysis && (
          <div className="flex items-center gap-1 px-2">
            <SentimentIcon sentiment={(recording as any).sentiment} />
            <QualityBadge score={(recording as any).qualityScore} />
          </div>
        )}

        {showAnalysis && (
          <AnalysisPanel
            analysis={analysis}
            loading={analysisLoading}
            compact={true}
            onReanalyze={() => reanalyzeMutation.mutate()}
            reanalyzing={reanalyzeMutation.isPending}
            canReanalyze={!!canReanalyze}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3" data-testid={`recording-player-${recording.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium truncate flex-1">{recording.filename}</span>
        {recording.fileSizeBytes && (
          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
            {formatFileSize(recording.fileSizeBytes)}
          </Badge>
        )}
        {isAnalyzing && (
          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
            Analýza...
          </Badge>
        )}
        {(recording as any).sentiment && <SentimentIcon sentiment={(recording as any).sentiment} />}
        {(recording as any).qualityScore && <QualityBadge score={(recording as any).qualityScore} />}
      </div>

      <WaveformSeekBar
        audioSrc={audioSrc}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={handleWaveformSeek}
      />

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-primary font-mono font-semibold w-10">
          {formatTime(currentTime)}
        </span>
        <div className="flex items-center gap-0.5 flex-1 justify-center">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSkip(-10)} data-testid={`btn-skip-back-${recording.id}`}>
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="default" className="h-8 w-8 rounded-full" onClick={togglePlay} data-testid={`btn-play-recording-${recording.id}`}>
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSkip(10)} data-testid={`btn-skip-forward-${recording.id}`}>
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
          -{formatTime(remainingTime)}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleDownload} data-testid={`btn-download-recording-${recording.id}`}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowAnalysis(!showAnalysis)}
          data-testid={`btn-toggle-analysis-full-${recording.id}`}
        >
          {showAnalysis ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {showAnalysis && (
        <AnalysisPanel
          analysis={analysis}
          loading={analysisLoading}
          compact={false}
          onReanalyze={() => reanalyzeMutation.mutate()}
          reanalyzing={reanalyzeMutation.isPending}
          canReanalyze={!!canReanalyze}
        />
      )}
    </div>
  );
}

function AnalysisPanel({
  analysis,
  loading,
  compact,
  onReanalyze,
  reanalyzing,
  canReanalyze,
}: {
  analysis: RecordingAnalysis | undefined;
  loading: boolean;
  compact: boolean;
  onReanalyze: () => void;
  reanalyzing: boolean;
  canReanalyze: boolean;
}) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
        <span className="text-xs text-muted-foreground">Načítavam analýzu...</span>
      </div>
    );
  }

  if (!analysis) return null;

  if (analysis.analysisStatus === "pending" || analysis.analysisStatus === "processing") {
    return (
      <div className="flex items-center gap-2 py-3 px-2 bg-muted/30 rounded-md mt-1">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {analysis.analysisStatus === "pending" ? "Čaká na analýzu..." : "Prebieha prepis a analýza..."}
        </span>
      </div>
    );
  }

  if (analysis.analysisStatus === "failed") {
    const errorDetail = (analysis.analysisResult as any)?.error || "";
    return (
      <div className="flex flex-col gap-1.5 py-3 px-2 bg-destructive/10 rounded-md mt-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive font-medium">Analýza zlyhala</span>
          {canReanalyze && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={onReanalyze} disabled={reanalyzing} data-testid="btn-reanalyze">
              {reanalyzing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Skúsiť znova
            </Button>
          )}
        </div>
        {errorDetail && (
          <span className="text-[10px] text-destructive/70 pl-6">{errorDetail}</span>
        )}
      </div>
    );
  }

  const textSize = compact ? "text-[10px]" : "text-xs";
  const headingSize = compact ? "text-[11px]" : "text-sm";

  const handleExport = (format: string) => {
    window.open(`/api/call-recordings/${analysis.id}/export-transcript?format=${format}`, "_blank");
  };

  return (
    <div className={`mt-2 space-y-2 ${compact ? "px-1" : ""}`} data-testid="analysis-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <SentimentIcon sentiment={analysis.sentiment} />
        <QualityBadge score={analysis.qualityScore} />
        {analysis.scriptComplianceScore !== null && analysis.scriptComplianceScore !== undefined && (
          <Badge variant="secondary" className="text-[10px] h-5 gap-1" data-testid="badge-script-compliance">
            <ClipboardCheck className={`h-2.5 w-2.5 ${analysis.scriptComplianceScore >= 8 ? "text-green-600 dark:text-green-400" : analysis.scriptComplianceScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`} />
            <span className={analysis.scriptComplianceScore >= 8 ? "text-green-600 dark:text-green-400" : analysis.scriptComplianceScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
              Skript {analysis.scriptComplianceScore}/10
            </span>
          </Badge>
        )}
        {canReanalyze && (
          <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={onReanalyze} disabled={reanalyzing} data-testid="btn-reanalyze-completed">
            {reanalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {analysis.alertKeywords && analysis.alertKeywords.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-2" data-testid="alert-keywords-section">
          <div className="flex items-center gap-1 mb-1">
            <ShieldAlert className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-red-500`} />
            <span className={`${headingSize} font-medium text-red-700 dark:text-red-400`}>Upozornenia</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.alertKeywords.map((kw, i) => (
              <Badge key={i} variant="destructive" className="text-[10px]">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      {analysis.summary && (
        <div className="bg-muted/40 rounded-md p-2">
          <div className="flex items-center gap-1 mb-1">
            <Brain className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground`} />
            <span className={`${headingSize} font-medium`}>Súhrn</span>
          </div>
          <p className={`${textSize} text-foreground leading-relaxed`}>{analysis.summary}</p>
        </div>
      )}

      {analysis.scriptComplianceDetails && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-2" data-testid="script-compliance-section">
          <div className="flex items-center gap-1 mb-1">
            <ClipboardCheck className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-blue-500`} />
            <span className={`${headingSize} font-medium text-blue-700 dark:text-blue-400`}>Dodržiavanie skriptu</span>
          </div>
          <p className={`${textSize} text-blue-700 dark:text-blue-300 leading-relaxed`}>{analysis.scriptComplianceDetails}</p>
        </div>
      )}

      {analysis.keyTopics && analysis.keyTopics.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Tag className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground`} />
            <span className={`${headingSize} font-medium`}>Témy</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.keyTopics.map((topic, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{topic}</Badge>
            ))}
          </div>
        </div>
      )}

      {analysis.actionItems && analysis.actionItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <ListChecks className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground`} />
            <span className={`${headingSize} font-medium`}>Akčné body</span>
          </div>
          <ul className="space-y-0.5">
            {analysis.actionItems.map((item, i) => (
              <li key={i} className={`flex items-start gap-1.5 ${textSize}`}>
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.complianceNotes && (
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md p-2">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-orange-500`} />
            <span className={`${headingSize} font-medium text-orange-700 dark:text-orange-400`}>Compliance</span>
          </div>
          <p className={`${textSize} text-orange-700 dark:text-orange-300`}>{analysis.complianceNotes}</p>
        </div>
      )}

      {analysis.transcriptionText && (
        <div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-1 h-7"
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              data-testid="btn-toggle-transcript"
            >
              <FileText className="h-3 w-3" />
              <span className={textSize}>{showFullTranscript ? "Skryť prepis" : "Zobraziť prepis hovoru"}</span>
              {showFullTranscript ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={() => handleExport("txt")}
              data-testid="btn-export-transcript-txt"
            >
              <Download className="h-3 w-3" />
              <span className={textSize}>TXT</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={() => handleExport("json")}
              data-testid="btn-export-transcript-json"
            >
              <Download className="h-3 w-3" />
              <span className={textSize}>JSON</span>
            </Button>
          </div>
          {showFullTranscript && (
            <ScrollArea className={`${compact ? "max-h-[150px]" : "max-h-[300px]"} mt-1`}>
              <div className="bg-muted/40 rounded-md p-3">
                <p className={`${textSize} text-foreground whitespace-pre-wrap leading-relaxed`}>
                  {analysis.transcriptionText}
                </p>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
