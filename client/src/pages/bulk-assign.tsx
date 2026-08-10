// ─────────────────────────────────────────────────────────────────────────────
// Bulk Assign Representatives — stránka pre manažérov
// Hromadné priradenie a výmena reprezentantov pre kliniky aj nemocnice.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, UserCheck, Users, ArrowRightLeft, Building2, Hospital,
  ChevronRight, CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { REGIONS_BY_COUNTRY, DISTRICTS_BY_REGION } from "@/lib/regions";
import { COUNTRIES } from "@shared/schema";

// flatten DISTRICTS_BY_REGION for a given region (values are either string[] or Record<string,string[]>)
function getDistricts(region: string): string[] {
  const v = (DISTRICTS_BY_REGION as Record<string, any>)[region];
  if (!v) return [];
  if (Array.isArray(v)) return v as string[];
  // nested by sub-region: flatten all
  return Object.values(v).flat() as string[];
}

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

  // Bulk assign state
  const [toUserId, setToUserId] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [fromUserId, setFromUserId] = useState("");

  // Swap state
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");

  // Dry run result
  const [dryRunResult, setDryRunResult] = useState<{ affected: number; clinicIds?: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: representatives = [], isLoading: repsLoading } = useQuery<RepUser[]>({
    queryKey: ["/api/representatives"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 0,
    refetchOnMount: true,
  });

  const regions = country ? (REGIONS_BY_COUNTRY as any)[country] ?? [] : [];
  const districts = region ? getDistricts(region) : [];

  const bulkEndpoint = entityType === "clinic"
    ? "/api/clinics/bulk-assign-representative"
    : "/api/hospitals/bulk-assign-representative";

  const swapEndpoint = entityType === "clinic"
    ? "/api/clinics/swap-representative"
    : "/api/hospitals/swap-representative";

  const bulkMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const criteria: Record<string, any> = {};
      if (country) criteria.country = country;
      if (region) criteria.region = region;
      if (district) criteria.district = district;
      if (onlyUnassigned) criteria.currentRepresentativeId = null;
      else if (fromUserId) criteria.currentRepresentativeId = fromUserId;

      const res = await fetch(bulkEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: toUserId, criteria, dryRun }),
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
      setSwapFrom("");
      setSwapTo("");
      setConfirmed(true);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
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
          <UserCheck className="h-4 w-4" />
          {p.bulkAssignTitle}
        </button>
        <button
          onClick={() => { setMode("swap"); setDryRunResult(null); setConfirmed(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${mode === "swap" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <ArrowRightLeft className="h-4 w-4" />
          {p.swapTitle}
        </button>
      </div>

      {/* Entity type selector */}
      <div className="flex rounded-md border overflow-hidden w-fit">
        <button
          onClick={() => setEntityType("clinic")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${entityType === "clinic" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "hover:bg-muted"}`}>
          <Building2 className="h-3.5 w-3.5" />
          {t.nav?.clinics || "Clinics"}
        </button>
        <button
          onClick={() => setEntityType("hospital")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${entityType === "hospital" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "hover:bg-muted"}`}>
          <Hospital className="h-3.5 w-3.5" />
          {t.hospitals?.title || "Hospitals"}
        </button>
      </div>

      {/* ── BULK ASSIGN form ── */}
      {mode === "bulk" && (
        <div className="space-y-4 rounded-xl border p-5 bg-card">
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

          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{p.bulkFilterTitle}</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Krajina / Country</Label>
              <Select value={country || "__all__"} onValueChange={v => { setCountry(v === "__all__" ? "" : v); setRegion(""); setDistrict(""); setDryRunResult(null); }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">—</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kraj / Region</Label>
              <Select value={region || "__all__"} onValueChange={v => { setRegion(v === "__all__" ? "" : v); setDistrict(""); setDryRunResult(null); }} disabled={!country || regions.length === 0}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">—</SelectItem>
                  {regions.map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Okres / District</Label>
              <Select value={district || "__all__"} onValueChange={v => { setDistrict(v === "__all__" ? "" : v); setDryRunResult(null); }} disabled={!region || districts.length === 0}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">—</SelectItem>
                  {districts.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch id="only-unassigned" checked={onlyUnassigned} onCheckedChange={v => { setOnlyUnassigned(v); if (v) setFromUserId(""); setDryRunResult(null); }} />
            <Label htmlFor="only-unassigned" className="cursor-pointer">{p.bulkOnlyUnassigned}</Label>
          </div>

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

          <Button
            disabled={!swapFrom || !swapTo || swapMutation.isPending}
            onClick={() => swapMutation.mutate()}>
            {swapMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {p.bulkConfirm}
          </Button>
        </div>
      )}
    </div>
  );
}
