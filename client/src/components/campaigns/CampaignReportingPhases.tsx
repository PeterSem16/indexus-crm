import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target, Phone, Mail, Users, CheckCircle, Clock, ArrowRight,
  BarChart3, TrendingUp, Layers, AlertCircle
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend
} from "recharts";
import { CHART_PALETTE } from "@/lib/chart-colors";
import type { CampaignPhase } from "@shared/schema";

interface PhaseWithStats extends CampaignPhase {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    results: Record<string, number>;
  };
}

const rt: Record<string, Record<string, string>> = {
  sk: {
    phaseReporting: "Reporting podľa fáz",
    phaseReportingDesc: "Kompletný prehľad výkonnosti jednotlivých fáz kampane",
    overallProgress: "Celkový progres kampane",
    phaseComparison: "Porovnanie fáz",
    phaseDetails: "Detail fázy",
    phaseFunnel: "Funnel fáz",
    targetAchievement: "Plnenie cieľov",
    contacts: "Kontakty",
    completed: "Dokončené",
    pending: "Čakajúce",
    inProgress: "Prebiehajúce",
    skipped: "Preskočené",
    total: "Celkom",
    completionRate: "Miera dokončenia",
    conversionRate: "Konverzia",
    responseRate: "Odozva",
    targetCalls: "Cieľ hovorov",
    targetEmails: "Cieľ emailov",
    targetConversions: "Cieľ konverzií",
    targetResponseRate: "Cieľ odozvy",
    actual: "Skutočný",
    target: "Cieľ",
    achieved: "Dosiahnuté",
    notAchieved: "Nedosiahnuté",
    noPhases: "Žiadne fázy v tejto kampani",
    phase: "Fáza",
    phone: "Telefón",
    email: "Email",
    draft: "Koncept",
    active: "Aktívna",
    evaluating: "Vyhodnocovanie",
    resultDistribution: "Rozdelenie výsledkov",
    noResults: "Žiadne výsledky",
    overallTargets: "Celkové ciele kampane",
    phaseTargets: "Ciele podľa fáz",
    avgCompletionRate: "Priemerná miera dokončenia",
    bestPhase: "Najlepšia fáza",
    worstPhase: "Najslabšia fáza",
    totalProcessed: "Celkom spracovaných",
    throughputRate: "Priepustnosť",
    dropoffRate: "Miera odpadu",
  },
  en: {
    phaseReporting: "Phase Reporting",
    phaseReportingDesc: "Complete performance overview of individual campaign phases",
    overallProgress: "Overall Campaign Progress",
    phaseComparison: "Phase Comparison",
    phaseDetails: "Phase Details",
    phaseFunnel: "Phase Funnel",
    targetAchievement: "Target Achievement",
    contacts: "Contacts",
    completed: "Completed",
    pending: "Pending",
    inProgress: "In Progress",
    skipped: "Skipped",
    total: "Total",
    completionRate: "Completion Rate",
    conversionRate: "Conversion",
    responseRate: "Response Rate",
    targetCalls: "Target Calls",
    targetEmails: "Target Emails",
    targetConversions: "Target Conversions",
    targetResponseRate: "Target Response Rate",
    actual: "Actual",
    target: "Target",
    achieved: "Achieved",
    notAchieved: "Not Achieved",
    noPhases: "No phases in this campaign",
    phase: "Phase",
    phone: "Phone",
    email: "Email",
    draft: "Draft",
    active: "Active",
    evaluating: "Evaluating",
    resultDistribution: "Result Distribution",
    noResults: "No results",
    overallTargets: "Overall Campaign Targets",
    phaseTargets: "Targets by Phase",
    avgCompletionRate: "Average Completion Rate",
    bestPhase: "Best Phase",
    worstPhase: "Weakest Phase",
    totalProcessed: "Total Processed",
    throughputRate: "Throughput Rate",
    dropoffRate: "Drop-off Rate",
  },
};

