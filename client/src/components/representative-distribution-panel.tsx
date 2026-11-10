import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

type Rep = { id: string; name: string; isActive: boolean; eligible: boolean; countries: string[] };
type Group = { countryCode: string; region: string; count: number };
type Kind = "assign" | "departure" | "temporary";
type Plan = { id: string; kind: Kind; startsAt: string; endsAt: string | null; sourceName: string | null;
  pending: number; active: number; completed: number; skipped: number; conflict: number };
const keyFor = (g: Group) => JSON.stringify([g.countryCode, g.region || ""]);
const api = "/api/representatives/distribution";
async function request(path: string, body?: unknown) {
  const response = await fetch(path, { credentials: "include", ...(body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.code || "error");
  }
  return response.json();
}
export function RepresentativeDistributionPanel({ entity, criteria }: { entity: "clinic" | "hospital"; criteria: any }) {
  const { t, locale } = useI18n(), c = t.representativeDistribution, p = t.representantPanel;
  const { toast } = useToast(), qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("assign"), [source, setSource] = useState("");
  const [now, setNow] = useState(true), [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [regions, setRegions] = useState<{ key: string; groups: Group[] } | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ key: string; affected: number; unchanged: number; fingerprint: string } | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const baseKey = JSON.stringify({ entity, criteria, kind, source });
  const selectionKey = JSON.stringify({ baseKey, targets, now, start, end });
  const liveBase = useRef(baseKey), liveKey = useRef(selectionKey);
  liveBase.current = baseKey; liveKey.current = selectionKey;
  useEffect(() => { setRegions(null); setTargets({}); setPreview(null); }, [baseKey]);
  const countries = Array.isArray(criteria.countryScope) ? criteria.countryScope.join(",") : "";
  const suffix = countries ? `&countries=${encodeURIComponent(countries)}` : "";
  const users = useQuery<Rep[]>({ queryKey: [api + "/users", countries], queryFn: () => request(api + "/users" + (countries ? "?countries=" + encodeURIComponent(countries) : "")) });
  const plans = useQuery<Plan[]>({ queryKey: [api + "/plans", entity, countries],
    queryFn: () => request(`${api}/plans?entity=${entity}${suffix}`), refetchInterval: 30000 });
  const reps = users.data || [];
  const groups = regions?.key === baseKey ? regions.groups : [];
  const input = () => ({
    entity, criteria, kind, fromUserId: source || undefined,
    startsAt: kind === "temporary" && !now && start ? new Date(start).toISOString() : undefined,
    endsAt: kind === "temporary" && end ? new Date(end).toISOString() : undefined,
    regions: groups.filter(g => targets[keyFor(g)]).map(g => ({ countryCode: g.countryCode, region: g.region, userId: targets[keyFor(g)] })),
  });
  const invalidate = () => qc.invalidateQueries({ predicate: query => {
    const key = query.queryKey[0];
    return typeof key === "string" && ["/api/clinics", "/api/hospitals", "/api/representatives", "/api/entity-detail"].some(prefix => key.startsWith(prefix));
  } });
  const error = (e: Error) => {
    const copy = e.message === "stale" ? c.staleError : e.message === "period" ? c.periodError
      : e.message === "target" || e.message === "source" ? c.targetError : e.message === "overlap" ? c.overlapError
      : e.message === "scope" ? c.scopeError : c.error;
    setPreview(null); toast({ title: t.common.error, description: copy, variant: "destructive" });
  };
  const action = useMutation({
    mutationFn: async (v: { type: "load" | "preview" | "confirm" | "end"; key: string; base: string; body?: any; id?: string }) => ({
      data: await request(v.type === "load" ? api + "/regions" : v.type === "end" ? `${api}/plans/${v.id}/end` : api + "/plans",
        v.type === "end" ? {} : v.body), v,
    }),
    onSuccess: ({ data, v }) => {
      if (v.type === "end" || v.type === "confirm") {
        void invalidate(); setPreview(null); setRegions(null); setTargets({});
        toast({ title: c.success }); return;
      }
      if (v.base !== liveBase.current) return;
      if (v.type === "load") {
        setRegions({ key: v.base, groups: data.groups }); setTargets({}); setPreview(null);
      } else if (v.key === liveKey.current) setPreview({ key: v.key, ...data });
    },
    onError: error,
  });
  const run = (type: "load" | "preview" | "confirm") => {
    try {
      action.mutate({ type, key: selectionKey, base: baseKey,
        body: type === "load" ? { entity, criteria, kind, fromUserId: source || undefined } :
          { ...input(), dryRun: type === "preview", fingerprint: type === "confirm" ? preview?.fingerprint : undefined } });
    } catch { error(new Error("period")); }
  };
  const validPeriod = kind !== "temporary" || (!!end && (now || !!start));
  const canLoad = (kind === "assign" || !!source) && !users.isError && !users.isLoading && !action.isPending;
  const canPreview = canLoad && validPeriod && groups.some(g => targets[keyFor(g)]);
  const showDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Bratislava", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  return <div className="space-y-5 min-w-0" data-testid="representative-distribution">
    <div><h2 className="font-semibold">{c.title}</h2><p className="text-xs text-muted-foreground mt-1">{c.help}</p></div>
    <div className="space-y-2">
      <Select value={kind} onValueChange={value => setKind(value as Kind)} disabled={action.isPending}>
        <SelectTrigger data-testid="distribution-kind"><SelectValue /></SelectTrigger>
        <SelectContent>{(["assign", "departure", "temporary"] as const).map(k => <SelectItem key={k} value={k}>{c[k]}</SelectItem>)}</SelectContent>
      </Select>
      <Label>{c.from}</Label>
      <Select value={source || "__all"} onValueChange={value => setSource(value === "__all" ? "" : value)} disabled={action.isPending || users.isLoading}>
        <SelectTrigger data-testid="distribution-source"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{kind === "assign" ? c.anySource : p.selectPlaceholder}</SelectItem>
          {reps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}{!rep.isActive ? ` · ${c.inactive}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{c.sourceHint}</p>
      {users.isError && <p role="alert" className="text-sm text-destructive">{c.error}</p>}
    </div>
    {kind === "temporary" && <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{c.returnHint}</p>
      <div className="flex items-center gap-2"><Switch id="distribution-now" checked={now} onCheckedChange={setNow} disabled={action.isPending} /><Label htmlFor="distribution-now">{c.now}</Label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!now && <div className="space-y-1"><Label>{c.starts}</Label><DateTimePicker value={start} onChange={setStart} includeTime minDate={new Date()} disabled={action.isPending} data-testid="distribution-start" /></div>}
        <div className="space-y-1"><Label>{c.ends}</Label><DateTimePicker value={end} onChange={setEnd} includeTime minDate={new Date()} disabled={action.isPending} data-testid="distribution-end" /></div>
      </div>
    </div>}
    <Button variant="outline" disabled={!canLoad} onClick={() => run("load")} data-testid="distribution-load">{action.isPending ? t.common.loading : c.load}</Button>
    {regions?.key === baseKey && (groups.length ? <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr] gap-3 text-xs font-semibold text-muted-foreground"><span>{c.region} · {c.count}</span><span>{c.representative}</span></div>
      {groups.map((group, index) => <div key={keyFor(group)} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] items-center gap-2 rounded-lg border p-3" data-testid={`distribution-region-${index}`}>
        <div className="text-sm min-w-0"><span className="text-xs text-muted-foreground mr-2">{group.countryCode}</span>{group.region || c.unknownRegion}<span className="ml-2 font-semibold">{group.count}</span></div>
        <Select value={targets[keyFor(group)] || "__unchanged"} onValueChange={value => {
          setTargets(previous => ({ ...previous, [keyFor(group)]: value === "__unchanged" ? "" : value })); setPreview(null);
        }} disabled={action.isPending}>
          <SelectTrigger data-testid={`distribution-target-${index}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unchanged">{c.unchanged}</SelectItem>
            {reps.filter(r => r.isActive && r.eligible && (kind === "assign" || r.id !== source)
              && (!r.countries?.length || r.countries.includes(group.countryCode)))
              .map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">{c.empty}</p>)}
    {preview?.key === selectionKey && <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm" data-testid="distribution-preview">
      <strong>{preview.affected}</strong> {p.bulkPreviewCount} · {c.unchanged}: {preview.unchanged}
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => run("preview")} disabled={!canPreview} data-testid="distribution-preview-button">{p.bulkDryRunBtn}</Button>
      <Button onClick={() => run("confirm")} disabled={!canPreview || preview?.key !== selectionKey || !preview?.affected} data-testid="distribution-confirm">{p.bulkConfirm}</Button>
    </div>
    <div className="border-t pt-4 space-y-3"><h3 className="text-sm font-semibold">{c.plans}</h3>
      {plans.isError && <p role="alert" className="text-sm text-destructive">{c.error}</p>}
      {plans.isLoading && <p className="text-sm text-muted-foreground">{t.common.loading}</p>}
      {plans.data?.map(plan => <div key={plan.id} className="rounded-lg border p-3 space-y-2 text-xs" data-testid="distribution-plan">
        <div className="font-medium text-sm">{c[plan.kind]}{plan.sourceName ? ` · ${plan.sourceName}` : ""}</div>
        <div className="text-muted-foreground">{showDate(plan.startsAt)}{plan.endsAt ? ` — ${showDate(plan.endsAt)}` : ""} · Europe/Bratislava</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">{(["pending", "active", "completed", "skipped", "conflict"] as const).filter(k => plan[k]).map(k =>
          <span key={k} className={k === "conflict" ? "text-destructive font-medium" : ""}>{k === "pending" ? c.scheduled : c[k]}: {plan[k]}</span>)}</div>
        {plan.kind === "temporary" && (plan.pending > 0 || plan.active > 0 || plan.conflict > 0) &&
          <Button size="sm" variant="outline" onClick={() => setEnding(plan.id)} disabled={action.isPending} data-testid="distribution-end-plan">{c.endNow}</Button>}
      </div>)}
    </div>
    <AlertDialog open={!!ending} onOpenChange={open => { if (!open) setEnding(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{c.finishQuestion}</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t.common.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => {
          if (ending) action.mutate({ type: "end", key: selectionKey, base: baseKey, id: ending }); setEnding(null);
        }}>{c.endNow}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
