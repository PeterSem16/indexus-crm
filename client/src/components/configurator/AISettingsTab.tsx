import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock3, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { AISettingsView, AIGatewaySettings, AIServiceRoute } from "@shared/ai-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import type { AISettingsCopy } from "@/i18n/ai-settings-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const queryKey = ["/api/configurator/ai"] as const;
const canonicalURL = "https://ai.cordbloodcenter.com/gateway/";
const internalModel = "indexus-document-audio:latest";
const staleMs = 15 * 60 * 1000;
type TestKind = "connectivity" | "smoke" | "openai";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}
function localizedError(copy: AISettingsCopy, error: unknown): string {
  const code = errorCode(error);
  const message = code ? copy[code as keyof AISettingsCopy] : undefined;
  return typeof message === "string" ? message : copy.genericError;
}

function StatusPill({ state, label }: { state: string; label: string }) {
  const color = state === "ready" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : state === "failed" || state === "blocked" ? "border-rose-300 bg-rose-50 text-rose-800"
    : state === "stale" ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-slate-300 bg-slate-50 text-slate-700";
  return <Badge variant="outline" className={color}>{label}</Badge>;
}

function GatewayEditor({ view, onUpdated }: { view: AISettingsView; onUpdated: (v: AISettingsView) => void }) {
  const { t } = useI18n();
  const copy = t.aiSettings;
  const [gateway, setGateway] = useState<AIGatewaySettings>(view.gateway);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editVersion, setEditVersion] = useState(view.version);
  useEffect(() => {
    if (!dirty) {
      setGateway(view.gateway);
      setEditVersion(view.version);
    }
  }, [view.gateway, view.version, dirty]);
  const save = useMutation({
    mutationFn: async (value: AIGatewaySettings) => await (await apiRequest("PUT", "/api/configurator/ai/gateway", {
      expectedVersion: editVersion, gateway: value,
    })).json() as AISettingsView,
    onSuccess: (updated) => {
      setDirty(false);
      setSaved(true);
      setEditVersion(updated.version);
      onUpdated(updated);
    },
  });
  const test = useMutation({
    mutationFn: async (kind: TestKind) => await (await apiRequest("POST", "/api/configurator/ai/test", {
      expectedVersion: view.version, kind,
    })).json() as AISettingsView,
    onSuccess: onUpdated,
  });
  const setNumber = (key: "timeoutMs" | "maxRetries" | "temperature" | "maxTokens", raw: string) => {
    const limits = { timeoutMs: [5000, 120000], maxRetries: [0, 2], temperature: [0, 2], maxTokens: [1, 8192] } as const;
    const [min, max] = limits[key];
    if (raw === "" && key !== "temperature" && key !== "maxTokens") return;
    const parsed = raw === "" ? null : Number(raw);
    const bounded = parsed === null ? null : Math.max(min, Math.min(max, parsed));
    const value = bounded !== null && (key === "maxRetries" || key === "maxTokens") ? Math.round(bounded) : bounded;
    const next = { ...gateway, [key]: value };
    setGateway(next);
    setDirty(true);
  };
  const check = view.gatewayCheck;
  const runtimeBlocked = view.runtime.replit || !view.runtime.serverAllowed || !view.runtime.production;
  const stale = !!check && (Date.now() - new Date(check.checkedAt).getTime() > staleMs || check.settingsVersion !== view.version);
  const status = runtimeBlocked || !gateway.enabled ? "blocked" : check ? stale ? "stale" : check.state : "unknown";
  const statusLabel = status === "ready" ? copy.statusReady : status === "failed" ? copy.statusFailed
    : status === "blocked" ? copy.statusBlocked : status === "checking" ? copy.statusChecking
    : status === "stale" ? copy.statusStale : copy.statusUnknown;
  const openaiCheck = view.openaiCheck;
  const openaiStale = !!openaiCheck && (Date.now() - new Date(openaiCheck.checkedAt).getTime() > staleMs || openaiCheck.settingsVersion !== view.version);
  const openaiStatus = !view.runtime.openaiConfigured ? "blocked" : openaiStale ? "stale" : openaiCheck?.state || "unknown";
  return <div className="space-y-5">
    <Card className="border-border/80">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-primary" />{copy.gateway}</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">{copy.gatewayDescription}</CardDescription></div>
          <StatusPill state={status} label={statusLabel} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ai-base-url">{copy.baseUrl}</Label>
                <Input id="ai-base-url" value={gateway.baseURL} onChange={e => { setGateway({ ...gateway, baseURL: e.target.value }); setDirty(true); }} />
                <p className="text-xs text-muted-foreground">{canonicalURL} {copy.canonicalOnly || copy.gatewayDescription}</p>
              </div>
              <div className="space-y-2"><Label htmlFor="ai-timeout">{copy.timeout}</Label>
                <Input id="ai-timeout" type="number" min={5000} max={120000} step={1000} value={gateway.timeoutMs} onChange={e => setNumber("timeoutMs", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="ai-retries">{copy.retries}</Label>
                <Input id="ai-retries" type="number" min={0} max={2} step={1} value={gateway.maxRetries} onChange={e => setNumber("maxRetries", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="ai-temperature">{copy.temperature}</Label>
                <div className="flex gap-2"><Input id="ai-temperature" type="number" min={0} max={2} step={0.1} value={gateway.temperature ?? ""} placeholder={copy.useDefault} onChange={e => setNumber("temperature", e.target.value)} />
                  {gateway.temperature !== null && <Button type="button" variant="outline" onClick={() => { setGateway({ ...gateway, temperature: null }); setDirty(true); }}>{copy.useDefault}</Button>}</div></div>
              <div className="space-y-2"><Label htmlFor="ai-max-tokens">{copy.maxTokens}</Label>
                <div className="flex gap-2"><Input id="ai-max-tokens" type="number" min={1} max={8192} step={1} value={gateway.maxTokens ?? ""} placeholder={copy.useDefault} onChange={e => setNumber("maxTokens", e.target.value)} />
                  {gateway.maxTokens !== null && <Button type="button" variant="outline" onClick={() => { setGateway({ ...gateway, maxTokens: null }); setDirty(true); }}>{copy.useDefault}</Button>}</div></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/25 p-3">
              <div><p className="text-sm font-medium">{copy.gatewayEnabled}</p><p className="text-xs text-muted-foreground">{gateway.enabled ? copy.enabled : copy.disabled}</p></div>
              <Switch checked={gateway.enabled} onCheckedChange={checked => { setGateway({ ...gateway, enabled: checked }); setDirty(true); }} aria-label={copy.gatewayEnabled} />
            </div>
            <Button onClick={() => save.mutate(gateway)} disabled={save.isPending || !dirty || !gateway.baseURL.trim()}>
              {save.isPending ? copy.saving : copy.save}
            </Button>
            {saved && !dirty && <span role="status" className="ml-3 text-sm text-emerald-700">{copy.saved}</span>}
            {errorCode(save.error) === "version_conflict" && <Button variant="outline" onClick={() => {
              setGateway(view.gateway); setDirty(false); setEditVersion(view.version); setSaved(false);
            }}>{copy.reloadLatest}</Button>}
          </div>
          <div className="space-y-4 rounded-lg bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{copy.token}</p>
              <StatusPill state={view.runtime.tokenConfigured ? "ready" : "blocked"} label={view.runtime.tokenConfigured ? copy.tokenReady : copy.tokenMissing} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{copy.tokenPrerequisite}</p>
            <div className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{copy.productionOnly}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <span className="text-sm font-medium">{copy.runtime}</span>
              <StatusPill state={runtimeBlocked ? "blocked" : "ready"} label={runtimeBlocked ? copy.runtimeBlocked : copy.runtimeAllowed} />
            </div>
            {view.runtime.replit && <p className="text-xs text-destructive">{copy.replitBlocked}</p>}
          </div>
        </div>
        <Separator />
        <section aria-labelledby="ai-check-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="ai-check-title" className="text-sm font-semibold">{copy.gatewayTest}</h3>
            <p className="text-xs text-muted-foreground">{copy.noAutoTests}</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              ["connectivity", copy.connectivityTest, copy.connectivityHelp],
              ["smoke", copy.smokeTest, copy.smokeHelp],
              ["openai", copy.openaiTest, copy.openaiHelp],
            ] as const).map(([kind, title, help]) => <div key={kind} className="flex flex-col justify-between gap-3 rounded-md border bg-card p-3">
              <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{help}</p></div>
              <Button variant={kind === "smoke" ? "default" : "outline"} className="w-full" disabled={test.isPending}
                onClick={() => test.mutate(kind)}>{test.isPending && test.variables === kind ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}{title}</Button>
            </div>)}
          </div>
          <div className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.connectionAndFormats}</span>
              <div className="flex flex-wrap gap-2"><StatusPill state={status === "ready" ? "ready" : status}
                label={status === "ready" ? copy.connected : copy.notConnected} />
                <StatusPill state={!stale && !runtimeBlocked && gateway.enabled && check?.textVerified ? "ready" : "unknown"} label={`${copy.textVerified}: ${!stale && !runtimeBlocked && gateway.enabled && check?.textVerified ? copy.enabled : copy.disabled}`} />
                <StatusPill state={!stale && !runtimeBlocked && gateway.enabled && check?.jsonVerified ? "ready" : "unknown"} label={`${copy.jsonVerified}: ${!stale && !runtimeBlocked && gateway.enabled && check?.jsonVerified ? copy.enabled : copy.disabled}`} /></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{copy.lastChecked}: {check ? new Date(check.checkedAt).toLocaleString() : copy.neverChecked}</span>
              {check && <span>{copy.duration}: {check.durationMs} ms</span>}
              {stale && <span>{copy.staleAfter}</span>}
            </div>
            {check?.state === "ready" && (check.models?.length ?? 0) > 0 && !stale && <div className="mt-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">{copy.verifiedModels}</p>
              <div className="mt-2 space-y-1">{check.models?.map(model => <p key={`${model.id}-${model.revision}`} className="flex flex-wrap gap-x-3 font-mono text-xs">
                <span>{model.id}</span><span className="text-muted-foreground">{model.revision}</span>
                <span className="text-muted-foreground">{model.outputFormats.join(", ")}</span>
                <span className="text-muted-foreground">{copy.modelLimits}: {model.maxInputTokens ?? "—"} / {model.maxOutputTokens ?? "—"}</span>
              </p>)}</div>
            </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
            <div><p className="text-sm font-medium">{copy.openai}</p><p className="mt-1 text-xs text-muted-foreground">{view.runtime.openaiConfigured ? copy.openaiConfigured || copy.tokenReady : copy.openaiNotConfigured || copy.tokenMissing}</p>
              <p className="mt-1 text-xs text-muted-foreground">{copy.lastChecked}: {openaiCheck ? new Date(openaiCheck.checkedAt).toLocaleString() : copy.neverChecked}</p></div>
            <StatusPill state={openaiStatus}
              label={openaiStatus === "ready" ? copy.statusReady : openaiStatus === "failed" ? copy.statusFailed : openaiStatus === "blocked" ? copy.statusBlocked : openaiStatus === "checking" ? copy.statusChecking : openaiStatus === "stale" ? copy.statusStale : copy.statusUnknown} />
          </div>
        </section>
        {(save.error || test.error) && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <strong>{copy.errorTitle}: </strong>{localizedError(copy, save.error || test.error)}
        </p>}
      </CardContent>
    </Card>
  </div>;
}

