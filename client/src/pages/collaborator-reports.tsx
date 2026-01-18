import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Calendar, Building2, Clock, Users, Filter, BarChart3, TrendingUp, PieChart, FileSpreadsheet, RefreshCw } from "lucide-react";
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
}

const CHART_COLORS = ['#6B1C3B', '#8B3A5B', '#AB587B', '#CB769B', '#EB94BB', '#5B8C5A', '#E6B800', '#4A90D9'];

export default function CollaboratorReportsPage() {
  const { selectedCountries } = useCountryFilter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: collaborators = [], isLoading: collaboratorsLoading, refetch: refetchCollaborators } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators"],
  });

  const { data: visitEvents = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events"],
  });

  const { data: hospitals = [], refetch: refetchHospitals } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchCollaborators(),
        refetchEvents(),
        refetchHospitals(),
      ]);
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

  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => 
      selectedCountries.length === 0 || selectedCountries.includes(c.countryCode as typeof selectedCountries[number])
    );
  }, [collaborators, selectedCountries]);

  const filteredEvents = useMemo(() => {
    const startDate = getStartDate(period);
    const endDate = getEndDate(period);
    
    return visitEvents.filter(e => {
      const eventDate = e.actualStart ? new Date(e.actualStart) : (e.startTime ? new Date(e.startTime) : null);
      if (!eventDate) return false;
      if (eventDate < startDate || eventDate > endDate) return false;
      
      if (selectedCollaborator !== 'all' && e.collaboratorId !== selectedCollaborator) return false;
      const collaborator = collaborators.find(c => c.id === e.collaboratorId);
      if (!collaborator) return false;
      if (selectedCountries.length > 0 && !selectedCountries.includes(collaborator.countryCode as typeof selectedCountries[number])) return false;
      return true;
    });
  }, [visitEvents, collaborators, period, selectedCollaborator, selectedCountries]);

  const stats = useMemo((): ReportStats => {
    const completedEvents = filteredEvents.filter(e => e.status === 'completed');
    const cancelledEvents = filteredEvents.filter(e => e.isCancelled || e.status === 'cancelled' || e.status === 'not_realized');
    const scheduledEvents = filteredEvents.filter(e => e.status === 'scheduled');
    const inProgressEvents = filteredEvents.filter(e => e.status === 'in_progress');
    
    let totalHours = 0;
    completedEvents.forEach(e => {
      if (e.actualStart && e.actualEnd) {
        totalHours += (new Date(e.actualEnd).getTime() - new Date(e.actualStart).getTime()) / 3600000;
      }
    });

    const activeCollabIds = new Set(filteredEvents.map(e => e.collaboratorId));
    const visitedHospitalIds = new Set(filteredEvents.map(e => e.hospitalId).filter(Boolean));

    return {
      totalCollaborators: filteredCollaborators.length,
      activeCollaborators: activeCollabIds.size,
      totalVisits: filteredEvents.length,
      completedVisits: completedEvents.length,
      cancelledVisits: cancelledEvents.length,
      scheduledVisits: scheduledEvents.length,
      inProgressVisits: inProgressEvents.length,
      totalHours: Math.round(totalHours * 10) / 10,
      hospitalsVisited: visitedHospitalIds.size,
    };
  }, [filteredEvents, filteredCollaborators]);

  const collaboratorStats = useMemo((): CollaboratorStats[] => {
    const statsMap = new Map<string, CollaboratorStats>();
    
    filteredCollaborators.forEach(c => {
      statsMap.set(c.id, {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        country: c.countryCode,
        totalVisits: 0,
        completedVisits: 0,
        cancelledVisits: 0,
        hoursWorked: 0,
        hospitalsVisited: 0,
      });
    });

    const hospitalsByCollab = new Map<string, Set<string>>();
    
    filteredEvents.forEach(e => {
      const stat = statsMap.get(e.collaboratorId);
      if (!stat) return;
      
      stat.totalVisits++;
      if (e.status === 'completed') {
        stat.completedVisits++;
        if (e.actualStart && e.actualEnd) {
          stat.hoursWorked += (new Date(e.actualEnd).getTime() - new Date(e.actualStart).getTime()) / 3600000;
        }
      }
      if (e.isCancelled || e.status === 'cancelled' || e.status === 'not_realized') {
        stat.cancelledVisits++;
      }
      if (e.hospitalId) {
        if (!hospitalsByCollab.has(e.collaboratorId)) {
          hospitalsByCollab.set(e.collaboratorId, new Set());
        }
        hospitalsByCollab.get(e.collaboratorId)!.add(e.hospitalId);
      }
    });

    hospitalsByCollab.forEach((hospitals, collabId) => {
      const stat = statsMap.get(collabId);
      if (stat) {
        stat.hospitalsVisited = hospitals.size;
      }
    });

    return Array.from(statsMap.values())
      .filter(s => s.totalVisits > 0)
      .sort((a, b) => b.totalVisits - a.totalVisits);
  }, [filteredCollaborators, filteredEvents]);

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
    const typeCount = new Map<number, number>();
    filteredEvents.forEach(e => {
      if (e.visitType !== null && e.visitType !== undefined) {
        const visitTypeNum = typeof e.visitType === 'string' ? parseInt(e.visitType, 10) : e.visitType;
        if (!isNaN(visitTypeNum)) {
          typeCount.set(visitTypeNum, (typeCount.get(visitTypeNum) || 0) + 1);
        }
      }
    });

    return Array.from(typeCount.entries())
      .map(([type, count]) => ({
        name: visitTypeNames[type] || `Type ${type}`,
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEvents]);

  const statusLabels = {
    completed: t.collaboratorReports?.completed || 'Completed',
    scheduled: t.common?.pending || 'Scheduled',
    inProgress: t.common?.loading || 'In Progress',
    cancelled: t.common?.error || 'Cancelled',
  };

  const statusData = useMemo(() => {
    return [
      { name: statusLabels.completed, value: stats.completedVisits, color: '#5B8C5A' },
      { name: statusLabels.scheduled, value: stats.scheduledVisits, color: '#4A90D9' },
      { name: statusLabels.inProgress, value: stats.inProgressVisits, color: '#E6B800' },
      { name: statusLabels.cancelled, value: stats.cancelledVisits, color: '#DC3545' },
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

  const isLoading = collaboratorsLoading || eventsLoading;

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
    <div className="space-y-6" data-testid="page-collaborator-reports">
      <PageHeader
        title={t.collaboratorReports.title}
        description={t.collaboratorReports.description}
      />

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
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="w-[250px]" data-testid="select-collaborator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-collaborator-all">{t.collaboratorReports.allCollaborators}</SelectItem>
                  {filteredCollaborators.map(c => (
                    <SelectItem key={c.id} value={c.id} data-testid={`option-collaborator-${c.id}`}>
                      {getCountryFlag(c.countryCode)} {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCountries.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <Label data-testid="label-countries">{t.collaboratorReports.countries}</Label>
                  <div className="flex gap-1">
                    {selectedCountries.map(code => (
                      <Badge key={code} variant="secondary" data-testid={`badge-country-${code}`}>
                        {getCountryFlag(code)} {getCountryName(code)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

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

      <div className="grid gap-4 md:grid-cols-4">
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
                  {t.collaboratorReports.ofTotal} {hospitals.length} {t.collaboratorReports.inSystem}
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
                  <Bar dataKey="value" fill="#6B1C3B" radius={[0, 4, 4, 0]} />
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
