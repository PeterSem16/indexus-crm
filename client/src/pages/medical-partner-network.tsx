import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Users, Settings, LayoutDashboard, Plus, Edit, Trash2,
  Phone, Mail, MessageCircle, Star, Search, Filter, Hospital, Stethoscope,
  UserCheck, UserX, Link2, ChevronRight, Building, Clock, Loader2
} from "lucide-react";

type PartnerCategory = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  entityScope: string;
  sortOrder: number;
  isActive: boolean;
};

type ContactChannel = {
  id: string;
  personId: string;
  channelType: string;
  value: string;
  label: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  assignmentId: string | null;
};

type CommunicationScheduleRow = {
  schedule: {
    id: string;
    categoryId: string;
    subcategory: string | null;
    channelType: string;
    frequencyMonths: number;
    isActive: boolean;
  };
  categoryName: string;
  categoryCode: string;
};

type ProtocolRow = {
  protocol: {
    id: string;
    categoryId: string;
    stepOrder: number;
    description: string;
    requiredDocuments: string[];
    isActive: boolean;
  };
  categoryName: string;
  categoryCode: string;
};

type MpnStats = {
  totalHospitals: number;
  totalClinics: number;
  totalPersons: number;
  totalAssignments: number;
  totalChannels: number;
  totalCategories: number;
  unassignedPersons: number;
  unassignedInstitutions: number;
};

type Institution = {
  id: string;
  name: string;
  city: string | null;
  countryCode: string;
  isActive: boolean;
  type: "hospital" | "clinic";
  phone?: string | null;
  email?: string | null;
};

type Person = {
  id: string;
  source: "collaborator" | "clinic" | "hospital";
  titleBefore: string;
  firstName: string;
  lastName: string;
  titleAfter: string;
  fullName: string;
  phone: string;
  mobile: string;
  email: string;
  isActive: boolean;
  countryCode: string;
  institutionName: string;
  institutionId: string;
  linkedInstitutions: { type: string; id: string; name: string }[];
  collaboratorType: string;
};

function channelIcon(type: string) {
  switch (type) {
    case "phone": case "landline": return <Phone className="h-4 w-4" />;
    case "mobile": return <Phone className="h-4 w-4" />;
    case "email": return <Mail className="h-4 w-4" />;
    case "whatsapp": case "viber": case "signal": return <MessageCircle className="h-4 w-4" />;
    default: return <Phone className="h-4 w-4" />;
  }
}

