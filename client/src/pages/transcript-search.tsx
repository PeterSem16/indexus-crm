import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Star, AlertTriangle, Download, ChevronDown, ChevronUp, Loader2, Phone, User, Megaphone, Clock, Filter, X } from "lucide-react";
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
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
    positive: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40", label: "Pozitívny" },
    neutral: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40", label: "Neutrálny" },
    negative: { cls: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40", label: "Negatívny" },
    angry: { cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40", label: "Nahnevaný" },
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
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Megaphone className="h-3 w-3" />
                {result.campaignName}
              </span>
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
                {result.alertKeywords.length} upozornení
              </Badge>
            )}
          </div>

          {result.summary && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{result.summary}</p>
          )}

          {result.alertKeywords && result.alertKeywords.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-2">
              <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
              {result.alertKeywords.map((kw, i) => (
                <Badge key={i} variant="destructive" className="text-[10px]">{kw}</Badge>
              ))}
            </div>
          )}

          <div className="bg-muted/40 rounded-md p-2 mb-2">
            <p className="text-xs leading-relaxed">
              {highlightText(expanded ? result.transcriptionText : snippet, query)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-expand-transcript-${result.id}`}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-[11px]">{expanded ? "Skryť" : "Celý prepis"}</span>
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
        </div>
      </div>
    </Card>
  );
}

export default function TranscriptSearchPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [hasAlertsFilter, setHasAlertsFilter] = useState(false);

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
    enabled: searchQuery.length >= 2,
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

  const hasActiveFilters = sentimentFilter || hasAlertsFilter;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Vyhľadávanie v prepisoch</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať v prepisoch hovorov..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="input-transcript-search"
            />
          </div>
          <Button onClick={handleSearch} disabled={searchInput.trim().length < 2} data-testid="btn-search-transcripts">
            <Search className="h-4 w-4 mr-1" />
            Hľadať
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
                  <SelectValue placeholder="Všetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky</SelectItem>
                  <SelectItem value="positive">Pozitívny</SelectItem>
                  <SelectItem value="neutral">Neutrálny</SelectItem>
                  <SelectItem value="negative">Negatívny</SelectItem>
                  <SelectItem value="angry">Nahnevaný</SelectItem>
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
                <span className="text-xs">Zrušiť filtre</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!searchQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Zadajte hľadaný výraz</p>
              <p className="text-xs mt-1">Vyhľadávanie v prepisoch hovorov, súhrnoch a kľúčových slovách</p>
              <div className="mt-6 bg-muted/40 rounded-md p-4 max-w-md text-center">
                <p className="text-xs leading-relaxed">
                  Prepisy sa vytvárajú automaticky z nahraných hovorov cez SIP telefón.
                  Nahrajte hovor a systém automaticky vytvorí prepis a AI analýzu
                  (sentiment, kvalita, dodržiavanie skriptu, varovné slová).
                </p>
              </div>
            </div>
          )}

          {searchQuery && isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Vyhľadávam...</span>
            </div>
          )}

          {searchQuery && !isLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Žiadne výsledky</p>
              <p className="text-xs mt-1">Pre hľadaný výraz "{searchQuery}" neboli nájdené žiadne prepisy</p>
            </div>
          )}

          {searchQuery && !isLoading && results.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  {results.length} výsledkov pre "{searchQuery}"
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
