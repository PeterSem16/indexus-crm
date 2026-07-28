import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Copy, AlertTriangle, CheckCircle2, Check, X, Pencil, Calculator as CalcIcon, ListOrdered, Grid3X3, CopyPlus, CalendarDays } from "lucide-react";

// ---------- types (mirror server /api/pricing responses) ----------
interface PriceListRow {
  id: string; countryCode: string; currency: string; name: string; status: string;
  validFrom: string | null; fxRateToEur: string | null; inflationRatePct: string | null;
  storageYearOptions: number[] | null;
}
interface PricingProduct { id: string; code: string; name: string; componentCodes: string[] }
interface Bundle {
  priceList: { id: string; countryCode: string; currency: string; name: string; fxRateToEur: string | null; storageYearOptions: number[] | null };
  products: Array<{ id: string; code: string; name: string }>;
  components: Array<{ id: string; code: string; name: string }>;
  productComponents: Array<{ productId: string; componentId: string }>;
  collectionPrices: Array<{ id: string; productId: string | null; componentId: string | null; price: string; note: string | null }>;
  storagePrices: Array<{ id: string; productId: string | null; componentId: string | null; years: number; price: string }>;
  storageDiscounts: Array<{ id: string; years: number; discountPct: string }>;
  installmentPlans: Array<{ id: string; installments: number; surchargePct: string }>;
  incompleteRules: Array<{ id: string; orderedProductId: string; collectedMask: string; resultLabel: string; collectionPrice: string; storagePrices: Record<string, number> | null; isOverride: boolean; note: string | null }>;
  adjustmentRules: Array<{ id: string; ruleType: string; amount: string | null; pct: string | null; appliesTo?: string | null; note: string | null; enabled?: boolean | null }>;
}
interface CalcResult {
  priceListId: string; countryCode: string; currency: string;
  orderedProduct: string; effectiveProduct: string; collectedMask: string;
  lineItems: Array<{ kind: string; label: string; amount: number; currency: string; reason: string }>;
  totalCollection: number; totalStorage: number; total: number; totalEur: number | null; warnings: string[];
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
      </Tabs>
    </div>
  );
}

