// ─────────────────────────────────────────────────────────────────────────────
// Bulk Assign Representatives — stránka pre manažérov
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

// ── MultiSelect component ─────────────────────────────────────────────────────
interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  renderOption?: (o: string) => React.ReactNode;
}

function MultiSelect({
  options, value, onChange, placeholder = "— (všetky)", disabled, searchable, renderOption,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const allSelected = value.length === 0;

  const label = allSelected
    ? <span className="text-muted-foreground">{placeholder}</span>
    : value.length === 1
      ? <span className="font-medium truncate">{renderOption ? renderOption(value[0]) : value[0]}</span>
      : <span className="font-medium">{value.length} vybraných</span>;

  const toggle = (item: string) =>
    onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item]);

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/40 transition-colors"
        >
          <span className="flex-1 text-left truncate">{label}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            {!allSelected && (
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 hover:bg-muted"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange([]); setOpen(false); }}
                onKeyDown={e => e.key === "Enter" && onChange([])}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
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
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        <div className="max-h-60 overflow-y-auto py-1">
          {/* All option */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={() => { onChange([]); setOpen(false); }}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${allSelected ? "text-primary" : "opacity-0"}`} />
            <span className="text-muted-foreground italic">— (všetky)</span>
          </button>
          {/* Items */}
          {filtered.map(item => {
            const selected = value.includes(item);
            return (
              <button
                key={item}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                onClick={() => toggle(item)}
              >
                <Check className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : "opacity-0"}`} />
                <span className="truncate">{renderOption ? renderOption(item) : item}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">Žiadne výsledky</p>
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t px-3 py-1.5">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Zrušiť výber ({value.length})
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── FilterBadges ──────────────────────────────────────────────────────────────
function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 text-xs font-normal pr-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface RepUser { id: string; name: string; email: string | null; clinicCount: number; }
type Mode = "bulk" | "swap";
type EntityType = "clinic" | "hospital";

const ALL_COUNTRY_CODES = COUNTRIES.map(c => c.code);

export default function BulkAssignPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const p = t.representantPanel;

  const [mode, setMode] = useState<Mode>("bulk");
  const [entityType, setEntityType] = useState<EntityType>("clinic");

  // Filters — all multi-select
  const [toUserId, setToUserId] = useState("");
  const [selCountries, setSelCountries] = useState<string[]>([]);
  const [selRegions, setSelRegions] = useState<string[]>([]);
  const [selDistricts, setSelDistricts] = useState<string[]>([]);
  const [selCities, setSelCities] = useState<string[]>([]);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [fromUserId, setFromUserId] = useState("");

  // Swap
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");

  const [dryRunResult, setDryRunResult] = useState<{ affected: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // ── Derived region list (union across selected countries) ─────────────────
  const allRegions = useMemo(() => {
    const codes = selCountries.length ? selCountries : ALL_COUNTRY_CODES;
    const set = new Set<string>();
    for (const code of codes) {
      for (const r of (REGIONS_BY_COUNTRY as any)[code] ?? []) set.add(r);
    }
    return [...set].sort();
  }, [selCountries]);

  // ── Derived district list (union across selected regions) ─────────────────
  const allDistricts = useMemo(() => {
    if (!selRegions.length) return [];
    const codes = selCountries.length ? selCountries : ALL_COUNTRY_CODES;
    const set = new Set<string>();
    for (const code of codes) {
      for (const region of selRegions) {
        for (const d of getDistrictsForRegion(code, region)) set.add(d);
      }
    }
    return [...set].sort();
  }, [selCountries, selRegions]);

  // ── Distinct cities from server ───────────────────────────────────────────
  const citiesBase = entityType === "clinic" ? "/api/clinics/distinct-cities" : "/api/hospitals/distinct-cities";
  const citiesParams = new URLSearchParams();
  if (selCountries.length) citiesParams.set("countries", selCountries.join(","));
  if (selRegions.length) citiesParams.set("regions", selRegions.join(","));
  if (selDistricts.length) citiesParams.set("districts", selDistricts.join(","));
  const citiesUrl = `${citiesBase}?${citiesParams}`;

  const { data: allCities = [], isLoading: citiesLoading } = useQuery<string[]>({
    queryKey: [citiesUrl],
    queryFn: async () => {
      const res = await fetch(citiesUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Representatives ───────────────────────────────────────────────────────
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

  // ── Build criteria ────────────────────────────────────────────────────────
  const buildCriteria = () => {
    const c: Record<string, any> = {};
    if (selCountries.length) c.countries = selCountries;
    if (selRegions.length) c.region = selRegions;
    if (selDistricts.length) c.district = selDistricts;
    if (selCities.length) c.city = selCities;
    if (onlyUnassigned) c.currentRepresentativeId = null;
    else if (fromUserId) c.currentRepresentativeId = fromUserId;
    return c;
  };

  const resetFilters = () => {
    setSelCountries([]); setSelRegions([]); setSelDistricts([]); setSelCities([]);
    setFromUserId(""); setOnlyUnassigned(false); setDryRunResult(null); setConfirmed(false);
  };

  const hasFilters = selCountries.length || selRegions.length || selDistricts.length || selCities.length;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const bulkMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await fetch(bulkEndpoint, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: toUserId, criteria: buildCriteria(), dryRun }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Error");
      return res.json();
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) { setDryRunResult(data); setConfirmed(false); }
      else {
        toast({ title: `${data.affected} ${p.bulkPreviewCount}` });
        qc.invalidateQueries({ queryKey: ["/api/representatives"] });
        setDryRunResult(null); setConfirmed(true);
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const swapMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(swapEndpoint, {
        method: "POST", credentials: "include",
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

  // ── Country render helper ─────────────────────────────────────────────────
  const countryMap = useMemo(() =>
    Object.fromEntries(COUNTRIES.map(c => [c.code, c])), []);

  const renderCountry = (code: string) => {
    const c = countryMap[code];
    return c ? `${c.flag} ${c.name}` : code;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-0">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {mode === "bulk" ? p.bulkAssignTitle : p.swapTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "bulk" ? p.bulkFilterTitle : `${p.bulkFrom} → ${p.bulkTo}`}
            </p>
          </div>
        </div>

        {/* Mode + entity toggles */}
        <div className="flex items-center gap-2">
          {/* Entity type */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              onClick={() => { setEntityType("clinic"); setSelCities([]); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${entityType === "clinic" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "hover:bg-muted"}`}>
              <Building2 className="h-3.5 w-3.5" />{t.nav?.clinics || "Clinics"}
            </button>
            <button
              onClick={() => { setEntityType("hospital"); setSelCities([]); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${entityType === "hospital" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "hover:bg-muted"}`}>
              <Hospital className="h-3.5 w-3.5" />{t.hospitals?.title || "Hospitals"}
            </button>
          </div>

          {/* Mode */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              onClick={() => { setMode("bulk"); setDryRunResult(null); setConfirmed(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <UserCheck className="h-3.5 w-3.5" />{p.bulkAssignTitle}
            </button>
            <button
              onClick={() => { setMode("swap"); setDryRunResult(null); setConfirmed(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${mode === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <ArrowRightLeft className="h-3.5 w-3.5" />{p.swapTitle}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto pt-4">
        {mode === "bulk" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">

            {/* Left — filters */}
            <div className="space-y-4 rounded-xl border p-5 bg-card">
              {/* Filter header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {p.bulkFilterTitle}
                </span>
                {hasFilters ? (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />Zrušiť všetky filtre
                  </button>
                ) : null}
              </div>

              {/* Country + Region */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Krajina / Country</Label>
                  <MultiSelect
                    options={COUNTRIES.map(c => c.code)}
                    value={selCountries}
                    onChange={v => {
                      setSelCountries(v);
                      setSelRegions([]); setSelDistricts([]); setSelCities([]);
                      setDryRunResult(null);
                    }}
                    placeholder="— (všetky)"
                    searchable
                    renderOption={renderCountry}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kraj / Region</Label>
                  <MultiSelect
                    options={allRegions}
                    value={selRegions}
                    onChange={v => {
                      setSelRegions(v);
                      setSelDistricts([]); setSelCities([]);
                      setDryRunResult(null);
                    }}
                    placeholder="— (všetky)"
                    searchable={allRegions.length > 6}
                    disabled={allRegions.length === 0}
                  />
                </div>
              </div>

              {/* District + City */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Okres / District</Label>
                  <MultiSelect
                    options={allDistricts}
                    value={selDistricts}
                    onChange={v => {
                      setSelDistricts(v);
                      setSelCities([]);
                      setDryRunResult(null);
                    }}
                    placeholder={selRegions.length ? "— (všetky)" : "— vyberte kraj"}
                    disabled={selRegions.length === 0 || allDistricts.length === 0}
                    searchable={allDistricts.length > 8}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mesto / City</Label>
                  <MultiSelect
                    options={allCities}
                    value={selCities}
                    onChange={v => { setSelCities(v); setDryRunResult(null); }}
                    placeholder={citiesLoading ? "Načítava..." : "— (všetky)"}
                    disabled={citiesLoading || allCities.length === 0}
                    searchable
                  />
                </div>
              </div>

              {/* Active filter badges */}
              {(selCountries.length > 0 || selRegions.length > 0 || selDistricts.length > 0 || selCities.length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {selCountries.map(c => (
                    <FilterBadge
                      key={c}
                      label={renderCountry(c)}
                      onRemove={() => {
                        const next = selCountries.filter(x => x !== c);
                        setSelCountries(next);
                        setSelRegions([]); setSelDistricts([]); setSelCities([]);
                      }}
                    />
                  ))}
                  {selRegions.map(r => (
                    <FilterBadge
                      key={r}
                      label={r}
                      onRemove={() => {
                        const next = selRegions.filter(x => x !== r);
                        setSelRegions(next);
                        if (!next.length) { setSelDistricts([]); setSelCities([]); }
                      }}
                    />
                  ))}
                  {selDistricts.map(d => (
                    <FilterBadge
                      key={d}
                      label={d}
                      onRemove={() => setSelDistricts(selDistricts.filter(x => x !== d))}
                    />
                  ))}
                  {selCities.map(c => (
                    <FilterBadge
                      key={c}
                      label={c}
                      onRemove={() => setSelCities(selCities.filter(x => x !== c))}
                    />
                  ))}
                </div>
              )}

              {/* Only unassigned */}
              <div className="flex items-center gap-3 border-t pt-3">
                <Switch
                  id="only-unassigned"
                  checked={onlyUnassigned}
                  onCheckedChange={v => { setOnlyUnassigned(v); if (v) setFromUserId(""); setDryRunResult(null); }}
                />
                <Label htmlFor="only-unassigned" className="cursor-pointer text-sm">
                  {p.bulkOnlyUnassigned}
                </Label>
              </div>

              {/* From representative */}
              {!onlyUnassigned && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{p.bulkOnlyFrom}</Label>
                  <Select
                    value={fromUserId || "__none__"}
                    onValueChange={v => { setFromUserId(v === "__none__" ? "" : v); setDryRunResult(null); }}
                    disabled={repsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— (všetky / all)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— (všetky / all)</SelectItem>
                      {representatives.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name} ({r.clinicCount})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right — assign panel */}
            <div className="space-y-4 rounded-xl border p-5 bg-card">
              <div className="space-y-1.5">
                <Label>{p.bulkTo}</Label>
                <Select
                  value={toUserId}
                  onValueChange={v => { setToUserId(v); setDryRunResult(null); setConfirmed(false); }}
                  disabled={repsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={repsLoading ? "Načítava..." : p.selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {representatives.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dry run result */}
              {dryRunResult && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-3">
                  <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm">
                    Ovplyvnených: <strong>{dryRunResult.affected}</strong> {entityType === "clinic" ? "kliník" : "nemocníc"}
                  </span>
                </div>
              )}

              {confirmed && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {p.assignedSuccess}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="outline"
                  disabled={!toUserId || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(true)}
                  className="w-full"
                >
                  {bulkMutation.isPending && bulkMutation.variables === true && (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  )}
                  {p.bulkDryRunBtn}
                </Button>
                <Button
                  disabled={!toUserId || !dryRunResult || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(false)}
                  className="w-full"
                >
                  {bulkMutation.isPending && bulkMutation.variables === false && (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  )}
                  {p.bulkConfirm}
                </Button>
              </div>

              {/* Summary */}
              {hasFilters && (
                <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
                  {selCountries.length > 0 && (
                    <div>Krajiny: {selCountries.map(renderCountry).join(", ")}</div>
                  )}
                  {selRegions.length > 0 && <div>Kraje: {selRegions.join(", ")}</div>}
                  {selDistricts.length > 0 && <div>Okresy: {selDistricts.join(", ")}</div>}
                  {selCities.length > 0 && <div>Mestá: {selCities.join(", ")}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "swap" && (
          <div className="max-w-lg space-y-4 rounded-xl border p-5 bg-card">
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

            <div className="flex items-center justify-center py-1">
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
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {p.assignedSuccess}
                </span>
              </div>
            )}

            <Button
              disabled={!swapFrom || !swapTo || swapMutation.isPending}
              onClick={() => swapMutation.mutate()}
              className="w-full"
            >
              {swapMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {p.bulkConfirm}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
