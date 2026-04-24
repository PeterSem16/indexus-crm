import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, RefreshCw, CheckCircle2, XCircle, Trash2, ExternalLink, Building2, Hospital, User, Upload, ListOrdered } from "lucide-react";

type ScrapeSource = { id: string; key: string; name: string; countryCode: string; enabled: boolean };
type ScrapeJob = { id: string; sourceKey: string; countryCode: string; specialty?: string; city?: string; region?: string; facilityType?: string; mode?: string; inputItems?: Array<{ name: string; city?: string }>; status: string; totalFound: number; errorMessage?: string; createdAt: string; finishedAt?: string };
type ScrapedContact = {
  id: string; jobId?: string; sourceKey: string; sourceUrl?: string; countryCode: string;
  inputName?: string; inputIndex?: number;
  name?: string; ico?: string; pzsId?: string; facilityType?: string; specialty?: string;
  doctorName?: string; doctorTitle?: string;
  address?: string; city?: string; postalCode?: string; region?: string; district?: string;
  phones?: { value: string; type: string }[]; emails?: string[]; website?: string;
  score: number; status: string; createdAt: string;
};
type TargetType = "clinic" | "hospital" | "person";
type ApproveMode = "create" | "update";
type SearchTarget = { id: string; name?: string; firstName?: string; lastName?: string; city?: string; address?: string; professionalClassification?: string };

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

