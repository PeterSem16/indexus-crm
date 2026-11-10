import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Hospital,
  Loader2,
  UserCheck,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";
import { useCountryFilter } from "@/contexts/country-filter-context";
import {
  EntityFilter,
  type FilterRule,
} from "@/components/shared/EntityFilter";
import {
  getMedicalPartnerFilterFields,
  getMedicalPartnerFilterPresets,
} from "@/components/shared/medical-partner-filter-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  RepresentativeDistributionPanel,
  representativeAssignmentCriteriaKey,
  type RepresentativeRegionAssignmentDraft,
} from "@/components/representative-distribution-panel";
import { RepresentativeRegionSuggestions } from "@/components/representative-region-suggestions";
import { REGIONS_BY_COUNTRY } from "@/lib/regions";
import { applyRepresentativeRegionFilter } from "@shared/representative-region-filter";

interface RepUser {
  id: string;
  name: string;
  email: string | null;
  clinicCount: number;
}

type Mode = "bulk" | "swap" | "regional";
type EntityType = "clinic" | "hospital";
type AssignmentCriteria = {
  search?: string;
  filterRules: FilterRule[];
  currentRepresentativeId?: string | null;
  countryScope?: string[];
};

type PreviewResult = {
  affected: number;
  ids: string[];
  fingerprint: string;
  requestKey: string;
};

function stableSelectionKey(value: unknown): string {
  return JSON.stringify(value);
}

