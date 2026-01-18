import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Calendar, Building2, Clock, Users, Filter, BarChart3 } from "lucide-react";
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
import type { Collaborator, VisitEvent, Hospital } from "@shared/schema";

type ReportType = 'activity_summary' | 'visit_statistics' | 'performance_metrics' | 'hospital_coverage';
type PeriodType = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

interface ReportStats {
  totalCollaborators: number;
  activeCollaborators: number;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  totalHours: number;
  hospitalsVisited: number;
}

export default function CollaboratorReportsPage() {
  const { selectedCountries } = useCountryFilter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState<ReportType | null>(null);

  const { data: collaborators = [], isLoading: collaboratorsLoading } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators"],
  });

  const { data: visitEvents = [], isLoading: eventsLoading } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events", { startDate: getStartDate(period), endDate: new Date().toISOString() }],
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const filteredCollaborators = collaborators.filter(c => 
    selectedCountries.length === 0 || selectedCountries.includes(c.countryCode as typeof selectedCountries[number])
  );

  const filteredEvents = visitEvents.filter(e => {
    if (selectedCollaborator !== 'all' && e.collaboratorId !== selectedCollaborator) return false;
    const collaborator = collaborators.find(c => c.id === e.collaboratorId);
    if (!collaborator) return false;
    if (selectedCountries.length > 0 && !selectedCountries.includes(collaborator.countryCode as typeof selectedCountries[number])) return false;
    return true;
  });

  const stats = calculateStats(filteredEvents, filteredCollaborators, hospitals);

  function getStartDate(periodType: PeriodType): string {
    const now = new Date();
    switch (periodType) {
      case 'last_month':
        return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      case 'last_3_months':
        return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      case 'this_year':
        return new Date(now.getFullYear(), 0, 1).toISOString();
      case 'this_month':
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
  }

  function calculateStats(events: VisitEvent[], collabs: Collaborator[], hosps: Hospital[]): ReportStats {
    const completedEvents = events.filter(e => e.status === 'completed');
    const cancelledEvents = events.filter(e => e.isCancelled || e.status === 'cancelled');
    
    let totalHours = 0;
    completedEvents.forEach(e => {
      if (e.actualStart && e.actualEnd) {
        totalHours += (new Date(e.actualEnd).getTime() - new Date(e.actualStart).getTime()) / 3600000;
      }
    });

    const activeCollabIds = new Set(events.map(e => e.collaboratorId));
    const visitedHospitalIds = new Set(events.map(e => e.hospitalId).filter(Boolean));

    return {
      totalCollaborators: collabs.length,
      activeCollaborators: activeCollabIds.size,
      totalVisits: events.length,
      completedVisits: completedEvents.length,
      cancelledVisits: cancelledEvents.length,
      totalHours: Math.round(totalHours * 10) / 10,
      hospitalsVisited: visitedHospitalIds.size,
    };
  }

  const handleDownload = async (reportType: ReportType) => {
    setIsDownloading(reportType);
    try {
      const params = new URLSearchParams({
        period,
        collaboratorId: selectedCollaborator,
        countries: selectedCountries.join(','),
      });
      
      const response = await fetch(`/api/collaborator-reports/${reportType}?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${period}_${Date.now()}.csv`;
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
                  {t.collaboratorReports.ofTotal} {stats.totalCollaborators} {t.collaboratorReports.active}
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
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map(report => (
          <Card key={report.id} className="hover-elevate" data-testid={`card-report-${report.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <report.icon className="h-5 w-5 text-primary" />
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleDownload(report.id)}
                disabled={isDownloading !== null}
                className="w-full"
                data-testid={`button-download-${report.id}`}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading === report.id ? t.collaboratorReports.downloading : t.collaboratorReports.downloadCsv}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
