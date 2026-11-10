import { useEffect, useMemo, useRef, useState } from "react";
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
type PreviewGroup = { countryCode: string; region: string; userId: string; count: number; affected: number; alreadyAssigned: number };
type Preview = {
  key: string;
  affected: number;
  unchanged: number;
  fingerprint: string;
  total?: number;
  selected?: number;
  alreadyAssigned?: number;
  unselected?: number;
  previewGroups?: PreviewGroup[];
};
type Kind = "assign" | "departure" | "temporary";
type Plan = { id: string; kind: Kind; startsAt: string; endsAt: string | null; sourceName: string | null;
  pending: number; active: number; completed: number; skipped: number; conflict: number };
const keyFor = (g: Group) => JSON.stringify([g.countryCode, g.region || ""]);
const api = "/api/representatives/distribution";
export type RepresentativeRegionAssignmentDraft = {
  key: string;
  revision: number;
  entity: "clinic" | "hospital";
  targets: Record<string, string>;
};
export const representativeAssignmentCriteriaKey = (entity: "clinic" | "hospital", criteria: any) =>
  JSON.stringify({ entity, criteria });
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
type DistributionProps = {
  entity: "clinic" | "hospital";
  criteria: any;
  singleTarget?: boolean;
  initialKind?: Kind;
  initialSource?: string;
  initialTarget?: string;
  assignmentDraft?: RepresentativeRegionAssignmentDraft;
  onContextChange?: (kind: Kind, source: string) => void;
};