export default function BulkAssignPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedCountries } = useCountryFilter();
  const p = t.representantPanel;

  const [mode, setMode] = useState<Mode>("bulk");
  const [temporaryCover, setTemporaryCover] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("clinic");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [regionalCriteria, setRegionalCriteria] = useState<AssignmentCriteria | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<RepresentativeRegionAssignmentDraft | undefined>();
  const [regionalPanelRevision, setRegionalPanelRevision] = useState(0);
  const [regionalSource, setRegionalSource] = useState("");
  const [regionalKind, setRegionalKind] = useState<"assign" | "departure" | "temporary">("assign");
  const [focusRegionalPanel, setFocusRegionalPanel] = useState(false);
  const regionalPanelRef = useRef<HTMLDivElement>(null);
  const assignmentRevision = useRef(0);

  const { data: representatives = [], isLoading: repsLoading } = useQuery<RepUser[]>({
    queryKey: ["/api/representatives"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 0,
    refetchOnMount: true,
  });
  const { data: laboratories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/config/laboratories"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60 * 1000,
  });

  const fields = useMemo(() => {
    const values = [...new Set([
      ...(selectedCountries.length ? selectedCountries : Object.keys(REGIONS_BY_COUNTRY)).flatMap(code => REGIONS_BY_COUNTRY[code] || []),
      ...filterRules.filter(rule => rule.field === "region").flatMap(rule => Array.isArray(rule.value) ? rule.value : [rule.value]),
    ])].filter(Boolean);
    return getMedicalPartnerFilterFields(entityType, locale, representatives, laboratories).map(field =>
      field.key === "region" && !filterRules.some(rule => rule.field === "region" && ["is", "contains"].includes(rule.op))
        ? { ...field, type: "multiselect" as const, options: values.map(value => ({ value, label: value })) } : field);
  }, [entityType, locale, representatives, laboratories, selectedCountries, filterRules]);
  const presets = useMemo(
    () => getMedicalPartnerFilterPresets(entityType, locale),
    [entityType, locale],
  );

  const criteria = useMemo(() => mode === "regional" && regionalCriteria ? ({
    ...regionalCriteria,
    currentRepresentativeId: regionalCriteria.currentRepresentativeId === null
      ? null : regionalSource || undefined,
    search: searchQuery.trim() || undefined,
    filterRules,
    countryScope: selectedCountries.length ? selectedCountries : undefined,
  }) : ({
    search: searchQuery.trim() || undefined,
    filterRules,
    currentRepresentativeId: mode === "bulk"
      ? (onlyUnassigned ? null : (fromUserId || undefined))
      : mode === "swap" ? (swapFrom || undefined) : (regionalSource || undefined),
    // This is a UI scope, never an authority grant.  The server intersects it
    // with the signed-in manager's assigned countries.
    countryScope: selectedCountries.length ? selectedCountries : undefined,
  }), [
    mode,
    regionalCriteria,
    regionalSource,
    searchQuery,
    filterRules,
    onlyUnassigned,
    fromUserId,
    swapFrom,
    selectedCountries,
  ]);

  const bulkEndpoint = entityType === "clinic"
    ? "/api/clinics/bulk-assign-representative"
    : "/api/hospitals/bulk-assign-representative";
  const swapEndpoint = entityType === "clinic"
    ? "/api/clinics/swap-representative"
    : "/api/hospitals/swap-representative";
  const targetUserId = mode === "bulk" ? toUserId : swapTo;
  const swapSourceId = mode === "swap" ? swapFrom : undefined;
  const selectionKey = useMemo(() => stableSelectionKey({
    entityType,
    mode,
    criteria,
    targetUserId,
    swapSourceId,
  }), [entityType, mode, criteria, targetUserId, swapSourceId]);

  // A preview is a claim about one complete selection.  Any input that can
  // change that selection invalidates it before a confirm can be clicked.
  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
  }, [entityType, mode, criteria, targetUserId, swapSourceId]);

  useEffect(() => {
    if (assignmentDraft && assignmentDraft.key !== representativeAssignmentCriteriaKey(entityType, criteria)) {
      setAssignmentDraft(undefined);
    }
  }, [assignmentDraft, entityType, criteria]);

  const clearSelection = () => {
    setPreview(null);
    setConfirmed(false);
  };

  const bulkMutation = useMutation({
    mutationFn: async ({ dryRun, requestKey }: { dryRun: boolean; requestKey: string }) => {
      const body: Record<string, unknown> = {
        userId: toUserId,
        criteria,
        dryRun,
        previewIds: dryRun ? undefined : preview?.ids,
        previewTargetUserId: dryRun ? undefined : toUserId,
        previewFingerprint: dryRun ? undefined : preview?.fingerprint,
      };
      const res = await fetch(bulkEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || t.errors.generic);
      }
      return { data: await res.json(), requestKey };
    },
    onSuccess: ({ data, requestKey }, variables) => {
      // Do not install a response from a request started against an older
      // filter/target state.
      if (variables.dryRun) {
        if (requestKey !== selectionKey) return;
        setPreview({
          affected: data.affected,
          ids: data.previewIds || data.clinicIds || data.hospitalIds || [],
          fingerprint: data.previewFingerprint,
          requestKey,
        });
        setConfirmed(false);
      } else {
        toast({ title: `${data.affected} ${p.bulkPreviewCount}` });
        qc.invalidateQueries({ queryKey: ["/api/representatives"] });
        setPreview(null);
        setConfirmed(true);
      }
    },
    onError: (error: Error) => toast({
      title: t.common.error,
      description: error.message,
      variant: "destructive",
    }),
  });

  const swapMutation = useMutation({
    mutationFn: async ({ dryRun, requestKey }: { dryRun: boolean; requestKey: string }) => {
      const body: Record<string, unknown> = {
        fromUserId: swapFrom,
        toUserId: swapTo,
        criteria,
        dryRun,
        previewIds: dryRun ? undefined : preview?.ids,
        previewTargetUserId: dryRun ? undefined : swapTo,
        previewFingerprint: dryRun ? undefined : preview?.fingerprint,
      };
      const res = await fetch(swapEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || t.errors.generic);
      }
      return { data: await res.json(), requestKey };
    },
    onSuccess: ({ data, requestKey }, variables) => {
      if (variables.dryRun) {
        if (requestKey !== selectionKey) return;
        setPreview({
          affected: data.affected ?? data.swapped ?? 0,
          ids: data.previewIds || data.clinicIds || data.hospitalIds || [],
          fingerprint: data.previewFingerprint,
          requestKey,
        });
        setConfirmed(false);
      } else {
        toast({ title: `${data.swapped ?? data.affected ?? 0} ${p.bulkPreviewCount}` });
        qc.invalidateQueries({ queryKey: ["/api/representatives"] });
        setPreview(null);
        setConfirmed(true);
      }
    },
    onError: (error: Error) => toast({
      title: t.common.error,
      description: error.message,
      variant: "destructive",
    }),
  });

  const resetFilters = () => {
    setSearchQuery("");
    setFilterRules([]);
    setFromUserId("");
    setOnlyUnassigned(false);
    setRegionalCriteria(null);
    setAssignmentDraft(undefined);
    clearSelection();
  };

  const changeEntity = (next: EntityType) => {
    if (next === entityType) return;
    setEntityType(next);
    // Rules are entity-specific; never carry a clinic rule into a hospital
    // request (or vice versa).
    setSearchQuery("");
    setFilterRules([]);
    setRegionalCriteria(null);
    setAssignmentDraft(undefined);
    clearSelection();
  };

  const prepareRegionalAssignment = (countryCode: string, regions: string[], targets: Record<string, string>) => {
    try {
      const nextRules = applyRepresentativeRegionFilter(criteria.filterRules || filterRules, countryCode, regions) as FilterRule[];
      const nextCriteria = {
        ...criteria,
        filterRules: nextRules,
      };
      setFilterRules(nextRules);
      setRegionalCriteria(nextCriteria);
      setAssignmentDraft({
        key: representativeAssignmentCriteriaKey(entityType, nextCriteria),
        revision: ++assignmentRevision.current,
        entity: entityType,
        targets,
      });
      setRegionalPanelRevision(assignmentRevision.current);
      if (mode !== "regional") {
        setRegionalSource(mode === "swap" ? swapFrom : mode === "bulk" && !onlyUnassigned ? fromUserId : "");
        setRegionalKind(temporaryCover ? "temporary" : "assign");
      }
      setMode("regional");
      clearSelection();
      setFocusRegionalPanel(true);
    } catch {
      toast({ title: t.common.error, description: t.representativeAssist.suggestionError, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!focusRegionalPanel || mode !== "regional") return;
    const frame = requestAnimationFrame(() => {
      regionalPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      regionalPanelRef.current?.focus({ preventScroll: true });
      setFocusRegionalPanel(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRegionalPanel, mode]);

  const startPreview = () => {
    if (mode === "bulk") {
      bulkMutation.mutate({ dryRun: true, requestKey: selectionKey });
    } else {
      swapMutation.mutate({ dryRun: true, requestKey: selectionKey });
    }
  };

  const confirmAssignment = () => {
    if (!preview || preview.requestKey !== selectionKey) return;
    if (mode === "bulk") {
      bulkMutation.mutate({ dryRun: false, requestKey: selectionKey });
    } else {
      swapMutation.mutate({ dryRun: false, requestKey: selectionKey });
    }
  };

  const isPending = bulkMutation.isPending || swapMutation.isPending;
  const canPreview = mode === "bulk"
    ? !!toUserId
    : !!swapFrom && !!swapTo && swapFrom !== swapTo;
  const canConfirm = canPreview && !!preview && preview.requestKey === selectionKey && !isPending;

  return (
    <div className={`${embedded ? "" : "h-full "}flex flex-col gap-0`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight break-words">
              {mode === "regional" ? t.representativeDistribution.title : mode === "bulk" ? p.bulkAssignTitle : p.swapTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{p.bulkFilterTitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="flex flex-wrap rounded-md border overflow-hidden text-sm max-w-full">
            <button
              onClick={() => changeEntity("clinic")}
              className={`flex min-w-0 items-center gap-1.5 px-3 py-1.5 font-medium whitespace-normal text-left transition-colors ${entityType === "clinic" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "hover:bg-muted"}`}
            >
              <Building2 className="h-3.5 w-3.5" />{t.mpn.clinic}
            </button>
            <button
              onClick={() => changeEntity("hospital")}
              className={`flex min-w-0 items-center gap-1.5 px-3 py-1.5 font-medium whitespace-normal text-left transition-colors ${entityType === "hospital" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "hover:bg-muted"}`}
            >
              <Hospital className="h-3.5 w-3.5" />{t.mpn.hospital}
            </button>
          </div>
          <div className="flex flex-wrap rounded-md border overflow-hidden text-sm max-w-full">
            <button
              onClick={() => { setMode("bulk"); setRegionalCriteria(null); setAssignmentDraft(undefined); clearSelection(); }}
              className={`flex min-w-0 items-center gap-1.5 px-3 py-1.5 font-medium whitespace-normal text-left transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <UserCheck className="h-3.5 w-3.5" />{p.bulkAssignTitle}
            </button>
            <button
              onClick={() => { setMode("swap"); setRegionalCriteria(null); setAssignmentDraft(undefined); clearSelection(); }}
              className={`flex min-w-0 items-center gap-1.5 px-3 py-1.5 font-medium whitespace-normal text-left transition-colors ${mode === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />{p.swapTitle}
            </button>
            <button onClick={() => { setMode("regional"); setRegionalCriteria(null); setAssignmentDraft(undefined); setRegionalSource(mode === "swap" ? swapFrom : ""); setRegionalKind("assign"); clearSelection(); }} data-testid="bulk-mode-regional"
              className={`flex min-w-0 items-center gap-1.5 px-3 py-1.5 font-medium whitespace-normal text-left transition-colors ${mode === "regional" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Building2 className="h-3.5 w-3.5" />{t.representativeDistribution.title}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-4">
        <div className={`grid grid-cols-1 ${mode === "regional" || temporaryCover ? "xl:grid-cols-[320px_1fr]" : "xl:grid-cols-[1fr_340px]"} gap-4 items-start`}>
          <div className="space-y-4 rounded-xl border p-5 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {p.bulkFilterTitle}
              </span>
              {(filterRules.length > 0 || searchQuery || fromUserId || onlyUnassigned) && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />{p.bulkFilterTitle}
                </button>
              )}
            </div>

            <EntityFilter
              searchQuery={searchQuery}
              onSearchChange={(value) => { setSearchQuery(value); setRegionalCriteria(previous => previous ? { ...previous, search: value.trim() || undefined } : null); setAssignmentDraft(undefined); clearSelection(); }}
              searchPlaceholder={entityType === "clinic"
                ? t.clinics.searchPlaceholder
                : t.hospitals.searchPlaceholder}
              rules={filterRules}
              onRulesChange={(rules) => { setFilterRules(rules); setRegionalCriteria(previous => previous ? { ...previous, filterRules: rules } : null); setAssignmentDraft(undefined); clearSelection(); }}
              fields={fields}
              presets={presets}
              storageKey={`entity-filter:bulk-assignment:${entityType}`}
              testId={`filter-bulk-${entityType}`}
              locale={locale}
              hideSavedViews={false}
              labels={{
                search: entityType === "clinic"
                  ? t.clinics.searchPlaceholder
                  : t.hospitals.searchPlaceholder,
                filter: t.common.filter,
                clearAll: t.common.clearAll,
              }}
            />

            <RepresentativeRegionSuggestions entity={entityType} criteria={criteria} onApply={(country, regions) => {
              const nextRules = applyRepresentativeRegionFilter(criteria.filterRules || filterRules, country, regions) as FilterRule[];
              setFilterRules(nextRules);
              setRegionalCriteria(previous => previous ? { ...previous, filterRules: nextRules } : null);
              setAssignmentDraft(undefined);
              clearSelection();
            }} onPrepare={prepareRegionalAssignment} />

            {selectedCountries.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {t.mpn.country}: {selectedCountries.join(", ")}
              </div>
            )}
            {mode === "regional" && criteria.currentRepresentativeId === null && (
              <p className="text-xs font-medium text-muted-foreground">{p.bulkOnlyUnassigned}</p>
            )}

            {mode === "bulk" && !temporaryCover && (
              <>
                <div className="flex items-center gap-3 border-t pt-3">
                  <Switch
                    id="only-unassigned"
                    checked={onlyUnassigned}
                    onCheckedChange={(value) => {
                      setOnlyUnassigned(value);
                      if (value) setFromUserId("");
                      clearSelection();
                    }}
                  />
                  <Label htmlFor="only-unassigned" className="cursor-pointer text-sm">
                    {p.bulkOnlyUnassigned}
                  </Label>
                </div>
                {!onlyUnassigned && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{p.bulkOnlyFrom}</Label>
                    <Select
                      value={fromUserId || "__none__"}
                      onValueChange={(value) => {
                        setFromUserId(value === "__none__" ? "" : value);
                        clearSelection();
                      }}
                      disabled={repsLoading}
                    >
                      <SelectTrigger><SelectValue placeholder={`— (${t.common.all})`} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ({t.common.all})</SelectItem>
                        {representatives.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>{rep.name} ({rep.clinicCount})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4 rounded-xl border p-5 bg-card">
            {mode !== "regional" && <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Switch id="bulk-temporary-cover" checked={temporaryCover} onCheckedChange={setTemporaryCover} data-testid="bulk-temporary-cover" />
                <Label htmlFor="bulk-temporary-cover">{t.representativeAssist.tempToggle}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{t.representativeAssist.tempHelp}</p>
            </div>}
            {mode === "regional" ? <div ref={regionalPanelRef} tabIndex={-1} className="min-w-0 scroll-mt-4 outline-none">
              <RepresentativeDistributionPanel key={regionalPanelRevision} entity={entityType} criteria={criteria} initialKind={regionalKind}
                initialSource={regionalSource} assignmentDraft={assignmentDraft}
                onContextChange={(kind, source) => {
                  setRegionalKind(kind);
                  setRegionalSource(source);
                }} />
            </div>
              : temporaryCover ? <RepresentativeDistributionPanel key={`${mode}:${entityType}:temporary`} entity={entityType}
                criteria={{ ...criteria, currentRepresentativeId: undefined }} singleTarget
                initialSource={mode === "bulk" ? fromUserId : swapFrom} initialTarget={mode === "bulk" ? toUserId : swapTo}
                onContextChange={(_kind, source) => {
                  if (mode === "swap") setSwapFrom(source);
                  else {
                    setFromUserId(source);
                    if (source) setOnlyUnassigned(false);
                  }
                }} /> : <>
            {mode === "bulk" ? (
              <div className="space-y-1.5">
                <Label>{p.bulkTo}</Label>
                <Select
                  value={toUserId}
                  onValueChange={(value) => { setToUserId(value); clearSelection(); }}
                  disabled={repsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={repsLoading ? t.common.loading : p.selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {representatives.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>{p.bulkFrom}</Label>
                  <Select value={swapFrom} onValueChange={(value) => { setSwapFrom(value); clearSelection(); }} disabled={repsLoading}>
                    <SelectTrigger><SelectValue placeholder={p.selectPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {representatives.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name} ({rep.clinicCount})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-center py-1">
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <Label>{p.bulkTo}</Label>
                  <Select value={swapTo} onValueChange={(value) => { setSwapTo(value); clearSelection(); }} disabled={repsLoading}>
                    <SelectTrigger><SelectValue placeholder={p.selectPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {representatives.filter((rep) => rep.id !== swapFrom).map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {preview && preview.requestKey === selectionKey && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-3">
                <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm">
                  <strong>{preview.affected}</strong> {p.bulkPreviewCount}
                </span>
              </div>
            )}
            {confirmed && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{p.assignedSuccess}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                disabled={!canPreview || isPending}
                onClick={startPreview}
                className="w-full"
              >
                {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {p.bulkDryRunBtn}
              </Button>
              <Button
                disabled={!canConfirm}
                onClick={confirmAssignment}
                className="w-full"
              >
                {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {p.bulkConfirm}
              </Button>
            </div>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