function scopeBadge(scope: string, t: any) {
  const colors: Record<string, string> = {
    hospital: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    clinic: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    independent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  const labels: Record<string, string> = { hospital: t.mpn.hospital, clinic: t.mpn.clinic, independent: t.mpn.independent };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[scope] || ""}`}>{labels[scope] || scope}</span>;
}

function channelLabel(type: string, t: any) {
  const map: Record<string, string> = {
    phone: t.mpn.phone, mobile: t.mpn.mobile, landline: t.mpn.landline,
    email: t.mpn.email, whatsapp: t.mpn.whatsapp, viber: t.mpn.viber, signal: t.mpn.signal,
    in_person: t.mpn.inPerson,
  };
  return map[type] || type;
}

function OverviewTab() {
  const { t } = useI18n();
  const { data: stats } = useQuery<MpnStats>({ queryKey: ["/api/mpn/stats"] });

  if (!stats) return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: t.mpn.totalHospitals, value: stats.totalHospitals, icon: Hospital, color: "text-blue-600" },
    { label: t.mpn.totalClinics, value: stats.totalClinics, icon: Stethoscope, color: "text-green-600" },
    { label: t.mpn.totalPersons, value: stats.totalPersons, icon: Users, color: "text-indigo-600" },
    { label: t.mpn.totalAssignments, value: stats.totalAssignments, icon: Link2, color: "text-amber-600" },
    { label: t.mpn.totalChannels, value: stats.totalChannels, icon: Phone, color: "text-cyan-600" },
    { label: t.mpn.unassignedPersons, value: stats.unassignedPersons, icon: UserX, color: "text-red-600" },
    { label: t.mpn.unassignedInstitutions, value: stats.unassignedInstitutions, icon: Building, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="mpn-overview-grid">
      {cards.map((c) => (
        <Card key={c.label} data-testid={`stat-card-${c.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.value}</p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InstitutionsTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedInstitution, setSelectedInstitution] = useState<{ type: string; id: string; name: string } | null>(null);

  const searchTimeout = useState<any>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[1] = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 300);
  };

  const queryParams: Record<string, string> = { page: String(page), limit: "100" };
  if (debouncedSearch) queryParams.search = debouncedSearch;
  if (typeFilter !== "all") queryParams.type = typeFilter;

  const { data: result, isLoading } = useQuery<{ data: Institution[]; total: number; page: number; totalPages: number }>({
    queryKey: ["/api/mpn/institutions", queryParams],
  });

  const filtered = result?.data || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center" data-testid="institutions-filters">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t.mpn.name}, ${t.mpn.city}...`}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-institutions"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.mpn.allTypes}</SelectItem>
            <SelectItem value="hospital">{t.mpn.hospital}</SelectItem>
            <SelectItem value="clinic">{t.mpn.clinic}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-institutions-count">
          {total} {t.mpn.institutions || "institutions"} {debouncedSearch && `(${t.mpn.filtered || "filtered"})`}
        </p>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.mpn.type}</TableHead>
              <TableHead>{t.mpn.name}</TableHead>
              <TableHead>{t.mpn.city}</TableHead>
              <TableHead>{t.mpn.country}</TableHead>
              <TableHead>{t.mpn.status}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t.mpn.noData}</TableCell></TableRow>
            ) : filtered.map((inst) => (
              <TableRow key={`${inst.type}-${inst.id}`} className="cursor-pointer hover:bg-muted/50" data-testid={`row-institution-${inst.id}`}>
                <TableCell>
                  {inst.type === "hospital" ? (
                    <Badge variant="outline" className="gap-1"><Hospital className="h-3 w-3" />{t.mpn.hospital}</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-green-300"><Stethoscope className="h-3 w-3" />{t.mpn.clinic}</Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">{inst.name}</TableCell>
                <TableCell>{inst.city || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{inst.countryCode}</Badge></TableCell>
                <TableCell>
                  <Badge variant={inst.isActive ? "default" : "secondary"}>
                    {inst.isActive ? t.mpn.active : t.mpn.inactive}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedInstitution({ type: inst.type, id: inst.id, name: inst.name })} data-testid={`btn-view-personnel-${inst.id}`}>
                    <Users className="h-4 w-4 mr-1" /> {t.mpn.personnel}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.mpn.page || "Page"} {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="btn-prev-page">
              ← {t.mpn.previous || "Previous"}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="btn-next-page">
              {t.mpn.next || "Next"} →
            </Button>
          </div>
        </div>
      )}

      {selectedInstitution && (
        <PersonnelDialog
          entityType={selectedInstitution.type}
          entityId={selectedInstitution.id}
          entityName={selectedInstitution.name}
          onClose={() => setSelectedInstitution(null)}
        />
      )}
    </div>
  );
}