// ============================= TAB 1: price lists =============================
function PriceListsTab({ lists, loading, selectedId, onSelect, bundle, canManage, toast }: {
  lists: PriceListRow[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void;
  bundle: Bundle | undefined; canManage: boolean; toast: any;
}) {
  const { t } = useI18n();
  const [confirmActivate, setConfirmActivate] = useState<PriceListRow | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  // adjustment-rule edits keyed by rule id: enabled toggle + amount/pct/appliesTo values
  const [ruleEdits, setRuleEdits] = useState<Record<string, { enabled?: boolean; amount?: string; pct?: string; appliesTo?: string }>>({});
  const selected = lists.find((l) => l.id === selectedId) ?? null;
  const isEditableDraft = !!selected && selected.status === "draft" && canManage;

  // switching lists must drop any in-progress edits, or stale row ids from the
  // previous list would be submitted (server ignores them → silent no-op save)
  useEffect(() => {
    setEditMode(false);
    setEdits({});
    setRuleEdits({});
  }, [selectedId]);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pricing/price-lists/${selected!.id}/duplicate`, { name: copyName });
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
        if (Object.keys(out).length > 1) rules.push(out);
      }
      return apiRequest("PATCH", `/api/pricing/price-lists/${selected!.id}/prices`, { collection, storage, discounts, installments, rules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/price-lists", selected?.id] });
      setEditMode(false);
      setEdits({});
      setRuleEdits({});
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
  const filteredLists = countryFilter === "all" ? lists : lists.filter((l) => l.countryCode === countryFilter);

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
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{t.pricing.allPriceLists}</CardTitle>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger data-testid="select-lists-country-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.pricing.allCountries}</SelectItem>
              {countries.map((cc) => <SelectItem key={cc} value={cc}>{COUNTRY_FLAGS[cc] ?? ""} {cc}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <Button size="sm" variant="outline" onClick={() => { setCopyName(`${selected.name} (${t.pricing.copySuffix})`); setCopyOpen(true); }} data-testid="button-copy-list">
                <CopyPlus className="w-4 h-4 mr-1" />{t.pricing.copyList}
              </Button>
              {isEditableDraft && !editMode && (
                <Button size="sm" variant="outline" onClick={() => { setEdits({}); setRuleEdits({}); setEditMode(true); }} data-testid="button-edit-prices">
                  <Pencil className="w-4 h-4 mr-1" />{t.pricing.editPrices}
                </Button>
              )}
              {isEditableDraft && editMode && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setEditMode(false); setEdits({}); setRuleEdits({}); }}>
                    <X className="w-4 h-4 mr-1" />{t.pricing.cancel}
                  </Button>
                  <Button size="sm" onClick={() => savePricesMutation.mutate()} disabled={savePricesMutation.isPending} data-testid="button-save-prices">
                    {savePricesMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}{t.pricing.save}
                  </Button>
                </>
              )}
              {selected.status === "draft" && !editMode && (
                <Button size="sm" onClick={() => setConfirmActivate(selected)} data-testid="button-activate">
                  <CheckCircle2 className="w-4 h-4 mr-1" />{t.pricing.activate}
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!bundle && <div className="text-sm text-muted-foreground">{t.pricing.loading}</div>}
          {bundle && (
            <>
              <div>
                <div className="text-sm font-semibold mb-2">{t.pricing.products}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.pricing.product}</TableHead>
                      <TableHead className="text-right">{t.pricing.collectionPrice}</TableHead>
                      {years.map((y) => <TableHead key={y} className="text-right">{t.pricing.storageShort} {y}{t.pricing.yearsShort}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.products.map((p) => {
                      const coll = bundle.collectionPrices.find((cp) => cp.productId === p.id);
                      if (!coll && !bundle.storagePrices.some((sp) => sp.productId === p.id)) return null;
                      return (
                        <TableRow key={p.id} data-testid={`row-product-${p.code}`}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{editMode && isEditableDraft ? priceCell(coll, "c") : fmt(coll?.price, bundle.priceList.currency)}</TableCell>
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
                <div className="text-sm font-semibold mb-2">{t.pricing.componentsStandalone}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.pricing.component}</TableHead>
                      <TableHead className="text-right">{t.pricing.collectionPrice}</TableHead>
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
                          <TableCell className="font-medium">{c.code}</TableCell>
                          <TableCell className="text-right">{editMode && isEditableDraft ? priceCell(coll, "c") : fmt(coll?.price, bundle.priceList.currency)}</TableCell>
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
                {bundle.storageDiscounts.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2">{t.pricing.prepayDiscounts}</div>
                    <div className="flex flex-wrap gap-2">
                      {bundle.storageDiscounts.map((d) => (
                        editMode && isEditableDraft ? (
                          <div key={d.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                            <span>{d.years}{t.pricing.yearsShort}: −</span>
                            <Input type="number" step="0.1" className="h-7 w-16 text-right"
                              value={edits[`d:${d.id}`] ?? String(parseFloat(d.discountPct))}
                              onChange={(e) => setEdits((s) => ({ ...s, [`d:${d.id}`]: e.target.value }))}
                              data-testid={`input-discount-${d.years}`} />
                            <span>%</span>
                          </div>
                        ) : (
                          <Badge key={d.id} variant="outline">{d.years}{t.pricing.yearsShort}: −{parseFloat(d.discountPct)} %</Badge>
                        )
                      ))}
                    </div>
                  </div>
                )}
                {bundle.installmentPlans.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2">{t.pricing.installments}</div>
                    <div className="flex flex-wrap gap-2">
                      {bundle.installmentPlans.map((p) => (
                        editMode && isEditableDraft ? (
                          <div key={p.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                            <span>{p.installments}× : +</span>
                            <Input type="number" step="0.1" className="h-7 w-16 text-right"
                              value={edits[`i:${p.id}`] ?? String(parseFloat(p.surchargePct))}
                              onChange={(e) => setEdits((s) => ({ ...s, [`i:${p.id}`]: e.target.value }))}
                              data-testid={`input-installment-${p.installments}`} />
                            <span>%</span>
                          </div>
                        ) : (
                          <Badge key={p.id} variant="outline">{p.installments}× : +{parseFloat(p.surchargePct)} %</Badge>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {bundle.adjustmentRules.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">{t.pricing.rulesTitle}</div>
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
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">{t.pricing.ruleAppliesTo}</span>
                            <Select value={currentAppliesTo} onValueChange={(v) => setRuleEdits((s) => ({ ...s, [r.id]: { ...s[r.id], appliesTo: v } }))} disabled={!enabled}>
                              <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__any">{t.pricing.ruleAnyComponent}</SelectItem>
                                {appliesToOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {bundle.priceList.fxRateToEur && (
                <div className="text-xs text-muted-foreground">{t.pricing.fxRate}: 1 EUR = {fmt(bundle.priceList.fxRateToEur)} {bundle.priceList.currency}</div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.pricing.copyDialogTitle}</DialogTitle>
            <DialogDescription>{selected ? `${COUNTRY_FLAGS[selected.countryCode] ?? ""} ${selected.name}` : ""}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>{t.pricing.newListName}</Label>
            <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} data-testid="input-copy-name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>{t.pricing.cancel}</Button>
            <Button onClick={() => duplicateMutation.mutate()} disabled={!copyName.trim() || duplicateMutation.isPending} data-testid="button-confirm-copy">
              {duplicateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t.pricing.copyList}
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
    </div>
  );
}

// ============================= TAB 2: incomplete-collection matrix =============================
function MatrixTab({ lists, products, canManage, toast }: { lists: PriceListRow[]; products: PricingProduct[]; canManage: boolean; toast: any }) {
  const { t } = useI18n();
  const activeByCountry = useMemo(() => lists.filter((l) => l.status === "active"), [lists]);
  const [country, setCountry] = useState<string>("SK");
  const list = activeByCountry.find((l) => l.countryCode === country) ?? activeByCountry[0] ?? null;

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
            {activeByCountry.map((l) => (
              <button key={l.id} onClick={() => setCountry(l.countryCode)} data-testid={`tab-matrix-country-${l.countryCode}`}
                className={`rounded px-3 py-1.5 text-sm font-medium hover-elevate ${list?.countryCode === l.countryCode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {COUNTRY_FLAGS[l.countryCode]} {l.countryCode}
              </button>
            ))}
          </div>
        </div>
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
          <CardHeader><CardTitle className="text-base">{t.pricing.matrixTitle}</CardTitle></CardHeader>
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
  const [storageYears, setStorageYears] = useState<number | null>(null);
  const effYears = storageYears && years.includes(storageYears) ? storageYears : years[years.length - 1];
  const [installments, setInstallments] = useState(1);
  const [result, setResult] = useState<CalcResult | null>(null);

  const calcMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing/calculate", {
        countryCode: list?.countryCode,
        productCode: effProductCode,
        storageYears: effYears,
        installments,
        collected: effCollected,
        contaminated: contaminated.filter((c) => effCollected.includes(c)),
        lowVolume,
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
            <Label className="text-sm">{t.pricing.calcLowVolume}</Label>
            <Switch checked={lowVolume} onCheckedChange={(v) => { setLowVolume(v); setResult(null); }} data-testid="switch-low-volume" />
          </div>

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
                  {[1, 2, 3, 4, 6, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n === 1 ? t.pricing.oneTimePayment : `${n}×`}</SelectItem>)}
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
