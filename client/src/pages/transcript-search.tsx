import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Star, AlertTriangle, Download, ChevronDown, ChevronUp, Loader2, Phone, User, Megaphone, Clock, Filter, X, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, MicOff, Brain, List, Calendar, UserCircle, Activity, Tag, BarChart3, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface TranscriptResult {
  id: string;
  callLogId: string;
  customerId: string | null;
  customerName: string | null;
  agentName: string | null;
  campaignName: string | null;
  phoneNumber: string | null;
  durationSeconds: number | null;
  sentiment: string | null;
  qualityScore: number | null;
  scriptComplianceScore: number | null;
  summary: string | null;
  alertKeywords: string[] | null;
  transcriptionText: string;
  createdAt: string;
}

interface CallLogEntry {
  id: string;
  userId: string;
  customerId: string | null;
  campaignId: string | null;
  phoneNumber: string;
  direction: string;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
  customerName: string | null;
  campaignName: string | null;
  hasRecording: boolean;
  recording: {
    id: string;
    analysisStatus: string | null;
    transcriptionText: string | null;
    sentiment: string | null;
    qualityScore: number | null;
    scriptComplianceScore: number | null;
    summary: string | null;
    alertKeywords: string[] | null;
    customerName: string | null;
    agentName: string | null;
    campaignName: string | null;
  } | null;
}

