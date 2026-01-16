import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, MapPin, ChevronLeft, ChevronRight, Clock, User, Building2, 
  Phone, MessageSquare, Filter, List, Map as MapIcon, Eye
} from "lucide-react";
import type { VisitEvent, Collaborator, Hospital } from "@shared/schema";
import { VISIT_SUBJECTS, REMARK_DETAIL_OPTIONS, VISIT_PLACE_OPTIONS } from "@shared/schema";

const dateLocales: Record<string, Locale> = {
  sk, cs, hu, ro, it, de, en: enUS
};

export default function VisitEventsPage() {
  const { locale, t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<VisitEvent | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "map">("calendar");
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("all");
  
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

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/hospitals${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.visitEvents?.title || "INDEXUS Connect - Návštevy"}
        description={t.visitEvents?.description || "Kalendár návštev reprezentantov s mapovou lokalizáciou"}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list" | "map")}>
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t.visitEvents?.calendar || "Kalendár"}
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-1">
              <List className="h-4 w-4" />
              {t.visitEvents?.list || "Zoznam"}
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-1">
              <MapIcon className="h-4 w-4" />
              {t.visitEvents?.map || "Mapa"}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
            <SelectTrigger className="w-[200px]" data-testid="select-collaborator-filter">
              <SelectValue placeholder={t.visitEvents?.allCollaborators || "Všetci reprezentanti"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.visitEvents?.allCollaborators || "Všetci reprezentanti"}</SelectItem>
              {collaborators.filter(c => c.mobileAppEnabled).map(collaborator => (
                <SelectItem key={collaborator.id} value={collaborator.id}>
                  {collaborator.firstName} {collaborator.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredEvents.length} {t.visitEvents?.eventsCount || "návštev"}
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
