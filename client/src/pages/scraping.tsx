import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, RefreshCw, CheckCircle2, XCircle, Trash2, ExternalLink, Building2, Hospital, User } from "lucide-react";

type ScrapeSource = { id: string; key: string; name: string; countryCode: string; enabled: boolean };
type ScrapeJob = { id: string; sourceKey: string; countryCode: string; specialty?: string; city?: string; region?: string; facilityType?: string; status: string; totalFound: number; errorMessage?: string; createdAt: string; finishedAt?: string };
type ScrapedContact = {
  id: string; jobId?: string; sourceKey: string; sourceUrl?: string; countryCode: string;
  name?: string; ico?: string; pzsId?: string; facilityType?: string; specialty?: string;
  doctorName?: string; doctorTitle?: string;
  address?: string; city?: string; postalCode?: string; region?: string; district?: string;
  phones?: { value: string; type: string }[]; emails?: string[]; website?: string;
  score: number; status: string; createdAt: string;
};

const SK_REGIONS = [
  "Bratislavský kraj", "Trnavský kraj", "Trenčiansky kraj", "Nitriansky kraj",
  "Žilinský kraj", "Banskobystrický kraj", "Prešovský kraj", "Košický kraj",
];

const FACILITY_TYPES = [
  { value: "any", label: "Akýkoľvek" },
  { value: "clinic", label: "Klinika / ambulancia" },
  { value: "hospital", label: "Nemocnica" },
  { value: "doctor", label: "Lekár" },
];

