import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3, FileText,
  Loader2, Plus, Trash2, RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight,
  Activity, Target, Sparkles, Calendar, Globe, ChevronDown
} from "lucide-react";
import type { ExecutiveSummary } from "@shared/schema";

interface Trend {
  key: string;
  direction: "up" | "down" | "stable";
  value: string;
  description: string;
}

interface Anomaly {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  metric: string;
}

interface KPI {
  label: string;
  value: string;
  change: string;
  changePercent: string;
}

export default function ExecutiveSummariesPage() {
  const { t, locale } = useI18n();
  const es = t.executiveSummaries;
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const summariesUrl = selectedCountry === "all"
    ? "/api/executive-summaries"
    : `/api/executive-summaries?countryCode=${selectedCountry}`;
  const { data: summaries = [], isLoading } = useQuery<ExecutiveSummary[]>({
    queryKey: ["/api/executive-summaries", selectedCountry],
    queryFn: async () => {
      const res = await fetch(summariesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summaries");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const overviewUrl = selectedCountry === "all"
    ? "/api/executive-summaries/stats/overview"
    : `/api/executive-summaries/stats/overview?countryCode=${selectedCountry}`;
  const { data: overviewStats } = useQuery<any>({
    queryKey: ["/api/executive-summaries/stats/overview", selectedCountry],
    queryFn: async () => {
      const res = await fetch(overviewUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/executive-summaries/generate", {
        countryCode: selectedCountry === "all" ? null : selectedCountry,
        periodType: selectedPeriod,
        locale,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive-summaries"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/executive-summaries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive-summaries"] });
      setDeleteId(null);
    },
  });

  const countries = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (direction === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const SeverityBadge = ({ severity }: { severity: string }) => {
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
    const labels: Record<string, string> = {
      high: es.severityHigh,
      medium: es.severityMedium,
      low: es.severityLow,
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity] || colors.low}`} data-testid={`badge-severity-${severity}`}>
        {labels[severity] || severity}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "generating") return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300" data-testid="badge-status-generating"><Loader2 className="h-3 w-3 animate-spin" />{es.generating}</Badge>;
    if (status === "failed") return <Badge variant="destructive" className="gap-1" data-testid="badge-status-failed">{es.failed}</Badge>;
    return <Badge variant="secondary" className="gap-1 text-green-600" data-testid="badge-status-completed"><Sparkles className="h-3 w-3" />{es.generated}</Badge>;
  };

  const renderSummaryCard = (summary: ExecutiveSummary) => {
    const isExpanded = expandedId === summary.id;
    const trends = (summary.trends || []) as Trend[];
    const anomalies = (summary.anomalies || []) as Anomaly[];
    const kpis = (summary.kpis || []) as KPI[];

    return (
      <Card key={summary.id} className="transition-all hover:shadow-md" data-testid={`card-summary-${summary.id}`}>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : summary.id)}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base truncate">{summary.title}</CardTitle>
                <StatusBadge status={summary.status} />
              </div>
              <CardDescription className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {summary.periodStart && summary.periodEnd
                    ? `${format(new Date(summary.periodStart), "dd.MM.yyyy")} - ${format(new Date(summary.periodEnd), "dd.MM.yyyy")}`
                    : es.periodRange}
                </span>
                {summary.countryCode && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {summary.countryCode}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {summary.totalCollections} {es.collections}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteId(summary.id); }} data-testid={`btn-delete-summary-${summary.id}`}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CardHeader>

        {isExpanded && summary.status === "completed" && (
          <CardContent className="pt-0 space-y-5">
            <Separator />

            {summary.summaryText && (
              <div data-testid="section-summary-text">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[hsl(var(--burgundy))]" />
                  {es.summary}
                </h4>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-4">
                  {summary.summaryText}
                </div>
              </div>
            )}

            {kpis.length > 0 && (
              <div data-testid="section-kpis">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-[hsl(var(--burgundy))]" />
                  {es.kpis}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {kpis.map((kpi, i) => {
                    const isPositive = kpi.change?.startsWith("+");
                    const isNegative = kpi.change?.startsWith("-");
                    return (
                      <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-1" data-testid={`kpi-card-${i}`}>
                        <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                        <p className="text-lg font-bold">{kpi.value}</p>
                        {kpi.change && (
                          <p className={`text-xs flex items-center gap-1 ${isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"}`}>
                            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : isNegative ? <ArrowDownRight className="h-3 w-3" /> : null}
                            {kpi.change} {kpi.changePercent && `(${kpi.changePercent})`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {trends.length > 0 && (
              <div data-testid="section-trends">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[hsl(var(--burgundy))]" />
                  {es.trends}
                </h4>
                <div className="space-y-2">
                  {trends.map((trend, i) => (
                    <div key={i} className="flex items-start gap-3 bg-muted/30 rounded-lg p-3" data-testid={`trend-row-${i}`}>
                      <TrendIcon direction={trend.direction} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{trend.value}</span>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {trend.direction === "up" ? es.trendUp : trend.direction === "down" ? es.trendDown : es.trendStable}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{trend.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {anomalies.length > 0 && (
              <div data-testid="section-anomalies">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  {es.anomalies}
                </h4>
                <div className="space-y-2">
                  {anomalies.map((anomaly, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1" data-testid={`anomaly-row-${i}`}>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={anomaly.severity} />
                        <span className="text-sm font-medium">{anomaly.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{anomaly.description}</p>
                      {anomaly.metric && (
                        <p className="text-[11px] text-muted-foreground/70">
                          {anomaly.metric}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.createdAt && (
              <p className="text-[11px] text-muted-foreground text-right">
                {es.generatedAt}: {format(new Date(summary.createdAt), "dd.MM.yyyy HH:mm")}
              </p>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{es.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{es.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/executive-summaries"] })} data-testid="btn-refresh">
            <RefreshCw className="h-4 w-4 mr-1" />
            {es.refreshData}
          </Button>
        </div>
      </div>

      {overviewStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card data-testid="card-stat-total">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{es.totalCollections}</p>
              <p className="text-2xl font-bold">{overviewStats.totalAll}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-month">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{es.monthly}</p>
              <p className="text-2xl font-bold">{overviewStats.totalMonth}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-year">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{es.yearly}</p>
              <p className="text-2xl font-bold">{overviewStats.totalYear}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-generate">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px]" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{es.monthly}</SelectItem>
                  <SelectItem value="quarterly">{es.quarterly}</SelectItem>
                  <SelectItem value="yearly">{es.yearly}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-[140px]" data-testid="select-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{es.allCountries}</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-[hsl(var(--burgundy))] hover:bg-[hsl(var(--burgundy))]/90 text-white"
              data-testid="btn-generate"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {generateMutation.isPending ? es.generating : es.generate}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : summaries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">{es.noSummaries}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">{es.noSummariesDesc}</p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-[hsl(var(--burgundy))] hover:bg-[hsl(var(--burgundy))]/90 text-white"
                data-testid="btn-generate-first"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {es.generateFirst}
              </Button>
            </CardContent>
          </Card>
        ) : (
          summaries.map(renderSummaryCard)
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{es.delete}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{es.confirmDelete}</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="btn-cancel-delete">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : es.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
