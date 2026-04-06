import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, Phone, Mail, Users, CheckCircle, Clock, ArrowRight, ArrowDown,
  BarChart3, TrendingUp, TrendingDown, Layers, AlertTriangle, Zap,
  UserCheck, Timer, Repeat, Activity, PieChart as PieChartIcon, Award,
  ThumbsUp, ThumbsDown, AlertCircle, Gauge
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, AreaChart, Area, CartesianGrid
} from "recharts";
import { CHART_PALETTE } from "@/lib/chart-colors";

interface PhaseAnalytics {
  id: string;
  phaseNumber: number;
  name: string;
  type: string;
  status: string;
  transitionMode: string;
  targetCalls: number | null;
  targetEmails: number | null;
  targetConversions: number | null;
  targetResponseRate: number | null;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    results: Record<string, number>;
  };
  agentPerformance: Array<{ name: string; total: number; completed: number; pending: number; inProgress: number }>;
  attemptDistribution: Record<number, number>;
  avgAttempts: number;
  avgDaysToComplete: number;
  dailyProgress: Array<{ date: string; completed: number; entered: number }>;
  resultsByCategory: Record<string, { count: number; actionType: string; color: string }>;
}

interface AnalyticsResponse {
  phases: PhaseAnalytics[];
  summary: {
    totalPhases: number;
    totalContacts: number;
    totalCompleted: number;
    totalPending: number;
    totalInProgress: number;
    totalConversions: number;
    overallConversionRate: number;
    conversionDispositions: string[];
  };
}

const rt: Record<string, Record<string, string>> = {
  sk: {
    phaseReporting: "Reporting fáz",
    phaseReportingDesc: "Analytické dáta pre rozhodovanie o kampani",
    executiveSummary: "Celkový prehľad",
    totalContacts: "Kontaktov celkom",
    completionRate: "Miera dokončenia",
    conversionRate: "Konverzný pomer",
    avgAttempts: "Priem. pokusov",
    phaseFunnel: "Funnel fáz",
    funnelDesc: "Priepustnosť kontaktov cez jednotlivé fázy",
    phaseDetail: "Detail fázy",
    agentPerformance: "Výkon operátorov",
    agentPerformanceDesc: "Porovnanie výkonu operátorov v rámci fázy",
    dispositionAnalysis: "Analýza výsledkov",
    dispositionDesc: "Rozdelenie dispozícií a ich vplyv na ďalšie rozhodnutia",
    attemptAnalysis: "Analýza pokusov",
    attemptDesc: "Distribúcia počtu pokusov pred dosiahnutím výsledku",
    dailyTrend: "Denný trend",
    dailyTrendDesc: "Vývoj spracovania kontaktov za posledných 14 dní",
    targetProgress: "Plnenie cieľov",
    recommendations: "Odporúčania",
    completed: "Dokončené",
    pending: "Čakajúce",
    inProgress: "Prebiehajúce",
    skipped: "Preskočené",
    total: "Celkom",
    contacts: "kontaktov",
    agent: "Operátor",
    processed: "Spracované",
    rate: "Miera",
    attempts: "Pokusov",
    avgDays: "Priem. dní",
    dropoff: "Úbytok",
    entered: "Prijaté",
    conversion: "Konverzia",
    callback: "Callback",
    complete: "Kompletné",
    other: "Ostatné",
    noData: "Žiadne dáta",
    noPhases: "Žiadne fázy v tejto kampani",
    phone: "Telefón",
    email: "Email",
    draft: "Koncept",
    active: "Aktívna",
    evaluating: "Vyhodnocovanie",
    target: "Cieľ",
    actual: "Skutočnosť",
    highDropoff: "Vysoký úbytok medzi fázami — zvážte úpravu prechodových pravidiel",
    lowCompletion: "Nízka miera dokončenia — skontrolujte kritériá alebo zvýšte kapacitu",
    highAttempts: "Vysoký priemerný počet pokusov — zvážte zmenu prístupu alebo skriptu",
    unevenWorkload: "Nerovnomerné rozdelenie práce medzi operátormi",
    goodProgress: "Fáza postupuje podľa plánu",
    targetMet: "Cieľ splnený",
    targetBelow: "Pod cieľom",
  },
  en: {
    phaseReporting: "Phase Reporting",
    phaseReportingDesc: "Analytics data for campaign decision-making",
    executiveSummary: "Executive Summary",
    totalContacts: "Total Contacts",
    completionRate: "Completion Rate",
    conversionRate: "Conversion Rate",
    avgAttempts: "Avg Attempts",
    phaseFunnel: "Phase Funnel",
    funnelDesc: "Contact throughput across campaign phases",
    phaseDetail: "Phase Detail",
    agentPerformance: "Agent Performance",
    agentPerformanceDesc: "Agent performance comparison within phase",
    dispositionAnalysis: "Disposition Analysis",
    dispositionDesc: "Disposition breakdown and impact on decisions",
    attemptAnalysis: "Attempt Analysis",
    attemptDesc: "Distribution of attempts before reaching an outcome",
    dailyTrend: "Daily Trend",
    dailyTrendDesc: "Contact processing trend over the last 14 days",
    targetProgress: "Target Progress",
    recommendations: "Recommendations",
    completed: "Completed",
    pending: "Pending",
    inProgress: "In Progress",
    skipped: "Skipped",
    total: "Total",
    contacts: "contacts",
    agent: "Agent",
    processed: "Processed",
    rate: "Rate",
    attempts: "Attempts",
    avgDays: "Avg Days",
    dropoff: "Drop-off",
    entered: "Entered",
    conversion: "Conversion",
    callback: "Callback",
    complete: "Complete",
    other: "Other",
    noData: "No data",
    noPhases: "No phases in this campaign",
    phone: "Phone",
    email: "Email",
    draft: "Draft",
    active: "Active",
    evaluating: "Evaluating",
    target: "Target",
    actual: "Actual",
    highDropoff: "High drop-off between phases — consider adjusting transition rules",
    lowCompletion: "Low completion rate — check criteria or increase capacity",
    highAttempts: "High average attempts — consider changing approach or script",
    unevenWorkload: "Uneven workload distribution among agents",
    goodProgress: "Phase progressing on track",
    targetMet: "Target met",
    targetBelow: "Below target",
  },
};

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  evaluating: "destructive",
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  convert: "#22c55e",
  callback: "#eab308",
  complete: "#3b82f6",
  other: "#94a3b8",
};