function PersonnelDialog({ entityType, entityId, entityName, onClose }: { entityType: string; entityId: string; entityName: string; onClose: () => void }) {
  const { t } = useI18n();
  const { data: personnel = [] } = useQuery<any[]>({
    queryKey: ["/api/mpn/institution", entityType, entityId, "personnel"],
    queryFn: async () => {
      const res = await fetch(`/api/mpn/institution/${entityType}/${entityId}/personnel`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {entityName} — {t.mpn.personnel}
          </DialogTitle>
        </DialogHeader>
        {personnel.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t.mpn.noData}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.mpn.name}</TableHead>
                <TableHead>{t.mpn.category}</TableHead>
                <TableHead>{t.mpn.department}</TableHead>
                <TableHead>{t.mpn.position}</TableHead>
                <TableHead>{t.mpn.contactInfo}</TableHead>
                <TableHead>{t.mpn.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnel.map((p: any) => (
                <TableRow key={p.assignment_id} data-testid={`row-personnel-${p.person_id}`}>
                  <TableCell className="font-medium">
                    {[p.title_before, p.first_name, p.last_name, p.title_after].filter(Boolean).join(" ")}
                    {p.is_primary && <Star className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell>{p.category_name || "—"}</TableCell>
                  <TableCell>{p.department || "—"}</TableCell>
                  <TableCell>{p.position || "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {(p.channels || []).slice(0, 3).map((ch: any) => (
                        <div key={ch.id} className="flex items-center gap-1 text-xs">
                          {channelIcon(ch.channelType)}
                          <span>{ch.value}</span>
                          {ch.isPrimary && <Star className="h-3 w-3 text-amber-400" />}
                        </div>
                      ))}
                      {(!p.channels || p.channels.length === 0) && (
                        <span className="text-xs text-muted-foreground">
                          {p.email || p.phone || p.mobile || "—"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? t.mpn.active : t.mpn.inactive}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function sourceLabel(source: string, t: any) {
  switch (source) {
    case "collaborator": return t.mpn.collaborator || "Collaborator";
    case "clinic": return t.mpn.clinic;
    case "hospital": return t.mpn.hospital;
    default: return source;
  }
}

function sourceBadgeColor(source: string) {
  switch (source) {
    case "collaborator": return "border-blue-300 text-blue-700";
    case "clinic": return "border-green-300 text-green-700";
    case "hospital": return "border-orange-300 text-orange-700";
    default: return "";
  }
}

function PersonsTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const searchTimeout = useState<any>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[1] = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 300);
  };

  const queryParams: Record<string, string> = { page: String(page), limit: "100" };
  if (debouncedSearch) queryParams.search = debouncedSearch;
  if (sourceFilter !== "all") queryParams.source = sourceFilter;

  const { data: result, isLoading } = useQuery<{ data: Person[]; total: number; page: number; totalPages: number }>({
    queryKey: ["/api/mpn/persons", queryParams],
  });

  const filtered = result?.data || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center" data-testid="persons-filters">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t.mpn.name}, ${t.mpn.email}...`}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-persons"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-52" data-testid="select-source-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.mpn.allSources || "All Sources"}</SelectItem>
            <SelectItem value="collaborator">{t.mpn.collaborator || "Collaborator"}</SelectItem>
            <SelectItem value="clinic">{t.mpn.clinicDoctors || "Clinic Doctors"}</SelectItem>
            <SelectItem value="hospital">{t.mpn.hospitalContacts || "Hospital Contacts"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-persons-count">
          {total} {t.mpn.persons || "persons"} {debouncedSearch && `(${t.mpn.filtered})`}
        </p>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.mpn.source || "Source"}</TableHead>
              <TableHead>{t.mpn.name}</TableHead>
              <TableHead>{t.mpn.institutionName}</TableHead>
              <TableHead>{t.mpn.contactInfo}</TableHead>
              <TableHead>{t.mpn.country}</TableHead>
              <TableHead>{t.mpn.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t.mpn.noData}</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/50" data-testid={`row-person-${p.id}`}>
                <TableCell>
                  <Badge variant="outline" className={`gap-1 ${sourceBadgeColor(p.source)}`}>
                    {p.source === "collaborator" && <UserCheck className="h-3 w-3" />}
                    {p.source === "clinic" && <Stethoscope className="h-3 w-3" />}
                    {p.source === "hospital" && <Hospital className="h-3 w-3" />}
                    {sourceLabel(p.source, t)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <div>{p.fullName || [p.titleBefore, p.firstName, p.lastName, p.titleAfter].filter(Boolean).join(" ")}</div>
                  {p.collaboratorType && <span className="text-xs text-muted-foreground">{p.collaboratorType}</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {p.linkedInstitutions && p.linkedInstitutions.length > 0 ? (
                    <div className="space-y-0.5">
                      {p.linkedInstitutions.slice(0, 3).map((inst, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          {inst.type === "hospital" ? <Hospital className="h-3 w-3 text-orange-500" /> : <Stethoscope className="h-3 w-3 text-green-500" />}
                          <span className="truncate max-w-[200px]">{inst.name}</span>
                        </div>
                      ))}
                      {p.linkedInstitutions.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{p.linkedInstitutions.length - 3} {t.mpn.more || "more"}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 text-xs">
                    {p.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</div>}
                    {p.mobile && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.mobile}</div>}
                    {p.phone && !p.mobile && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</div>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{p.countryCode}</Badge></TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "default" : "secondary"}>
                    {p.isActive ? t.mpn.active : t.mpn.inactive}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.mpn.page} {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="btn-persons-prev">
              ← {t.mpn.previous}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="btn-persons-next">
              {t.mpn.next} →
            </Button>
          </div>
        </div>
      )}

      {selectedPerson && (
        <PersonDetailDialog person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  );
}

function PersonDetailDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const { t } = useI18n();
  const fullName = [person.titleBefore, person.firstName, person.lastName, person.titleAfter].filter(Boolean).join(" ");

  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/mpn/person", person.id, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/mpn/person/${person.id}/assignments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: channels = [] } = useQuery<ContactChannel[]>({
    queryKey: ["/api/mpn/channels", { personId: person.id }],
    queryFn: async () => {
      const res = await fetch(`/api/mpn/channels?personId=${person.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {t.mpn.workplaces}
            </h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.mpn.noData}</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a: any) => (
                  <Card key={a.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {a.entity_type === "hospital" ? <Hospital className="h-4 w-4 text-blue-600" /> : <Stethoscope className="h-4 w-4 text-green-600" />}
                          {a.entity_name || "—"}
                          {a.is_primary && <Star className="h-3 w-3 text-amber-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-x-3">
                          {a.category_name && <span>{a.category_name}</span>}
                          {a.department && <span>• {a.department}</span>}
                          {a.entity_city && <span>• {a.entity_city}</span>}
                        </div>
                      </div>
                      <Badge variant={a.is_active ? "default" : "secondary"}>
                        {a.is_active ? t.mpn.active : t.mpn.inactive}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" /> {t.mpn.channels}
            </h3>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.mpn.noData}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                      {channelIcon(ch.channelType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ch.value}</div>
                      <div className="text-xs text-muted-foreground">
                        {channelLabel(ch.channelType, t)}
                        {ch.label && ` — ${ch.label}`}
                      </div>
                    </div>
                    {ch.isPrimary && <Star className="h-4 w-4 text-amber-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<PartnerCategory | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const { data: categories = [] } = useQuery<PartnerCategory[]>({ queryKey: ["/api/mpn/categories"] });
  const { data: schedulesData = [] } = useQuery<CommunicationScheduleRow[]>({ queryKey: ["/api/mpn/schedules"] });
  const { data: protocolsData = [] } = useQuery<ProtocolRow[]>({ queryKey: ["/api/mpn/protocols"] });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/mpn/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mpn/categories"] });
      toast({ title: "OK" });
    },
  });

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t.mpn.categories}</CardTitle>
            <CardDescription>{t.mpn.description}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddCategory(true)} data-testid="btn-add-category">
            <Plus className="h-4 w-4 mr-1" /> {t.mpn.addCategory}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.mpn.sortOrder}</TableHead>
                <TableHead>{t.mpn.categoryCode}</TableHead>
                <TableHead>{t.mpn.categoryName}</TableHead>
                <TableHead>{t.mpn.entityScope}</TableHead>
                <TableHead>{t.mpn.status}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id} data-testid={`row-category-${cat.code}`}>
                  <TableCell>{cat.sortOrder}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cat.code}</code></TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{scopeBadge(cat.entityScope, t)}</TableCell>
                  <TableCell>
                    <Badge variant={cat.isActive ? "default" : "secondary"}>
                      {cat.isActive ? t.mpn.active : t.mpn.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingCategory(cat)} data-testid={`btn-edit-category-${cat.code}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteCategoryMut.mutate(cat.id)} data-testid={`btn-delete-category-${cat.code}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.mpn.schedules}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.mpn.category}</TableHead>
                <TableHead>{t.mpn.subcategory}</TableHead>
                <TableHead>{t.mpn.channelType}</TableHead>
                <TableHead>{t.mpn.frequencyMonths}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulesData.map((row) => (
                <TableRow key={row.schedule.id} data-testid={`row-schedule-${row.schedule.id}`}>
                  <TableCell className="font-medium">{row.categoryName}</TableCell>
                  <TableCell>{row.schedule.subcategory || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {channelIcon(row.schedule.channelType)}
                      {channelLabel(row.schedule.channelType, t)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {row.schedule.frequencyMonths} {t.mpn.frequencyMonths.split("(")[1]?.replace(")", "") || "m"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.mpn.protocols}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from(new Set(protocolsData.map((r) => r.categoryName))).map((catName) => {
              const catProtocols = protocolsData.filter((r) => r.categoryName === catName);
              return (
                <div key={catName}>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    {scopeBadge(catProtocols[0]?.categoryCode?.includes("midwife") ? "independent" :
                      catProtocols[0]?.categoryCode?.includes("ambulant") ? "clinic" : "hospital", t)}
                    {catName}
                  </h4>
                  <div className="space-y-2 ml-4">
                    {catProtocols.map((row) => (
                      <div key={row.protocol.id} className="flex gap-3 p-2 rounded-md border bg-card" data-testid={`row-protocol-${row.protocol.id}`}>
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                          {row.protocol.stepOrder}
                        </div>
                        <div>
                          <p className="text-sm">{row.protocol.description}</p>
                          {row.protocol.requiredDocuments.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.protocol.requiredDocuments.map((doc, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{doc}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(showAddCategory || editingCategory) && (
        <CategoryFormDialog
          category={editingCategory}
          onClose={() => { setShowAddCategory(false); setEditingCategory(null); }}
        />
      )}
    </div>
  );
}

function CategoryFormDialog({ category, onClose }: { category: PartnerCategory | null; onClose: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const isEdit = !!category;

  const [form, setForm] = useState({
    code: category?.code || "",
    name: category?.name || "",
    nameEn: category?.nameEn || "",
    entityScope: category?.entityScope || "hospital",
    sortOrder: category?.sortOrder || 0,
    isActive: category?.isActive ?? true,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return apiRequest("PATCH", `/api/mpn/categories/${category!.id}`, form);
      }
      return apiRequest("POST", "/api/mpn/categories", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mpn/categories"] });
      toast({ title: "OK" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.mpn.editCategory : t.mpn.addCategory}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.mpn.categoryCode}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="input-category-code" />
            </div>
            <div>
              <Label>{t.mpn.sortOrder}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-sort-order" />
            </div>
          </div>
          <div>
            <Label>{t.mpn.categoryName} (SK)</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-category-name" />
          </div>
          <div>
            <Label>{t.mpn.categoryName} (EN)</Label>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} data-testid="input-category-name-en" />
          </div>
          <div>
            <Label>{t.mpn.entityScope}</Label>
            <Select value={form.entityScope} onValueChange={(v) => setForm({ ...form, entityScope: v })}>
              <SelectTrigger data-testid="select-entity-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hospital">{t.mpn.hospital}</SelectItem>
                <SelectItem value="clinic">{t.mpn.clinic}</SelectItem>
                <SelectItem value="independent">{t.mpn.independent}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-is-active" />
            <Label>{t.mpn.active}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common?.cancel || "Cancel"}</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="btn-save-category">
            {saveMut.isPending ? "..." : (t.common?.save || "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MedicalPartnerNetworkPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 space-y-6" data-testid="mpn-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-mpn-title">
          <Building2 className="h-6 w-6" />
          {t.mpn.title}
        </h1>
        <p className="text-muted-foreground mt-1">{t.mpn.description}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-4" data-testid="mpn-tabs">
          <TabsTrigger value="overview" className="gap-1" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.overview}</span>
          </TabsTrigger>
          <TabsTrigger value="institutions" className="gap-1" data-testid="tab-institutions">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.institutions}</span>
          </TabsTrigger>
          <TabsTrigger value="persons" className="gap-1" data-testid="tab-persons">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.persons}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mpn.settings}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="institutions"><InstitutionsTab /></TabsContent>
        <TabsContent value="persons"><PersonsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