function ServiceRouteEditor({ service, view, onUpdated }: { service: AISettingsView["services"][number]; view: AISettingsView; onUpdated: (v: AISettingsView) => void }) {
  const { t } = useI18n();
  const copy = t.aiSettings;
  const [route, setRoute] = useState<AIServiceRoute>(service.route);
  const [baseline, setBaseline] = useState<AIServiceRoute>(service.route);
  const [baselineVersion, setBaselineVersion] = useState(view.version);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = JSON.stringify(route) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!dirty) {
      if (JSON.stringify(service.route) !== JSON.stringify(baseline)) {
        setRoute(service.route);
        setBaseline(service.route);
      }
      setBaselineVersion(view.version);
    }
  }, [service.route, baseline, dirty, view.version]);
  const smoke = view.gatewayCheck;
  const smokeFresh = !!smoke && smoke.kind === "smoke" && smoke.state === "ready" &&
    smoke.settingsVersion === view.version && smoke.textVerified && smoke.jsonVerified &&
    Date.now() - new Date(smoke.checkedAt).getTime() <= staleMs;
  const canInternal = service.internalEligible &&
    view.runtime.production && !view.runtime.replit && view.runtime.serverAllowed && smokeFresh;
  const canSaveInternal = canInternal || !route.enabled;
  const save = useMutation({
    mutationFn: async (args: { value: AIServiceRoute; confirm: boolean }) =>
      await (await apiRequest("PUT", "/api/configurator/ai/route", {
        expectedVersion: baselineVersion, service: service.id, route: args.value,
        ...(args.confirm ? { confirmInternal: true } : {}),
      })).json() as AISettingsView,
    onSuccess: (updated, args) => { setError(null); setConfirmOpen(false); setBaseline(args.value); setRoute(args.value); setBaselineVersion(updated.version); onUpdated(updated); },
    onError: err => { setError(err); if (errorCode(err) === "version_conflict") queryClient.invalidateQueries({ queryKey }); },
  });
  const submit = () => {
    if (route.provider === "internal" && route.enabled) setConfirmOpen(true);
    else save.mutate({ value: route, confirm: false });
  };
  const operation = copy.operations[service.operation.toLowerCase()] || service.operation;
  return <article className="grid gap-4 border-b p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(210px,1fr)_minmax(240px,1fr)_auto] lg:items-center">
    <div className="min-w-0"><p className="truncate font-mono text-sm font-semibold" title={service.id}>{service.id}</p><p className="mt-1 text-xs text-muted-foreground">{operation}</p></div>
    <div className="space-y-1.5"><Label htmlFor={`provider-${service.id}`} className="text-xs">{copy.provider}</Label>
      <select id={`provider-${service.id}`} value={route.provider} onChange={e => {
        const provider = e.target.value as AIServiceRoute["provider"];
        setRoute({ ...route, provider, model: provider === "internal" ? internalModel : null });
      }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="openai">{copy.openai}</option>
        <option value="internal" disabled={!service.internalEligible || view.runtime.replit || !view.runtime.production || !view.runtime.serverAllowed}>{copy.internal}</option>
      </select>
    </div>
    <div className="space-y-1.5"><Label htmlFor={`model-${service.id}`} className="text-xs">{copy.model}</Label>
      {route.provider === "internal" ? <select id={`model-${service.id}`} value={route.model || internalModel}
        onChange={e => setRoute({ ...route, model: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs">
        <option value={internalModel}>{internalModel}</option></select> :
        <div className="flex gap-1.5"><Input id={`model-${service.id}`} value={route.model || ""} placeholder={copy.originalModel}
          onChange={e => setRoute({ ...route, model: e.target.value || null })} className="font-mono text-xs" />
          {route.model !== null && <Button type="button" variant="outline" size="sm" title={copy.originalModel} onClick={() => setRoute({ ...route, model: null })}>{copy.originalModel}</Button>}</div>}
    </div>
    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
      <div className="flex items-center gap-2"><Switch checked={route.enabled} onCheckedChange={enabled => setRoute({ ...route, enabled })} aria-label={route.enabled ? copy.serviceEnabled : copy.serviceDisabled} />
        <span className="text-xs text-muted-foreground">{route.enabled ? copy.enabled : copy.disabled}</span></div>
      <Button size="sm" onClick={submit} disabled={save.isPending || (route.provider === "internal" && !canSaveInternal)}>
        {save.isPending ? copy.savingRoute : copy.saveRoute}</Button>
    </div>
    {route.provider === "internal" && route.enabled && !canInternal && <p className="text-xs text-amber-800 lg:col-span-4">{copy.verificationRequired} {copy.internalUnavailable}</p>}
    {!!error && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive lg:col-span-4">
      <span>{localizedError(copy, error)}</span>
      {errorCode(error) === "version_conflict" && <Button size="sm" variant="outline" onClick={() => {
        setRoute(service.route); setBaseline(service.route); setBaselineVersion(view.version); setError(null);
      }}>{copy.reloadLatest}</Button>}
    </div>}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{copy.internalConfirmTitle}</DialogTitle>
          <DialogDescription>{copy.internalConfirmDescription}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>{copy.cancel}</Button>
          <Button disabled={save.isPending || !canInternal} onClick={() => save.mutate({ value: route, confirm: true })}>{copy.internalConfirm}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </article>;
}

export function AISettingsTab() {
  const { t } = useI18n();
  const copy = t.aiSettings;
  const query = useQuery<AISettingsView>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", "/api/configurator/ai")).json(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const [search, setSearch] = useState("");
  const filteredServices = useMemo(() => (query.data?.services || []).filter(service =>
    `${service.id} ${service.operation}`.toLowerCase().includes(search.trim().toLowerCase())), [query.data?.services, search]);
  const onUpdated = (updated: AISettingsView) => queryClient.setQueryData(queryKey, updated);
  if (query.isLoading) return <div className="space-y-4" aria-label={copy.title}>
    <div className="h-36 animate-pulse rounded-lg bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" />
  </div>;
  if (query.isError || !query.data) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
      <div className="flex-1"><h2 className="font-semibold">{copy.errorTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{localizedError(copy, query.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => query.refetch()}>{copy.retry}</Button></div></div>
  </div>;
  const view = query.data;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Sparkles className="h-5 w-5 text-primary" />{copy.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.description}</p></div>
      <Badge variant="outline" className="font-mono">v{view.version}</Badge>
    </div>
    <GatewayEditor view={view} onUpdated={onUpdated} />
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">{copy.services}</CardTitle><CardDescription className="mt-1">{copy.servicesDescription}</CardDescription></div>
          <Badge variant="outline">{view.runtime.mode === "legacy" ? copy.legacyMode : copy.routedMode}</Badge></div>
        {view.runtime.mode === "legacy" && <p className="rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-sm text-amber-950">{copy.legacyNote}</p>}
        <div className="relative mt-2 max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={copy.searchServices} className="pl-9" /></div>
      </CardHeader>
      <CardContent className="p-0">
        {!view.services.length ? <div className="p-8 text-center text-sm text-muted-foreground">{copy.noServices}</div>
          : filteredServices.length ? filteredServices.map(service => <ServiceRouteEditor key={service.id} service={service} view={view} onUpdated={onUpdated} />)
            : <div className="p-8 text-center text-sm text-muted-foreground">{copy.noMatches}</div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg">{copy.audit}</CardTitle><CardDescription>{copy.auditDescription}</CardDescription></CardHeader>
      <CardContent>
        {!view.audit.length ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{copy.noAudit}</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2 font-medium">{copy.date}</th><th className="px-3 py-2 font-medium">{copy.actor}</th><th className="px-3 py-2 font-medium">{copy.action}</th><th className="px-3 py-2 font-medium">{copy.revision}</th></tr></thead>
            <tbody>{view.audit.slice(0, 20).map(entry => <tr key={entry.id} className="border-b last:border-0">
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{entry.actorId}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{entry.action}</td><td className="px-3 py-2.5 tabular-nums">{entry.version}</td>
            </tr>)}</tbody>
          </table></div>}
      </CardContent>
    </Card>
  </div>;
}
