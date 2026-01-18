import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, MapPin, ChevronLeft, ChevronRight, Clock, User, Building2, 
  Phone, MessageSquare, Filter, List, Map as MapIcon, Eye, Smartphone,
  Activity, Search, XCircle, CheckCircle, LogIn, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import type { VisitEvent, Collaborator, Hospital } from "@shared/schema";
import { VISIT_SUBJECTS, REMARK_DETAIL_OPTIONS, VISIT_PLACE_OPTIONS } from "@shared/schema";

type PageView = "visits" | "activityLog";
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

const dateLocales: Record<string, Locale> = {
  sk, cs, hu, ro, it, de, en: enUS
};

export default function VisitEventsPage() {
  const { locale, t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const [pageView, setPageView] = useState<PageView>("visits");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<VisitEvent | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "map">("calendar");
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  
  const dateFnsLocale = dateLocales[locale] || enUS;

  const { data: visitEvents = [], isLoading } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events", selectedCountries.join(","), format(startOfMonth(currentMonth), "yyyy-MM-dd"), format(endOfMonth(currentMonth), "yyyy-MM-dd")],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCountries.length > 0) {
        params.set("countries", selectedCountries.join(","));
      }
      params.set("startDate", format(startOfMonth(currentMonth), "yyyy-MM-dd"));
      params.set("endDate", format(endOfMonth(currentMonth), "yyyy-MM-dd"));
      const res = await fetch(`/api/visit-events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: allVisitEvents = [] } = useQuery<VisitEvent[]>({
    queryKey: ["/api/visit-events", selectedCountries.join(","), "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCountries.length > 0) {
        params.set("countries", selectedCountries.join(","));
      }
      const res = await fetch(`/api/visit-events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: pageView === "activityLog",
  });

  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/collaborators${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/hospitals${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredEvents = selectedCollaborator === "all" 
    ? visitEvents 
    : visitEvents.filter(e => e.collaboratorId === selectedCollaborator);

  const getSubjectLabel = (code: string) => {
    const subject = VISIT_SUBJECTS.find(s => s.code === code);
    if (!subject) return code;
    return (subject as any)[locale] || subject.en;
  };

  const getRemarkDetailLabel = (code: string) => {
    const detail = REMARK_DETAIL_OPTIONS.find(d => d.code === code);
    if (!detail) return code;
    return (detail as any)[locale] || detail.en;
  };

  const getPlaceLabel = (code: string) => {
    const place = VISIT_PLACE_OPTIONS.find(p => p.code === code);
    if (!place) return code;
    return (place as any)[locale] || place.en;
  };

  const getCollaboratorName = (id: string) => {
    const collaborator = collaborators.find(c => c.id === id);
    return collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "Unknown";
  };

  const getHospitalName = (id: string | null) => {
    if (!id) return null;
    const hospital = hospitals.find(h => h.id === id);
    return hospital?.name || null;
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, day);
    });
  };

  const activities: ActivityItem[] = (() => {
    const items: ActivityItem[] = [];
    allVisitEvents.forEach((event) => {
      const collaboratorName = getCollaboratorName(event.collaboratorId);
      const hospitalName = getHospitalName(event.hospitalId);

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
          remarkDetail: event.remarkDetail ? getRemarkDetailLabel(event.remarkDetail) : undefined,
        },
      });

      if (event.isCancelled) {
        items.push({
          id: `${event.id}-cancelled`,
          type: "visit_cancelled",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt || event.createdAt),
          details: { hospitalName: hospitalName || undefined },
        });
      }

      if (event.isNotRealized) {
        items.push({
          id: `${event.id}-not-realized`,
          type: "visit_not_realized",
          collaboratorId: event.collaboratorId,
          collaboratorName,
          timestamp: new Date(event.updatedAt || event.createdAt),
          details: { hospitalName: hospitalName || undefined },
        });
      }
    });

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items;
  })();

  const filteredActivities = (() => {
    let filtered = activities;
    if (selectedCollaborator !== "all") {
      filtered = filtered.filter(a => a.collaboratorId === selectedCollaborator);
    }
    if (activityType !== "all") {
      filtered = filtered.filter(a => a.type === activityType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.collaboratorName.toLowerCase().includes(q) ||
        a.details.hospitalName?.toLowerCase().includes(q) ||
        a.details.visitType?.toLowerCase().includes(q)
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
  })();

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
      case "visit_not_realized": return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
      case "login": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getActivityLabel = (type: ActivityItem["type"]) => {
    switch (type) {
      case "visit_scheduled": return t.common?.scheduled || t.common?.unknown;
      case "visit_started": return t.common?.started || t.common?.unknown;
      case "visit_completed": return t.common?.completed || t.common?.unknown;
      case "visit_cancelled": return t.common?.cancelled || t.common?.unknown;
      case "visit_not_realized": return t.common?.notRealized || t.common?.unknown;
      case "login": return "Login";
      default: return t.common?.unknown;
    }
  };

  const groupedActivities = filteredActivities.reduce((acc, activity) => {
    const dateKey = format(activity.timestamp, "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, ActivityItem[]>);

  const renderCalendarView = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-lg">
            {format(currentMonth, "LLLL yyyy", { locale: dateFnsLocale })}
          </CardTitle>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
          {t.common?.today || "Dnes"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
          {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map(day => (
            <div key={day} className="bg-background p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="bg-muted/30 p-2 min-h-[100px]" />
          ))}
          
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toISOString()}
                className={`bg-background p-2 min-h-[100px] ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="text-xs p-1 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20 transition-colors"
                      title={getSubjectLabel(event.subject)}
                    >
                      {format(new Date(event.startTime), "HH:mm")} - {getSubjectLabel(event.subject).substring(0, 15)}...
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} {t.common?.more || "viac"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          {t.visitEvents?.listTitle || "Zoznam návštev"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t.visitEvents?.noEvents || "Žiadne návštevy v tomto období"}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{getSubjectLabel(event.subject)}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.startTime), "dd.MM.yyyy HH:mm", { locale: dateFnsLocale })} - 
                      {format(new Date(event.endTime), "HH:mm", { locale: dateFnsLocale })}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <User className="h-3 w-3" />
                      {getCollaboratorName(event.collaboratorId)}
                    </div>
                    {event.hospitalId && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Building2 className="h-3 w-3" />
                        {getHospitalName(event.hospitalId)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {event.isCancelled && (
                      <Badge variant="destructive">{t.visitEvents?.cancelled || "Zrušená"}</Badge>
                    )}
                    {event.syncedFromMobile && (
                      <Badge variant="secondary">
                        <Phone className="h-3 w-3 mr-1" />
                        Mobile
                      </Badge>
                    )}
                    {event.latitude && event.longitude && (
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderMapView = () => {
    const eventsWithLocation = filteredEvents.filter(e => e.latitude && e.longitude);
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            {t.visitEvents?.mapTitle || "Mapa návštev"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsWithLocation.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.visitEvents?.noLocations || "Žiadne návštevy s GPS lokalizáciou"}
            </div>
          ) : (
            <div className="relative h-[500px] bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapIcon className="h-12 w-12 mx-auto mb-2" />
                <p>{t.visitEvents?.mapPlaceholder || "Mapová integrácia"}</p>
                <p className="text-sm mt-2">
                  {eventsWithLocation.length} {t.visitEvents?.eventsWithLocation || "návštev s GPS lokalizáciou"}
                </p>
                <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                  {eventsWithLocation.slice(0, 5).map(event => (
                    <div key={event.id} className="p-2 bg-background rounded border text-sm">
                      <div className="font-medium">{getCollaboratorName(event.collaboratorId)}</div>
                      <div className="text-xs text-muted-foreground">
                        {event.latitude}, {event.longitude}
                      </div>
                      <div className="text-xs">{event.locationAddress || "Adresa neznáma"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderActivityLogView = () => (
    <div className="space-y-6" data-testid="activity-log-container">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common?.search || "Search"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-activity-search"
          />
        </div>
        <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
          <SelectTrigger className="w-[200px]" data-testid="select-activity-collaborator">
            <SelectValue placeholder={t.visitEvents?.allCollaborators || t.common?.unknown} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.visitEvents?.allCollaborators || t.common?.unknown}</SelectItem>
            {collaborators.filter(c => c.mobileAppEnabled).map(collaborator => (
              <SelectItem key={collaborator.id} value={collaborator.id}>
                {collaborator.firstName} {collaborator.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
          <SelectTrigger className="w-[180px]" data-testid="select-activity-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common?.all || t.common?.unknown}</SelectItem>
            <SelectItem value="visit_scheduled">{t.common?.scheduled || t.common?.unknown}</SelectItem>
            <SelectItem value="visit_started">{t.common?.started || t.common?.unknown}</SelectItem>
            <SelectItem value="visit_completed">{t.common?.completed || t.common?.unknown}</SelectItem>
            <SelectItem value="visit_cancelled">{t.common?.cancelled || t.common?.unknown}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px]" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t.common?.today || t.common?.unknown}</SelectItem>
            <SelectItem value="week">{t.common?.last7days || t.common?.unknown}</SelectItem>
            <SelectItem value="month">{t.common?.last30days || t.common?.unknown}</SelectItem>
            <SelectItem value="all">{t.common?.allTime || t.common?.unknown}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t.nav?.activityLog || t.common?.unknown}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {Object.keys(groupedActivities).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t.common?.noData || t.common?.unknown}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedActivities).sort().reverse().map(dateKey => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3" data-testid={`date-header-${dateKey}`}>
                      <Badge variant="outline" className="text-xs">
                        {format(parseISO(dateKey), "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}
                      </Badge>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2 ml-4 border-l-2 border-muted pl-4">
                      {groupedActivities[dateKey].map(activity => (
                        <div key={activity.id} className="relative" data-testid={`activity-item-${activity.id}`}>
                          <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-background border-2 border-primary" />
                          <div className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium" data-testid={`activity-collaborator-${activity.id}`}>
                                    {activity.collaboratorName}
                                  </span>
                                  <Badge className={`text-xs ${getActivityColor(activity.type)}`} data-testid={`activity-type-badge-${activity.id}`}>
                                    {getActivityIcon(activity.type)}
                                    <span className="ml-1">{getActivityLabel(activity.type)}</span>
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
                                {(activity.type === "visit_cancelled" || activity.type === "visit_not_realized") && activity.details.reason && (
                                  <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300" data-testid={`activity-reason-${activity.id}`}>
                                    {activity.details.reason}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`activity-time-${activity.id}`}>
                                <Clock className="h-3 w-3 inline mr-1" />
                                {format(activity.timestamp, "HH:mm", { locale: dateFnsLocale })}
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
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.visitEvents?.title || "INDEXUS Connect"}
        description={t.visitEvents?.description || t.common?.unknown}
      />

      <Tabs value={pageView} onValueChange={(v) => setPageView(v as PageView)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="visits" className="flex items-center gap-1" data-testid="tab-visits">
            <Calendar className="h-4 w-4" />
            {t.visitEvents?.visitsTab || t.nav?.visitEvents || t.common?.unknown}
          </TabsTrigger>
          <TabsTrigger value="activityLog" className="flex items-center gap-1" data-testid="tab-activity-log">
            <Activity className="h-4 w-4" />
            {t.nav?.activityLog || t.common?.unknown}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageView === "visits" && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list" | "map")}>
              <TabsList>
                <TabsTrigger value="calendar" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t.visitEvents?.calendar || t.common?.unknown}
                </TabsTrigger>
                <TabsTrigger value="list" className="flex items-center gap-1">
                  <List className="h-4 w-4" />
                  {t.visitEvents?.list || t.common?.unknown}
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-1">
                  <MapIcon className="h-4 w-4" />
                  {t.visitEvents?.map || t.common?.unknown}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="w-[200px]" data-testid="select-collaborator-filter">
                  <SelectValue placeholder={t.visitEvents?.allCollaborators || t.common?.unknown} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.visitEvents?.allCollaborators || t.common?.unknown}</SelectItem>
                  {collaborators.filter(c => c.mobileAppEnabled).map(collaborator => (
                    <SelectItem key={collaborator.id} value={collaborator.id}>
                      {collaborator.firstName} {collaborator.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Link href="/mobile-preview">
              <Button variant="outline" className="flex items-center gap-2" data-testid="button-mobile-preview">
                <Smartphone className="h-4 w-4" />
                Mobile Preview
              </Button>
            </Link>

            <div className="ml-auto text-sm text-muted-foreground">
              {filteredEvents.length} {t.visitEvents?.eventsCount || t.common?.unknown}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {viewMode === "calendar" && renderCalendarView()}
              {viewMode === "list" && renderListView()}
              {viewMode === "map" && renderMapView()}
            </>
          )}
        </>
      )}

      {pageView === "activityLog" && renderActivityLogView()}

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t.visitEvents?.eventDetail || "Detail návštevy"}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">{t.visitEvents?.subject || "Predmet"}</div>
                <div className="font-medium">{getSubjectLabel(selectedEvent.subject)}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.time || "Čas"}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(selectedEvent.startTime), "dd.MM.yyyy HH:mm", { locale: dateFnsLocale })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    do {format(new Date(selectedEvent.endTime), "HH:mm", { locale: dateFnsLocale })}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.collaborator || "Reprezentant"}</div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {getCollaboratorName(selectedEvent.collaboratorId)}
                  </div>
                </div>
              </div>

              {selectedEvent.hospitalId && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.hospital || "Nemocnica"}</div>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {getHospitalName(selectedEvent.hospitalId)}
                  </div>
                </div>
              )}

              {selectedEvent.latitude && selectedEvent.longitude && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.location || "Lokácia"}</div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.locationAddress || `${selectedEvent.latitude}, ${selectedEvent.longitude}`}
                  </div>
                </div>
              )}

              {selectedEvent.visitType && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.visitType || "Typ návštevy"}</div>
                  <div>{getSubjectLabel(selectedEvent.visitType)}</div>
                </div>
              )}

              {selectedEvent.place && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.place || "Miesto"}</div>
                  <div>{getPlaceLabel(selectedEvent.place)}</div>
                </div>
              )}

              {selectedEvent.remarkDetail && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.remarkDetail || "Detail poznámky"}</div>
                  <div>{getRemarkDetailLabel(selectedEvent.remarkDetail)}</div>
                </div>
              )}

              {selectedEvent.remark && (
                <div>
                  <div className="text-sm text-muted-foreground">{t.visitEvents?.remark || "Poznámka"}</div>
                  <div className="p-3 bg-muted rounded-md">
                    <MessageSquare className="h-4 w-4 inline mr-2" />
                    {selectedEvent.remark}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedEvent.isCancelled && (
                  <Badge variant="destructive">{t.visitEvents?.cancelled || "Zrušená"}</Badge>
                )}
                {selectedEvent.isNotRealized && (
                  <Badge variant="secondary">{t.visitEvents?.notRealized || "Nerealizovaná"}</Badge>
                )}
                {selectedEvent.syncedFromMobile && (
                  <Badge variant="outline">
                    <Phone className="h-3 w-3 mr-1" />
                    {t.visitEvents?.fromMobile || "Z mobilnej aplikácie"}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