export default function ScrapingPage() {
  const { toast } = useToast();
  const [sourceKey, setSourceKey] = useState<string>("evuc");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState<string>("");
  const [facilityType, setFacilityType] = useState<string>("any");
  const [activeTab, setActiveTab] = useState("staging");
  const [filterJobId, setFilterJobId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [perRowTarget, setPerRowTarget] = useState<Record<string, "clinic" | "hospital" | "person">>({});

  const { data: sources = [] } = useQuery<ScrapeSource[]>({ queryKey: ["/api/scraper/sources"] });
  const { data: jobs = [], refetch: refetchJobs } = useQuery<ScrapeJob[]>({ queryKey: ["/api/scraper/jobs"], refetchInterval: 5000 });
  const { data: contacts = [], refetch: refetchContacts } = useQuery<ScrapedContact[]>({
    queryKey: ["/api/scraper/contacts", filterStatus, filterJobId],
    queryFn: async () => {
      const url = `/api/scraper/contacts?status=${filterStatus}${filterJobId ? `&jobId=${filterJobId}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const startJob = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/scraper/jobs", {
        sourceKey, countryCode: "SK",
        specialty: specialty || null,
        city: city || null,
        region: region || null,
        facilityType: facilityType === "any" ? null : facilityType,
      });
    },
    onSuccess: () => {
      toast({ title: "Scrape spustený", description: "Job beží na pozadí. Sleduj záložku Joby." });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/jobs"] });
      setActiveTab("jobs");
    },
    onError: (e: any) => toast({ title: "Chyba pri spustení", description: e.message, variant: "destructive" }),
  });

  const approveContact = useMutation({
    mutationFn: async ({ id, targetType }: { id: string; targetType: string }) => {
      return await apiRequest("POST", `/api/scraper/contacts/${id}/approve`, { targetType });
    },
    onSuccess: (_d, vars) => {
      toast({ title: "Schválené", description: `Vytvorené v ${vars.targetType === "clinic" ? "klinikách" : vars.targetType === "hospital" ? "nemocniciach" : "osobách"}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/contacts"] });
    },
    onError: (e: any) => toast({ title: "Chyba pri schvaľovaní", description: e.message, variant: "destructive" }),
  });

  const rejectContact = useMutation({
    mutationFn: async (id: string) => await apiRequest("POST", `/api/scraper/contacts/${id}/reject`, {}),
    onSuccess: () => {
      toast({ title: "Zamietnuté" });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/contacts"] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/scraper/contacts/${id}`),
    onSuccess: () => {
      toast({ title: "Vymazané" });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/contacts"] });
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Web scraping</h1>
        <p className="text-sm text-muted-foreground">
          Vyhľadávanie zdravotníckych kontaktov z verejných slovenských zdrojov (e-VÚC, ÚDZS).
          Údaje sa najprv uložia do staging tabuľky, schváliť ich musíš ručne.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" data-testid="tab-search">Hľadať</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Joby ({jobs.length})</TabsTrigger>
          <TabsTrigger value="staging" data-testid="tab-staging">Staging ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kritériá vyhľadávania</CardTitle>
              <CardDescription>Vyber zdroj a špecifikuj filter. Job sa spustí na pozadí.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Zdroj *</Label>
                <Select value={sourceKey} onValueChange={setSourceKey}>
                  <SelectTrigger data-testid="select-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sources.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Krajina</Label>
                <Input value="SK (Slovensko)" disabled className="h-9 bg-muted" data-testid="input-country" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kraj</Label>
                <Select value={region || "all"} onValueChange={v => setRegion(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-region"><SelectValue placeholder="Všetky kraje" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všetky kraje</SelectItem>
                    {SK_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mesto</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="napr. Bratislava" className="h-9" data-testid="input-city" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Odbor</Label>
                <Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="napr. gynekológia" className="h-9" data-testid="input-specialty" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ zariadenia</Label>
                <Select value={facilityType} onValueChange={setFacilityType}>
                  <SelectTrigger data-testid="select-facility-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FACILITY_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={() => startJob.mutate()} disabled={startJob.isPending} data-testid="button-start-scrape">
                  {startJob.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Spustiť scrape
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetchJobs()} data-testid="button-refresh-jobs">
              <RefreshCw className="h-4 w-4 mr-2" />Obnoviť
            </Button>
          </div>
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">Žiadne joby zatiaľ neboli spustené.</p>}
          {jobs.map(j => (
            <Card key={j.id} data-testid={`card-job-${j.id}`}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>
                      {j.status}
                    </Badge>
                    <span className="text-sm font-medium">{j.sourceKey}</span>
                    <span className="text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString("sk-SK")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-2">
                    {j.region && <span>kraj: {j.region}</span>}
                    {j.city && <span>mesto: {j.city}</span>}
                    {j.specialty && <span>odbor: {j.specialty}</span>}
                    {j.facilityType && <span>typ: {j.facilityType}</span>}
                  </div>
                  {j.errorMessage && <p className="text-xs text-destructive mt-1">{j.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" data-testid={`text-job-count-${j.id}`}>{j.totalFound} kontaktov</span>
                  <Button variant="outline" size="sm" onClick={() => { setFilterJobId(j.id); setActiveTab("staging"); }} data-testid={`button-view-job-${j.id}`}>
                    Zobraziť
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="staging" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Status:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                </SelectContent>
              </Select>
              {filterJobId && (
                <Button variant="outline" size="sm" onClick={() => setFilterJobId("")} data-testid="button-clear-job-filter">
                  Filter podľa jobu × 
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchContacts()} data-testid="button-refresh-contacts">
              <RefreshCw className="h-4 w-4 mr-2" />Obnoviť
            </Button>
          </div>

          {contacts.length === 0 && <p className="text-sm text-muted-foreground">Žiadne kontakty v stavu "{filterStatus}".</p>}

          <div className="space-y-2">
            {contacts.map(c => {
              const target = perRowTarget[c.id] || (c.facilityType === "hospital" ? "hospital" : c.doctorName && !c.name ? "person" : "clinic");
              return (
                <Card key={c.id} data-testid={`card-contact-${c.id}`}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" data-testid={`text-contact-name-${c.id}`}>
                            {c.doctorTitle ? `${c.doctorTitle} ` : ""}{c.doctorName || c.name || "—"}
                          </span>
                          {c.name && c.doctorName && <span className="text-xs text-muted-foreground">/ {c.name}</span>}
                          <Badge variant="outline" className="text-xs">score {c.score}</Badge>
                          {c.facilityType && <Badge variant="secondary" className="text-xs">{c.facilityType}</Badge>}
                          {c.specialty && <Badge variant="outline" className="text-xs">{c.specialty}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 grid sm:grid-cols-2 gap-x-4">
                          {c.address && <span>{c.address}{c.postalCode ? `, ${c.postalCode}` : ""} {c.city || ""}</span>}
                          {c.region && <span>{c.region}{c.district ? ` / ${c.district}` : ""}</span>}
                          {c.ico && <span>IČO: {c.ico}</span>}
                          {c.pzsId && <span>PZS: {c.pzsId}</span>}
                          {c.phones && c.phones.length > 0 && (
                            <span>{c.phones.map(p => `${p.value} (${p.type})`).join(", ")}</span>
                          )}
                          {c.emails && c.emails.length > 0 && <span>{c.emails.join(", ")}</span>}
                          {c.website && <span><a href={c.website} target="_blank" rel="noreferrer" className="underline">{c.website}</a></span>}
                          {c.sourceUrl && (
                            <span className="col-span-2">
                              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />zdroj ({c.sourceKey})
                              </a>
                            </span>
                          )}
                        </div>
                      </div>
                      {c.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Select value={target} onValueChange={(v: any) => setPerRowTarget(p => ({ ...p, [c.id]: v }))}>
                            <SelectTrigger className="h-8 w-36 text-xs" data-testid={`select-target-${c.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="clinic"><Building2 className="h-3 w-3 inline mr-1" />Klinika</SelectItem>
                              <SelectItem value="hospital"><Hospital className="h-3 w-3 inline mr-1" />Nemocnica</SelectItem>
                              <SelectItem value="person"><User className="h-3 w-3 inline mr-1" />Osoba</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="default" onClick={() => approveContact.mutate({ id: c.id, targetType: target })} disabled={approveContact.isPending} data-testid={`button-approve-${c.id}`}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Schváliť
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectContact.mutate(c.id)} disabled={rejectContact.isPending} data-testid={`button-reject-${c.id}`}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteContact.mutate(c.id)} disabled={deleteContact.isPending} data-testid={`button-delete-${c.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
