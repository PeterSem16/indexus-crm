import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, AlertTriangle, CheckCircle2, Check, X, Pencil, Calculator as CalcIcon, ListOrdered, Grid3X3, CopyPlus, CalendarDays, Trash2, Package, Percent, Droplets, Plus, Sparkles, Lock, Unlock, ShieldCheck, TrendingUp, Camera, BarChart3, FileDown, Upload, FileSpreadsheet } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// ---------- types (mirror server /api/pricing responses) ----------
interface PriceListRow {
  id: string; countryCode: string; currency: string; name: string; status: string;
  validFrom: string | null; fxRateToEur: string | null; fxRateMode: string | null;
  inflationRatePct: string | null; inflationYear: number | null; inflationApply: boolean | null;
  storageYearOptions: number[] | null;
}
interface PricingProduct { id: string; code: string; name: string; componentCodes: string[] }
interface Bundle {
  priceList: { id: string; countryCode: string; currency: string; name: string; fxRateToEur: string | null; storageYearOptions: number[] | null };
  products: Array<{ id: string; code: string; name: string }>;
  components: Array<{ id: string; code: string; name: string }>;
  productComponents: Array<{ productId: string; componentId: string }>;
  collectionPrices: Array<{ id: string; productId: string | null; componentId: string | null; price: string; maxCollectionDiscountPct: string | null; note: string | null }>;
  storagePrices: Array<{ id: string; productId: string | null; componentId: string | null; years: number; price: string }>;
  storageDiscounts: Array<{ id: string; years: number; discountPct: string }>;
  installmentPlans: Array<{ id: string; installments: number; surchargePct: string }>;
  incompleteRules: Array<{ id: string; orderedProductId: string; collectedMask: string; resultLabel: string; collectionPrice: string; storagePrices: Record<string, number> | null; isOverride: boolean; note: string | null }>;
  adjustmentRules: Array<{ id: string; ruleType: string; amount: string | null; pct: string | null; appliesTo?: string | null; note: string | null; enabled?: boolean | null; volumeOperator?: string | null; volumeMinMl?: string | null; volumeMaxMl?: string | null }>;
}
interface CalcResult {
  priceListId: string; countryCode: string; currency: string;
  orderedProduct: string; effectiveProduct: string; collectedMask: string;
  lineItems: Array<{ kind: string; label: string; amount: number; currency: string; reason: string }>;
  totalCollection: number; totalStorage: number; total: number; totalEur: number | null; warnings: string[];
}

interface CostRow {
  id: string; countryCode: string; productLabel: string;
  grossRevenueEur: string | null; totalCostEur: string | null;
  reziaEur: string | null; note: string | null;
}
interface CostItem {
  id: string; costRowId: string; label: string; amountEur: string; sortOrder: number;
}

const COUNTRY_FLAGS: Record<string, string> = { SK: "🇸🇰", CZ: "🇨🇿", RO: "🇷🇴", HU: "🇭🇺", AT: "🇦🇹", IT: "🇮🇹" };

