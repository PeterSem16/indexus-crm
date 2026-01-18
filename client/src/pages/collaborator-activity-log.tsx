import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, Calendar, Clock, User, Building2, 
  Phone, MapPin, Filter, Search, XCircle, CheckCircle,
  LogIn, Smartphone, Eye, AlertCircle
} from "lucide-react";
import type { VisitEvent, Collaborator } from "@shared/schema";
import { VISIT_SUBJECTS, REMARK_DETAIL_OPTIONS, VISIT_PLACE_OPTIONS } from "@shared/schema";

const dateLocales: Record<string, Locale> = {
  sk, cs, hu, ro, it, de, en: enUS
};

type ActivityType = "all" | "visit_scheduled" | "visit_started" | "visit_completed" | "visit_cancelled" | "login";
type DateRange = "today" | "week" | "month" | "all";

interface ActivityItem {
  id: string;
  type: "visit_scheduled" | "visit_started" | "visit_completed" | "visit_cancelled" | "visit_not_realized" | "login";
  collaboratorId: string;
  collaboratorName: string;
  timestamp: Date;
  details: {
    hospitalName?: string;
    visitType?: string;
    place?: string;
    remarkDetail?: string;
    reason?: string;
    deviceInfo?: string;
  };
}

export default function CollaboratorActivityLogPage() {
  const { locale, t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("all");
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  
  const dateFnsLocale = dateLocales[locale] || enUS;

  const { data: visitEvents = [], isLoading: visitsLoading } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/visit-events${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/collaborators${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/hospitals${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const getCollaboratorName = (id: string) => {
    const collaborator = collaborators.find(c => c.id === id);
    return collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : t.common.unknown;
  };

  const getHospitalName = (id: string | null) => {
    if (!id) return null;
    const hospital = hospitals.find(h => h.id === id);
    return hospital?.name || null;
  };

  const getSubjectLabel = (code: string) => {
    const subject = VISIT_SUBJECTS.find(s => s.code === code);
    if (!subject) return t.common.unknown;
    return (subject as any)[locale] || t.common.unknown;
  };

  const getPlaceLabel = (code: string) => {
    const place = VISIT_PLACE_OPTIONS.find(p => p.code === code);
    if (!place) return t.common.unknown;
    return (place as any)[locale] || t.common.unknown;
  };

  const activities: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    visitEvents.forEach((event) => {
      const collaboratorName = getCollaboratorName(event.collaboratorId);
      const hospitalName = getHospitalName(event.hospitalId);

      // Visit scheduled
      items.push({
        id: `${event.id}-scheduled`,
        type: "visit_scheduled",
        collaboratorId: event.collaboratorId,
        collaboratorName,
        timestamp: new Date(event.createdAt),
        details: {
          hospitalName: hospitalName || undefined,
          visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
          place: event.place ? getPlaceLabel(event.place) : undefined,
        },
      });

      // Visit started (has actualStart)
      if (event.actualStart && !event.isCancelled && !event.isNotRealized) {
        items.push({
          id: `${event.id}-started`,
          type: "visit_started",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.actualStart),
          details: {
            hospitalName: hospitalName || undefined,
            visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
          },
        });
      }

      // Visit completed (status === 'completed' or has actualEnd)
      if ((event.status === 'completed' || event.actualEnd) && !event.isCancelled && !event.isNotRealized) {
        items.push({
          id: `${event.id}-completed`,
          type: "visit_completed",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: event.actualEnd ? new Date(event.actualEnd) : new Date(event.updatedAt),
          details: {
            hospitalName: hospitalName || undefined,
            visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
          },
        });
      }

      // Visit cancelled
      if (event.isCancelled || event.status === 'cancelled') {
        items.push({
          id: `${event.id}-cancelled`,
          type: "visit_cancelled",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt),
          details: {
            hospitalName: hospitalName || undefined,
            visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
            reason: (event as any).cancelReason || undefined,
          },
        });
      }

      // Visit not realized
      if (event.isNotRealized || event.status === 'not_realized') {
        items.push({
          id: `${event.id}-not-realized`,
          type: "visit_not_realized",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt),
          details: {
            hospitalName: hospitalName || undefined,
            visitType: event.subject ? getSubjectLabel(event.subject) : undefined,
            reason: (event as any).cancelReason || undefined,
          },
        });
      }
    });

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [visitEvents, collaborators, hospitals, locale]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (selectedCollaborator !== "all") {
      filtered = filtered.filter(a => a.collaboratorId === selectedCollaborator);
    }

    if (activityType !== "all") {
      filtered = filtered.filter(a => a.type === activityType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.collaboratorName.toLowerCase().includes(query) ||
        a.details.hospitalName?.toLowerCase().includes(query) ||
        a.details.visitType?.toLowerCase().includes(query)
      );
    }

    const now = new Date();
    if (dateRange === "today") {
      const start = startOfDay(now);
      const end = endOfDay(now);
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start, end }));
    } else if (dateRange === "week") {
      const start = startOfDay(subDays(now, 7));
      const end = endOfDay(now);
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start, end }));
    } else if (dateRange === "month") {
      const start = startOfDay(subDays(now, 30));
      const end = endOfDay(now);
      filtered = filtered.filter(a => isWithinInterval(a.timestamp, { start, end }));
    }

    return filtered;
  }, [activities, selectedCollaborator, activityType, searchQuery, dateRange]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return <Calendar className="h-4 w-4" />;
      case "visit_started": return <MapPin className="h-4 w-4" />;
      case "visit_completed": return <CheckCircle className="h-4 w-4" />;
      case "visit_cancelled": return <XCircle className="h-4 w-4" />;
      case "visit_not_realized": return <AlertCircle className="h-4 w-4" />;
      case "login": return <LogIn className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "visit_started": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "visit_completed": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "visit_cancelled": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "visit_not_realized": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "login": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getActivityLabel = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return t.common.scheduled;
      case "visit_started": return t.common.started;
      case "visit_completed": return t.common.completed;
      case "visit_cancelled": return t.common.cancelled;
      case "visit_not_realized": return t.common.notRealized;
      case "login": return t.activity.login;
      default: return t.common.unknown;
    }
  };

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    filteredActivities.forEach(activity => {
      const dateKey = format(activity.timestamp, "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(activity);
    });
    return groups;
  }, [filteredActivities]);

  const stats = useMemo(() => {
    const scheduled = activities.filter(a => a.type === "visit_scheduled").length;
    const completed = activities.filter(a => a.type === "visit_completed").length;
    const cancelled = activities.filter(a => a.type === "visit_cancelled" || a.type === "visit_not_realized").length;
    return { scheduled, completed, cancelled };
  }, [activities]);

  return (
    <div className="flex flex-col h-full" data-testid="collaborator-activity-log-page">
      <PageHeader
        title={t.nav.activityLog}
        icon={Activity}
      />

      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card data-testid="stat-scheduled">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-scheduled-value">{stats.scheduled}</div>
                <div className="text-sm text-muted-foreground" data-testid="stat-scheduled-label">{t.common.scheduled}</div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-completed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-300" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-completed-value">{stats.completed}</div>
                <div className="text-sm text-muted-foreground" data-testid="stat-completed-label">{t.common.completed}</div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-cancelled">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="stat-cancelled-value">{stats.cancelled}</div>
                <div className="text-sm text-muted-foreground" data-testid="stat-cancelled-label">{t.common.cancelled}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.common.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-activities"
                  />
                </div>
              </div>
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="w-[200px]" data-testid="select-collaborator">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t.nav.collaborators} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all}</SelectItem>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                <SelectTrigger className="w-[180px]" data-testid="select-activity-type">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t.common.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all}</SelectItem>
                  <SelectItem value="visit_scheduled">{t.common.scheduled}</SelectItem>
                  <SelectItem value="visit_completed">{t.common.completed}</SelectItem>
                  <SelectItem value="visit_cancelled">{t.common.cancelled}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t.common.dateFrom} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t.common.today}</SelectItem>
                  <SelectItem value="week">{t.common.last7days}</SelectItem>
                  <SelectItem value="month">{t.common.last30days}</SelectItem>
                  <SelectItem value="all">{t.common.allTime}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t.nav.activityLog} ({filteredActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-480px)]">
              {Object.keys(groupedActivities).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-activities-message">
                  {t.common.noResults}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
                    <div key={dateKey} className="mb-8">
                      <div className="sticky top-0 bg-background py-2 z-10" data-testid={`date-header-${dateKey}`}>
                        <Badge variant="secondary" className="ml-8">
                          {format(new Date(dateKey), "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}
                        </Badge>
                      </div>
                      <div className="space-y-4 mt-4">
                        {dayActivities.map((activity) => (
                          <div key={activity.id} className="flex gap-4 ml-1" data-testid={`activity-item-${activity.id}`}>
                            <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${getActivityColor(activity.type)}`}>
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium" data-testid={`activity-collaborator-${activity.id}`}>{activity.collaboratorName}</span>
                                    <Badge variant="outline" className="text-xs" data-testid={`activity-type-badge-${activity.id}`}>
                                      {getActivityLabel(activity.type)}
                                    </Badge>
                                  </div>
                                  {activity.details.hospitalName && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1" data-testid={`activity-hospital-${activity.id}`}>
                                      <Building2 className="h-3 w-3" />
                                      {activity.details.hospitalName}
                                    </div>
                                  )}
                                  {activity.details.visitType && (
                                    <div className="text-sm text-muted-foreground" data-testid={`activity-visit-type-${activity.id}`}>
                                      {activity.details.visitType}
                                      {activity.details.place && ` - ${activity.details.place}`}
                                    </div>
                                  )}
                                  {(activity.type === "visit_cancelled" || activity.type === "visit_not_realized") && (
                                    <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300" data-testid={`activity-cancel-reason-${activity.id}`}>
                                      {activity.type === "visit_cancelled" ? t.common.cancelled : t.common.notRealized}
                                      {activity.details.reason && (
                                        <span>: {activity.details.reason}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap" data-testid={`activity-time-${activity.id}`}>
                                  <Clock className="h-3 w-3" />
                                  {format(activity.timestamp, "HH:mm")}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
