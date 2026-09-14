import { useEffect, useMemo, useState } from "react";
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

interface RepUser {
  id: string;
  name: string;
  email: string | null;
  clinicCount: number;
}

type Mode = "bulk" | "swap";
type EntityType = "clinic" | "hospital";

type PreviewResult = {
  affected: number;
  ids: string[];
  fingerprint: string;
  requestKey: string;
};

function stableSelectionKey(value: unknown): string {
  return JSON.stringify(value);
}

export default function BulkAssignPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedCountries } = useCountryFilter();
  const p = t.representantPanel;

  const [mode, setMode] = useState<Mode>("bulk");
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

  const fields = useMemo(
    () => getMedicalPartnerFilterFields(entityType, locale, representatives, laboratories),
    [entityType, locale, representatives, laboratories],
  );
  const presets = useMemo(
    () => getMedicalPartnerFilterPresets(entityType, locale),
    [entityType, locale],
  );

  const criteria = useMemo(() => ({
    search: searchQuery.trim() || undefined,
    filterRules,
    currentRepresentativeId: mode === "bulk"
      ? (onlyUnassigned ? null : (fromUserId || undefined))
      : undefined,
    // This is a UI scope, never an authority grant.  The server intersects it
    // with the signed-in manager's assigned countries.
    countryScope: selectedCountries.length ? selectedCountries : undefined,
  }), [
    searchQuery,
    filterRules,
    mode,
    onlyUnassigned,
    fromUserId,
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
    clearSelection();
  };

  const changeEntity = (next: EntityType) => {
    if (next === entityType) return;
    setEntityType(next);
    // Rules are entity-specific; never carry a clinic rule into a hospital
    // request (or vice versa).
    setSearchQuery("");
    setFilterRules([]);
    clearSelection();
  };

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
    <div className="h-full flex flex-col gap-0">
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {mode === "bulk" ? p.bulkAssignTitle : p.swapTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{p.bulkFilterTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              onClick={() => changeEntity("clinic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${entityType === "clinic" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "hover:bg-muted"}`}
            >
              <Building2 className="h-3.5 w-3.5" />{t.mpn.clinic}
            </button>
            <button
              onClick={() => changeEntity("hospital")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${entityType === "hospital" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "hover:bg-muted"}`}
            >
              <Hospital className="h-3.5 w-3.5" />{t.mpn.hospital}
            </button>
          </div>
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              onClick={() => { setMode("bulk"); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${mode === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <UserCheck className="h-3.5 w-3.5" />{p.bulkAssignTitle}
            </button>
            <button
              onClick={() => { setMode("swap"); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${mode === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />{p.swapTitle}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
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
              onSearchChange={(value) => { setSearchQuery(value); clearSelection(); }}
              searchPlaceholder={entityType === "clinic"
                ? t.clinics.searchPlaceholder
                : t.hospitals.searchPlaceholder}
              rules={filterRules}
              onRulesChange={(rules) => { setFilterRules(rules); clearSelection(); }}
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

            {selectedCountries.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {t.mpn.country}: {selectedCountries.join(", ")}
              </div>
            )}

            {mode === "bulk" && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