function fmt(v: number | string | null | undefined, currency?: string) {
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (num === null || num === undefined || isNaN(num)) return "—";
  const s = num.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${s} ${currency}` : s;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: t.pricing.statusDraft, cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
    active: { label: t.pricing.statusActive, cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    archived: { label: t.pricing.statusArchived, cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.archived;
  return <Badge variant="secondary" className={m.cls} data-testid={`badge-status-${status}`}>{m.label}</Badge>;
}

// ── Margin Gauge (SVG ring) ────────────────────────────────────────────────
function MarginGauge({ pct }: { pct: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ - (clamped / 100) * circ;
  const good = pct >= 40, ok = pct >= 20;
  const stroke = good ? "#22c55e" : ok ? "#f59e0b" : "#ef4444";
  const bg = good ? "#dcfce7" : ok ? "#fef3c7" : "#fee2e2";
  const textColor = good ? "#16a34a" : ok ? "#d97706" : "#dc2626";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill={bg} stroke="#e5e7eb" strokeWidth="7" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={stroke} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-black leading-none tabular-nums" style={{ color: textColor }}>
          {Number.isFinite(pct) ? `${Math.round(pct)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Margin Tab ─────────────────────────────────────────────────────────────
function MarginTab({ canManage, toast }: { canManage: boolean; toast: ReturnType<typeof useToast>["toast"] }) {
  const { t } = useI18n();
  const p = t.pricing;
  const [step, setStep] = useState<"locked" | "enter-code" | "unlocked">("locked");
  const [inputCode, setInputCode] = useState("");
  const [country, setCountry] = useState("SK");
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null); // null = current/global
  const [reziaInputs, setReziaInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expandedCostRows, setExpandedCostRows] = useState<Set<string>>(new Set());
  // per-item local edit drafts: { label, amount } keyed by item id
  const [itemDrafts, setItemDrafts] = useState<Record<string, { label: string; amount: string }>>({});
  const initialized = useRef(false);

  // Check for an existing session on mount
  const { data: sessionData } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/pricing/margin/session"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/margin/session", { credentials: "include" });
      if (!res.ok) return { verified: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sessionData?.verified && step === "locked") setStep("unlocked");
  }, [sessionData]);

  // All non-draft price lists for selector
  const { data: allPriceLists = [] } = useQuery<PriceListRow[]>({
    queryKey: ["/api/pricing/price-lists"],
    enabled: step === "unlocked",
  });
  const selectorLists = allPriceLists.filter((l) => l.status !== "draft");

  const { data: costs = [], refetch: refetchCosts } = useQuery<CostRow[]>({
    queryKey: ["/api/pricing/costs", selectedPriceListId],
    queryFn: async () => {
      const url = selectedPriceListId
        ? `/api/pricing/costs?priceListId=${encodeURIComponent(selectedPriceListId)}`
        : "/api/pricing/costs";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: step === "unlocked",
  });

  const { data: allItems = [], refetch: refetchItems } = useQuery<CostItem[]>({
    queryKey: ["/api/pricing/cost-items"],
    enabled: step === "unlocked",
  });

  // Seed rezia inputs from DB on first load
  useEffect(() => {
    if (costs.length && !initialized.current) {
      initialized.current = true;
      const init: Record<string, string> = {};
      for (const c of costs) init[c.id] = c.reziaEur ?? "";
      setReziaInputs(init);
    }
  }, [costs]);

  // Seed item drafts when items load
  useEffect(() => {
    setItemDrafts((prev) => {
      const next = { ...prev };
      for (const item of allItems) {
        if (!next[item.id]) next[item.id] = { label: item.label, amount: item.amountEur };
      }
      return next;
    });
  }, [allItems]);

  const requestOtp = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pricing/margin/request-otp", {}),
    onSuccess: () => { setStep("enter-code"); toast({ title: p.marginOtpSent }); },
    onError: () => toast({ title: p.marginOtpSendFailed, variant: "destructive" }),
  });

  const verifyOtp = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pricing/margin/verify-otp", { code: inputCode }),
    onSuccess: () => { setStep("unlocked"); setInputCode(""); },
    onError: () => toast({ title: p.marginOtpInvalid, variant: "destructive" }),
  });

  const addCostItem = useMutation({
    mutationFn: (costRowId: string) =>
      apiRequest("POST", `/api/pricing/costs/${costRowId}/items`, { label: "", amountEur: 0 }),
    onSuccess: async () => { await Promise.all([refetchCosts(), refetchItems()]); },
    onError: () => toast({ title: p.marginCostItemSaveFailed, variant: "destructive" }),
  });

  const updateCostItem = async (itemId: string, draft: { label: string; amount: string }) => {
    const amountEur = parseFloat(draft.amount);
    if (!Number.isFinite(amountEur)) return;
    try {
      await apiRequest("PATCH", `/api/pricing/cost-items/${itemId}`, {
        label: draft.label,
        amountEur,
      });
      await Promise.all([refetchCosts(), refetchItems()]);
      toast({ title: p.marginCostItemSaved });
    } catch {
      toast({ title: p.marginCostItemSaveFailed, variant: "destructive" });
    }
  };

  const deleteCostItem = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/pricing/cost-items/${itemId}`, {}),
    onSuccess: async () => {
      await Promise.all([refetchCosts(), refetchItems()]);
      toast({ title: p.marginCostItemDeleted });
    },
    onError: () => toast({ title: p.marginCostItemSaveFailed, variant: "destructive" }),
  });

  const takeSnapshot = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pricing/margin/snapshot", {}),
    onSuccess: () => toast({ title: p.marginSnapshotSaved }),
    onError: () => toast({ title: p.marginSaveFailed, variant: "destructive" }),
  });

  const initFromList = useMutation({
    mutationFn: (priceListId: string) =>
      apiRequest("POST", `/api/pricing/margin/init-from-list/${priceListId}`, {}),
    onSuccess: async () => { await refetchCosts(); toast({ title: p.marginCostItemSaved }); },
    onError: () => toast({ title: p.marginSaveFailed, variant: "destructive" }),
  });

  const saveRezia = async (row: CostRow) => {
    const val = (reziaInputs[row.id] ?? "").trim();
    const num = val === "" ? null : parseFloat(val);
    if (num !== null && !Number.isFinite(num)) return;
    setSaving((s) => ({ ...s, [row.id]: true }));
    try {
      await apiRequest("PATCH", `/api/pricing/costs/${row.id}`, { reziaEur: num });
      await refetchCosts();
      toast({ title: p.marginSaved });
    } catch {
      toast({ title: p.marginSaveFailed, variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [row.id]: false }));
    }
  };

  // ── Locked / OTP gate ──
  if (step !== "unlocked") {
    return (
      <div className="mt-6 flex justify-center">
        <div className="w-full max-w-sm">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 shadow-2xl text-white">
            {/* decorative blobs */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/10" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-violet-500/10" />
            <div className="relative z-10 flex flex-col items-center gap-5 text-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 ${requestOtp.isPending || verifyOtp.isPending ? "animate-pulse" : ""}`}>
                {step === "enter-code" ? <ShieldCheck className="h-9 w-9 text-indigo-300" /> : <Lock className="h-9 w-9 text-indigo-300" />}
              </div>
              <div>
                <h3 className="text-lg font-bold">{p.marginOtpTitle}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-indigo-200">{p.marginOtpDesc}</p>
                <p className="mt-1 text-xs text-indigo-300/60">{p.marginSessionInfo}</p>
              </div>

              {step === "locked" && (
                <Button onClick={() => requestOtp.mutate()} disabled={requestOtp.isPending}
                  className="border-0 bg-indigo-500 px-8 text-white hover:bg-indigo-400">
                  {requestOtp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {p.marginOtpRequest}
                </Button>
              )}

              {step === "enter-code" && (
                <div className="w-full space-y-3">
                  <Input value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="_ _ _ _ _ _"
                    className="h-14 border-white/20 bg-white/10 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder:text-white/30"
                    maxLength={6}
                    onKeyDown={(e) => e.key === "Enter" && inputCode.length === 6 && verifyOtp.mutate()} />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("locked")}
                      className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10">
                      {p.cancel}
                    </Button>
                    <Button onClick={() => verifyOtp.mutate()} disabled={inputCode.length !== 6 || verifyOtp.isPending}
                      className="flex-1 border-0 bg-indigo-500 text-white hover:bg-indigo-400">
                      {verifyOtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {p.marginOtpVerify}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked ──────────────────────────────────────────────────────────────
  const costs_countries = [...new Set(costs.map((c) => c.countryCode))].sort();
  const activeCountry = costs_countries.includes(country) ? country : costs_countries[0] ?? "SK";
  const filtered = costs.filter((c) => c.countryCode === activeCountry);
  const selectedList = selectorLists.find((l) => l.id === selectedPriceListId) ?? null;

  // group selectorLists by country for the two-level picker
  const selectorCountries = [...new Set(selectorLists.map((l) => l.countryCode))].sort();
  const [selectorCountry, setSelectorCountry] = useState<string | null>(null);
  const effectiveSelectorCountry = selectorCountry ?? selectorCountries[0] ?? null;
  const listsForCountry = effectiveSelectorCountry
    ? selectorLists.filter((l) => l.countryCode === effectiveSelectorCountry)
    : [];

  const switchList = (id: string | null) => {
    setSelectedPriceListId(id);
    setExpandedCostRows(new Set());
    setReziaInputs({});
    initialized.current = false;
    // sync cost-row country filter to the selected list's country
    if (id) {
      const l = selectorLists.find((x) => x.id === id);
      if (l) setCountry(l.countryCode);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* ── top bar: session pill + snapshot ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          <Unlock className="h-3 w-3" />
          <span>{p.marginSessionInfo}</span>
        </div>
        <Button size="sm" variant="outline"
          className="h-7 gap-1.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          disabled={takeSnapshot.isPending}
          onClick={() => takeSnapshot.mutate()}>
          {takeSnapshot.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          {p.marginSnapshotNow}
        </Button>
      </div>

      {/* ── two-level cenník selector ── */}
      {selectorLists.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">Cenník</div>
          {/* Level 1: country tabs */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setSelectorCountry(null); switchList(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1 ${selectedPriceListId === null ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}>
              Aktuálne
            </button>
            <div className="w-px bg-indigo-200 mx-1 self-stretch" />
            {selectorCountries.map((cc) => (
              <button key={cc}
                onClick={() => { setSelectorCountry(cc); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${effectiveSelectorCountry === cc && selectedPriceListId !== null ? "bg-indigo-600 text-white shadow-sm" : effectiveSelectorCountry === cc ? "bg-white border-2 border-indigo-400 text-indigo-700" : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}>
                {COUNTRY_FLAGS[cc] ?? ""} {cc}
              </button>
            ))}
          </div>
          {/* Level 2: price lists for selected country */}
          {effectiveSelectorCountry && listsForCountry.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 pl-1 border-t border-indigo-100">
              {listsForCountry.map((l) => {
                const isActive = selectedPriceListId === l.id;
                const statusDot = l.status === "active"
                  ? "bg-emerald-400"
                  : l.status === "draft"
                  ? "bg-amber-400"
                  : "bg-slate-300";
                return (
                  <button key={l.id}
                    onClick={() => switchList(l.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all flex items-center gap-1.5 ${isActive ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-white/80" : statusDot}`} />
                    {l.name}
                    {l.status === "archived" && !isActive && <span className="text-[9px] text-slate-400">archív</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── cost-row country pills (only when actual cost rows exist) ── */}
      {costs_countries.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {costs_countries.map((cc) => (
            <button key={cc} onClick={() => setCountry(cc)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${activeCountry === cc ? "bg-indigo-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {COUNTRY_FLAGS[cc] ?? ""} {cc}
            </button>
          ))}
        </div>
      )}

      {/* ── init button when selected list has no rows yet ── */}
      {selectedPriceListId && costs.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-indigo-700">
            {selectedList ? `${selectedList.name} (${selectedList.countryCode})` : selectedPriceListId}
          </p>
          <p className="text-xs text-muted-foreground">Tento cenník nemá zatiaľ žiadne nákladové riadky. Inicializuj ich z cien zberov.</p>
          <Button size="sm"
            className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5"
            disabled={initFromList.isPending}
            onClick={() => initFromList.mutate(selectedPriceListId)}>
            {initFromList.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Inicializovať nákladové riadky
          </Button>
        </div>
      )}

      {filtered.length === 0 && !(selectedPriceListId && costs.length === 0) ? (
        <div className="py-16 text-center text-muted-foreground">{p.marginNoData}</div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((row) => {
            const rowItems = allItems.filter((i) => i.costRowId === row.id);
            const gross = parseFloat(row.grossRevenueEur ?? "0") || 0;
            const cost = parseFloat(row.totalCostEur ?? "0") || 0; // stored negative
            const reziaVal = reziaInputs[row.id] ?? (row.reziaEur ?? "");
            const rezia = parseFloat(reziaVal) || 0;
            const margin = gross + cost - rezia;
            const mPct = gross > 0 ? (margin / gross) * 100 : 0;
            const good = mPct >= 40, ok = mPct >= 20;
            const border = good ? "border-emerald-200" : ok ? "border-amber-200" : "border-rose-200";
            const gradFrom = good ? "from-emerald-50/60" : ok ? "from-amber-50/60" : "from-rose-50/60";
            const mColor = good ? "text-emerald-600" : ok ? "text-amber-600" : "text-rose-600";
            const isExpanded = expandedCostRows.has(row.id);
            const toggleExpanded = () => setExpandedCostRows((prev) => {
              const next = new Set(prev);
              if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
              return next;
            });
            return (
              <div key={row.id} className={`rounded-2xl border-2 ${border} bg-gradient-to-br ${gradFrom} to-white p-4 shadow-sm transition-shadow hover:shadow-md`}>
                {/* product label + country badge */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-tight">{row.productLabel}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{row.countryCode}</span>
                </div>

                {/* gauge */}
                <div className="flex justify-center py-1">
                  <MarginGauge pct={mPct} />
                </div>

                {/* stats grid — 2×2 */}
                <div className="mt-3 grid grid-cols-2 gap-1 text-center text-[10px]">
                  <div className="rounded-lg bg-white/70 p-1.5">
                    <div className="text-muted-foreground">{p.marginGrossRevenue}</div>
                    <div className="tabular-nums font-semibold">{fmt(gross)} €</div>
                  </div>
                  {/* Priame náklady cell — click to toggle breakdown */}
                  <button onClick={toggleExpanded}
                    className={`rounded-lg p-1.5 text-left transition-colors ${isExpanded ? "bg-rose-100 border border-rose-300" : "bg-white/70 hover:bg-rose-50"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">{p.marginTotalCost}</span>
                      <Pencil className={`h-2.5 w-2.5 shrink-0 ${isExpanded ? "text-rose-500" : "text-muted-foreground/50"}`} />
                    </div>
                    <div className="tabular-nums font-semibold text-rose-600 text-center">− {fmt(Math.abs(cost))} €</div>
                    {rowItems.length > 0 && (
                      <div className="text-[9px] text-muted-foreground text-center">{rowItems.length} {p.marginCostItems}</div>
                    )}
                  </button>
                  <div className={`rounded-lg p-1.5 ${rezia > 0 ? "bg-orange-50 border border-orange-200" : "bg-white/70"}`}>
                    <div className="text-muted-foreground text-center">{p.marginRezia}</div>
                    <div className={`tabular-nums font-semibold text-center ${rezia > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                      {rezia > 0 ? `− ${fmt(rezia)} €` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/70 p-1.5">
                    <div className="text-muted-foreground text-center">{p.marginValue}</div>
                    <div className={`tabular-nums font-semibold text-center ${mColor}`}>{fmt(margin)} €</div>
                  </div>
                </div>

                {/* ── Cost items breakdown (expandable) ── */}
                {isExpanded && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-rose-700">{p.marginCostBreakdown}</span>
                      <Button size="sm" variant="ghost"
                        className="h-6 px-2 text-[10px] text-rose-600 hover:text-rose-800 hover:bg-rose-100"
                        disabled={addCostItem.isPending}
                        onClick={() => addCostItem.mutate(row.id)}>
                        {addCostItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-0.5" />}
                        {p.marginAddCostItem}
                      </Button>
                    </div>

                    {rowItems.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-3 italic">
                        {p.marginNoCostItems}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {rowItems.map((item) => {
                          const draft = itemDrafts[item.id] ?? { label: item.label, amount: item.amountEur };
                          const setDraft = (patch: Partial<{ label: string; amount: string }>) =>
                            setItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, ...patch } }));
                          return (
                            <div key={item.id} className="rounded-lg border border-rose-100 bg-white/80 p-2 space-y-1.5 shadow-sm">
                              {/* label — full width */}
                              <Input
                                value={draft.label}
                                onChange={(e) => setDraft({ label: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && updateCostItem(item.id, draft)}
                                placeholder={p.marginCostLabel}
                                className="h-7 w-full text-xs font-medium border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-rose-300" />
                              {/* amount row */}
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={draft.amount}
                                  onChange={(e) => setDraft({ amount: e.target.value })}
                                  onKeyDown={(e) => e.key === "Enter" && updateCostItem(item.id, draft)}
                                  placeholder="0.00"
                                  className="h-7 flex-1 text-xs text-right tabular-nums" />
                                <span className="text-[10px] text-muted-foreground shrink-0">€</span>
                                <Button size="sm" variant="ghost"
                                  className="h-7 w-7 shrink-0 p-0 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => updateCostItem(item.id, draft)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost"
                                  className="h-7 w-7 shrink-0 p-0 text-rose-400 hover:bg-rose-100"
                                  disabled={deleteCostItem.isPending}
                                  onClick={() => deleteCostItem.mutate(item.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex justify-between border-t border-rose-200 pt-2 text-[10px]">
                          <span className="text-muted-foreground font-semibold">{p.marginCostTotalLabel}</span>
                          <span className="tabular-nums font-bold text-rose-700">
                            {fmt(rowItems.reduce((s, i) => s + (parseFloat(i.amountEur) || 0), 0))} €
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* réžia input */}
                <div className="mt-3 space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">{p.marginRezia} (€)</label>
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" min="0"
                      value={reziaVal}
                      onChange={(e) => setReziaInputs((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveRezia(row)}
                      className="h-8 text-xs" placeholder="0,00" />
                    <Button size="sm" className="h-8 shrink-0 px-2" disabled={saving[row.id]} onClick={() => saveRezia(row)}>
                      {saving[row.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── Types for trend data ───────────────────────────────────────────────────
interface TrendDataRaw {
  lists: Array<{ id: string; countryCode: string; name: string; status: string; validFrom: string | null }>;
  prices: Array<{ priceListId: string; productId: string | null; componentId: string | null; price: string }>;
  products: Array<{ id: string; code: string; name: string }>;
}
interface MarginSnapshot {
  id: string; costRowId: string; productLabel: string; countryCode: string;
  grossRevenueEur: string | null; totalCostEur: string | null; reziaEur: string | null;
  snapshotDate: string; note: string | null;
}

// ── Trend Tab ──────────────────────────────────────────────────────────────
const CHART_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

function TrendTab() {
  const { t } = useI18n();
  const p = t.pricing;
  const [country, setCountry] = useState("SK");

  // Check if margin session is active
  const { data: sessionData } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/pricing/margin/session"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/margin/session", { credentials: "include" });
      if (!res.ok) return { verified: false };
      return res.json();
    },
    staleTime: 60_000,
  });
  const marginUnlocked = sessionData?.verified === true;

  const { data: trendRaw } = useQuery<TrendDataRaw>({
    queryKey: ["/api/pricing/trend"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/trend", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: snapshots = [] } = useQuery<MarginSnapshot[]>({
    queryKey: ["/api/pricing/margin/snapshots"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/margin/snapshots", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: marginUnlocked,
    staleTime: 60_000,
  });

  // Derive available countries
  const countries = useMemo(() => {
    const fromLists = (trendRaw?.lists ?? []).map((l) => l.countryCode);
    const fromSnaps = snapshots.map((s) => s.countryCode);
    return [...new Set([...fromLists, ...fromSnaps])].sort();
  }, [trendRaw, snapshots]);
  const activeCountry = countries.includes(country) ? country : (countries[0] ?? "SK");

  // Build price trend chart data: [{date, ProductCode: price, ...}]
  const priceChartData = useMemo(() => {
    if (!trendRaw) return [];
    const { lists, prices, products } = trendRaw;
    const countryLists = lists
      .filter((l) => l.countryCode === activeCountry && l.validFrom && l.status !== "draft")
      .sort((a, b) => new Date(a.validFrom!).getTime() - new Date(b.validFrom!).getTime());

    const rows: Record<string, Record<string, unknown>> = {};
    for (const list of countryLists) {
      const dateKey = new Date(list.validFrom!).toLocaleDateString("sk-SK", { year: "numeric", month: "short" });
      const listPrices = prices.filter((lp) => lp.priceListId === list.id && lp.productId && !lp.componentId);
      for (const lp of listPrices) {
        const product = products.find((pr) => pr.id === lp.productId);
        if (!product) continue;
        if (!rows[dateKey]) rows[dateKey] = { date: dateKey, listName: list.name };
        rows[dateKey][product.code] = parseFloat(lp.price);
      }
    }
    return Object.values(rows);
  }, [trendRaw, activeCountry]);

  const priceProductCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const row of priceChartData) {
      for (const key of Object.keys(row)) {
        if (key !== "date" && key !== "listName") codes.add(key);
      }
    }
    return [...codes];
  }, [priceChartData]);

  // Build margin snapshot chart data per day
  const marginChartData = useMemo(() => {
    const countrySnaps = snapshots
      .filter((s) => s.countryCode === activeCountry)
      .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
    const dates = [...new Set(countrySnaps.map((s) => s.snapshotDate.substring(0, 10)))];
    return dates.map((date) => {
      const daySnaps = countrySnaps.filter((s) => s.snapshotDate.startsWith(date));
      const revenue = daySnaps.reduce((sum, s) => sum + (parseFloat(s.grossRevenueEur ?? "0") || 0), 0);
      const cost = daySnaps.reduce((sum, s) => sum + Math.abs(parseFloat(s.totalCostEur ?? "0") || 0), 0);
      const rezia = daySnaps.reduce((sum, s) => sum + (parseFloat(s.reziaEur ?? "0") || 0), 0);
      const margin = revenue - cost - rezia;
      const dateLabel = new Date(date).toLocaleDateString("sk-SK", { year: "numeric", month: "short", day: "numeric" });
      return { date: dateLabel, [p.marginTrendRevenue]: Math.round(revenue), [p.marginTrendCost]: Math.round(cost), [p.marginTrendMargin]: Math.round(margin) };
    });
  }, [snapshots, activeCountry, p]);

  const fmtTick = (v: number) => `${v.toLocaleString("sk-SK")} €`;

  return (
    <div className="mt-4 space-y-6">
      {/* country selector */}
      {countries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {countries.map((cc) => (
            <button key={cc} onClick={() => setCountry(cc)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${activeCountry === cc ? "bg-indigo-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {COUNTRY_FLAGS[cc] ?? ""} {cc}
            </button>
          ))}
        </div>
      )}

      {/* ── Price trend ── */}
      <div className="rounded-2xl border bg-white dark:bg-muted/30 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          {p.marginTrendTitle} — {activeCountry}
        </h3>
        {priceChartData.length < 2 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{priceChartData.length < 1 ? p.marginTrendNoData : "Potrebné aspoň 2 cenníky pre zobrazenie trendu."}</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={priceChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11 }} width={80} />
              <ReTooltip formatter={(v: number) => `${v.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {priceProductCodes.map((code, i) => (
                <Line key={code} type="monotone" dataKey={code}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Margin / cost trend (snapshots) ── */}
      <div className="rounded-2xl border bg-white dark:bg-muted/30 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          {p.marginTrendCost} / {p.marginTrendMargin} — {activeCountry}
        </h3>
        {!marginUnlocked ? (
          <div className="py-8 text-center space-y-2">
            <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground">{p.marginLocked}</p>
          </div>
        ) : marginChartData.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground">{p.marginTrendNoData}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marginChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11 }} width={80} />
              <ReTooltip formatter={(v: number) => `${v.toLocaleString("sk-SK", { minimumFractionDigits: 0 })} €`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={p.marginTrendRevenue} fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey={p.marginTrendCost} fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey={p.marginTrendMargin} fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { t } = useI18n();
  const { canEdit, canAccessModule, isLoading: permsLoading } = usePermissions();
  const canManage = canEdit("pricing");
  const { toast } = useToast();
  const canAccess = canAccessModule("pricing");

  const { data: lists = [], isLoading: listsLoading } = useQuery<PriceListRow[]>({ queryKey: ["/api/pricing/price-lists"], enabled: canAccess });
  const { data: products = [] } = useQuery<PricingProduct[]>({ queryKey: ["/api/pricing/products"], enabled: canAccess });

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const effectiveListId = selectedListId ?? lists.find((l) => l.status === "active")?.id ?? lists[0]?.id ?? null;
  const { data: bundle } = useQuery<Bundle>({
    queryKey: ["/api/pricing/price-lists", effectiveListId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/price-lists/${effectiveListId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!effectiveListId && canAccess,
  });

  if (!permsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-no-access">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t.pricing.noAccess}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" data-testid="page-pricing">
      <div>
        <h1 className="text-2xl font-bold">{t.pricing.title}</h1>
        <p className="text-sm text-muted-foreground">{t.pricing.subtitle}</p>
      </div>
      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists" data-testid="tab-price-lists"><ListOrdered className="w-4 h-4 mr-1" />{t.pricing.tabLists}</TabsTrigger>
          <TabsTrigger value="matrix" data-testid="tab-matrix"><Grid3X3 className="w-4 h-4 mr-1" />{t.pricing.tabMatrix}</TabsTrigger>
          <TabsTrigger value="calculator" data-testid="tab-calculator"><CalcIcon className="w-4 h-4 mr-1" />{t.pricing.tabCalculator}</TabsTrigger>
          {canManage && <TabsTrigger value="margin" data-testid="tab-margin"><TrendingUp className="w-4 h-4 mr-1" />{t.pricing.tabMargin}</TabsTrigger>}
          {canManage && <TabsTrigger value="trend" data-testid="tab-trend"><BarChart3 className="w-4 h-4 mr-1" />{t.pricing.tabTrend}</TabsTrigger>}
        </TabsList>
        <TabsContent value="lists">
          <PriceListsTab lists={lists} loading={listsLoading} selectedId={effectiveListId} onSelect={setSelectedListId} bundle={bundle} canManage={canManage} toast={toast} />
        </TabsContent>
        <TabsContent value="matrix">
          <MatrixTab lists={lists} products={products} canManage={canManage} toast={toast} />
        </TabsContent>
        <TabsContent value="calculator">
          <CalculatorTab lists={lists} products={products} />
        </TabsContent>
        {canManage && (
          <TabsContent value="margin">
            <MarginTab canManage={canManage} toast={toast} />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="trend">
            <TrendTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// playful color identity per component code (falls back through the palette for unknown codes)
const COMPONENT_COLORS: Record<string, string> = {
  CB: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  PB: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
  T: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800",
  P: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
};
const COMPONENT_FALLBACK = [
  "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/40 dark:text-lime-300 dark:border-lime-800",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 dark:border-fuchsia-800",
];
function compColor(code: string): string {
  if (COMPONENT_COLORS[code]) return COMPONENT_COLORS[code];
  let h = 0; for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return COMPONENT_FALLBACK[Math.abs(h) % COMPONENT_FALLBACK.length];
}
function CompChip({ code, small }: { code: string; small?: boolean }) {
  return <span className={`inline-flex items-center rounded-full border font-medium ${small ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} ${compColor(code)}`}>{code}</span>;
}
// product family color by contained components (blood products red-ish, tissue teal, mixed indigo)
function productBadgeCls(codes: string[]): string {
  const hasBlood = codes.includes("CB") || codes.includes("PB");
  const hasTissue = codes.includes("T") || codes.includes("P");
  if (hasBlood && hasTissue) return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800";
  if (hasBlood) return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800";
  if (hasTissue) return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800";
  return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
}

// human-readable LOW_VOLUME condition (mirrors server volumeConditionText)
function volumeCondText(op?: string | null, min?: string | number | null, max?: string | number | null): string {
  const f = (v: string | number | null | undefined) => { const x = parseFloat(String(v ?? "")); return Number.isFinite(x) ? x : 0; };
  if (!op) return "< 20 ml";
  if (op === "lt") return `< ${f(max)} ml`;
  if (op === "gt") return `> ${f(min)} ml`;
  return `${f(min)}–${f(max)} ml`;
}

// ============================= TAB 1: price lists =============================
function PriceListsTab({ lists, loading, selectedId, onSelect, bundle, canManage, toast }: {
  lists: PriceListRow[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void;
  bundle: Bundle | undefined; canManage: boolean; toast: any;
}) {
  const { t } = useI18n();
  const [confirmActivate, setConfirmActivate] = useState<PriceListRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PriceListRow | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copyFxMode, setCopyFxMode] = useState<"live" | "fixed">("fixed");
  const [copyFxFixed, setCopyFxFixed] = useState("");
  const [copyInflationYear, setCopyInflationYear] = useState<string>(String(new Date().getFullYear()));
  const [copyInflationApply, setCopyInflationApply] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  // adjustment-rule edits keyed by rule id: enabled toggle + amount/pct/appliesTo values
  const [ruleEdits, setRuleEdits] = useState<Record<string, { enabled?: boolean; amount?: string; pct?: string; appliesTo?: string; volumeOperator?: string; volumeMin?: string; volumeMax?: string }>>({});
  // add/remove of discount & installment items (draft edit mode)
  const [newDiscounts, setNewDiscounts] = useState<Array<{ years: string; pct: string }>>([]);
  const [newInstallments, setNewInstallments] = useState<Array<{ count: string; pct: string }>>([]);
  const [removedDiscounts, setRemovedDiscounts] = useState<string[]>([]);
  const [removedInstallments, setRemovedInstallments] = useState<string[]>([]);
  const resetItemEdits = () => { setNewDiscounts([]); setNewInstallments([]); setRemovedDiscounts([]); setRemovedInstallments([]); };
  const selected = lists.find((l) => l.id === selectedId) ?? null;
  const isEditableDraft = !!selected && selected.status === "draft" && canManage;

  // switching lists must drop any in-progress edits, or stale row ids from the
  // previous list would be submitted (server ignores them → silent no-op save)
  useEffect(() => {
    setEditMode(false);
    setEdits({});
    setRuleEdits({});
    resetItemEdits();
  }, [selectedId]);

  const selectedCurrency = selected?.currency ?? "EUR";
  const needsFx = selectedCurrency !== "EUR";
  const inflYearInt = parseInt(copyInflationYear, 10);
  const validInflYear = Number.isInteger(inflYearInt) && inflYearInt >= 2000 && inflYearInt <= 2100;

  const { data: liveFxData, isLoading: liveFxLoading } = useQuery<{ currency: string; rate: string; rateDate: string | null }>({
    queryKey: ["/api/pricing/fx-rate", selectedCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/fx-rate/${selectedCurrency}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: copyOpen && needsFx && copyFxMode === "live",
    staleTime: 1000 * 60 * 5,
  });

  const { data: inflData, isLoading: inflLoading } = useQuery<{ country: string; year: number; rate: string; source: string | null }>({
    queryKey: ["/api/pricing/inflation-rate", selected?.countryCode, inflYearInt],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/inflation-rate/${selected!.countryCode}/${inflYearInt}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: copyOpen && copyInflationApply && validInflYear && !!selected,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const downloadExport = async (listId: string, listName: string) => {
    try {
      const res = await fetch(`/api/pricing/price-lists/${listId}/export`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `cennik-${listName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Export zlyhal", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportBusy(true);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/pricing/import-template", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Import zlyhal");
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists"] });
      setImportOpen(false);
      setImportFile(null);
      onSelect(data.priceListId);
      toast({ title: `Cenník „${data.name}" vytvorený (draft)` });
    } catch (e: any) {
      toast({ title: "Import zlyhal", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setImportBusy(false);
    }
  };

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name: copyName, fxRateMode: copyFxMode };
      if (needsFx && copyFxMode === "fixed") {
        const v = parseFloat(copyFxFixed);
        if (!Number.isFinite(v) || v <= 0) throw new Error(t.pricing.invalidNumber);
        payload.fxRateToEur = v;
      }
      if (copyInflationApply && validInflYear) {
        payload.inflationYear = inflYearInt;
        payload.inflationApply = true;
      }
      const res = await apiRequest("POST", `/api/pricing/price-lists/${selected!.id}/duplicate`, payload);
      return res.json() as Promise<PriceListRow>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists"] });
      setCopyOpen(false);
      onSelect(created.id);
      toast({ title: t.pricing.listCreated });
    },
    onError: (e: any) => toast({ title: t.pricing.updateFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/pricing/price-lists/${confirmDelete!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists"] });
      setConfirmDelete(null);
      onSelect(lists.find((l) => l.status === "active" && l.countryCode === selected?.countryCode)?.id ?? lists.find((l) => l.status === "active")?.id ?? "");
      toast({ title: t.pricing.listDeleted });
    },
    onError: (e: any) => toast({ title: t.pricing.updateFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const savePricesMutation = useMutation({
    mutationFn: () => {
      const collection: Array<{ id: string; price: number }> = [];
      const storage: Array<{ id: string; price: number }> = [];
      const discounts: Array<{ id: string; discountPct: number }> = [];
      const installments: Array<{ id: string; surchargePct: number }> = [];
      for (const [key, val] of Object.entries(edits)) {
        if (val === "") continue;
        const num = parseFloat(val);
        if (!Number.isFinite(num)) return Promise.reject(new Error(t.pricing.invalidNumber));
        if (key.startsWith("c:")) collection.push({ id: key.slice(2), price: num });
        else if (key.startsWith("s:")) storage.push({ id: key.slice(2), price: num });
        else if (key.startsWith("d:")) discounts.push({ id: key.slice(2), discountPct: num });
        else if (key.startsWith("i:")) installments.push({ id: key.slice(2), surchargePct: num });
        // md: prefix = max collection discount; empty string means clear (null), non-empty = set value
      }
      const maxDiscounts: Array<{ id: string; maxDiscountPct: number | null }> = [];
      for (const [key, val] of Object.entries(edits)) {
        if (!key.startsWith("md:")) continue;
        const id = key.slice(3);
        if (val === "") { maxDiscounts.push({ id, maxDiscountPct: null }); continue; }
        const num = parseFloat(val);
        if (!Number.isFinite(num) || num < 0 || num > 100) return Promise.reject(new Error(t.pricing.invalidNumber));
        maxDiscounts.push({ id, maxDiscountPct: num });
      }
      const rules: Array<{ id: string; enabled?: boolean; amount?: number | null; pct?: number | null; appliesTo?: string | null }> = [];
      for (const [id, r] of Object.entries(ruleEdits)) {
        const out: any = { id };
        if (r.enabled !== undefined) out.enabled = r.enabled;
        if (r.amount !== undefined) {
          if (r.amount === "") out.amount = null;
          else { const v = parseFloat(r.amount); if (!Number.isFinite(v)) return Promise.reject(new Error(t.pricing.invalidNumber)); out.amount = v; }
        }
        if (r.pct !== undefined) {
          if (r.pct === "") out.pct = null;
          else { const v = parseFloat(r.pct); if (!Number.isFinite(v)) return Promise.reject(new Error(t.pricing.invalidNumber)); out.pct = v; }
        }
        if (r.appliesTo !== undefined) out.appliesTo = r.appliesTo === "__any" ? null : r.appliesTo;
        if (r.volumeOperator !== undefined) {
          out.volumeOperator = r.volumeOperator;
          // server validates operator vs thresholds within the payload, so send the
          // effective (edited or existing) thresholds along with an operator change
          const rule = bundle?.adjustmentRules.find((ar) => ar.id === id);
          if (r.volumeMin === undefined && rule?.volumeMinMl != null) out.volumeMinMl = parseFloat(rule.volumeMinMl);
          if (r.volumeMax === undefined && rule?.volumeMaxMl != null) out.volumeMaxMl = parseFloat(rule.volumeMaxMl);
        }
        if (r.volumeMin !== undefined) {
          if (r.volumeMin === "") out.volumeMinMl = null;
          else { const v = parseFloat(r.volumeMin); if (!Number.isFinite(v)) return Promise.reject(new Error(t.pricing.invalidNumber)); out.volumeMinMl = v; }
        }
        if (r.volumeMax !== undefined) {
          if (r.volumeMax === "") out.volumeMaxMl = null;
          else { const v = parseFloat(r.volumeMax); if (!Number.isFinite(v)) return Promise.reject(new Error(t.pricing.invalidNumber)); out.volumeMaxMl = v; }
        }
        if (Object.keys(out).length > 1) rules.push(out);
      }
      const addDiscounts: Array<{ years: number; discountPct: number }> = [];
      for (const d of newDiscounts) {
        if (d.years === "" && d.pct === "") continue; // untouched blank row
        const years = parseInt(d.years, 10); const pct = parseFloat(d.pct);
        if (!Number.isInteger(years) || years <= 0 || !Number.isFinite(pct)) return Promise.reject(new Error(t.pricing.invalidNumber));
        addDiscounts.push({ years, discountPct: pct });
      }
      const addInstallments: Array<{ installments: number; surchargePct: number }> = [];
      for (const i of newInstallments) {
        if (i.count === "" && i.pct === "") continue;
        const count = parseInt(i.count, 10); const pct = parseFloat(i.pct);
        if (!Number.isInteger(count) || count <= 0 || !Number.isFinite(pct)) return Promise.reject(new Error(t.pricing.invalidNumber));
        addInstallments.push({ installments: count, surchargePct: pct });
      }
      return apiRequest("PATCH", `/api/pricing/price-lists/${selected!.id}/prices`, {
        collection, storage, discounts, installments, rules, maxDiscounts,
        addDiscounts, addInstallments,
        removeDiscounts: removedDiscounts, removeInstallments: removedInstallments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists", selected?.id] });
      setEditMode(false);
      setEdits({});
      setRuleEdits({});
      resetItemEdits();
      toast({ title: t.pricing.pricesSaved });
    },
    onError: (e: any) => toast({ title: t.pricing.updateFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const priceCell = (row: { id: string; price: string } | undefined, kind: "c" | "s") => {
    if (!row) return <span>—</span>;
    if (!editMode || !isEditableDraft) return <span>{fmt(row.price, undefined)}</span>;
    const key = `${kind}:${row.id}`;
    return (
      <Input type="number" step="0.01" className="h-8 w-24 ml-auto text-right"
        value={edits[key] ?? String(parseFloat(row.price))}
        onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))} />
    );
  };
  const countries = useMemo(() => Array.from(new Set(lists.map((l) => l.countryCode))), [lists]);
  // auto-select first country on load; sync when selected list is from a different country
  useEffect(() => {
    if (countries.length > 0 && (countryFilter === "all" || !countries.includes(countryFilter))) {
      setCountryFilter(countries[0]);
    }
  }, [countries]);
  useEffect(() => {
    if (selected && selected.countryCode !== countryFilter) setCountryFilter(selected.countryCode);
  }, [selected?.countryCode]);
  const filteredLists = countryFilter && countryFilter !== "all" ? lists.filter((l) => l.countryCode === countryFilter) : lists;

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/pricing/price-lists/${id}/status`, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists"] });
      setConfirmActivate(null);
      toast({ title: t.pricing.activated });
    },
    onError: (e: any) => toast({ title: t.pricing.updateFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const byCountry = useMemo(() => {
    const m = new Map<string, PriceListRow[]>();
    for (const l of filteredLists) { if (!m.has(l.countryCode)) m.set(l.countryCode, []); m.get(l.countryCode)!.push(l); }
    return Array.from(m.entries());
  }, [filteredLists]);

  const years = bundle?.priceList.storageYearOptions ?? [];
  const compById = new Map((bundle?.components ?? []).map((c) => [c.id, c]));
  const prodById = new Map((bundle?.products ?? []).map((p) => [p.id, p]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-base">{t.pricing.allPriceLists}</CardTitle>
          <div className="flex items-center gap-1 flex-wrap rounded-md border p-1 bg-muted/30">
            {countries.map((cc) => (
              <button key={cc} onClick={() => setCountryFilter(cc)} data-testid={`tab-lists-country-${cc}`}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${countryFilter === cc ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}>
                {COUNTRY_FLAGS[cc] ?? ""} {cc}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {byCountry.map(([cc, rows]) => (
            <div key={cc}>
              <div className="text-xs font-semibold text-muted-foreground mb-1">{COUNTRY_FLAGS[cc] ?? ""} {cc} · {rows[0]?.currency}</div>
              <div className="space-y-1">
                {rows.map((l) => (
                  <button key={l.id} onClick={() => onSelect(l.id)} data-testid={`row-price-list-${l.id}`}
                    className={`w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover-elevate ${l.id === selectedId ? "border-primary bg-primary/5" : ""}`}>
                    <span className="truncate">{l.name}</span>
                    <StatusBadge status={l.status} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {selected ? <>{COUNTRY_FLAGS[selected.countryCode]} {selected.name} <StatusBadge status={selected.status} /></> : t.pricing.selectList}
          </CardTitle>
          {selected && canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => downloadExport(selected.id, selected.name)}
                data-testid="button-export-list">
                <FileDown className="w-4 h-4" />XLS
              </Button>
              <Button size="sm" variant="outline"
                className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50"
                onClick={() => { setImportFile(null); setImportOpen(true); }}
                data-testid="button-import-list">
                <Upload className="w-4 h-4" />Import
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setCopyName(`${selected.name} (${t.pricing.copySuffix})`); setCopyOpen(true); }} data-testid="button-copy-list">
                <CopyPlus className="w-4 h-4 mr-1" />{t.pricing.copyList}
              </Button>
              {isEditableDraft && !editMode && (
                <Button size="sm" variant="outline" onClick={() => { setEdits({}); setRuleEdits({}); resetItemEdits(); setEditMode(true); }} data-testid="button-edit-prices">
                  <Pencil className="w-4 h-4 mr-1" />{t.pricing.editPrices}
                </Button>
              )}
              {isEditableDraft && editMode && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setEditMode(false); setEdits({}); setRuleEdits({}); resetItemEdits(); }}>
                    <X className="w-4 h-4 mr-1" />{t.pricing.cancel}
                  </Button>
                  <Button size="sm" onClick={() => savePricesMutation.mutate()} disabled={savePricesMutation.isPending} data-testid="button-save-prices">
                    {savePricesMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}{t.pricing.save}
                  </Button>
                </>
              )}
              {selected.status === "draft" && !editMode && (
                <>
                  <Button size="sm" onClick={() => setConfirmActivate(selected)} data-testid="button-activate">
                    <CheckCircle2 className="w-4 h-4 mr-1" />{t.pricing.activate}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(selected)} data-testid="button-delete-list">
                    <Trash2 className="w-4 h-4 mr-1" />{t.pricing.deleteList}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!bundle && <div className="text-sm text-muted-foreground">{t.pricing.loading}</div>}
          {bundle && (
            <>
              <div>
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{t.pricing.products}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.pricing.product}</TableHead>
                      <TableHead className="text-right">{t.pricing.collectionPrice}</TableHead>
                      <TableHead className="text-right text-xs">{t.pricing.maxCollDiscount}</TableHead>
                      {years.map((y) => <TableHead key={y} className="text-right">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.products.map((p) => {
                      const coll = bundle.collectionPrices.find((cp) => cp.productId === p.id);
                      if (!coll && !bundle.storagePrices.some((sp) => sp.productId === p.id)) return null;
                      const compIds = bundle.productComponents.filter((pc) => pc.productId === p.id).map((pc) => pc.componentId);
                      const codes = bundle.components.filter((c) => compIds.includes(c.id)).map((c) => c.code);
                      return (
                        <TableRow key={p.id} data-testid={`row-product-${p.code}`}>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-semibold ${productBadgeCls(codes)}`}>
                                <Package className="w-3.5 h-3.5" />{p.name}
                              </span>
                              <span className="flex items-center gap-1">{codes.map((c) => <CompChip key={c} code={c} small />)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{editMode && isEditableDraft ? priceCell(coll, "c") : fmt(coll?.price, bundle.priceList.currency)}</TableCell>
                          <TableCell className="text-right">
                            {editMode && isEditableDraft && coll ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input type="number" step="0.5" min="0" max="10" className="h-7 w-16 text-right"
                                  placeholder="—"
                                  value={edits[`md:${coll.id}`] ?? (coll.maxCollectionDiscountPct ? String(parseFloat(coll.maxCollectionDiscountPct)) : "")}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v) && v > 10) return;
                                    setEdits((s) => ({ ...s, [`md:${coll.id}`]: e.target.value }));
                                  }}
                                  data-testid={`input-max-discount-${p.code}`} />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            ) : coll?.maxCollectionDiscountPct ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                max {parseFloat(coll.maxCollectionDiscountPct)} %
                              </Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          {years.map((y) => {
                            const sp = bundle.storagePrices.find((s) => s.productId === p.id && s.years === y);
                            return <TableCell key={y} className="text-right">{editMode && isEditableDraft ? priceCell(sp, "s") : fmt(sp?.price, bundle.priceList.currency)}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Droplets className="w-4 h-4 text-rose-600 dark:text-rose-400" />{t.pricing.componentsStandalone}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.pricing.component}</TableHead>
                      <TableHead className="text-right">{t.pricing.collectionPrice}</TableHead>
                      <TableHead className="text-right text-xs">{t.pricing.maxCollDiscount}</TableHead>
                      {years.map((y) => <TableHead key={y} className="text-right">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.components.map((c) => {
                      const coll = bundle.collectionPrices.find((cp) => cp.componentId === c.id);
                      const hasStorage = bundle.storagePrices.some((sp) => sp.componentId === c.id);
                      if (!coll && !hasStorage) return null;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CompChip code={c.code} />
                              {c.name && c.name !== c.code && <span className="text-xs text-muted-foreground">{c.name}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{editMode && isEditableDraft ? priceCell(coll, "c") : fmt(coll?.price, bundle.priceList.currency)}</TableCell>
                          <TableCell className="text-right">
                            {editMode && isEditableDraft && coll ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input type="number" step="0.5" min="0" max={c.code === "PL" ? 5 : 10} className="h-7 w-16 text-right" placeholder="—"
                                  value={edits[`md:${coll.id}`] ?? (coll.maxCollectionDiscountPct ? String(parseFloat(coll.maxCollectionDiscountPct)) : "")}
                                  onChange={(e) => {
                                    const hardMax = c.code === "PL" ? 5 : 10;
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v) && v > hardMax) return;
                                    setEdits((s) => ({ ...s, [`md:${coll.id}`]: e.target.value }));
                                  }}
                                  data-testid={`input-max-discount-comp-${c.code}`} />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            ) : coll?.maxCollectionDiscountPct ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                max {parseFloat(coll.maxCollectionDiscountPct)} %
                              </Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          {years.map((y) => {
                            const sp = bundle.storagePrices.find((s) => s.componentId === c.id && s.years === y);
                            return <TableCell key={y} className="text-right">{editMode && isEditableDraft ? priceCell(sp, "s") : fmt(sp?.price, bundle.priceList.currency)}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(bundle.storageDiscounts.length > 0 || (editMode && isEditableDraft)) && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Percent className="w-4 h-4 text-green-600 dark:text-green-400" />{t.pricing.prepayDiscounts}</div>
                    <div className="flex flex-wrap gap-2">
                      {bundle.storageDiscounts.filter((d) => !removedDiscounts.includes(d.id)).map((d) => (
                        editMode && isEditableDraft ? (
                          <div key={d.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                            <span>{d.years}{t.pricing.yearsShort}: −</span>
                            <Input type="number" step="0.1" className="h-7 w-16 text-right"
                              value={edits[`d:${d.id}`] ?? String(parseFloat(d.discountPct))}
                              onChange={(e) => setEdits((s) => ({ ...s, [`d:${d.id}`]: e.target.value }))}
                              data-testid={`input-discount-${d.years}`} />
                            <span>%</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={() => setRemovedDiscounts((s) => [...s, d.id])} data-testid={`button-remove-discount-${d.years}`}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Badge key={d.id} variant="outline" className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                            {d.years}{t.pricing.yearsShort}: −{parseFloat(d.discountPct)} %
                          </Badge>
                        )
                      ))}
                      {editMode && isEditableDraft && newDiscounts.map((d, i) => (
                        <div key={`new-d-${i}`} className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-sm">
                          <Input type="number" step="1" min="1" className="h-7 w-14 text-right" placeholder={t.pricing.yearsShort}
                            value={d.years} onChange={(e) => setNewDiscounts((s) => s.map((x, j) => j === i ? { ...x, years: e.target.value } : x))}
                            data-testid={`input-new-discount-years-${i}`} />
                          <span>{t.pricing.yearsShort}: −</span>
                          <Input type="number" step="0.1" className="h-7 w-16 text-right" placeholder="%"
                            value={d.pct} onChange={(e) => setNewDiscounts((s) => s.map((x, j) => j === i ? { ...x, pct: e.target.value } : x))}
                            data-testid={`input-new-discount-pct-${i}`} />
                          <span>%</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            onClick={() => setNewDiscounts((s) => s.filter((_, j) => j !== i))}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      {editMode && isEditableDraft && (
                        <Button size="sm" variant="outline" className="h-8 border-dashed" onClick={() => setNewDiscounts((s) => [...s, { years: "", pct: "" }])} data-testid="button-add-discount">
                          <Plus className="w-3.5 h-3.5 mr-1" />{t.pricing.addDiscount}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {(bundle.installmentPlans.length > 0 || (editMode && isEditableDraft)) && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />{t.pricing.installments}</div>
                    <div className="flex flex-wrap gap-2">
                      {bundle.installmentPlans.filter((p) => !removedInstallments.includes(p.id)).map((p) => (
                        editMode && isEditableDraft ? (
                          <div key={p.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                            <span>{p.installments}× : +</span>
                            <Input type="number" step="0.1" className="h-7 w-16 text-right"
                              value={edits[`i:${p.id}`] ?? String(parseFloat(p.surchargePct))}
                              onChange={(e) => setEdits((s) => ({ ...s, [`i:${p.id}`]: e.target.value }))}
                              data-testid={`input-installment-${p.installments}`} />
                            <span>%</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={() => setRemovedInstallments((s) => [...s, p.id])} data-testid={`button-remove-installment-${p.installments}`}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Badge key={p.id} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            {p.installments}× : +{parseFloat(p.surchargePct)} %
                          </Badge>
                        )
                      ))}
                      {editMode && isEditableDraft && newInstallments.map((p, i) => (
                        <div key={`new-i-${i}`} className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-sm">
                          <Input type="number" step="1" min="1" className="h-7 w-14 text-right" placeholder="×"
                            value={p.count} onChange={(e) => setNewInstallments((s) => s.map((x, j) => j === i ? { ...x, count: e.target.value } : x))}
                            data-testid={`input-new-installment-count-${i}`} />
                          <span>× : +</span>
                          <Input type="number" step="0.1" className="h-7 w-16 text-right" placeholder="%"
                            value={p.pct} onChange={(e) => setNewInstallments((s) => s.map((x, j) => j === i ? { ...x, pct: e.target.value } : x))}
                            data-testid={`input-new-installment-pct-${i}`} />
                          <span>%</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            onClick={() => setNewInstallments((s) => s.filter((_, j) => j !== i))}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      {editMode && isEditableDraft && (
                        <Button size="sm" variant="outline" className="h-8 border-dashed" onClick={() => setNewInstallments((s) => [...s, { count: "", pct: "" }])} data-testid="button-add-installment">
                          <Plus className="w-3.5 h-3.5 mr-1" />{t.pricing.addInstallment}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {bundle.adjustmentRules.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" />{t.pricing.rulesTitle}</div>
                  <div className="space-y-2">
                    {bundle.adjustmentRules.map((r) => {
                      const edit = ruleEdits[r.id] ?? {};
                      const enabled = edit.enabled ?? r.enabled !== false;
                      const label = r.ruleType === "LOW_VOLUME" ? t.pricing.ruleLowVolume
                        : r.ruleType === "CONTAMINATION" ? t.pricing.ruleContamination
                        : r.ruleType === "FLAT_FEE" ? t.pricing.ruleFlatFee : r.ruleType;
                      const compCodes = bundle.components.map((c) => c.code);
                      const appliesToOptions = [...compCodes, ...(compCodes.length >= 2 ? [compCodes.slice(0, 2).join("+")] : [])];
                      const currentAppliesTo = edit.appliesTo ?? (r.appliesTo ?? "__any");
                      if (!editMode || !isEditableDraft) {
                        return (
                          <div key={r.id} className={`flex items-center gap-2 flex-wrap rounded-md border px-3 py-2 text-sm ${enabled ? "" : "opacity-50"}`}>
                            <span className="font-medium">{label}</span>
                            {r.ruleType === "LOW_VOLUME" && <Badge variant="outline">{volumeCondText(r.volumeOperator, r.volumeMinMl, r.volumeMaxMl)}</Badge>}
                            {!enabled && <Badge variant="secondary">{t.pricing.ruleDisabled}</Badge>}
                            {r.amount != null && <Badge variant="outline">−{fmt(r.amount, bundle.priceList.currency)}</Badge>}
                            {r.pct != null && <Badge variant="outline">{parseFloat(r.pct)} %</Badge>}
                            {r.appliesTo && <Badge variant="outline">{t.pricing.ruleAppliesTo}: {r.appliesTo}</Badge>}
                          </div>
                        );
                      }
                      return (
                        <div key={r.id} className="flex items-center gap-3 flex-wrap rounded-md border px-3 py-2 text-sm" data-testid={`row-rule-${r.ruleType}`}>
                          <Switch checked={enabled}
                            onCheckedChange={(v) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], enabled: v } }))}
                            data-testid={`switch-rule-${r.ruleType}`} />
                          <span className={`font-medium min-w-32 ${enabled ? "" : "opacity-50"}`}>{label}</span>
                          {r.ruleType === "LOW_VOLUME" && (() => {
                            const op = edit.volumeOperator ?? (r.volumeOperator ?? "lt");
                            const vMin = edit.volumeMin ?? (r.volumeMinMl != null ? String(parseFloat(r.volumeMinMl)) : "");
                            const vMax = edit.volumeMax ?? (r.volumeMaxMl != null ? String(parseFloat(r.volumeMaxMl)) : "");
                            return (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-xs">{t.pricing.ruleVolume}</span>
                                <Select value={op} onValueChange={(v) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], volumeOperator: v } }))} disabled={!enabled}>
                                  <SelectTrigger className="h-7 w-28" data-testid="select-volume-operator"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="lt">{t.pricing.volLt}</SelectItem>
                                    <SelectItem value="gt">{t.pricing.volGt}</SelectItem>
                                    <SelectItem value="between">{t.pricing.volBetween}</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(op === "gt" || op === "between") && (
                                  <Input type="number" step="0.1" className="h-7 w-20 text-right" disabled={!enabled} placeholder="ml"
                                    value={vMin} data-testid="input-volume-min"
                                    onChange={(e) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], volumeMin: e.target.value } }))} />
                                )}
                                {op === "between" && <span className="text-muted-foreground text-xs">–</span>}
                                {(op === "lt" || op === "between") && (
                                  <Input type="number" step="0.1" className="h-7 w-20 text-right" disabled={!enabled} placeholder="ml"
                                    value={vMax} data-testid="input-volume-max"
                                    onChange={(e) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], volumeMax: e.target.value } }))} />
                                )}
                                <span className="text-muted-foreground text-xs">ml</span>
                              </div>
                            );
                          })()}
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">{t.pricing.ruleAmount} ({bundle.priceList.currency})</span>
                            <Input type="number" step="0.01" className="h-7 w-24 text-right" disabled={!enabled}
                              value={edit.amount ?? (r.amount != null ? String(parseFloat(r.amount)) : "")}
                              onChange={(e) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], amount: e.target.value } }))} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">%</span>
                            <Input type="number" step="0.1" className="h-7 w-20 text-right" disabled={!enabled}
                              value={edit.pct ?? (r.pct != null ? String(parseFloat(r.pct)) : "")}
                              onChange={(e) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], pct: e.target.value } }))} />
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-muted-foreground text-xs shrink-0">{t.pricing.ruleAppliesTo}:</span>
                            {/* "Any" option */}
                            <label className={`flex items-center gap-1 text-xs rounded-sm px-1.5 py-0.5 cursor-pointer select-none border ${!currentAppliesTo || currentAppliesTo === "__any" ? "bg-primary/10 border-primary/30 text-primary font-medium" : "border-transparent text-muted-foreground"}`}>
                              <Checkbox
                                checked={!currentAppliesTo || currentAppliesTo === "__any"}
                                disabled={!enabled}
                                onCheckedChange={(v) => v && setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], appliesTo: "__any" } }))} />
                              {t.pricing.ruleAppliesToAny}
                            </label>
                            {compCodes.map((code) => {
                              const sel = currentAppliesTo && currentAppliesTo !== "__any" ? currentAppliesTo.split("+").includes(code) : false;
                              return (
                                <label key={code} className={`flex items-center gap-1 text-xs rounded-sm px-1.5 py-0.5 cursor-pointer select-none border ${sel ? "bg-primary/10 border-primary/30 text-primary font-medium" : "border-transparent text-muted-foreground"}`}>
                                  <Checkbox
                                    checked={sel}
                                    disabled={!enabled}
                                    onCheckedChange={(v) => {
                                      const cur = currentAppliesTo && currentAppliesTo !== "__any" ? new Set(currentAppliesTo.split("+").filter(Boolean)) : new Set<string>();
                                      if (v) cur.add(code); else cur.delete(code);
                                      const joined = [...cur].sort().join("+");
                                      setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], appliesTo: joined || "__any" } }));
                                    }} />
                                  <CompChip code={code} small />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {bundle.priceList.fxRateToEur && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>💱 1 EUR = {fmt(bundle.priceList.fxRateToEur)} {bundle.priceList.currency}</span>
                  {selected?.fxRateMode === "live" && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                      NBS live
                    </Badge>
                  )}
                  {selected?.fxRateMode === "fixed" && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                      {t.pricing.fxRateFixed}
                    </Badge>
                  )}
                </div>
              )}
              {selected?.inflationYear && selected.inflationRatePct && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>📈 {t.pricing.inflationSection} {selected.inflationYear}: {fmt(selected.inflationRatePct)} %</span>
                  {selected.inflationApply && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                      {t.pricing.inflationWillApply}
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={copyOpen} onOpenChange={(o) => { setCopyOpen(o); if (!o) { setCopyFxMode("fixed"); setCopyFxFixed(""); setCopyInflationApply(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.pricing.copyDialogTitle}</DialogTitle>
            <DialogDescription>{selected ? `${COUNTRY_FLAGS[selected.countryCode] ?? ""} ${selected.name} · ${selectedCurrency}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.pricing.newListName}</Label>
              <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} data-testid="input-copy-name" />
            </div>

            {/* FX rate section — only for non-EUR currencies */}
            {needsFx && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <span className="text-lg">💱</span>{t.pricing.fxRateSection}
                </div>
                <div className="flex gap-2">
                  {(["live", "fixed"] as const).map((mode) => (
                    <button key={mode} type="button"
                      onClick={() => setCopyFxMode(mode)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${copyFxMode === mode ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                      data-testid={`button-fx-mode-${mode}`}>
                      {mode === "live" ? t.pricing.fxRateLive : t.pricing.fxRateFixed}
                    </button>
                  ))}
                </div>
                {copyFxMode === "live" && (
                  <div className="text-xs text-muted-foreground">
                    {liveFxLoading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t.pricing.fxRateLoading}</span>
                      : liveFxData ? <span className="text-green-700 dark:text-green-400 font-medium">✓ NBS: 1 EUR = {fmt(liveFxData.rate)} {selectedCurrency}{liveFxData.rateDate ? ` (${liveFxData.rateDate})` : ""}</span>
                      : <span className="text-amber-600">{t.pricing.fxRateNotFound}</span>}
                  </div>
                )}
                {copyFxMode === "fixed" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">1 EUR =</span>
                    <Input type="number" step="0.0001" min="0" placeholder="napr. 25.35"
                      value={copyFxFixed} onChange={(e) => setCopyFxFixed(e.target.value)}
                      className="h-8" data-testid="input-fx-fixed" />
                    <span className="text-sm font-medium">{selectedCurrency}</span>
                  </div>
                )}
              </div>
            )}

            {/* Inflation section — optional */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <span className="text-lg">📈</span>{t.pricing.inflationSection}
                  <span className="text-xs font-normal text-muted-foreground ml-1">({t.pricing.optional})</span>
                </div>
                <Switch checked={copyInflationApply} onCheckedChange={setCopyInflationApply} data-testid="switch-inflation-apply" />
              </div>
              {copyInflationApply && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">{t.pricing.inflationYear}</Label>
                    <Input type="number" min="2000" max="2100" step="1" className="h-8 w-28"
                      value={copyInflationYear} onChange={(e) => setCopyInflationYear(e.target.value)}
                      data-testid="input-inflation-year" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!validInflYear ? null
                      : inflLoading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t.pricing.inflationLoading}</span>
                      : inflData ? <span className="text-green-700 dark:text-green-400 font-medium">✓ {inflData.rate} % ({inflData.source ?? selected?.countryCode}){" · "}{t.pricing.inflationWillApply}</span>
                      : <span className="text-amber-600">{t.pricing.inflationNotFound}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>{t.pricing.cancel}</Button>
            <Button onClick={() => duplicateMutation.mutate()}
              disabled={!copyName.trim() || duplicateMutation.isPending
                || (needsFx && copyFxMode === "fixed" && !copyFxFixed.trim())
                || (copyInflationApply && (!validInflYear || (!inflData && !inflLoading)))}
              data-testid="button-confirm-copy">
              {duplicateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.copyList}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.pricing.deleteList}</DialogTitle>
            <DialogDescription>
              {confirmDelete ? `${COUNTRY_FLAGS[confirmDelete.countryCode] ?? ""} ${confirmDelete.name}` : ""} — {t.pricing.deleteListConfirm}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>{t.pricing.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.deleteList}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmActivate} onOpenChange={(o) => !o && setConfirmActivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.pricing.activateConfirmTitle}</DialogTitle>
            <DialogDescription>{t.pricing.activateConfirmDesc}</DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t.pricing.activateWarning}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmActivate(null)}>{t.pricing.cancel}</Button>
            <Button onClick={() => confirmActivate && activateMutation.mutate(confirmActivate.id)} disabled={activateMutation.isPending} data-testid="button-confirm-activate">
              {activateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.activate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import template dialog ── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) { setImportOpen(false); setImportFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-600" />
              Import cenníka z XLS šablóny
            </DialogTitle>
            <DialogDescription>
              Nahraj XLS súbor exportovaný z Indexusu. Vytvorí sa nový <strong>draft</strong> cenník so všetkými cenami (a nákladmi ak boli nakonfigurované).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Súbor (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-sky-200 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700 file:cursor-pointer hover:file:bg-sky-100"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {importFile && (
              <div className="flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="truncate font-medium">{importFile.name}</span>
                <span className="shrink-0 text-sky-400">({(importFile.size / 1024).toFixed(0)} KB)</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }}>Zrušiť</Button>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
              disabled={!importFile || importBusy}
              onClick={handleImport}>
              {importBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importovať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================= TAB 2: incomplete-collection matrix =============================
function MatrixTab({ lists, products, canManage, toast }: { lists: PriceListRow[]; products: PricingProduct[]; canManage: boolean; toast: any }) {
  const { t } = useI18n();
  // include drafts so managers can edit incomplete-collection rules on draft lists
  const managedLists = useMemo(() => lists.filter((l) => l.status === "active" || l.status === "draft"), [lists]);
  const countriesInMatrix = useMemo(() => [...new Set(managedLists.map((l) => l.countryCode))], [managedLists]);
  const [country, setCountry] = useState<string>("SK");
  const listsForCountry = useMemo(() => managedLists.filter((l) => l.countryCode === country), [managedLists, country]);
  const [listId, setListId] = useState<string | null>(null);
  const list = listsForCountry.find((l) => l.id === listId)
    ?? listsForCountry.find((l) => l.status === "active")
    ?? listsForCountry[0]
    ?? null;
  // sync listId when country changes or lists load
  useEffect(() => {
    if (list && list.id !== listId) setListId(list.id);
  }, [list?.id]);

  const { data: bundle } = useQuery<Bundle>({
    queryKey: ["/api/pricing/price-lists", list?.id],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/price-lists/${list!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!list,
  });

  const [productCode, setProductCode] = useState<string>("");
  const productList = bundle?.products ?? [];
  // fall back to the first product when the stored code doesn't exist in the current list
  const selectedProduct = productList.find((p) => p.code === productCode) ?? productList[0];
  const effProductCode = selectedProduct?.code ?? "";
  const rules = (bundle?.incompleteRules ?? []).filter((r) => r.orderedProductId === selectedProduct?.id);
  const years = bundle?.priceList.storageYearOptions ?? [];
  const compCodeById = new Map((bundle?.components ?? []).map((c) => [c.id, c.code]));
  const orderedComponentCodes = (bundle?.productComponents ?? [])
    .filter((pc) => pc.productId === selectedProduct?.id)
    .map((pc) => compCodeById.get(pc.componentId))
    .filter(Boolean) as string[];

  const [editRule, setEditRule] = useState<Bundle["incompleteRules"][number] | null>(null);
  const [editColl, setEditColl] = useState("");
  const [editStorage, setEditStorage] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState("");

  // --- new combination dialog ---
  const [newCombOpen, setNewCombOpen] = useState(false);
  const [newCombSelected, setNewCombSelected] = useState<Set<string>>(new Set());
  const [newCombColl, setNewCombColl] = useState("");
  const [newCombStorage, setNewCombStorage] = useState<Record<string, string>>({});

  const openNewComb = () => {
    setNewCombSelected(new Set());
    setNewCombColl("");
    setNewCombStorage(Object.fromEntries(years.map((y) => [String(y), ""])));
    setNewCombOpen(true);
  };

  const addCombMutation = useMutation({
    mutationFn: () => {
      const coll = parseFloat(newCombColl);
      if (!Number.isFinite(coll)) return Promise.reject(new Error(t.pricing.invalidNumber));
      const storage = Object.fromEntries(
        Object.entries(newCombStorage).filter(([, v]) => v !== "").map(([k, v]) => {
          const n = parseFloat(v);
          if (!Number.isFinite(n)) throw new Error(t.pricing.invalidNumber);
          return [k, n];
        })
      );
      const mask = [...newCombSelected].sort().join("+");
      return apiRequest("POST", `/api/pricing/price-lists/${list!.id}/incomplete-rules`, {
        orderedProductId: selectedProduct!.id,
        collectedMask: mask,
        collectionPrice: coll,
        storagePrices: storage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists", list?.id] });
      setNewCombOpen(false);
      toast({ title: t.pricing.combinationAdded });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      const key = msg.toLowerCase().includes("already exists") ? t.pricing.combinationExists : msg;
      toast({ title: t.pricing.updateFailed, description: key, variant: "destructive" });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: () => {
      const coll = parseFloat(editColl);
      const storage = Object.fromEntries(Object.entries(editStorage).filter(([, v]) => v !== "").map(([k, v]) => [k, parseFloat(v)]));
      if (!Number.isFinite(coll) || Object.values(storage).some((v) => !Number.isFinite(v))) {
        return Promise.reject(new Error(t.pricing.invalidNumber));
      }
      return apiRequest("PATCH", `/api/pricing/incomplete-rules/${editRule!.id}`, {
        collectionPrice: coll,
        storagePrices: storage,
        note: editNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists", list?.id] });
      setEditRule(null);
      toast({ title: t.pricing.updated });
    },
    onError: (e: any) => toast({ title: t.pricing.updateFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const openEdit = (r: Bundle["incompleteRules"][number]) => {
    setEditRule(r);
    setEditColl(String(parseFloat(r.collectionPrice)));
    setEditStorage(Object.fromEntries(years.map((y) => [String(y), r.storagePrices?.[String(y)] !== undefined ? String(r.storagePrices[String(y)]) : ""])));
    setEditNote(r.note ?? "");
  };

  const adjRules = bundle?.adjustmentRules ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">{t.pricing.country}</Label>
          <div className="flex items-center gap-1 rounded-md border p-1" data-testid="tabs-matrix-country">
            {countriesInMatrix.map((cc) => (
              <button key={cc} onClick={() => setCountry(cc)} data-testid={`tab-matrix-country-${cc}`}
                className={`rounded px-3 py-1.5 text-sm font-medium hover-elevate ${country === cc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {COUNTRY_FLAGS[cc]} {cc}
              </button>
            ))}
          </div>
        </div>
        {listsForCountry.length > 1 && (
          <div>
            <Label className="text-xs">{t.pricing.priceList}</Label>
            <div className="flex items-center gap-1 rounded-md border p-1">
              {listsForCountry.map((l) => (
                <button key={l.id} onClick={() => setListId(l.id)} data-testid={`tab-matrix-list-${l.id}`}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium hover-elevate ${list?.id === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {l.name}
                  <span className={`rounded px-1.5 py-0.5 text-xs ${l.status === "draft" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"}`}>{l.status === "draft" ? t.pricing.statusDraft : t.pricing.statusActive}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs">{t.pricing.orderedProduct}</Label>
          <Select value={effProductCode} onValueChange={setProductCode}>
            <SelectTrigger className="w-64" data-testid="select-matrix-product"><SelectValue /></SelectTrigger>
            <SelectContent>
              {productList.map((p) => <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t.pricing.matrixTitle}</CardTitle>
            {canManage && list?.status === "draft" && selectedProduct && (
              <Button size="sm" variant="outline" onClick={openNewComb} data-testid="button-new-combination">
                <Plus className="w-4 h-4 mr-1" />{t.pricing.newCombination}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.pricing.collectedComponents}</TableHead>
                  <TableHead>{t.pricing.resultProduct}</TableHead>
                  <TableHead className="text-right">{t.pricing.collectionPrice}</TableHead>
                  {years.map((y) => <TableHead key={y} className="text-right">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</TableHead>)}
                  {canManage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id} data-testid={`row-matrix-${r.id}`}>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.collectedMask === "" ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">{t.pricing.nothingCollected}</Badge>
                        ) : orderedComponentCodes.map((c) => {
                          const present = r.collectedMask.split("+").includes(c);
                          return (
                            <span key={c} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${present
                              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "border-dashed bg-muted/40 text-muted-foreground line-through opacity-60"}`}>
                              {present ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{c}
                            </span>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={r.resultLabel !== selectedProduct?.name && r.resultLabel !== selectedProduct?.code ? "font-medium text-blue-700 dark:text-blue-300" : ""}>{r.resultLabel}</span>
                        {r.isOverride && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 cursor-help">{t.pricing.override}</Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{r.note ?? ""}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmt(r.collectionPrice, bundle?.priceList.currency)}</TableCell>
                    {years.map((y) => <TableCell key={y} className="text-right">{fmt(r.storagePrices?.[String(y)], bundle?.priceList.currency)}</TableCell>)}
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} data-testid={`button-edit-rule-${r.id}`}><Pencil className="w-4 h-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {rules.length === 0 && <TableRow><TableCell colSpan={5 + years.length} className="text-center text-sm text-muted-foreground">{t.pricing.noRules}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader><CardTitle className="text-base">{t.pricing.globalRules}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {adjRules.map((r, i) => (
              <div key={i} className="rounded-md border p-2.5">
                <div className="font-medium text-xs uppercase text-muted-foreground mb-1">
                  {r.ruleType === "LOW_VOLUME" ? t.pricing.ruleLowVolume : r.ruleType === "CONTAMINATION" ? t.pricing.ruleContamination : t.pricing.ruleFlatFee}
                </div>
                <div>
                  {r.amount && <span className="font-semibold">{fmt(r.amount, bundle?.priceList.currency)}</span>}
                  {r.pct && <span className="font-semibold">{parseFloat(r.pct)} %</span>}
                  {r.appliesTo && <span className="text-xs text-muted-foreground ml-1">({t.pricing.appliesTo}: {r.appliesTo})</span>}
                </div>
                {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}
              </div>
            ))}
            {adjRules.length === 0 && <div className="text-muted-foreground text-sm">—</div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editRule} onOpenChange={(o) => !o && setEditRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.pricing.editRow}</DialogTitle>
            <DialogDescription>{editRule?.resultLabel} — {editRule?.collectedMask || t.pricing.nothingCollected}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t.pricing.collectionPrice} ({bundle?.priceList.currency})</Label>
              <Input type="number" step="0.01" value={editColl} onChange={(e) => setEditColl(e.target.value)} data-testid="input-override-collection" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {years.map((y) => (
                <div key={y}>
                  <Label className="text-xs">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</Label>
                  <Input type="number" step="0.01" value={editStorage[String(y)] ?? ""} onChange={(e) => setEditStorage((s) => ({ ...s, [String(y)]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div>
              <Label>{t.pricing.overrideNote} *</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder={t.pricing.overrideNotePlaceholder} data-testid="input-override-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRule(null)}>{t.pricing.cancel}</Button>
            <Button onClick={() => overrideMutation.mutate()} disabled={!editNote.trim() || overrideMutation.isPending} data-testid="button-save-override">
              {overrideMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New combination dialog */}
      <Dialog open={newCombOpen} onOpenChange={(o) => !o && setNewCombOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.pricing.newCombination}</DialogTitle>
            <DialogDescription>{selectedProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">{t.pricing.selectComponents}</Label>
              <div className="flex flex-wrap gap-2">
                {orderedComponentCodes.map((code) => {
                  const sel = newCombSelected.has(code);
                  return (
                    <label key={code} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer select-none transition-colors ${sel ? "bg-primary/10 border-primary text-primary font-medium" : "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                      <Checkbox checked={sel} onCheckedChange={(v) => {
                        const next = new Set(newCombSelected);
                        if (v) next.add(code); else next.delete(code);
                        setNewCombSelected(next);
                      }} />
                      <CompChip code={code} small />
                    </label>
                  );
                })}
              </div>
              {newCombSelected.size === 0 && (
                <p className="text-xs text-muted-foreground mt-1">{t.pricing.nothingCollected} — {t.pricing.combinationExists.toLowerCase()}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">{t.pricing.collectionPrice} ({bundle?.priceList.currency})</Label>
              <Input type="number" step="0.01" value={newCombColl} onChange={(e) => setNewCombColl(e.target.value)} data-testid="input-new-comb-collection" />
            </div>
            {years.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {years.map((y) => (
                  <div key={y}>
                    <Label className="text-xs">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</Label>
                    <Input type="number" step="0.01" value={newCombStorage[String(y)] ?? ""}
                      onChange={(e) => setNewCombStorage((s) => ({ ...s, [String(y)]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCombOpen(false)}>{t.pricing.cancel}</Button>
            <Button onClick={() => addCombMutation.mutate()} disabled={addCombMutation.isPending || !newCombColl} data-testid="button-save-new-comb">
              {addCombMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// equal monthly installments starting today; rounding remainder goes to the last one
function buildInstallmentSchedule(total: number, count: number): Array<{ n: number; date: Date; amount: number }> {
  const base = Math.floor((total / count) * 100) / 100;
  const rows: Array<{ n: number; date: Date; amount: number }> = [];
  const start = new Date();
  for (let i = 0; i < count; i++) {
    // clamp to the last day of the target month (Jan 31 + 1m -> Feb 28/29, not Mar 3)
    const lastDay = new Date(start.getFullYear(), start.getMonth() + i + 1, 0).getDate();
    const date = new Date(start.getFullYear(), start.getMonth() + i, Math.min(start.getDate(), lastDay));
    const amount = i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base;
    rows.push({ n: i + 1, date, amount });
  }
  return rows;
}

// ============================= TAB 3: calculator =============================
function CalculatorTab({ lists, products }: { lists: PriceListRow[]; products: PricingProduct[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const activeLists = useMemo(() => lists.filter((l) => l.status === "active"), [lists]);
  const [country, setCountry] = useState("SK");
  const list = activeLists.find((l) => l.countryCode === country) ?? activeLists[0] ?? null;
  const years = list?.storageYearOptions ?? [1, 10, 20];

  const [productCode, setProductCode] = useState("");
  const effProductCode = productCode || products[0]?.code || "";
  const product = products.find((p) => p.code === effProductCode);
  const productComponents = product?.componentCodes ?? [];

  const [collected, setCollected] = useState<string[] | null>(null); // null = complete
  const effCollected = collected ?? productComponents;
  const [contaminated, setContaminated] = useState<string[]>([]);
  const [lowVolume, setLowVolume] = useState(false);
  const { data: calcBundle } = useQuery<Bundle>({
    queryKey: ["/api/pricing/price-lists", list?.id],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/price-lists/${list!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!list?.id,
  });
  const lowVolumeRule = calcBundle?.adjustmentRules.find((r) => r.ruleType === "LOW_VOLUME" && r.enabled !== false) ?? null;
  // max collection discount for the currently selected product
  const calcProduct = calcBundle?.products.find((p) => p.code === effProductCode);
  const calcCollRow = calcProduct ? calcBundle?.collectionPrices.find((cp) => cp.productId === calcProduct.id) : null;
  const maxCollDiscountPct = calcCollRow?.maxCollectionDiscountPct ? parseFloat(calcCollRow.maxCollectionDiscountPct) : 0;

  const [storageYears, setStorageYears] = useState<number | null>(null);
  const effYears = storageYears && years.includes(storageYears) ? storageYears : years[years.length - 1];

  // installment plans available in the selected price list (1 = one-time always included)
  const availableInstallmentCounts = useMemo(() => {
    const fromList = (calcBundle?.installmentPlans ?? []).map((p) => p.installments);
    return [1, ...fromList.filter((n) => n !== 1).sort((a, b) => a - b)];
  }, [calcBundle?.installmentPlans]);

  const [installments, setInstallments] = useState(1);
  // reset to 1 when the selected count is no longer offered by the new price list
  useEffect(() => {
    if (!availableInstallmentCounts.includes(installments)) {
      setInstallments(1);
      setResult(null);
    }
  }, [availableInstallmentCounts]);

  const [collectionDiscount, setCollectionDiscount] = useState(0);
  // clamp when product changes and the new max is lower than the current value
  useEffect(() => {
    setCollectionDiscount((prev) => Math.min(prev, maxCollDiscountPct));
    setResult(null);
  }, [maxCollDiscountPct]);

  // per-component discounts: components in the current price list that have maxCollectionDiscountPct > 0
  const componentMaxDiscounts = useMemo(() => {
    if (!calcBundle) return [];
    return effCollected.flatMap((code) => {
      const comp = calcBundle.components.find((c) => c.code === code);
      if (!comp) return [];
      const cp = calcBundle.collectionPrices.find((p) => p.componentId === comp.id);
      const max = cp?.maxCollectionDiscountPct ? parseFloat(cp.maxCollectionDiscountPct) : 0;
      if (max <= 0) return [];
      return [{ code, name: comp.name, max }];
    });
  }, [calcBundle, effCollected]);

  const [componentDiscounts, setComponentDiscounts] = useState<Record<string, number>>({});
  // reset/clamp component discounts when collected set or available maxes change
  useEffect(() => {
    setComponentDiscounts((prev) => {
      const next: Record<string, number> = {};
      for (const { code, max } of componentMaxDiscounts) {
        next[code] = Math.min(prev[code] ?? 0, max);
      }
      return next;
    });
    setResult(null);
  }, [componentMaxDiscounts]);

  const [result, setResult] = useState<CalcResult | null>(null);

  const calcMutation = useMutation({
    mutationFn: async () => {
      const activeCompDiscounts = Object.fromEntries(
        Object.entries(componentDiscounts).filter(([, v]) => v > 0),
      );
      const res = await apiRequest("POST", "/api/pricing/calculate", {
        countryCode: list?.countryCode,
        productCode: effProductCode,
        storageYears: effYears,
        installments,
        collected: effCollected,
        contaminated: contaminated.filter((c) => effCollected.includes(c)),
        lowVolume,
        ...(collectionDiscount > 0 ? { collectionDiscountPct: collectionDiscount } : {}),
        ...(Object.keys(activeCompDiscounts).length > 0 ? { componentDiscountPcts: activeCompDiscounts } : {}),
      });
      return res.json() as Promise<CalcResult>;
    },
    onSuccess: (r) => setResult(r),
    onError: (e: any) => toast({ title: t.pricing.calcFailed, description: String(e?.message ?? e), variant: "destructive" }),
  });

  const toggleCollected = (code: string) => {
    const next = effCollected.includes(code) ? effCollected.filter((c) => c !== code) : [...effCollected, code];
    setCollected(next);
    setContaminated((prev) => prev.filter((c) => next.includes(c)));
  };

  const copyBreakdown = () => {
    if (!result) return;
    const lines = result.lineItems.map((li) => `${li.label}\t${li.amount.toFixed(2)} ${li.currency}\t${li.reason}`);
    lines.push(`${t.pricing.total}\t${result.total.toFixed(2)} ${result.currency}`);
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: t.pricing.copied });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t.pricing.calcInputs}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.pricing.country}</Label>
              <Select value={list?.countryCode ?? ""} onValueChange={(v) => { setCountry(v); setResult(null); }}>
                <SelectTrigger data-testid="select-calc-country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeLists.map((l) => <SelectItem key={l.id} value={l.countryCode}>{COUNTRY_FLAGS[l.countryCode]} {l.countryCode} ({l.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.pricing.orderedProduct}</Label>
              <Select value={effProductCode} onValueChange={(v) => { setProductCode(v); setCollected(null); setContaminated([]); setResult(null); }}>
                <SelectTrigger data-testid="select-calc-product"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">{t.pricing.calcCollected}</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {productComponents.map((code) => {
                const on = effCollected.includes(code);
                const cont = contaminated.includes(code);
                return (
                  <div key={code} className={`flex items-center overflow-hidden rounded-full border text-sm font-medium transition-colors ${on
                    ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-900/30"
                    : "border-dashed bg-muted/40 opacity-70"}`}>
                    <button type="button" onClick={() => { toggleCollected(code); setResult(null); }} data-testid={`chip-collected-${code}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 hover-elevate ${on ? "text-green-800 dark:text-green-300" : "text-muted-foreground line-through"}`}>
                      {on ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}{code}
                    </button>
                    {on && (
                      <button type="button" onClick={() => { setContaminated((p) => p.includes(code) ? p.filter((c) => c !== code) : [...p, code]); setResult(null); }}
                        data-testid={`chip-contaminated-${code}`}
                        className={`border-l px-2 py-1.5 text-xs hover-elevate ${cont ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "text-muted-foreground"}`}>
                        ☣ {t.pricing.contaminatedLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{t.pricing.chipHint}</div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label className="text-sm">{t.pricing.calcLowVolume}{lowVolumeRule ? ` (${volumeCondText(lowVolumeRule.volumeOperator, lowVolumeRule.volumeMinMl, lowVolumeRule.volumeMaxMl)})` : ""}</Label>
            <Switch checked={lowVolume} onCheckedChange={(v) => { setLowVolume(v); setResult(null); }} data-testid="switch-low-volume" />
          </div>

          {(maxCollDiscountPct > 0 || componentMaxDiscounts.length > 0) && (
            <div className="rounded-md border px-3 py-2 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                <Percent className="w-3.5 h-3.5" />
                {t.pricing.componentDiscountSection}
              </div>

              {maxCollDiscountPct > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1.5">
                      {t.pricing.collDiscountLabel}
                      <span className="text-xs text-muted-foreground">({t.pricing.collDiscountHint.replace("%d", String(maxCollDiscountPct))})</span>
                    </Label>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400 min-w-[2.5rem] text-right">
                      {collectionDiscount > 0 ? `−${collectionDiscount} %` : "—"}
                    </span>
                  </div>
                  <input type="range" min="0" max={maxCollDiscountPct} step="0.5"
                    value={collectionDiscount}
                    onChange={(e) => { setCollectionDiscount(Number(e.target.value)); setResult(null); }}
                    className="w-full accent-green-600" data-testid="slider-collection-discount" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0 %</span><span>{maxCollDiscountPct} %</span>
                  </div>
                </div>
              )}

              {componentMaxDiscounts.map(({ code, name, max }) => {
                const val = componentDiscounts[code] ?? 0;
                return (
                  <div key={code} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <CompChip code={code} small />
                        <span className="text-xs text-muted-foreground">({t.pricing.componentDiscountHint.replace("%d", String(max))})</span>
                      </Label>
                      <span className={`text-sm font-semibold min-w-[2.5rem] text-right ${val > 0 ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                        {val > 0 ? `−${val} %` : "—"}
                      </span>
                    </div>
                    <input type="range" min="0" max={max} step="0.5"
                      value={val}
                      onChange={(e) => { setComponentDiscounts((p) => ({ ...p, [code]: Number(e.target.value) })); setResult(null); }}
                      className="w-full accent-green-600" data-testid={`slider-comp-discount-${code}`} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0 %</span><span>{max} %</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.pricing.calcStorageYears}</Label>
              <Select value={String(effYears)} onValueChange={(v) => { setStorageYears(Number(v)); setResult(null); }}>
                <SelectTrigger data-testid="select-calc-years"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y} {t.pricing.yearsWord}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.pricing.calcInstallments}</Label>
              <Select value={String(installments)} onValueChange={(v) => { setInstallments(Number(v)); setResult(null); }}>
                <SelectTrigger data-testid="select-calc-installments"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableInstallmentCounts.map((n) => {
                    const plan = calcBundle?.installmentPlans.find((p) => p.installments === n);
                    const surcharge = plan ? ` (+${parseFloat(plan.surchargePct)} %)` : "";
                    return (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? t.pricing.oneTimePayment : `${n}×${surcharge}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending || !list} data-testid="button-calculate">
            {calcMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.calculate}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.pricing.resultTitle}</CardTitle>
          {result && (
            <Button variant="outline" size="sm" onClick={copyBreakdown} data-testid="button-copy-breakdown"><Copy className="w-4 h-4 mr-1" />{t.pricing.copyBreakdown}</Button>
          )}
        </CardHeader>
        <CardContent>
          {!result && <div className="text-sm text-muted-foreground">{t.pricing.noResultYet}</div>}
          {result && (
            <div className="space-y-4" data-testid="calc-result">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{COUNTRY_FLAGS[result.countryCode]} {result.countryCode}</Badge>
                <Badge variant="outline">{t.pricing.orderedProduct}: {result.orderedProduct}</Badge>
                {result.effectiveProduct !== result.orderedProduct && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{t.pricing.effectiveProduct}: {result.effectiveProduct}</Badge>
                )}
              </div>
              <div className="space-y-2">
                {result.lineItems.map((li, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{li.label}</div>
                      <div className="text-xs text-muted-foreground">{li.reason}</div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ${li.amount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{fmt(li.amount, li.currency)}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.pricing.subtotalCollection}</span><span>{fmt(result.totalCollection, result.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.pricing.subtotalStorage}</span><span>{fmt(result.totalStorage, result.currency)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-1.5"><span>{t.pricing.total}</span><span data-testid="text-total">{fmt(result.total, result.currency)}</span></div>
                {result.totalEur !== null && result.currency !== "EUR" && (
                  <div className="flex justify-between text-xs text-muted-foreground"><span>≈ EUR</span><span>{fmt(result.totalEur, "EUR")}</span></div>
                )}
              </div>
              {installments > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"><CalendarDays className="w-4 h-4" />{t.pricing.installmentSchedule}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{t.pricing.dueDate}</TableHead>
                        <TableHead className="text-right">{t.pricing.amount}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildInstallmentSchedule(result.total, installments).map((row) => (
                        <TableRow key={row.n}>
                          <TableCell className="text-muted-foreground">{row.n}.</TableCell>
                          <TableCell>{row.date.toLocaleDateString("sk-SK")}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(row.amount, result.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {result.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc pl-4 text-xs space-y-0.5">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