export default function CampaignReportingPhases({ campaignId }: { campaignId: string }) {
  const { language } = useI18n();
  const t = rt[language] || rt.sk;

  const { data: phases = [], isLoading } = useQuery<PhaseWithStats[]>({
    queryKey: ["/api/campaigns", campaignId, "phases"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/phases`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t.noPhases}</p>
        </CardContent>
      </Card>
    );
  }

  const totalContacts = phases.reduce((sum, p) => sum + p.stats.total, 0);
  const totalCompleted = phases.reduce((sum, p) => sum + p.stats.completed, 0);
  const totalPending = phases.reduce((sum, p) => sum + p.stats.pending, 0);
  const totalInProgress = phases.reduce((sum, p) => sum + p.stats.inProgress, 0);
  const totalSkipped = phases.reduce((sum, p) => sum + p.stats.skipped, 0);
  const overallCompletionRate = totalContacts > 0 ? (totalCompleted / totalContacts * 100) : 0;

  const phaseCompletionRates = phases.map(p => ({
    name: `#${p.phaseNumber} ${p.name}`,
    completionRate: p.stats.total > 0 ? Math.round(p.stats.completed / p.stats.total * 100) : 0,
    total: p.stats.total,
    completed: p.stats.completed,
    pending: p.stats.pending,
    inProgress: p.stats.inProgress,
    skipped: p.stats.skipped,
  }));

  const activePhasesWithData = phaseCompletionRates.filter(p => p.total > 0);
  const bestPhase = activePhasesWithData.length > 0
    ? activePhasesWithData.reduce((best, p) => p.completionRate > best.completionRate ? p : best)
    : phaseCompletionRates[0];
  const worstPhase = activePhasesWithData.length > 0
    ? activePhasesWithData.reduce((worst, p) => p.completionRate < worst.completionRate ? p : worst)
    : phaseCompletionRates[0];

  const funnelData = phases.map((p, idx) => ({
    name: `#${p.phaseNumber} ${p.name}`,
    value: p.stats.total,
    completed: p.stats.completed,
    dropoff: idx > 0 ? Math.max(0, phases[idx - 1].stats.total - p.stats.total) : 0,
  }));

  const hasTargets = phases.some(p => 
    (p.targetCalls && p.targetCalls > 0) || 
    (p.targetEmails && p.targetEmails > 0) || 
    (p.targetConversions && p.targetConversions > 0) || 
    (p.targetResponseRate && p.targetResponseRate > 0)
  );

  const targetData = phases.filter(p => 
    (p.targetCalls && p.targetCalls > 0) || 
    (p.targetEmails && p.targetEmails > 0) || 
    (p.targetConversions && p.targetConversions > 0) || 
    (p.targetResponseRate && p.targetResponseRate > 0)
  ).map(p => {
    const targets = [];
    if (p.targetCalls && p.targetCalls > 0) {
      const pct = Math.min(100, Math.round((p.stats.completed / p.targetCalls) * 100));
      targets.push({ label: t.targetCalls, actual: p.stats.completed, target: p.targetCalls, pct, achieved: pct >= 100 });
    }
    if (p.targetEmails && p.targetEmails > 0) {
      const pct = Math.min(100, Math.round((p.stats.total / p.targetEmails) * 100));
      targets.push({ label: t.targetEmails, actual: p.stats.total, target: p.targetEmails, pct, achieved: pct >= 100 });
    }
    if (p.targetConversions && p.targetConversions > 0) {
      const pct = Math.min(100, Math.round((p.stats.completed / p.targetConversions) * 100));
      targets.push({ label: t.targetConversions, actual: p.stats.completed, target: p.targetConversions, pct, achieved: pct >= 100 });
    }
    if (p.targetResponseRate && p.targetResponseRate > 0) {
      const actualRate = p.stats.total > 0 ? Math.round((p.stats.completed / p.stats.total) * 100) : 0;
      const pct = Math.min(100, Math.round((actualRate / p.targetResponseRate) * 100));
      targets.push({ label: t.targetResponseRate, actual: actualRate, target: p.targetResponseRate, pct, achieved: pct >= 100, unit: "%" });
    }
    return { phase: `#${p.phaseNumber} ${p.name}`, targets };
  });

  const allResults: Record<string, number> = {};
  phases.forEach(p => {
    Object.entries(p.stats.results).forEach(([result, count]) => {
      allResults[result] = (allResults[result] || 0) + count;
    });
  });
  const resultPieData = Object.entries(allResults)
    .map(([name, value], idx) => ({ name, value, color: CHART_PALETTE[idx % CHART_PALETTE.length] }))
    .sort((a, b) => b.value - a.value);

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "active": return "default";
      case "completed": return "outline";
      case "evaluating": return "destructive";
      default: return "secondary" as const;
    }
  };

  const getBarColor = (pct: number) =>
    pct >= 100 ? "text-green-600 dark:text-green-400" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const getBgColor = (pct: number) =>
    pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-6" data-testid="campaign-phase-reporting">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{t.phaseReporting}</h3>
        <span className="text-sm text-muted-foreground">— {t.phaseReportingDesc}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="stat-total-contacts">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.total} {t.contacts.toLowerCase()}</p>
                <p className="text-2xl font-bold">{totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-completed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.completed}</p>
                <p className="text-2xl font-bold">{totalCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-pending">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.pending}</p>
                <p className="text-2xl font-bold">{totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-in-progress">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.inProgress}</p>
                <p className="text-2xl font-bold">{totalInProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completion-rate">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.completionRate}</p>
                <p className="text-2xl font-bold">{overallCompletionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="stat-avg-completion">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">{t.avgCompletionRate}</p>
            <p className="text-3xl font-bold">
              {(phaseCompletionRates.reduce((s, p) => s + p.completionRate, 0) / Math.max(phaseCompletionRates.length, 1)).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
        <Card data-testid="stat-best-phase">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">{t.bestPhase}</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{bestPhase?.name}</p>
            <p className="text-sm text-muted-foreground">{bestPhase?.completionRate}%</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-worst-phase">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">{t.worstPhase}</p>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{worstPhase?.name}</p>
            <p className="text-sm text-muted-foreground">{worstPhase?.completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="chart-phase-comparison">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {t.phaseComparison}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={phaseCompletionRates} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" name={t.completed} fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name={t.pending} fill={CHART_PALETTE[3]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="inProgress" name={t.inProgress} fill={CHART_PALETTE[1]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="skipped" name={t.skipped} fill={CHART_PALETTE[4]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="chart-result-distribution">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" />
              {t.resultDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={resultPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {resultPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p>{t.noResults}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="chart-phase-funnel">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t.phaseFunnel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelData.map((item, idx) => {
              const maxVal = Math.max(...funnelData.map(d => d.value), 1);
              const widthPct = Math.max(10, (item.value / maxVal) * 100);
              const completedPct = item.value > 0 ? Math.round((item.completed / item.value) * 100) : 0;
              return (
                <div key={idx} className="space-y-1" data-testid={`funnel-phase-${idx}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.dropoff > 0 && (
                        <Badge variant="outline" className="text-[10px] text-orange-600 dark:text-orange-400">
                          -{item.dropoff} drop-off
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.value} {t.contacts.toLowerCase()}</span>
                      <span className="font-medium">{completedPct}% ✓</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div
                      className="h-8 rounded-md bg-primary/20 transition-all flex items-center justify-center"
                      style={{ width: `${widthPct}%` }}
                    >
                      <div
                        className="absolute left-0 top-0 h-8 rounded-md bg-primary/60 transition-all"
                        style={{ width: `${(completedPct / 100) * widthPct}%` }}
                      />
                      <span className="relative z-10 text-xs font-medium text-primary-foreground mix-blend-difference">
                        {item.completed}/{item.value}
                      </span>
                    </div>
                  </div>
                  {idx < funnelData.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {hasTargets && (
        <Card data-testid="card-target-achievement">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" />
              {t.targetAchievement}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {targetData.map((phaseTargets, idx) => (
              <div key={idx} className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                  {phaseTargets.phase}
                </h4>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {phaseTargets.targets.map((tgt, tIdx) => (
                    <div key={tIdx} className="p-3 rounded-lg border space-y-2" data-testid={`target-${idx}-${tIdx}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{tgt.label}</span>
                        <Badge
                          variant={tgt.achieved ? "default" : "secondary"}
                          className={`text-[10px] ${tgt.achieved ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}`}
                        >
                          {tgt.achieved ? t.achieved : `${tgt.pct}%`}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{tgt.actual}{tgt.unit || ""}</span>
                        <span className="text-muted-foreground">/ {tgt.target}{tgt.unit || ""}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getBgColor(tgt.pct)}`}
                          style={{ width: `${tgt.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {phases.map((phase) => {
          const completionPct = phase.stats.total > 0 ? Math.round(phase.stats.completed / phase.stats.total * 100) : 0;
          const phaseResults = Object.entries(phase.stats.results).sort((a, b) => b[1] - a[1]);

          return (
            <Card key={phase.id} className={phase.status === "active" ? "ring-2 ring-primary" : ""} data-testid={`phase-report-card-${phase.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground">#{phase.phaseNumber}</span>
                    {phase.type === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    <CardTitle className="text-sm">{phase.name}</CardTitle>
                  </div>
                  <Badge variant={statusColor(phase.status) as any}>
                    {(t as any)[phase.status] || phase.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{completionPct}%</p>
                  <p className="text-xs text-muted-foreground">{t.completionRate}</p>
                  <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.total}:</span>
                    <span className="font-medium">{phase.stats.total}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-muted-foreground">{t.completed}:</span>
                    <span className="font-medium">{phase.stats.completed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-yellow-500" />
                    <span className="text-muted-foreground">{t.pending}:</span>
                    <span className="font-medium">{phase.stats.pending}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-gray-400" />
                    <span className="text-muted-foreground">{t.skipped}:</span>
                    <span className="font-medium">{phase.stats.skipped}</span>
                  </div>
                </div>

                {phaseResults.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t.resultDistribution}:</p>
                    {phaseResults.slice(0, 5).map(([result, count]) => {
                      const pct = phase.stats.total > 0 ? Math.round((count / phase.stats.total) * 100) : 0;
                      return (
                        <div key={result} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span>{result}</span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(phase.targetCalls || phase.targetEmails || phase.targetConversions || phase.targetResponseRate) ? (
                  <div className="border-t pt-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {t.phaseTargets}:
                    </p>
                    {phase.targetCalls != null && phase.targetCalls > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.targetCalls}</span>
                        <span className={phase.stats.completed >= phase.targetCalls ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          {phase.stats.completed}/{phase.targetCalls}
                        </span>
                      </div>
                    )}
                    {phase.targetEmails != null && phase.targetEmails > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.targetEmails}</span>
                        <span className={phase.stats.total >= phase.targetEmails ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          {phase.stats.total}/{phase.targetEmails}
                        </span>
                      </div>
                    )}
                    {phase.targetConversions != null && phase.targetConversions > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.targetConversions}</span>
                        <span className={phase.stats.completed >= phase.targetConversions ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          {phase.stats.completed}/{phase.targetConversions}
                        </span>
                      </div>
                    )}
                    {phase.targetResponseRate != null && phase.targetResponseRate > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.targetResponseRate}</span>
                        <span className={
                          (phase.stats.total > 0 ? (phase.stats.completed / phase.stats.total * 100) : 0) >= phase.targetResponseRate
                            ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"
                        }>
                          {phase.stats.total > 0 ? Math.round(phase.stats.completed / phase.stats.total * 100) : 0}%/{phase.targetResponseRate}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