function TargetPicker({ targetType, value, onChange, contactId }: { targetType: TargetType; value: string | null; onChange: (id: string | null, label: string) => void; contactId: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [], isFetching } = useQuery<SearchTarget[]>({
    queryKey: ["/api/scraper/search-targets", targetType, q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const url = `/api/scraper/search-targets?type=${targetType}&q=${encodeURIComponent(q.trim())}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    enabled: q.trim().length >= 2,
  });

  const labelOf = (t: SearchTarget) => {
    if (targetType === "person") {
      const name = `${t.firstName || ""} ${t.lastName || ""}`.trim() || "Bez mena";
      return `${name}${t.city ? ` · ${t.city}` : ""}${t.professionalClassification ? ` · ${t.professionalClassification}` : ""}`;
    }
    return `${t.name || "—"}${t.city ? ` · ${t.city}` : ""}`;
  };

  return (
    <div className="relative w-full">
      <Input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={`Hľadať existujúci ${targetType === "clinic" ? "klinika" : targetType === "hospital" ? "nemocnica" : "osoba"}...`}
        className="h-8 text-xs"
        data-testid={`input-target-search-${contactId}`}
      />
      {value && <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">Vybraný cieľ: {value}</p>}
      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md">
          {isFetching && <div className="px-3 py-2 text-xs text-muted-foreground">Hľadám...</div>}
          {!isFetching && data.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Žiadne výsledky.</div>}
          {data.map((t: SearchTarget) => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
              onClick={() => { onChange(t.id, labelOf(t)); setOpen(false); setQ(labelOf(t)); }}
              data-testid={`option-target-${t.id}`}
            >
              {labelOf(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [perRowTarget, setPerRowTarget] = useState<Record<string, TargetType>>({});
  const [perRowMode, setPerRowMode] = useState<Record<string, ApproveMode>>({});
  const [perRowTargetId, setPerRowTargetId] = useState<Record<string, string | null>>({});

  // Bulk lookup state
  const [bulkSourceKey, setBulkSourceKey] = useState<string>("evuc");
  const [bulkText, setBulkText] = useState<string>("");
  const [bulkRegion, setBulkRegion] = useState<string>("");
  const [bulkSpecialty, setBulkSpecialty] = useState("");

  const parseBulkInput = (text: string): Array<{ name: string; city?: string }> => {
    return text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/[;|\t]/).map(p => p.trim()).filter(Boolean);
        return { name: parts[0], city: parts[1] || undefined };
      })
      .filter(it => it.name && it.name.length >= 2);
  };
  const parsedBulkItems = parseBulkInput(bulkText);

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

  const startBulkJob = useMutation({
    mutationFn: async () => {
      const items = parseBulkInput(bulkText);
      if (items.length === 0) throw new Error("Pridaj aspoň jeden názov ambulancie / kliniky.");
      return await apiRequest("POST", "/api/scraper/jobs/bulk", {
        sourceKey: bulkSourceKey,
        countryCode: "SK",
        specialty: bulkSpecialty || null,
        region: bulkRegion || null,
        items,
      });
    },
    onSuccess: () => {
      toast({ title: "Bulk hľadanie spustené", description: `${parsedBulkItems.length} položiek sa spracováva. Sleduj Joby.` });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/jobs"] });
      setActiveTab("jobs");
    },
    onError: (e: any) => toast({ title: "Chyba pri spustení", description: e.message, variant: "destructive" }),
  });

  const approveContact = useMutation({
    mutationFn: async ({ id, targetType, mode, targetId }: { id: string; targetType: TargetType; mode: ApproveMode; targetId?: string | null }) => {
      const body: any = { targetType, mode };
      if (mode === "update") body.targetId = targetId;
      return await apiRequest("POST", `/api/scraper/contacts/${id}/approve`, body);
    },
    onSuccess: (_d, vars) => {
      const action = vars.mode === "update" ? "Aktualizovaný existujúci záznam" : "Vytvorený nový záznam";
      toast({ title: "Schválené", description: `${action} (${vars.targetType === "clinic" ? "klinika" : vars.targetType === "hospital" ? "nemocnica" : "osoba"}).` });
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
          <TabsTrigger value="bulk" data-testid="tab-bulk">Bulk hľadanie</TabsTrigger>
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

        <TabsContent value="bulk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk hľadanie podľa zoznamu</CardTitle>
              <CardDescription>
                Vlož zoznam názvov ambulancií / kliník / nemocníc — jedna na riadok. Voliteľne za bodkočiarku doplň mesto.
                Scraper sa pokúsi o každom položke nájsť všetky dostupné kontakty (telefón, email, adresa, IČO atď.) zo zvoleného zdroja.
                Pri schvaľovaní si pre každý nájdený kontakt vyberieš, či vytvoriť nový záznam alebo doplniť existujúci.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Zdroj *</Label>
                  <Select value={bulkSourceKey} onValueChange={setBulkSourceKey}>
                    <SelectTrigger data-testid="select-bulk-source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sources.map(s => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kraj (zúži vyhľadávanie)</Label>
                  <Select value={bulkRegion || "all"} onValueChange={v => setBulkRegion(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="select-bulk-region"><SelectValue placeholder="Všetky kraje" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky kraje</SelectItem>
                      {SK_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Odbor (voliteľné)</Label>
                  <Input value={bulkSpecialty} onChange={e => setBulkSpecialty(e.target.value)} placeholder="napr. ortopedia" className="h-9" data-testid="input-bulk-specialty" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-2">
                  <ListOrdered className="h-3.5 w-3.5" />
                  Zoznam (jeden na riadok, formát: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">Názov</code> alebo <code className="text-[10px] bg-muted px-1 py-0.5 rounded">Názov; Mesto</code>)
                </Label>
                <Textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"Ambulancia MUDr. Novák; Bratislava\nMediko spol. s r.o.; Košice\nNemocnica Trenčín\n..."}
                  rows={10}
                  className="font-mono text-xs"
                  data-testid="input-bulk-text"
                />
                <p className="text-xs text-muted-foreground">
                  Rozpoznané položky: <span className="font-semibold" data-testid="text-bulk-count">{parsedBulkItems.length}</span> (max 200)
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => startBulkJob.mutate()}
                  disabled={startBulkJob.isPending || parsedBulkItems.length === 0}
                  data-testid="button-start-bulk"
                >
                  {startBulkJob.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Spustiť bulk hľadanie ({parsedBulkItems.length})
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
                    {j.mode === "bulk" && <Badge variant="outline" className="text-xs">bulk · {j.inputItems?.length || 0} položiek</Badge>}
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
              const target: TargetType = perRowTarget[c.id] || (c.facilityType === "hospital" ? "hospital" : c.doctorName && !c.name ? "person" : "clinic");
              const mode: ApproveMode = perRowMode[c.id] || "create";
              const targetId = perRowTargetId[c.id] || null;
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
                          {c.inputName && <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">zo zoznamu: {c.inputName}</Badge>}
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
                          <Button size="sm" variant="outline" onClick={() => rejectContact.mutate(c.id)} disabled={rejectContact.isPending} data-testid={`button-reject-${c.id}`}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteContact.mutate(c.id)} disabled={deleteContact.isPending} data-testid={`button-delete-${c.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {c.status === "pending" && (
                      <div className="border-t pt-2 mt-2 flex flex-wrap items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Typ:</Label>
                        <Select value={target} onValueChange={(v: TargetType) => { setPerRowTarget(p => ({ ...p, [c.id]: v })); setPerRowTargetId(p => ({ ...p, [c.id]: null })); }}>
                          <SelectTrigger className="h-8 w-36 text-xs" data-testid={`select-target-${c.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clinic"><Building2 className="h-3 w-3 inline mr-1" />Klinika</SelectItem>
                            <SelectItem value="hospital"><Hospital className="h-3 w-3 inline mr-1" />Nemocnica</SelectItem>
                            <SelectItem value="person"><User className="h-3 w-3 inline mr-1" />Osoba</SelectItem>
                          </SelectContent>
                        </Select>
                        <Label className="text-xs text-muted-foreground ml-2">Akcia:</Label>
                        <div className="inline-flex rounded-md border overflow-hidden">
                          <button
                            type="button"
                            className={`px-2 py-1 text-xs ${mode === "create" ? "bg-primary text-primary-foreground" : "bg-background hover-elevate"}`}
                            onClick={() => setPerRowMode(p => ({ ...p, [c.id]: "create" }))}
                            data-testid={`button-mode-create-${c.id}`}
                          >Vytvoriť nový</button>
                          <button
                            type="button"
                            className={`px-2 py-1 text-xs border-l ${mode === "update" ? "bg-primary text-primary-foreground" : "bg-background hover-elevate"}`}
                            onClick={() => setPerRowMode(p => ({ ...p, [c.id]: "update" }))}
                            data-testid={`button-mode-update-${c.id}`}
                          >Doplniť existujúci</button>
                        </div>
                        {mode === "update" && (
                          <div className="flex-1 min-w-[240px]">
                            <TargetPicker
                              targetType={target}
                              value={targetId}
                              onChange={(id) => setPerRowTargetId(p => ({ ...p, [c.id]: id }))}
                              contactId={c.id}
                            />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => approveContact.mutate({ id: c.id, targetType: target, mode, targetId })}
                          disabled={approveContact.isPending || (mode === "update" && !targetId)}
                          data-testid={`button-approve-${c.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {mode === "update" ? "Doplniť" : "Vytvoriť"}
                        </Button>
                      </div>
                    )}
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