interface CampaignBasic {
  id: string;
  name: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function highlightText(text: string, query: string): JSX.Element {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded-sm font-medium">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function getSnippet(text: string, query: string, maxLen = 300): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.substring(0, maxLen) + (text.length > maxLen ? "..." : "");
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + query.length + 200);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const config: Record<string, { cls: string; label: string }> = {
    positive: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40", label: "Pozit." },
    neutral: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40", label: "Neutr." },
    negative: { cls: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40", label: "Negat." },
    angry: { cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40", label: "Nahn." },
  };
  const c = config[sentiment] || config.neutral;
  return <Badge variant="secondary" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (!score) return null;
  const color = score >= 8 ? "text-green-600 dark:text-green-400" : score >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <Star className={`h-2.5 w-2.5 ${color}`} />
      <span className={color}>{score}/10</span>
      <span className="text-muted-foreground ml-0.5">{label}</span>
    </Badge>
  );
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  if (status === "failed" || status === "no_answer" || status === "busy") {
    return <PhoneMissed className="h-4 w-4 text-destructive" />;
  }
  if (direction === "inbound") {
    return <PhoneIncoming className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  return <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    completed: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40", label: "Dokonceny" },
    failed: { cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40", label: "Zlyhany" },
    no_answer: { cls: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40", label: "Neprijaty" },
    busy: { cls: "text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950/40", label: "Obsadeny" },
    cancelled: { cls: "text-muted-foreground bg-muted", label: "Zruseny" },
    initiated: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40", label: "Zahajeny" },
    ringing: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40", label: "Zvoni" },
    answered: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40", label: "Prebieha" },
  };
  const c = config[status] || { cls: "text-muted-foreground bg-muted", label: status };
  return <Badge variant="secondary" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function CallLogCard({ log }: { log: CallLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const rec = log.recording;
  const hasTranscription = rec?.transcriptionText;

  return (
    <Card className="p-3" data-testid={`call-log-${log.id}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <DirectionIcon direction={log.direction} status={log.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {log.phoneNumber}
            </span>
            {log.customerName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {log.customerName}
              </span>
            )}
            {log.campaignName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Megaphone className="h-2.5 w-2.5" />
                {log.campaignName}
              </Badge>
            )}
            {rec?.agentName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UserCircle className="h-3 w-3" />
                {rec.agentName}
              </span>
            )}
            <StatusBadge status={log.status} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDuration(log.durationSeconds)}
            </span>
            {log.hasRecording ? (
              <Badge variant="secondary" className="text-[10px] gap-1 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40">
                <Mic className="h-2.5 w-2.5" />
                Nahrane
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1 text-muted-foreground">
                <MicOff className="h-2.5 w-2.5" />
                Bez nahravky
              </Badge>
            )}
            {rec?.analysisStatus === "completed" && (
              <Badge variant="secondary" className="text-[10px] gap-1 text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40">
                <Brain className="h-2.5 w-2.5" />
                Analyzovane
              </Badge>
            )}
            {rec?.analysisStatus === "processing" && (
              <Badge variant="secondary" className="text-[10px] gap-1 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Spracovava sa
              </Badge>
            )}
          </div>

          {rec && rec.analysisStatus === "completed" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <SentimentBadge sentiment={rec.sentiment} />
                <ScoreBadge score={rec.qualityScore} label="Kvalita" />
                <ScoreBadge score={rec.scriptComplianceScore} label="Skript" />
                {rec.alertKeywords && rec.alertKeywords.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {rec.alertKeywords.length}
                  </Badge>
                )}
              </div>
              {rec.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">{rec.summary}</p>
              )}
              {hasTranscription && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1"
                    onClick={() => setExpanded(!expanded)}
                    data-testid={`btn-expand-transcript-${log.id}`}
                  >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="text-[11px]">{expanded ? "Skryt prepis" : "Zobrazit prepis"}</span>
                  </Button>
                  {expanded && (
                    <div className="bg-muted/40 rounded-md p-2">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{rec.transcriptionText}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {log.notes && (
            <p className="text-xs text-muted-foreground mt-1 italic">{log.notes}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ResultCard({ result, query }: { result: TranscriptResult; query: string }) {
  const [expanded, setExpanded] = useState(false);

  const handleExport = (format: string) => {
    window.open(`/api/call-recordings/${result.id}/export-transcript?format=${format}`, "_blank");
  };

  const snippet = getSnippet(result.transcriptionText, query);
  const dateStr = new Date(result.createdAt).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Card className="p-3" data-testid={`transcript-result-${result.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {result.customerName && (
              <span className="text-sm font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {result.customerName}
              </span>
            )}
            {result.phoneNumber && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {result.phoneNumber}
              </span>
            )}
            {result.agentName && (
              <Badge variant="outline" className="text-[10px]">{result.agentName}</Badge>
            )}
            {result.campaignName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Megaphone className="h-2.5 w-2.5" />
                {result.campaignName}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatDuration(result.durationSeconds)}</span>
            <SentimentBadge sentiment={result.sentiment} />
            <ScoreBadge score={result.qualityScore} label="Kvalita" />
            <ScoreBadge score={result.scriptComplianceScore} label="Skript" />
            {result.alertKeywords && result.alertKeywords.length > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {result.alertKeywords.length} upoz.
              </Badge>
            )}
          </div>

          {result.summary && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{result.summary}</p>
          )}

          <div className="bg-muted/40 rounded-md p-2 mb-2">
            <p className="text-xs leading-relaxed">{highlightText(snippet, query)}</p>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-full-transcript-${result.id}`}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-[11px]">{expanded ? "Skryt cely prepis" : "Cely prepis"}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => handleExport("txt")}
              data-testid={`btn-export-txt-${result.id}`}
            >
              <Download className="h-3 w-3" />
              <span className="text-[11px]">TXT</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => handleExport("json")}
              data-testid={`btn-export-json-${result.id}`}
            >
              <Download className="h-3 w-3" />
              <span className="text-[11px]">JSON</span>
            </Button>
          </div>

          {expanded && (
            <div className="bg-muted/40 rounded-md p-2 mt-2">
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{highlightText(result.transcriptionText, query)}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon?: any }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-7 gap-1 text-[11px]"
      onClick={onClick}
      data-testid={`filter-chip-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Button>
  );
}

export default function TranscriptSearchPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"browse" | "search">("browse");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showBrowseFilters, setShowBrowseFilters] = useState(false);

  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [hasAlertsFilter, setHasAlertsFilter] = useState(false);

  const [browseCampaignFilter, setBrowseCampaignFilter] = useState<string>("");
  const [browseDirectionFilter, setBrowseDirectionFilter] = useState<string>("");
  const [browseStatusFilter, setBrowseStatusFilter] = useState<string>("");
  const [browseRecordingFilter, setBrowseRecordingFilter] = useState<string>("");
  const [browseSentimentFilter, setBrowseSentimentFilter] = useState<string>("");
  const [browseAgentFilter, setBrowseAgentFilter] = useState<string>("");
  const [browseHasAlertsFilter, setBrowseHasAlertsFilter] = useState(false);
  const [browseMinQuality, setBrowseMinQuality] = useState<string>("");
  const [browseDateFrom, setBrowseDateFrom] = useState<string>("");
  const [browseDateTo, setBrowseDateTo] = useState<string>("");
  const [browseSearchText, setBrowseSearchText] = useState<string>("");

  const { data: callLogs = [], isLoading: logsLoading } = useQuery<CallLogEntry[]>({
    queryKey: ["/api/call-logs/browse"],
    queryFn: async () => {
      const res = await fetch("/api/call-logs/browse?limit=200", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "browse",
  });

  const { data: campaignsList = [] } = useQuery<CampaignBasic[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const { data: results = [], isLoading, isFetching } = useQuery<TranscriptResult[]>({
    queryKey: ["/api/call-recordings/search/transcripts", { query: searchQuery, sentiment: sentimentFilter, hasAlerts: hasAlertsFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ query: searchQuery, limit: "50" });
      if (sentimentFilter) params.set("sentiment", sentimentFilter);
      if (hasAlertsFilter) params.set("hasAlerts", "true");
      const res = await fetch(`/api/call-recordings/search/transcripts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2 && activeTab === "search",
  });

  const handleSearch = useCallback(() => {
    if (searchInput.trim().length >= 2) {
      setSearchQuery(searchInput.trim());
    }
  }, [searchInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const clearFilters = () => {
    setSentimentFilter("");
    setHasAlertsFilter(false);
  };

  const clearBrowseFilters = () => {
    setBrowseCampaignFilter("");
    setBrowseDirectionFilter("");
    setBrowseStatusFilter("");
    setBrowseRecordingFilter("");
    setBrowseSentimentFilter("");
    setBrowseAgentFilter("");
    setBrowseHasAlertsFilter(false);
    setBrowseMinQuality("");
    setBrowseDateFrom("");
    setBrowseDateTo("");
    setBrowseSearchText("");
  };

  const hasActiveFilters = sentimentFilter || hasAlertsFilter;

  const hasActiveBrowseFilters = browseCampaignFilter || browseDirectionFilter || browseStatusFilter ||
    browseRecordingFilter || browseSentimentFilter || browseAgentFilter || browseHasAlertsFilter ||
    browseMinQuality || browseDateFrom || browseDateTo || browseSearchText;

  const activeBrowseFilterCount = [
    browseCampaignFilter, browseDirectionFilter, browseStatusFilter,
    browseRecordingFilter, browseSentimentFilter, browseAgentFilter,
    browseHasAlertsFilter ? "yes" : "", browseMinQuality, browseDateFrom, browseDateTo, browseSearchText,
  ].filter(Boolean).length;

  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    callLogs.forEach(log => {
      if (log.recording?.agentName) agents.add(log.recording.agentName);
    });
    return Array.from(agents).sort();
  }, [callLogs]);

  const uniqueCampaignsInLogs = useMemo(() => {
    const camps = new Map<string, string>();
    callLogs.forEach(log => {
      if (log.campaignId && log.campaignName) {
        camps.set(log.campaignId, log.campaignName);
      }
    });
    return Array.from(camps.entries()).map(([id, name]) => ({ id, name }));
  }, [callLogs]);

  const filteredCallLogs = useMemo(() => {
    let filtered = [...callLogs];

    if (browseSearchText) {
      const q = browseSearchText.toLowerCase();
      filtered = filtered.filter(log =>
        log.phoneNumber?.toLowerCase().includes(q) ||
        log.customerName?.toLowerCase().includes(q) ||
        log.campaignName?.toLowerCase().includes(q) ||
        log.recording?.agentName?.toLowerCase().includes(q) ||
        log.notes?.toLowerCase().includes(q)
      );
    }

    if (browseCampaignFilter) {
      if (browseCampaignFilter === "__none__") {
        filtered = filtered.filter(log => !log.campaignId);
      } else {
        filtered = filtered.filter(log => log.campaignId === browseCampaignFilter);
      }
    }

    if (browseDirectionFilter) {
      filtered = filtered.filter(log => log.direction === browseDirectionFilter);
    }

    if (browseStatusFilter) {
      filtered = filtered.filter(log => log.status === browseStatusFilter);
    }

    if (browseRecordingFilter) {
      if (browseRecordingFilter === "recorded") {
        filtered = filtered.filter(log => log.hasRecording);
      } else if (browseRecordingFilter === "not_recorded") {
        filtered = filtered.filter(log => !log.hasRecording);
      } else if (browseRecordingFilter === "analyzed") {
        filtered = filtered.filter(log => log.recording?.analysisStatus === "completed");
      } else if (browseRecordingFilter === "transcribed") {
        filtered = filtered.filter(log => log.recording?.transcriptionText);
      }
    }

    if (browseSentimentFilter) {
      filtered = filtered.filter(log => log.recording?.sentiment === browseSentimentFilter);
    }

    if (browseAgentFilter) {
      filtered = filtered.filter(log => log.recording?.agentName === browseAgentFilter);
    }

    if (browseHasAlertsFilter) {
      filtered = filtered.filter(log => log.recording?.alertKeywords && log.recording.alertKeywords.length > 0);
    }

    if (browseMinQuality) {
      const minQ = parseInt(browseMinQuality);
      if (!isNaN(minQ)) {
        filtered = filtered.filter(log => log.recording?.qualityScore != null && log.recording.qualityScore >= minQ);
      }
    }

    if (browseDateFrom) {
      const from = new Date(browseDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(log => new Date(log.startedAt || log.createdAt) >= from);
    }

    if (browseDateTo) {
      const to = new Date(browseDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.startedAt || log.createdAt) <= to);
    }

    return filtered;
  }, [callLogs, browseSearchText, browseCampaignFilter, browseDirectionFilter, browseStatusFilter,
    browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter,
    browseMinQuality, browseDateFrom, browseDateTo]);

  const stats = useMemo(() => {
    const total = filteredCallLogs.length;
    const recorded = filteredCallLogs.filter(l => l.hasRecording).length;
    const analyzed = filteredCallLogs.filter(l => l.recording?.analysisStatus === "completed").length;
    const withAlerts = filteredCallLogs.filter(l => l.recording?.alertKeywords && l.recording.alertKeywords.length > 0).length;
    const avgQuality = filteredCallLogs.filter(l => l.recording?.qualityScore).reduce((sum, l) => sum + (l.recording?.qualityScore || 0), 0) / (filteredCallLogs.filter(l => l.recording?.qualityScore).length || 1);
    return { total, recorded, analyzed, withAlerts, avgQuality: Math.round(avgQuality * 10) / 10 };
  }, [filteredCallLogs]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Hovory a prepisy</h1>
        </div>

        <div className="flex items-center gap-1 mb-3">
          <Button
            variant={activeTab === "browse" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("browse")}
            data-testid="btn-tab-browse"
          >
            <List className="h-4 w-4 mr-1" />
            Vsetky hovory
          </Button>
          <Button
            variant={activeTab === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("search")}
            data-testid="btn-tab-search"
          >
            <Search className="h-4 w-4 mr-1" />
            Hladat v prepisoch
          </Button>
        </div>

        {activeTab === "browse" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Hladat v hovoroch..."
                  className="pl-8 h-8 text-xs"
                  value={browseSearchText}
                  onChange={(e) => setBrowseSearchText(e.target.value)}
                  data-testid="input-browse-search"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBrowseFilters(!showBrowseFilters)}
                className={`gap-1 ${hasActiveBrowseFilters ? "border-primary" : ""}`}
                data-testid="btn-browse-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-xs">Filtre</span>
                {activeBrowseFilterCount > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{activeBrowseFilterCount}</Badge>
                )}
              </Button>
              {hasActiveBrowseFilters && (
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearBrowseFilters} data-testid="btn-clear-browse-filters">
                  <X className="h-3 w-3" />
                  <span className="text-xs">Zrusit</span>
                </Button>
              )}
            </div>

            {showBrowseFilters && (
              <div className="bg-muted/30 rounded-md p-3 mb-2 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseCampaignFilter} onValueChange={(v) => setBrowseCampaignFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-browse-campaign">
                        <SelectValue placeholder="Kampan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky kampane</SelectItem>
                        <SelectItem value="__none__">Bez kampane</SelectItem>
                        {(uniqueCampaignsInLogs.length > 0 ? uniqueCampaignsInLogs : campaignsList).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseStatusFilter} onValueChange={(v) => setBrowseStatusFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky statusy</SelectItem>
                        <SelectItem value="completed">Dokonceny</SelectItem>
                        <SelectItem value="failed">Zlyhany</SelectItem>
                        <SelectItem value="no_answer">Neprijaty</SelectItem>
                        <SelectItem value="busy">Obsadeny</SelectItem>
                        <SelectItem value="cancelled">Zruseny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseDirectionFilter} onValueChange={(v) => setBrowseDirectionFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-direction">
                        <SelectValue placeholder="Smer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky smery</SelectItem>
                        <SelectItem value="outbound">Odchadzajuce</SelectItem>
                        <SelectItem value="inbound">Prichadzajuce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseRecordingFilter} onValueChange={(v) => setBrowseRecordingFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-browse-recording">
                        <SelectValue placeholder="Nahravka" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky</SelectItem>
                        <SelectItem value="recorded">S nahravkou</SelectItem>
                        <SelectItem value="not_recorded">Bez nahravky</SelectItem>
                        <SelectItem value="analyzed">Analyzovane</SelectItem>
                        <SelectItem value="transcribed">S prepisom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseSentimentFilter} onValueChange={(v) => setBrowseSentimentFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-sentiment">
                        <SelectValue placeholder="Sentiment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky</SelectItem>
                        <SelectItem value="positive">Pozitivny</SelectItem>
                        <SelectItem value="neutral">Neutralny</SelectItem>
                        <SelectItem value="negative">Negativny</SelectItem>
                        <SelectItem value="angry">Nahnevany</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {uniqueAgents.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={browseAgentFilter} onValueChange={(v) => setBrowseAgentFilter(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-browse-agent">
                          <SelectValue placeholder="Agent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Vsetci agenti</SelectItem>
                          {uniqueAgents.map(a => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      className="h-8 text-xs w-[140px]"
                      value={browseDateFrom}
                      onChange={(e) => setBrowseDateFrom(e.target.value)}
                      data-testid="input-date-from"
                    />
                    <span className="text-xs text-muted-foreground">do</span>
                    <Input
                      type="date"
                      className="h-8 text-xs w-[140px]"
                      value={browseDateTo}
                      onChange={(e) => setBrowseDateTo(e.target.value)}
                      data-testid="input-date-to"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseMinQuality} onValueChange={(v) => setBrowseMinQuality(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-browse-quality">
                        <SelectValue placeholder="Min. kvalita" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky</SelectItem>
                        <SelectItem value="8">8+ (vynikajuce)</SelectItem>
                        <SelectItem value="6">6+ (dobre)</SelectItem>
                        <SelectItem value="4">4+ (priemerne)</SelectItem>
                        <SelectItem value="1">1+ (slabe)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <FilterChip
                    label="S upozorneniami"
                    active={browseHasAlertsFilter}
                    onClick={() => setBrowseHasAlertsFilter(!browseHasAlertsFilter)}
                    icon={AlertTriangle}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{stats.total} hovorov</span>
              <span>{stats.recorded} nahranych</span>
              <span>{stats.analyzed} analyzovanych</span>
              {stats.withAlerts > 0 && (
                <span className="text-destructive flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.withAlerts} s upoz.
                </span>
              )}
              {stats.analyzed > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3" />
                  Priemer: {stats.avgQuality}/10
                </span>
              )}
              {hasActiveBrowseFilters && callLogs.length !== filteredCallLogs.length && (
                <span className="text-primary font-medium">(filtre aktivne: {filteredCallLogs.length} z {callLogs.length})</span>
              )}
            </div>
          </>
        )}

        {activeTab === "search" && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hladat v prepisoch hovorov..."
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  data-testid="input-transcript-search"
                />
              </div>
              <Button onClick={handleSearch} disabled={searchInput.trim().length < 2} data-testid="btn-search-transcripts">
                <Search className="h-4 w-4 mr-1" />
                Hladat
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? "border-primary" : ""}
                data-testid="btn-toggle-filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Sentiment:</span>
                  <Select value={sentimentFilter} onValueChange={(v) => setSentimentFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-sentiment-filter">
                      <SelectValue placeholder="Vsetky" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Vsetky</SelectItem>
                      <SelectItem value="positive">Pozitivny</SelectItem>
                      <SelectItem value="neutral">Neutralny</SelectItem>
                      <SelectItem value="negative">Negativny</SelectItem>
                      <SelectItem value="angry">Nahnevany</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant={hasAlertsFilter ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setHasAlertsFilter(!hasAlertsFilter)}
                  data-testid="btn-filter-alerts"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">S upozorneniami</span>
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearFilters} data-testid="btn-clear-filters">
                    <X className="h-3 w-3" />
                    <span className="text-xs">Zrusit filtre</span>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {activeTab === "browse" && logsLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Nacitavam hovory...</span>
            </div>
          )}

          {activeTab === "browse" && !logsLoading && filteredCallLogs.length === 0 && !hasActiveBrowseFilters && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Phone className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Ziadne hovory</p>
              <p className="text-xs mt-1">Zatial neboli zaznamenane ziadne hovory</p>
              <div className="mt-6 bg-muted/40 rounded-md p-4 max-w-md text-center">
                <p className="text-xs leading-relaxed">
                  Hovory sa zaznamenavaju automaticky pri pouziti SIP telefonu v CRM.
                  Pre nahranie hovoru kliknite na tlacidlo nahravanie pocas hovoru.
                  System potom automaticky vytvori prepis a AI analyzu.
                </p>
              </div>
            </div>
          )}

          {activeTab === "browse" && !logsLoading && filteredCallLogs.length === 0 && hasActiveBrowseFilters && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Filter className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Ziadne vysledky</p>
              <p className="text-xs mt-1">Pre zvolene filtre neboli najdene ziadne hovory</p>
              <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={clearBrowseFilters}>
                <X className="h-3 w-3" />
                Zrusit filtre
              </Button>
            </div>
          )}

          {activeTab === "browse" && !logsLoading && filteredCallLogs.length > 0 && (
            <>
              {filteredCallLogs.map((log) => (
                <CallLogCard key={log.id} log={log} />
              ))}
            </>
          )}

          {activeTab === "search" && !searchQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Zadajte hladany vyraz</p>
              <p className="text-xs mt-1">Vyhladavanie v prepisoch hovorov, suhrnoch a klucovych slovach</p>
            </div>
          )}

          {activeTab === "search" && searchQuery && isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Vyhladavam...</span>
            </div>
          )}

          {activeTab === "search" && searchQuery && !isLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Ziadne vysledky</p>
              <p className="text-xs mt-1">Pre hladany vyraz "{searchQuery}" neboli najdene ziadne prepisy</p>
            </div>
          )}

          {activeTab === "search" && searchQuery && !isLoading && results.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  {results.length} vysledkov pre "{searchQuery}"
                  {isFetching && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
                </span>
              </div>
              {results.map((result) => (
                <ResultCard key={result.id} result={result} query={searchQuery} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