export function RepresentativeDistributionPanel({
  entity, criteria, singleTarget = false, initialKind = "assign", initialSource = "", initialTarget = "", assignmentDraft, onContextChange,
}: DistributionProps) {
  const { t, locale } = useI18n(), c = t.representativeDistribution, p = t.representantPanel;
  const a = t.representativeAssist;
  const { toast } = useToast(), qc = useQueryClient();
  const [kind, setKind] = useState<Kind>(singleTarget ? "temporary" : initialKind);
  const [source, setSource] = useState(initialSource);
  const [replacement, setReplacement] = useState(initialTarget);
  const [wholePortfolio, setWholePortfolio] = useState(false);
  const [now, setNow] = useState(true), [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [regions, setRegions] = useState<{ key: string; groups: Group[] } | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const contextChangeRef = useRef(onContextChange);
  contextChangeRef.current = onContextChange;
  const draftMatches = !!assignmentDraft && assignmentDraft.entity === entity
    && assignmentDraft.key === representativeAssignmentCriteriaKey(entity, criteria);
  const draftKey = draftMatches ? assignmentDraft!.key : "";
  const draftRevision = draftMatches ? assignmentDraft!.revision : 0;
  const draftIdentity = draftKey ? `${draftKey}:${draftRevision}` : "";
  const draftTargets = draftMatches ? assignmentDraft!.targets : {};
  const activeKind: Kind = singleTarget ? "temporary" : kind;
  const effectiveCriteria = useMemo(() => singleTarget && wholePortfolio
    ? { countryScope: criteria?.countryScope }
    : criteria, [singleTarget, wholePortfolio, criteria]);
  const countries = Array.isArray(criteria?.countryScope) ? criteria.countryScope.join(",") : "";
  const suffix = countries ? `&countries=${encodeURIComponent(countries)}` : "";
  const users = useQuery<Rep[]>({
    queryKey: [api + "/users", countries],
    queryFn: () => request(api + "/users" + (countries ? "?countries=" + encodeURIComponent(countries) : "")),
  });
  const plans = useQuery<Plan[]>({
    queryKey: [api + "/plans", entity, countries],
    queryFn: () => request(`${api}/plans?entity=${entity}${suffix}`), refetchInterval: 30000,
  });
  const reps = users.data || [];
  const baseKey = JSON.stringify({
    entity, criteria: effectiveCriteria, kind: activeKind, source,
    draftIdentity,
    replacement: singleTarget ? replacement : undefined,
    startsAt: activeKind === "temporary" && !now ? start : "",
    endsAt: activeKind === "temporary" ? end : "",
    wholePortfolio: singleTarget && wholePortfolio,
  });
  const selectionKey = JSON.stringify({ baseKey, targets, now, start, end, replacement });
  const liveBase = useRef(baseKey), liveKey = useRef(selectionKey);
  const liveDraftKey = useRef(draftIdentity);
  liveBase.current = baseKey;
  liveKey.current = selectionKey;
  liveDraftKey.current = draftIdentity;
  useEffect(() => {
    contextChangeRef.current?.(activeKind, source);
  }, [activeKind, source]);
  useEffect(() => { setRegions(null); setTargets({}); setPreview(null); }, [baseKey]);
  const groups = regions?.key === baseKey ? regions.groups : [];
  const allowedCountries: string[] = groups.length
    ? Array.from(new Set(groups.map(group => group.countryCode)))
    : [];
  const targetReps = reps.filter(rep => rep.isActive && rep.eligible && rep.id !== source
    && (!rep.countries?.length || allowedCountries.every(code => rep.countries.includes(code))));
  const input = () => ({
    entity, criteria: effectiveCriteria, kind: activeKind, fromUserId: source || undefined,
    startsAt: activeKind === "temporary" && !now && start ? new Date(start).toISOString() : undefined,
    endsAt: activeKind === "temporary" && end ? new Date(end).toISOString() : undefined,
    regions: singleTarget
      ? groups.filter(() => !!replacement).map(group => ({ countryCode: group.countryCode, region: group.region, userId: replacement }))
      : groups.filter(group => targets[keyFor(group)]).map(group => ({ countryCode: group.countryCode, region: group.region, userId: targets[keyFor(group)] })),
  });
  const invalidate = () => qc.invalidateQueries({ predicate: query => {
    const key = query.queryKey[0];
    return typeof key === "string" && ["/api/clinics", "/api/hospitals", "/api/representatives", "/api/entity-detail"].some(prefix => key.startsWith(prefix));
  } });
  const error = (e: Error) => {
    const copy = e.message === "stale" ? c.staleError : e.message === "period" ? c.periodError
      : e.message === "target" || e.message === "source" ? c.targetError : e.message === "overlap" ? c.overlapError
        : e.message === "scope" ? c.scopeError : c.error;
    setPreview(null);
    toast({ title: t.common.error, description: copy, variant: "destructive" });
  };
  const action = useMutation({
    mutationFn: async (v: { type: "load" | "preview" | "confirm" | "end"; key: string; base: string; body?: any; id?: string;
      draftKey?: string; draftRevision?: number; draftTargets?: Record<string, string> }) => ({
      data: await request(v.type === "load" ? api + "/regions" : v.type === "end" ? `${api}/plans/${v.id}/end` : api + "/plans",
        v.type === "end" ? {} : v.body), v,
    }),
    onSuccess: ({ data, v }) => {
      if (v.type === "end" || v.type === "confirm") {
        void invalidate();
        if (v.type === "confirm" && v.base === liveBase.current && v.key === liveKey.current) {
          setPreview(null); setRegions(null); setTargets({});
        }
        toast({ title: c.success });
        return;
      }
      if (v.base !== liveBase.current) return;
      if (v.type === "load") {
        // A new date/kind clears old targets in the same effect cycle as an
        // automatic draft load. Its base and draft identity remain authoritative;
        // the transient previous targets must not make that response stale.
        if ((!v.draftKey && v.key !== liveKey.current)
          || (v.draftKey ? `${v.draftKey}:${v.draftRevision || 0}` : "") !== liveDraftKey.current) return;
        setRegions({ key: v.base, groups: Array.isArray(data.groups) ? data.groups : [] });
        const loadedGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];
        const prefilled: Record<string, string> = {};
        if (v.draftKey && v.draftTargets) {
          for (const group of loadedGroups) {
            const target = v.draftTargets[group.region];
            if (target) prefilled[keyFor(group)] = target;
          }
        }
        setTargets(prefilled);
        setPreview(null);
      } else if (v.key === liveKey.current) setPreview({ key: v.key, ...data });
    },
    onError: error,
  });
  const run = (type: "load" | "preview" | "confirm") => {
    try {
      action.mutate({
        type, key: selectionKey, base: baseKey,
        ...(type === "load" ? { draftKey, draftRevision, draftTargets } : {}),
        body: type === "load"
          ? { entity, criteria: effectiveCriteria, kind: activeKind, fromUserId: source || undefined }
          : { ...input(), dryRun: type === "preview", fingerprint: type === "confirm" ? preview?.fingerprint : undefined },
      });
    } catch { error(new Error("period")); }
  };
  const autoLoadKey = useRef("");
  const mutateRef = useRef(action.mutate);
  mutateRef.current = action.mutate;
  useEffect(() => {
    const loadIdentity = `${draftIdentity}:${baseKey}`;
    if (!draftKey || singleTarget || users.isLoading || (activeKind !== "assign" && !source)
      || autoLoadKey.current === loadIdentity) return;
    autoLoadKey.current = loadIdentity;
    mutateRef.current({
      type: "load", key: selectionKey, base: baseKey, draftKey, draftRevision, draftTargets,
      body: { entity, criteria: effectiveCriteria, kind: activeKind, fromUserId: source || undefined },
    });
  }, [draftIdentity, users.isLoading, singleTarget, selectionKey, baseKey, activeKind, source]);
  const validPeriod = activeKind !== "temporary" || (!!end && (now || !!start));
  const assignedGroups = groups.filter(group => !!targets[keyFor(group)]);
  const selectedGroups = singleTarget ? groups.filter(() => !!replacement) : assignedGroups;
  const validTarget = singleTarget
    ? targetReps.some(rep => rep.id === replacement)
    : assignedGroups.length > 0 && assignedGroups.every(group => reps.some(rep =>
      rep.id === targets[keyFor(group)] && rep.isActive && rep.eligible
      && (activeKind === "assign" || rep.id !== source)
      && (!rep.countries?.length || rep.countries.includes(group.countryCode))));
  const canLoad = (activeKind === "assign" || !!source) && (!singleTarget || !!replacement)
    && !users.isError && !users.isLoading && !action.isPending;
  const canPreview = canLoad && validPeriod && groups.length > 0 && validTarget;
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const currentPreview = preview?.key === selectionKey ? preview : null;
  const previewGroups = currentPreview?.previewGroups;
  const previewBreakdownValid = (() => {
    if (!currentPreview || !Number.isSafeInteger(currentPreview.total) || !Number.isSafeInteger(currentPreview.selected)
      || !Number.isSafeInteger(currentPreview.alreadyAssigned) || !Number.isSafeInteger(currentPreview.unselected)
      || !Array.isArray(previewGroups) || !Number.isSafeInteger(currentPreview.affected)
      || !Number.isSafeInteger(currentPreview.unchanged) || !currentPreview.fingerprint) return false;
    const { total: previewTotal, selected, alreadyAssigned, unselected, affected, unchanged } = currentPreview;
    if (previewTotal! < 0 || selected! < 0 || alreadyAssigned! < 0 || unselected! < 0 || affected! < 0
      || previewTotal !== selected! + unselected! || affected! + alreadyAssigned! !== selected!
      || unchanged! !== alreadyAssigned! + unselected! || selected !== selectedGroups.reduce((sum, group) => sum + group.count, 0)
      || previewGroups.length !== selectedGroups.length) return false;
    const matched = new Set<string>();
    for (const item of previewGroups) {
      if (!item || typeof item.countryCode !== "string" || typeof item.region !== "string"
        || typeof item.userId !== "string") return false;
      const key = keyFor(item);
      const sourceGroup = selectedGroups.find(group => keyFor(group) === key);
      const expectedTarget = singleTarget ? replacement : targets[key];
      if (!sourceGroup || matched.has(key) || item.userId !== expectedTarget || item.count !== sourceGroup.count
        || !Number.isSafeInteger(item.affected) || !Number.isSafeInteger(item.alreadyAssigned)
        || item.affected < 0 || item.alreadyAssigned < 0 || item.affected + item.alreadyAssigned !== item.count) return false;
      matched.add(key);
    }
    return matched.size === selectedGroups.length
      && previewGroups.reduce((sum, item) => sum + item.affected, 0) === affected
      && previewGroups.reduce((sum, item) => sum + item.alreadyAssigned, 0) === alreadyAssigned;
  })();
  const previewTargetIds = Array.from(new Set(selectedGroups.map(group => singleTarget ? replacement : targets[keyFor(group)]).filter(Boolean)));
  const previewTargetNames = previewTargetIds.map(id => reps.find(rep => rep.id === id)?.name || "");
  const previewSentence = (template: string) => template
    .replace("{selected}", String(currentPreview?.selected ?? ""))
    .replace("{total}", String(currentPreview?.total ?? ""))
    .replace("{unselected}", String(currentPreview?.unselected ?? ""))
    .replace("{name}", previewTargetNames[0] || "")
    .replace("{count}", String(previewTargetIds.length));
  const showDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Bratislava", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  return <div className="space-y-5 min-w-0" data-testid="representative-distribution">
    <div><h2 className="font-semibold">{singleTarget ? a.tempToggle : c.title}</h2><p className="text-xs text-muted-foreground mt-1">{singleTarget ? a.tempHelp : c.help}</p></div>
    <div className="space-y-2">
       {!singleTarget && <Select value={kind} onValueChange={value => {
         const nextKind = value as Kind;
         setKind(nextKind);
         contextChangeRef.current?.(nextKind, source);
       }} disabled={action.isPending}>
        <SelectTrigger data-testid="distribution-kind"><SelectValue /></SelectTrigger>
        <SelectContent>{(["assign", "departure", "temporary"] as const).map(k => <SelectItem key={k} value={k}>{c[k]}</SelectItem>)}</SelectContent>
      </Select>}
      <Label>{c.from}</Label>
       <Select value={source || "__all"} onValueChange={value => {
         const nextSource = value === "__all" ? "" : value;
         setSource(nextSource);
         contextChangeRef.current?.(activeKind, nextSource);
       }} disabled={action.isPending || users.isLoading}>
        <SelectTrigger data-testid="distribution-source"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{activeKind === "assign" ? c.anySource : p.selectPlaceholder}</SelectItem>
          {reps.map(rep => <SelectItem key={rep.id} value={rep.id} disabled={activeKind === "temporary" && (!rep.isActive || !rep.eligible)}>{rep.name}{!rep.isActive ? ` · ${c.inactive}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{c.sourceHint}</p>
      {singleTarget && <>
        <div className="space-y-1.5 pt-2">
          <Label>{a.replacement}</Label>
          <Select value={replacement || "__choose"} onValueChange={value => { setReplacement(value === "__choose" ? "" : value); setPreview(null); }} disabled={action.isPending || users.isLoading}>
            <SelectTrigger data-testid="distribution-single-target"><SelectValue placeholder={a.chooseReplacement} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__choose">{a.chooseReplacement}</SelectItem>
              {targetReps.map(rep => <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-start gap-3 border-t pt-3">
          <Switch id="distribution-whole-portfolio" data-testid="distribution-whole-portfolio" checked={wholePortfolio} onCheckedChange={setWholePortfolio} disabled={action.isPending} />
          <div><Label htmlFor="distribution-whole-portfolio" className="cursor-pointer text-sm">{a.wholePortfolio}</Label><p className="mt-1 text-xs text-muted-foreground">{wholePortfolio ? a.wholePortfolioHelp : a.filteredPortfolioHelp}</p></div>
        </div>
      </>}
      {users.isError && <p role="alert" className="text-sm text-destructive">{c.error}</p>}
    </div>
    {activeKind === "temporary" && <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{c.returnHint}</p>
      <div className="flex items-center gap-2"><Switch id="distribution-now" checked={now} onCheckedChange={setNow} disabled={action.isPending} /><Label htmlFor="distribution-now">{c.now}</Label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!now && <div className="space-y-1"><Label>{c.starts}</Label><DateTimePicker value={start} onChange={setStart} includeTime minDate={new Date()} disabled={action.isPending} data-testid="distribution-start" /></div>}
        <div className="space-y-1"><Label>{c.ends}</Label><DateTimePicker value={end} onChange={setEnd} includeTime minDate={new Date()} disabled={action.isPending} data-testid="distribution-end" /></div>
      </div>
    </div>}
    <Button variant="outline" disabled={!canLoad} onClick={() => run("load")} data-testid="distribution-load">
      {action.isPending ? t.common.loading : singleTarget ? a.loadPortfolio : c.load}
    </Button>
    {regions?.key === baseKey && (groups.length ? singleTarget ? <div className="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="distribution-portfolio-total">
      <span className="text-muted-foreground">{a.portfolioTotal}: </span><strong className="tabular-nums">{total}</strong>
    </div> : <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr] gap-3 text-xs font-semibold text-muted-foreground"><span>{c.region} · {c.count}</span><span>{c.representative}</span></div>
      {groups.map((group, index) => <div key={keyFor(group)} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] items-center gap-2 rounded-lg border p-3" data-testid={`distribution-region-${index}`}>
        <div className="text-sm min-w-0"><span className="text-xs text-muted-foreground mr-2">{group.countryCode}</span>{group.region || c.unknownRegion}<span className="ml-2 font-semibold">{group.count}</span></div>
        <Select value={targets[keyFor(group)] || "__unchanged"} onValueChange={value => {
          setTargets(previous => ({ ...previous, [keyFor(group)]: value === "__unchanged" ? "" : value })); setPreview(null);
        }} disabled={action.isPending}>
          <SelectTrigger data-testid={`distribution-target-${index}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unchanged">{c.unchanged}</SelectItem>
            {reps.filter(r => r.isActive && r.eligible && (activeKind === "assign" || r.id !== source)
              && (!r.countries?.length || r.countries.includes(group.countryCode)))
              .map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">{c.empty}</p>)}
    {draftKey && regions?.key === baseKey && <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground" data-testid="distribution-handoff-next-step">{a.nextStep}</p>}
    {currentPreview && <section className="space-y-3 rounded-lg border p-3 sm:p-4 text-sm" data-testid="distribution-preview">
      {!previewBreakdownValid ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" data-testid="distribution-preview-refresh">
        {a.previewRefresh}
      </p> : <>
        <p className="font-medium" data-testid="distribution-outcome">
          {previewTargetIds.length === 1
            ? previewSentence(a.previewOneTarget)
            : previewSentence(a.previewMultipleTargets)}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 px-3 py-2" data-testid="distribution-new-count">
            <span className="text-muted-foreground">{a.newAssignments}</span>
            <strong className="ml-2 tabular-nums">{currentPreview.affected}</strong>
          </div>
          <div className="rounded-md border bg-muted/20 px-3 py-2" data-testid="distribution-already-count">
            <span className="text-muted-foreground">{a.alreadyAssigned}</span>
            <strong className="ml-2 tabular-nums">{currentPreview.alreadyAssigned}</strong>
          </div>
        </div>
        {currentPreview.unselected! > 0 && <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm" data-testid="distribution-unselected-warning">
          {previewSentence(a.unselectedWarning)}
        </p>}
        {currentPreview.affected === 0 && <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm" data-testid="distribution-no-changes">
          {a.noChanges}
        </p>}
        <div className="space-y-2 border-t pt-3" data-testid="distribution-region-breakdown">
          <h3 className="text-xs font-semibold text-muted-foreground">{c.region}</h3>
          {previewGroups!.map((item, index) => {
            const representative = reps.find(rep => rep.id === item.userId)?.name || "";
            const region = item.region || c.unknownRegion;
            return <div key={`${item.countryCode}:${item.region}:${item.userId}`} className="grid grid-cols-1 gap-1 rounded-md border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid={`distribution-preview-region-${index}`}>
              <div className="min-w-0"><span className="mr-2 text-xs text-muted-foreground">{item.countryCode}</span><span>{region}</span><span className="ml-2 text-muted-foreground">· {representative}</span></div>
              <div className="flex flex-wrap gap-x-3 text-xs tabular-nums">
                <span><span className="text-muted-foreground">{a.newAssignments}:</span> {item.affected}</span>
                <span><span className="text-muted-foreground">{a.alreadyAssigned}:</span> {item.alreadyAssigned}</span>
              </div>
            </div>;
          })}
        </div>
      </>}
    </section>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => run("preview")} disabled={!canPreview} data-testid="distribution-preview-button">{p.bulkDryRunBtn}</Button>
      <Button onClick={() => run("confirm")} disabled={!canPreview || !currentPreview || !previewBreakdownValid || !currentPreview.affected} data-testid="distribution-confirm">{p.bulkConfirm}</Button>
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
