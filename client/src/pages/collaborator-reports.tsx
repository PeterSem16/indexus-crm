import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Calendar, Building2, Clock, Users, Filter, BarChart3, TrendingUp, PieChart, FileSpreadsheet, RefreshCw, Phone, PhoneOff, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { Collaborator, VisitEvent, Hospital } from "@shared/schema";

type ReportType = 'activity_summary' | 'visit_statistics' | 'performance_metrics' | 'hospital_coverage';
type PeriodType = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

interface ReportStats {
  totalCollaborators: number;
  activeCollaborators: number;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  scheduledVisits: number;
  inProgressVisits: number;
  totalHours: number;
  hospitalsVisited: number;
  totalCalls: number;
  answeredCalls: number;
  noAnswerCalls: number;
  busyCalls: number;
  failedCalls: number;
  totalCallSeconds: number;
  avgCallDuration: number;
  callSuccessRate: number;
}

interface CollaboratorStats {
  id: string;
  name: string;
  country: string;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  hoursWorked: number;
  hospitalsVisited: number;
  totalCalls: number;
  answeredCalls: number;
  callSuccessRate: number;
  avgCallDuration: number;
}

import { CHART_PALETTE, STATUS_COLORS } from '@/lib/chart-colors';

export function CollaboratorReportsContent({ embedded = false }: { embedded?: boolean }) {
  const { selectedCountries, toggleCountry, availableCountries } = useCountryFilter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [selectedCollabName, setSelectedCollabName] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStartDate = (periodType: PeriodType): Date => {
    const now = new Date();
    switch (periodType) {
      case 'last_month':
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case 'last_3_months':
        return new Date(now.getFullYear(), now.getMonth() - 3, 1);
      case 'this_year':
        return new Date(now.getFullYear(), 0, 1);
      case 'this_month':
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };

  const getEndDate = (periodType: PeriodType): Date => {
    const now = new Date();
    if (periodType === 'last_month') {
      return new Date(now.getFullYear(), now.getMonth(), 0);
    }
    return now;
  };

  const startDate = useMemo(() => getStartDate(period), [period]);
  const endDate = useMemo(() => getEndDate(period), [period]);

  const reportQueryKey = ["/api/collaborator-reports/stats", startDate.toISOString(), endDate.toISOString(), selectedCountries.join(","), selectedCollaborator];

  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useQuery<any>({
    queryKey: reportQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("startDate", startDate.toISOString());
      params.set("endDate", endDate.toISOString());
      if (selectedCountries.length > 0) params.set("countries", selectedCountries.join(","));
      if (selectedCollaborator !== "all") params.set("collaboratorId", selectedCollaborator);
      const res = await fetch(`/api/collaborator-reports/stats?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  const stats: ReportStats = reportData?.stats || {
    totalCollaborators: 0, activeCollaborators: 0, totalVisits: 0,
    completedVisits: 0, cancelledVisits: 0, scheduledVisits: 0,
    inProgressVisits: 0, totalHours: 0, hospitalsVisited: 0,
    totalCalls: 0, answeredCalls: 0, noAnswerCalls: 0, busyCalls: 0,
    failedCalls: 0, totalCallSeconds: 0, avgCallDuration: 0, callSuccessRate: 0,
  };
  const totalHospitals: number = reportData?.stats?.totalHospitals || 0;
  const collaboratorStats: CollaboratorStats[] = reportData?.collaboratorStats || [];

  const [collabSearch, setCollabSearch] = useState("");
  const { data: collabSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/collaborators/lookup", collabSearch],
    queryFn: async () => {
      if (collabSearch.length < 2) return [];
      const res = await fetch(`/api/collaborators/lookup?q=${encodeURIComponent(collabSearch)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: collabSearch.length >= 2,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchReport();
      toast({
        title: t.common.success,
        description: t.collaboratorReports.dataRefreshed || 'Data refreshed',
      });
    } catch {
      toast({
        title: t.common.error,
        description: t.common.error,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const eventsLoading = reportLoading;

  const visitTypeNames: Record<number, string> = {
    1: 'Personal visit',
    2: 'Phone call',
    3: 'Online meeting',
    4: 'Training',
    5: 'Conference',
    6: 'Examination',
    7: 'Kit delivery',
    8: 'Pregnancy lecture',
    9: 'Lectures midwives',
    10: 'Lectures doctors',
    11: 'Contract hospital',
    12: 'Contract doctor',
    13: 'Contract business',
    14: 'Other',
  };

  const visitTypeData = useMemo(() => {
    return (reportData?.visitTypes || []).map((vt: any) => ({
      name: visitTypeNames[vt.type] || `Type ${vt.type}`,
      value: vt.count,
    }));
  }, [reportData]);

  const statusLabels = {
    completed: t.collaboratorReports?.completed || 'Completed',
    scheduled: t.common?.pending || 'Scheduled',
    inProgress: t.common?.loading || 'In Progress',
    cancelled: t.common?.error || 'Cancelled',
  };

  const statusData = useMemo(() => {
    return [
      { name: statusLabels.completed, value: stats.completedVisits, color: CHART_PALETTE[0] },
      { name: statusLabels.scheduled, value: stats.scheduledVisits, color: CHART_PALETTE[1] },
      { name: statusLabels.inProgress, value: stats.inProgressVisits, color: CHART_PALETTE[2] },
      { name: statusLabels.cancelled, value: stats.cancelledVisits, color: CHART_PALETTE[3] },
    ].filter(d => d.value > 0);
  }, [stats, statusLabels]);

  const handleDownload = async (reportType: ReportType, format: 'csv' | 'excel' = 'csv') => {
    const downloadKey = `${reportType}_${format}`;
    setIsDownloading(downloadKey);
    try {
      const params = new URLSearchParams({
        period,
        collaboratorId: selectedCollaborator,
        countries: selectedCountries.join(','),
      });
      
      const endpoint = format === 'excel' 
        ? `/api/collaborator-reports/${reportType}/excel?${params}`
        : `/api/collaborator-reports/${reportType}?${params}`;
      
      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${period}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t.common.success,
        description: t.collaboratorReports.downloadSuccess,
      });
    } catch (error) {
      toast({
        title: t.common.error,
        description: t.collaboratorReports.downloadError,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(null);
    }
  };

  const isLoading = eventsLoading;

  const reportTypes = [
    {
      id: 'activity_summary' as ReportType,
      title: t.collaboratorReports.activitySummary,
      description: t.collaboratorReports.activitySummaryDesc,
      icon: FileText,
    },
    {
      id: 'visit_statistics' as ReportType,
      title: t.collaboratorReports.visitStatistics,
      description: t.collaboratorReports.visitStatisticsDesc,
      icon: BarChart3,
    },
    {
      id: 'performance_metrics' as ReportType,
      title: t.collaboratorReports.performanceMetrics,
      description: t.collaboratorReports.performanceMetricsDesc,
      icon: Clock,
    },
    {
      id: 'hospital_coverage' as ReportType,
      title: t.collaboratorReports.hospitalCoverage,
      description: t.collaboratorReports.hospitalCoverageDesc,
      icon: Building2,
    },
  ];

  const periodOptions = [
    { value: 'this_month', label: t.collaboratorReports.thisMonth },
    { value: 'last_month', label: t.collaboratorReports.lastMonth },
    { value: 'last_3_months', label: t.collaboratorReports.last3Months },
    { value: 'this_year', label: t.collaboratorReports.thisYear },
  ];

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"} data-testid="page-collaborator-reports">
      {!embedded && (
        <PageHeader
          title={t.collaboratorReports.title}
          description={t.collaboratorReports.description}
        />
      )}

      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t.collaboratorReports.filters}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label data-testid="label-period">{t.collaboratorReports.period}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[200px]" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} data-testid={`option-period-${opt.value}`}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label data-testid="label-collaborator">{t.collaboratorReports.collaborator}</Label>
              <div className="relative w-[280px]">
                {selectedCollaborator === "all" ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={collabSearch}
                      onChange={e => setCollabSearch(e.target.value)}
                      placeholder={t.collaboratorReports.allCollaborators}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="input-collaborator-search"
                    />
                    {collabSearch.length >= 2 && collabSearchResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md">
                        {collabSearchResults.map((c: any) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                            onClick={() => { setSelectedCollaborator(c.id); setCollabSearch(""); setSelectedCollabName(`${c.firstName} ${c.lastName}`); }}
                            data-testid={`option-collaborator-${c.id}`}
                          >
                            {getCountryFlag(c.countryCode)} {c.firstName} {c.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-10 px-3 rounded-md border border-input bg-muted/50 flex items-center text-sm">
                      {selectedCollabName || selectedCollaborator}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCollaborator("all"); setSelectedCollabName(""); }} data-testid="btn-clear-collaborator">
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label data-testid="label-countries">{t.collaboratorReports.countries}</Label>
              <div className="flex gap-1 flex-wrap">
                {availableCountries.map(c => {
                  const isSelected = selectedCountries.includes(c.code);
                  return (
                    <Badge
                      key={c.code}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer select-none ${isSelected ? "" : "opacity-50"}`}
                      onClick={() => toggleCountry(c.code)}
                      data-testid={`badge-country-${c.code}`}
                    >
                      {getCountryFlag(c.code)} {c.code}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="flex items-end ml-auto">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                data-testid="button-refresh-data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t.collaboratorReports.refreshData || 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card data-testid="card-collaborators-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-collaborators-label">{t.collaboratorReports.collaborators}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-active-collaborators">{stats.activeCollaborators}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-collaborators-total">
                  {t.collaboratorReports.active} ({stats.totalCollaborators} {t.collaboratorReports.ofTotal})
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-visits-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-visits-label">{t.collaboratorReports.totalVisits}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-visits">{stats.totalVisits}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-completed-visits">
                  {stats.completedVisits} {t.collaboratorReports.completed}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-hours-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-hours-label">{t.collaboratorReports.hoursWorked}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-hours">{stats.totalHours}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-hours-period">
                  {t.collaboratorReports.forPeriod}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-hospitals-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-hospitals-label">{t.collaboratorReports.hospitalsVisited}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-hospitals-visited">{stats.hospitalsVisited}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-hospitals-total">
                  {t.collaboratorReports.ofTotal} {totalHospitals} {t.collaboratorReports.inSystem}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-calls-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-calls-label">{t.common.calls || "Calls"}</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-calls">{stats.totalCalls}</div>
                <p className="text-xs text-muted-foreground" data-testid="text-answered-calls">
                  {stats.answeredCalls} {t.common.answered || "answered"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-call-success-stat">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="text-success-label">{t.common.successRate || "Success Rate"}</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-call-success-rate">{stats.callSuccessRate}%</div>
                <p className="text-xs text-muted-foreground" data-testid="text-avg-duration">
                  ⌀ {stats.avgCallDuration}s / {t.common.call || "call"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-visit-types-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t.collaboratorReports.visitStatistics}
            </CardTitle>
            <CardDescription>{t.collaboratorReports.visitStatisticsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : visitTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visitTypeData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(210, 60%, 70%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t.common.noData}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-status-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              {t.collaboratorReports.activitySummary}
            </CardTitle>
            <CardDescription>{t.collaboratorReports.activitySummaryDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t.common.noData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-collaborator-table">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t.collaboratorReports.performanceMetrics}
          </CardTitle>
          <CardDescription>{t.collaboratorReports.performanceMetricsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : collaboratorStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.collaboratorReports.collaborator}</TableHead>
                  <TableHead>{t.collaboratorReports.countries}</TableHead>
                  <TableHead className="text-right">{t.collaboratorReports.totalVisits}</TableHead>
                  <TableHead className="text-right">{t.collaboratorReports.completed}</TableHead>
                  <TableHead className="text-right">{t.common?.cancelled || 'Cancelled'}</TableHead>
                  <TableHead className="text-right">{t.collaboratorReports.hoursWorked}</TableHead>
                  <TableHead className="text-right">{t.collaboratorReports.hospitalsVisited}</TableHead>
                  <TableHead className="text-right">{t.common.calls || "Calls"}</TableHead>
                  <TableHead className="text-right">{t.common.answered || "Answered"}</TableHead>
                  <TableHead className="text-right">{t.common.successRate || "Success %"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaboratorStats.map((stat) => (
                  <TableRow key={stat.id} data-testid={`row-collaborator-${stat.id}`}>
                    <TableCell className="font-medium">{stat.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCountryFlag(stat.country)} {stat.country}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{stat.totalVisits}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default" className="bg-green-600">
                        {stat.completedVisits}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.cancelledVisits > 0 && (
                        <Badge variant="destructive">{stat.cancelledVisits}</Badge>
                      )}
                      {stat.cancelledVisits === 0 && '-'}
                    </TableCell>
                    <TableCell className="text-right">{Math.round(stat.hoursWorked * 10) / 10}</TableCell>
                    <TableCell className="text-right">{stat.hospitalsVisited}</TableCell>
                    <TableCell className="text-right">{stat.totalCalls || '-'}</TableCell>
                    <TableCell className="text-right">
                      {stat.totalCalls > 0 ? (
                        <Badge variant="default" className="bg-green-600">{stat.answeredCalls}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.totalCalls > 0 ? (
                        <Badge variant={stat.callSuccessRate >= 50 ? "default" : "destructive"} className={stat.callSuccessRate >= 50 ? "bg-green-600" : ""}>
                          {stat.callSuccessRate}%
                        </Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              {t.common.noData}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {reportTypes.map(report => (
          <Card key={report.id} className="hover-elevate" data-testid={`card-report-${report.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <report.icon className="h-5 w-5 text-primary" />
                {report.title}
              </CardTitle>
              <CardDescription className="text-xs">{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => handleDownload(report.id, 'csv')}
                disabled={isDownloading !== null}
                className="w-full"
                size="sm"
                variant="outline"
                data-testid={`button-download-csv-${report.id}`}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading === `${report.id}_csv` ? t.collaboratorReports.downloading : t.collaboratorReports.downloadCsv}
              </Button>
              <Button
                onClick={() => handleDownload(report.id, 'excel')}
                disabled={isDownloading !== null}
                className="w-full"
                size="sm"
                data-testid={`button-download-excel-${report.id}`}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {isDownloading === `${report.id}_excel` ? t.collaboratorReports.downloading : 'Excel'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CollaboratorReportsPage() {
  return <CollaboratorReportsContent embedded={false} />;
}