export default function CampaignReportingPhases({ campaignId }: { campaignId: string }) {
  const { language } = useI18n();
  const t = rt[language] || rt.sk;

  const { data, isLoading } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/campaigns", campaignId, "phases", "analytics"],
    enabled: !!campaignId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.phases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t.noPhases}</p>
        </CardContent>
      </Card>
    );
  }

  const { phases, summary } = data;
  const overallCompletionRate = summary.totalContacts > 0
    ? Math.round(summary.totalCompleted / summary.totalContacts * 1000) / 10
    : 0;

  const funnelData = phases.map((p, idx) => ({
    name: `#${p.phaseNumber} ${p.name}`,
    total: p.stats.total,
    completed: p.stats.completed,
    pending: p.stats.pending,
    completionPct: p.stats.total > 0 ? Math.round(p.stats.completed / p.stats.total * 100) : 0,
    dropoff: idx > 0 ? Math.max(0, phases[idx - 1].stats.total - p.stats.total) : 0,
    dropoffPct: idx > 0 && phases[idx - 1].stats.total > 0
      ? Math.round(Math.max(0, phases[idx - 1].stats.total - p.stats.total) / phases[idx - 1].stats.total * 100)
      : 0,
  }));

  const allResults: Record<string, { count: number; actionType: string }> = {};
  phases.forEach(p => {
    Object.entries(p.resultsByCategory).forEach(([code, data]) => {
      if (!allResults[code]) allResults[code] = { count: 0, actionType: data.actionType };
      allResults[code].count += data.count;
    });
  });
  const resultPieData = Object.entries(allResults)
    .map(([name, data], idx) => ({
      name,
      value: data.count,
      actionType: data.actionType,
      color: ACTION_TYPE_COLORS[data.actionType] || CHART_PALETTE[idx % CHART_PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);

  const globalRecommendations: Array<{ type: "warning" | "success" | "info"; text: string }> = [];
  const maxDropoff = Math.max(...funnelData.map(f => f.dropoffPct));
  if (maxDropoff > 30) globalRecommendations.push({ type: "warning", text: t.highDropoff });
  if (overallCompletionRate < 40 && summary.totalContacts > 10) globalRecommendations.push({ type: "warning", text: t.lowCompletion });
  const avgAttemptsAll = phases.reduce((s, p) => s + p.avgAttempts, 0) / Math.max(phases.length, 1);
  if (avgAttemptsAll > 5) globalRecommendations.push({ type: "info", text: t.highAttempts });
  if (globalRecommendations.length === 0) globalRecommendations.push({ type: "success", text: t.goodProgress });

  return (
    <div className="space-y-6" data-testid="campaign-phase-reporting">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card data-testid="stat-total-contacts">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.totalContacts}</p>
                <p className="text-xl font-bold">{summary.totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completion-rate">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.completionRate}</p>
                <p className="text-xl font-bold">{overallCompletionRate}%</p>
                <p className="text-[10px] text-muted-foreground">{summary.totalCompleted} / {summary.totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-conversion-rate">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.conversionRate}</p>
                <p className="text-xl font-bold">{summary.overallConversionRate}%</p>
                <p className="text-[10px] text-muted-foreground">{summary.totalConversions} {t.conversion.toLowerCase()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-avg-attempts">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Repeat className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.avgAttempts}</p>
                <p className="text-xl font-bold">{avgAttemptsAll.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">{summary.totalPhases} {t.total.toLowerCase()} fáz</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {globalRecommendations.length > 0 && (
        <Card className="border-l-4 border-l-primary" data-testid="card-recommendations">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{t.recommendations}</p>
                {globalRecommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {rec.type === "warning" && <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                    {rec.type === "success" && <ThumbsUp className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    {rec.type === "info" && <Gauge className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    <span className="text-muted-foreground">{rec.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-phase-funnel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {t.phaseFunnel}
          </CardTitle>
          <CardDescription className="text-xs">{t.funnelDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funnelData.map((item, idx) => {
              const maxVal = Math.max(...funnelData.map(d => d.total), 1);
              const barWidth = Math.max(15, (item.total / maxVal) * 100);
              const phase = phases[idx];
              return (
                <div key={idx} data-testid={`funnel-phase-${idx}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {phase.type === "email" ? <Mail className="w-3 h-3 text-muted-foreground" /> : <Phone className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs font-medium truncate">#{phase.phaseNumber} {phase.name}</span>
                      </div>
                      <Badge variant={STATUS_COLORS[phase.status] as any} className="text-[9px] mt-0.5">
                        {(t as any)[phase.status] || phase.status}
                      </Badge>
                    </div>
                    <div className="flex-1 relative">
                      <div
                        className="h-7 rounded bg-muted/50 transition-all relative overflow-hidden"
                        style={{ width: `${barWidth}%` }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/70 rounded-l"
                          style={{ width: `${item.completionPct}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-medium z-10">
                            {item.completed}/{item.total} ({item.completionPct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      {item.dropoff > 0 && (
                        <div className="flex items-center justify-end gap-1 text-orange-600 dark:text-orange-400">
                          <TrendingDown className="w-3 h-3" />
                          <span className="text-[10px] font-medium">-{item.dropoff} ({item.dropoffPct}%)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < funnelData.length - 1 && (
                    <div className="flex justify-center py-0.5 ml-32">
                      <ArrowDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="chart-result-distribution">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              {t.dispositionAnalysis}
            </CardTitle>
            <CardDescription className="text-xs">{t.dispositionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {resultPieData.length > 0 ? (
              <div className="flex items-start gap-4">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={resultPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {resultPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, t.contacts]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 pt-2">
                  {resultPieData.map((item, idx) => {
                    const pct = summary.totalCompleted > 0 ? Math.round(item.value / summary.totalCompleted * 100) : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
                        <span className="font-medium">{item.value}</span>
                        <span className="text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                {t.noData}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="chart-phase-comparison">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {t.attemptAnalysis}
            </CardTitle>
            <CardDescription className="text-xs">{t.attemptDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const attemptData: Record<string, number> = {};
              phases.forEach(p => {
                Object.entries(p.attemptDistribution).forEach(([attempts, count]) => {
                  const key = Number(attempts) >= 6 ? "6+" : attempts;
                  attemptData[key] = (attemptData[key] || 0) + count;
                });
              });
              const chartData = Object.entries(attemptData)
                .sort(([a], [b]) => {
                  const numA = a === "6+" ? 6 : Number(a);
                  const numB = b === "6+" ? 6 : Number(b);
                  return numA - numB;
                })
                .map(([attempts, count]) => ({ attempts: `${attempts}x`, count }));

              if (chartData.length === 0) return (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">{t.noData}</div>
              );

              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <XAxis dataKey="attempts" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name={t.contacts} fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {phases.map((phase) => {
        const completionPct = phase.stats.total > 0 ? Math.round(phase.stats.completed / phase.stats.total * 100) : 0;
        const phaseResults = Object.entries(phase.stats.results).sort((a, b) => b[1] - a[1]);
        const hasTargets = (phase.targetCalls && phase.targetCalls > 0) ||
          (phase.targetEmails && phase.targetEmails > 0) ||
          (phase.targetConversions && phase.targetConversions > 0) ||
          (phase.targetResponseRate && phase.targetResponseRate > 0);

        const phaseRecommendations: Array<{ type: "warning" | "success"; text: string }> = [];
        if (completionPct < 30 && phase.stats.total > 5 && phase.status === "active") {
          phaseRecommendations.push({ type: "warning", text: t.lowCompletion });
        }
        if (phase.avgAttempts > 5) {
          phaseRecommendations.push({ type: "warning", text: t.highAttempts });
        }
        if (phase.agentPerformance.length > 1) {
          const rates = phase.agentPerformance.map(a => a.total > 0 ? a.completed / a.total : 0);
          const maxRate = Math.max(...rates);
          const minRate = Math.min(...rates);
          if (maxRate - minRate > 0.3) {
            phaseRecommendations.push({ type: "warning", text: t.unevenWorkload });
          }
        }
        if (phaseRecommendations.length === 0 && phase.stats.total > 0) {
          phaseRecommendations.push({ type: "success", text: t.goodProgress });
        }

        return (
          <Card key={phase.id} className={phase.status === "active" ? "ring-1 ring-primary/30" : ""} data-testid={`phase-analytics-${phase.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    {phase.type === "email" ? <Mail className="w-3.5 h-3.5 text-primary" /> : <Phone className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div>
                    <CardTitle className="text-sm">#{phase.phaseNumber} {phase.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={STATUS_COLORS[phase.status] as any} className="text-[9px]">
                        {(t as any)[phase.status] || phase.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{phase.stats.total} {t.contacts}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{completionPct}%</p>
                  <p className="text-[10px] text-muted-foreground">{t.completionRate}</p>
                </div>
              </div>
              <Progress value={completionPct} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold">{phase.stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">{t.total}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/10">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{phase.stats.completed}</p>
                  <p className="text-[10px] text-muted-foreground">{t.completed}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                  <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{phase.stats.pending}</p>
                  <p className="text-[10px] text-muted-foreground">{t.pending}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{phase.stats.inProgress}</p>
                  <p className="text-[10px] text-muted-foreground">{t.inProgress}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/20">
                  <p className="text-lg font-bold text-muted-foreground">{phase.stats.skipped}</p>
                  <p className="text-[10px] text-muted-foreground">{t.skipped}</p>
                </div>
              </div>

              <div className="grid gap-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-1.5 p-2 rounded border bg-muted/10">
                    <Repeat className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-muted-foreground">{t.avgAttempts}:</span>
                    <span className="font-semibold">{phase.avgAttempts}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded border bg-muted/10">
                    <Timer className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-muted-foreground">{t.avgDays}:</span>
                    <span className="font-semibold">{phase.avgDaysToComplete}d</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded border bg-muted/10">
                    <Zap className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-muted-foreground">{t.rate}:</span>
                    <span className="font-semibold">{completionPct}%</span>
                  </div>
                </div>
              </div>

              {phase.agentPerformance.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.agentPerformance}
                  </p>
                  <div className="space-y-1.5">
                    {phase.agentPerformance
                      .sort((a, b) => b.completed - a.completed)
                      .map((agent, idx) => {
                      const agentRate = agent.total > 0 ? Math.round(agent.completed / agent.total * 100) : 0;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs" data-testid={`agent-perf-${phase.id}-${idx}`}>
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-2.5 h-2.5 text-primary" />
                          </div>
                          <span className="w-28 truncate font-medium">{agent.name}</span>
                          <div className="flex-1">
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${agentRate >= 70 ? 'bg-green-500' : agentRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${agentRate}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-10 text-right font-medium">{agentRate}%</span>
                          <span className="w-14 text-right text-muted-foreground">{agent.completed}/{agent.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {phaseResults.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.dispositionAnalysis}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {phaseResults.map(([result, count]) => {
                      const pct = phase.stats.total > 0 ? Math.round(count / phase.stats.total * 100) : 0;
                      const catInfo = phase.resultsByCategory[result];
                      const dotColor = catInfo ? ACTION_TYPE_COLORS[catInfo.actionType] || "#888" : "#888";
                      return (
                        <div key={result} className="flex items-center gap-1.5 p-1.5 rounded border text-xs bg-muted/10">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                          <span className="truncate flex-1 text-muted-foreground">{result}</span>
                          <span className="font-medium">{count}</span>
                          <span className="text-muted-foreground text-[10px]">({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasTargets && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.targetProgress}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {phase.targetCalls && phase.targetCalls > 0 && (
                      <TargetCell label={t.phone} actual={phase.stats.completed} target={phase.targetCalls} t={t} />
                    )}
                    {phase.targetEmails && phase.targetEmails > 0 && (
                      <TargetCell label={t.email} actual={phase.stats.total} target={phase.targetEmails} t={t} />
                    )}
                    {phase.targetConversions && phase.targetConversions > 0 && (() => {
                      const conversions = Object.entries(phase.stats.results)
                        .filter(([code]) => summary.conversionDispositions.includes(code))
                        .reduce((s, [, c]) => s + c, 0);
                      return <TargetCell label={t.conversion} actual={conversions} target={phase.targetConversions} t={t} />;
                    })()}
                    {phase.targetResponseRate && phase.targetResponseRate > 0 && (
                      <TargetCell
                        label={t.rate}
                        actual={completionPct}
                        target={phase.targetResponseRate}
                        unit="%"
                        t={t}
                      />
                    )}
                  </div>
                </div>
              )}

              {phase.dailyProgress.length > 1 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.dailyTrend}
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={phase.dailyProgress} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9 }}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()}.${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip
                        labelFormatter={(val) => {
                          const d = new Date(val as string);
                          return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
                        }}
                      />
                      <Area type="monotone" dataKey="entered" name={t.entered} fill={CHART_PALETTE[1]} fillOpacity={0.2} stroke={CHART_PALETTE[1]} strokeWidth={1.5} />
                      <Area type="monotone" dataKey="completed" name={t.completed} fill={CHART_PALETTE[0]} fillOpacity={0.3} stroke={CHART_PALETTE[0]} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {phaseRecommendations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {phaseRecommendations.map((rec, idx) => (
                    <Badge key={idx} variant="outline" className={`text-[10px] ${rec.type === "warning" ? "text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-800" : "text-green-600 border-green-300 dark:text-green-400 dark:border-green-800"}`}>
                      {rec.type === "warning" ? <AlertTriangle className="w-2.5 h-2.5 mr-1" /> : <ThumbsUp className="w-2.5 h-2.5 mr-1" />}
                      {rec.text}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TargetCell({ label, actual, target, unit, t }: {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  t: Record<string, string>;
}) {
  const pct = Math.min(100, Math.round((actual / target) * 100));
  const met = pct >= 100;
  return (
    <div className={`p-2 rounded border text-xs ${met ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10' : 'bg-muted/10'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <Badge variant="outline" className={`text-[9px] ${met ? 'text-green-600 border-green-300' : 'text-orange-600 border-orange-300'}`}>
          {met ? t.targetMet : `${pct}%`}
        </Badge>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold">{actual}{unit || ""}</span>
        <span className="text-muted-foreground">/ {target}{unit || ""}</span>
      </div>
      <Progress value={pct} className="h-1 mt-1" />
    </div>
  );
}
