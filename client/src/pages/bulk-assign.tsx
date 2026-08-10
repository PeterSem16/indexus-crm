// ─────────────────────────────────────────────────────────────────────────────
// Bulk Assign Representatives — stránka pre manažérov
// Hromadné priradenie a výmena reprezentantov pre kliniky aj nemocnice.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, UserCheck, ArrowRightLeft, Building2, Hospital,
  ChevronRight, CheckCircle2, ChevronsUpDown, Check, Search, X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { REGIONS_BY_COUNTRY, getDistrictsForRegion } from "@/lib/regions";
import { COUNTRIES } from "@shared/schema";

// ── Inline MultiSelect ────────────────────────────────────────────────────────
interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  allLabel?: string;
}

function MultiSelect({ options, value, onChange, placeholder = "—", disabled, searchable, allLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const allSelected = value.length === 0;
  const label = allSelected
    ? (allLabel ?? placeholder)
    : value.length === 1
    ? value[0]
    : `${value.length} vybraných`;

  const toggle = (item: string) => {
    onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item]);
  };

  const toggleAll = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/50 transition-colors"
        >
          <span className={allSelected ? "text-muted-foreground" : "font-medium"}>
            {label}
          </span>
          <div className="flex items-center gap-1">
            {!allSelected && (
              <button
                type="button"
                className="rounded hover:bg-muted p-0.5"
                onMouseDown={e => { e.stopPropagation(); onChange([]); }}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {searchable && (
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hľadať..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div className="max-h-56 overflow-y-auto py-1">
          {/* Všetky */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={toggleAll}
          >
            <Check className={`h-3.5 w-3.5 ${allSelected ? "opacity-100" : "opacity-0"}`} />
            <span className="text-muted-foreground italic">— (všetky)</span>
          </button>
          {filtered.map(item => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => toggle(item)}
            >
              <Check className={`h-3.5 w-3.5 shrink-0 ${value.includes(item) ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{item}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground text-center">Žiadne výsledky</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface RepUser {
  id: string;
  name: string;
  email: string | null;
  clinicCount: number;
}

type Mode = "bulk" | "swap";
type EntityType = "clinic" | "hospital";

export default function BulkAssignPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const p = t.representantPanel;

  const [mode, setMode] = useState<Mode>("bulk");
  const [entityType, setEntityType] = useState<EntityType>("clinic");

  // Bulk assign filter state — all multi
  const [toUserId, setToUserId] = useState("");
  const [country, setCountry] = useState("");
  const [selRegions, setSelRegions] = useState<string[]>([]);
  const [selDistricts, setSelDistricts] = useState<string[]>([]);
  const [selCities, setSelCities] = useState<string[]>([]);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [fromUserId, setFromUserId] = useState("");

  // Swap state
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");

  // Dry run result
  const [dryRunResult, setDryRunResult] = useState<{ affected: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // ── Derived option lists ───────────────────────────────────────────────────
  const allRegions: string[] = country ? ((REGIONS_BY_COUNTRY as any)[country] ?? []) : [];

  const allDistricts = useMemo(() => {
    if (!country || selRegions.length === 0) return [];
    const set = new Set<string>();
    for (const r of selRegions) {
      for (const d of getDistrictsForRegion(country, r)) set.add(d);
    }
    return [...set].sort();
  }, [country, selRegions]);

  // ── Distinct cities from server ─────────────────────────────────────────
  const citiesEndpoint = entityType === "clinic" ? "/api/clinics/distinct-cities" : "/api/hospitals/distinct-cities";
  const citiesParams = new URLSearchParams();
  if (country) citiesParams.set("country", country);
  if (selRegions.length) citiesParams.set("regions", selRegions.join(","));
  if (selDistricts.length) citiesParams.set("districts", selDistricts.join(","));
  const citiesUrl = `${citiesEndpoint}?${citiesParams}`;

  const { data: allCities = [] } = useQuery<string[]>({
    queryKey: [citiesUrl],
    queryFn: async () => {
      if (!country) return [];
      const res = await fetch(citiesUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!country,
    staleTime: 30_000,
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: representatives = [], isLoading: repsLoading } = useQuery<RepUser[]>({
    queryKey: ["/api/representatives"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 0,
    refetchOnMount: true,
  });

  const bulkEndpoint = entityType === "clinic"
    ? "/api/clinics/bulk-assign-representative"
    : "/api/hospitals/bulk-assign-representative";

  const swapEndpoint = entityType === "clinic"
    ? "/api/clinics/swap-representative"
    : "/api/hospitals/swap-representative";

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setCountry(""); setSelRegions([]); setSelDistricts([]); setSelCities([]);
    setFromUserId(""); setOnlyUnassigned(false); setDryRunResult(null); setConfirmed(false);
  };

  const buildCriteria = () => {
    const c: Record<string, any> = {};
    if (country) c.country = country;
    if (selRegions.length) c.region = selRegions;
    if (selDistricts.length) c.district = selDistricts;
    if (selCities.length) c.city = selCities;
    if (onlyUnassigned) c.currentRepresentativeId = null;
    else if (fromUserId) c.currentRepresentativeId = fromUserId;
    return c;
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const bulkMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await fetch(bulkEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: toUserId, criteria: buildCriteria(), dryRun }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Error");
      return res.json();
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) {
        setDryRunResult(data);
        setConfirmed(false);
      } else {
        toast({ title: `${data.affected} ${p.bulkPreviewCount}` });
        qc.invalidateQueries({ queryKey: ["/api/representatives"] });
        setDryRunResult(null);
        setConfirmed(true);
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const swapMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(swapEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: swapFrom, toUserId: swapTo }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Error");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.swapped} ${p.bulkPreviewCount}` });
      qc.invalidateQueries({ queryKey: ["/api/representatives"] });
      setSwapFrom(""); setSwapTo(""); setConfirmed(true);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{mode === "bulk" ? p.bulkAssignTitle : p.swapTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "bulk" ? p.bulkFilterTitle : p.bulkFrom + " → " + p.bulkTo}
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-lg border overflow-hidden w-fit">
        <button
          onClick={() => { setMode("bulk"); setDryRunResult(null); setConfirmed(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <UserCheck className="h-4 w-4" />{p.bulkAssignTitle}
        </button>
        <button
          onClick={() => { setMode("swap"); setDryRunResult(null); setConfirmed(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${mode === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <ArrowRightLeft className="h-4 w-4" />{p.swapTitle}
        </button>
      </div>

      {/* Entity type selector */}
      <div className="flex rounded-md border overflow-hidden w-fit">
        <button onClick={() => { setEntityType("clinic"); setSelCities([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${entityType === "clinic" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "hover:bg-muted"}`}>
          <Building2 className="h-3.5 w-3.5" />{t.nav?.clinics || "Clinics"}
        </button>
        <button onClick={() => { setEntityType("hospital"); setSelCities([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${entityType === "hospital" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "hover:bg-muted"}`}>
          <Hospital className="h-3.5 w-3.5" />{t.hospitals?.title || "Hospitals"}
        </button>
      </div>

      {/* ── BULK ASSIGN form ── */}
      {mode === "bulk" && (
        <div className="space-y-4 rounded-xl border p-5 bg-card">

          {/* To rep */}
          <div className="space-y-1.5">
            <Label>{p.bulkTo}</Label>
            <Select value={toUserId} onValueChange={v => { setToUserId(v); setDryRunResult(null); setConfirmed(false); }} disabled={repsLoading}>
              <SelectTrigger><SelectValue placeholder={p.selectPlaceholder} /></SelectTrigger>
              <SelectContent>
                {representatives.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter header */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{p.bulkFilterTitle}</div>
            {(country || selRegions.length || selDistricts.length || selCities.length) && (
              <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="h-3 w-3" />Zrušiť filtre
              </button>
            )}
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label>Krajina / Country</Label>
            <Select value={country || "__all__"} onValueChange={v => {
              setCountry(v === "__all__" ? "" : v);
              setSelRegions([]); setSelDistricts([]); setSelCities([]);
              setDryRunResult(null);
            }}>
              <SelectTrigger><SelectValue placeholder="— (všetky)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">— (všetky)</SelectItem>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Region + District grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kraj / Region</Label>
              <MultiSelect
                options={allRegions}
                value={selRegions}
                onChange={v => { setSelRegions(v); setSelDistricts([]); setSelCities([]); setDryRunResult(null); }}
                placeholder="— (všetky)"
                disabled={!country || allRegions.length === 0}
                searchable={allRegions.length > 8}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Okres / District</Label>
              <MultiSelect
                options={allDistricts}
                value={selDistricts}
                onChange={v => { setSelDistricts(v); setSelCities([]); setDryRunResult(null); }}
                placeholder="— (všetky)"
                disabled={selRegions.length === 0 || allDistricts.length === 0}
                searchable={allDistricts.length > 8}
              />
            </div>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label>Mesto / City</Label>
            <MultiSelect
              options={allCities}
              value={selCities}
              onChange={v => { setSelCities(v); setDryRunResult(null); }}
              placeholder="— (všetky)"
              disabled={!country || allCities.length === 0}
              searchable
            />
          </div>

          {/* Only unassigned */}
          <div className="flex items-center gap-3 pt-1">
            <Switch id="only-unassigned" checked={onlyUnassigned}
              onCheckedChange={v => { setOnlyUnassigned(v); if (v) setFromUserId(""); setDryRunResult(null); }} />
            <Label htmlFor="only-unassigned" className="cursor-pointer">{p.bulkOnlyUnassigned}</Label>
          </div>

          {/* From rep (only if not onlyUnassigned) */}
          {!onlyUnassigned && (
            <div className="space-y-1.5">
              <Label>{p.bulkOnlyFrom}</Label>
              <Select value={fromUserId || "__none__"} onValueChange={v => { setFromUserId(v === "__none__" ? "" : v); setDryRunResult(null); }} disabled={repsLoading}>
                <SelectTrigger><SelectValue placeholder="— (všetky / all)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— (všetky / all)</SelectItem>
                  {representatives.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name} ({r.clinicCount})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active filter summary */}
          {(selRegions.length > 0 || selDistricts.length > 0 || selCities.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selRegions.map(r => (
                <Badge key={r} variant="secondary" className="gap-1 text-xs">
                  {r}
                  <button onClick={() => setSelRegions(selRegions.filter(x => x !== r))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {selDistricts.map(d => (
                <Badge key={d} variant="outline" className="gap-1 text-xs">
                  {d}
                  <button onClick={() => setSelDistricts(selDistricts.filter(x => x !== d))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {selCities.map(c => (
                <Badge key={c} variant="outline" className="gap-1 text-xs bg-blue-50 dark:bg-blue-950/30">
                  {c}
                  <button onClick={() => setSelCities(selCities.filter(x => x !== c))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Dry run result */}
          {dryRunResult && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-3">
              <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm font-medium">
                <strong>{dryRunResult.affected}</strong> {p.bulkPreviewCount}
              </span>
            </div>
          )}

          {confirmed && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{p.assignedSuccess}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" disabled={!toUserId || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate(true)}>
              {bulkMutation.isPending && bulkMutation.variables === true && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {p.bulkDryRunBtn}
            </Button>
            <Button disabled={!toUserId || !dryRunResult || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate(false)}>
              {bulkMutation.isPending && bulkMutation.variables === false && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {p.bulkConfirm}
            </Button>
          </div>
        </div>
      )}

      {/* ── SWAP form ── */}
      {mode === "swap" && (
        <div className="space-y-4 rounded-xl border p-5 bg-card">
          <div className="space-y-1.5">
            <Label>{p.bulkFrom}</Label>
            <Select value={swapFrom} onValueChange={v => { setSwapFrom(v); setConfirmed(false); }} disabled={repsLoading}>
              <SelectTrigger><SelectValue placeholder={p.selectPlaceholder} /></SelectTrigger>
              <SelectContent>
                {representatives.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({r.clinicCount})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <Label>{p.bulkTo}</Label>
            <Select value={swapTo} onValueChange={v => { setSwapTo(v); setConfirmed(false); }} disabled={repsLoading}>
              <SelectTrigger><SelectValue placeholder={p.selectPlaceholder} /></SelectTrigger>
              <SelectContent>
                {representatives.filter(r => r.id !== swapFrom).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({r.clinicCount})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {confirmed && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{p.assignedSuccess}</span>
            </div>
          )}

          <Button disabled={!swapFrom || !swapTo || swapMutation.isPending}
            onClick={() => swapMutation.mutate()}>
            {swapMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {p.bulkConfirm}
          </Button>
        </div>
      )}
    </div>
  );
}
