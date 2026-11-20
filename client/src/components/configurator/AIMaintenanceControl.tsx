import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3, Hand, Pause, Play, RefreshCw, ShieldAlert } from "lucide-react";
import type { AIMaintenanceAction, AIMaintenanceCommand, AIMaintenanceView } from "@shared/ai-maintenance";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import type { AISettingsCopy } from "@/i18n/ai-settings-translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const maintenanceQueryKey = ["/api/configurator/ai/maintenance"] as const;
const staleAfterMs = 12_000;

type ConfirmationSnapshot = {
  action: AIMaintenanceAction;
  expectedVersion: number;
  operationId: string | null;
};

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function localizedError(copy: AISettingsCopy, error: unknown): string {
  const code = errorCode(error);
  const message = code ? copy[code as keyof AISettingsCopy] : undefined;
  return typeof message === "string" ? message : copy.maintenance_unavailable;
}

function actionLabel(action: AIMaintenanceAction, copy: AISettingsCopy) {
  if (action === "pause") return copy.maintenanceActionPause;
  if (action === "resume") return copy.maintenanceActionResume;
  return copy.maintenanceActionTakeover;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border bg-background px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
  </div>;
}

export function AIMaintenanceControl() {
  const { t } = useI18n();
  const copy = t.aiSettings;
  const [confirmation, setConfirmation] = useState<ConfirmationSnapshot | null>(null);
  const [now, setNow] = useState(Date.now);
  const [reconcileAfter, setReconcileAfter] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery<AIMaintenanceView>({
    queryKey: maintenanceQueryKey,
    queryFn: async () => (await apiRequest("GET", "/api/configurator/ai/maintenance")).json(),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (snapshot: ConfirmationSnapshot) => {
      const command: AIMaintenanceCommand = {
        action: snapshot.action,
        expectedVersion: snapshot.expectedVersion,
        operationId: snapshot.operationId,
        confirm: true,
      };
      return await (await apiRequest("PUT", "/api/configurator/ai/maintenance", command)).json() as AIMaintenanceView;
    },
    retry: false,
    onSuccess: updated => {
      queryClient.setQueryData(maintenanceQueryKey, updated);
      setConfirmation(null);
    },
    onError: () => {
      setConfirmation(null);
      setReconcileAfter(Date.now());
      void queryClient.invalidateQueries({ queryKey: maintenanceQueryKey, refetchType: "active" });
    },
  });

  if (query.isLoading && !query.data) return <Card aria-label={copy.maintenanceTitle}>
    <CardHeader className="pb-3"><div className="h-5 w-44 animate-pulse rounded bg-muted" /><div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" /></CardHeader>
    <CardContent className="space-y-3"><div className="h-14 animate-pulse rounded-md bg-muted" /><div className="h-24 animate-pulse rounded-md bg-muted" /></CardContent>
  </Card>;

  const view = query.data;
  const pollingFailed = query.isError || query.isRefetchError;
  const isStale = !view || !query.dataUpdatedAt || now - query.dataUpdatedAt > staleAfterMs ||
    pollingFailed || query.dataUpdatedAt <= reconcileAfter;
  const blocked = query.isLoading || isStale || mutation.isPending;
  const canPause = !!view && view.mode === "running" &&
    view.workers.unsupported === 0 && view.workers.confirmed >= view.workers.alive;
  const canResume = !!view && view.mode === "paused" && view.ownedByMe;
  const canTakeover = !!view && view.mode === "paused" && !view.ownedByMe;
  const openConfirmation = (action: AIMaintenanceAction) => {
    if (!view || blocked) return;
    setConfirmation({ action, expectedVersion: view.version, operationId: view.operationId });
  };
  const confirmAction = () => {
    if (confirmation && !blocked && Date.now() - query.dataUpdatedAt <= staleAfterMs)
      mutation.mutate(confirmation);
  };
  const confirmDescription = confirmation?.action === "pause" ? copy.maintenanceConfirmPause
    : confirmation?.action === "resume" ? copy.maintenanceConfirmResume : copy.maintenanceConfirmTakeover;
  const confirmButton = confirmation?.action === "pause" ? copy.maintenancePause
    : confirmation?.action === "resume" ? copy.maintenanceResume : copy.maintenanceTakeover;
  const statusLabel = view?.mode === "paused" ? copy.maintenancePaused : copy.maintenanceRunning;

  return <>
    <Card aria-label={copy.maintenanceTitle} data-testid="ai-maintenance-control">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-primary" />{copy.maintenanceTitle}
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">{copy.maintenanceDescription}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {view && <Badge variant="outline" className={view.mode === "paused"
              ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}>
              {statusLabel}
            </Badge>}
            <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
              {query.isFetching ? copy.maintenanceRefreshing : copy.maintenanceRefresh}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!view || isStale) && <div role="alert" className="flex flex-wrap items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-destructive">{query.error ? localizedError(copy, query.error) : copy.maintenanceUnavailable}</p>
        </div>}

        {view && <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md bg-muted/35 px-3 py-2 text-xs">
            <span className="font-mono">{copy.maintenanceVersion}: v{view.version}</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{copy.maintenanceChangedAt}: {new Date(view.changedAt).toLocaleString()}</span>
            {view.mode === "paused" && <span>{copy.maintenanceOwner}: {view.ownedByMe ? copy.maintenanceOwnedByMe : copy.maintenanceOwnedByOther}</span>}
          </div>

          <section aria-label={copy.maintenanceWorkers} className="space-y-2">
            <h3 className="text-sm font-semibold">{copy.maintenanceWorkers}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label={copy.maintenanceAlive} value={view.workers.alive} />
              <Metric label={copy.maintenanceConfirmed} value={view.workers.confirmed} />
              <Metric label={copy.maintenanceUnsupported} value={view.workers.unsupported} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{copy.maintenanceDeployPrerequisite}</p>
            {view.workers.unsupported > 0 && <p className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{copy.maintenanceUnsupportedBlock}
            </p>}
            {view.workers.unsupported === 0 && (view.workers.alive === 0 || view.workers.confirmed < view.workers.alive) &&
              <p className="text-xs text-amber-800">{copy.maintenanceDeployPrerequisite}</p>}
          </section>

          <section aria-label={copy.maintenanceQueues} className="space-y-2">
            <h3 className="text-sm font-semibold">{copy.maintenanceQueues}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {([
                [copy.maintenanceJobsQueue, view.queues.jobs],
                [copy.maintenanceInferenceQueue, view.queues.inference],
              ] as const).map(([label, queue]) => <div key={label} className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">{label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label={copy.maintenanceWaiting} value={queue.pending} />
                  <Metric label={copy.maintenanceProcessing} value={queue.processing} />
                </div>
              </div>)}
            </div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span>{copy.maintenanceGatewayDrain}</span><Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{copy.maintenanceUnverified}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span>{copy.maintenanceBackendDrain}</span><Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{copy.maintenanceUnverified}</Badge>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-950">
            <p>{copy.maintenanceNoRestartEvidence}</p>
            <p>{copy.maintenanceOperationalLimits}</p>
            <p>{copy.maintenanceOwnershipWarning}</p>
            <p>{copy.maintenanceNoAutoExpiry}</p>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {view.mode === "running" && <Button type="button" variant="destructive" disabled={blocked || !canPause} onClick={() => openConfirmation("pause")}>
              <Pause className="mr-2 h-4 w-4" />{copy.maintenancePause}
            </Button>}
            {view.mode === "paused" && view.ownedByMe && <Button type="button" disabled={blocked || !canResume} onClick={() => openConfirmation("resume")}>
              <Play className="mr-2 h-4 w-4" />{copy.maintenanceResume}
            </Button>}
            {view.mode === "paused" && !view.ownedByMe && <Button type="button" variant="outline" disabled={blocked || !canTakeover} onClick={() => openConfirmation("takeover")}>
              <Hand className="mr-2 h-4 w-4" />{copy.maintenanceTakeover}
            </Button>}
            {mutation.isPending && <span role="status" className="self-center text-xs text-muted-foreground">{copy.maintenanceRefreshing}</span>}
          </div>
          {mutation.error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {localizedError(copy, mutation.error)}
          </p>}
        </>}

        <div className="rounded-md border-l-2 border-primary/50 bg-muted/25 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {copy.maintenanceFlowHelp}
        </div>
        {view && <section aria-label={copy.maintenanceAudit} className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{copy.maintenanceAudit}</h3><span className="text-xs text-muted-foreground">{copy.maintenanceNoAutoExpiry}</span></div>
          {!view.audit.length ? <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{copy.maintenanceNoAudit}</p>
            : <ol className="space-y-1.5">
              {view.audit.slice(0, 8).map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-xs">
                <span className="font-medium">{actionLabel(entry.action, copy)} <span className="font-mono text-muted-foreground">v{entry.version}</span></span>
                <time dateTime={entry.at} className="text-muted-foreground">{new Date(entry.at).toLocaleString()}</time>
              </li>)}
            </ol>}
        </section>}
      </CardContent>
    </Card>

    <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmation(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.maintenanceConfirmTitle}</DialogTitle>
          <DialogDescription>{confirmDescription}</DialogDescription>
        </DialogHeader>
        {confirmation && <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          <p><span className="text-muted-foreground">{copy.action}: </span>{actionLabel(confirmation.action, copy)}</p>
          <p className="font-mono text-xs"><span className="font-sans text-muted-foreground">{copy.maintenanceConfirmVersion}: </span>v{confirmation.expectedVersion}</p>
          <p className="break-all font-mono text-xs"><span className="font-sans text-muted-foreground">{copy.maintenanceConfirmOperation}: </span>{confirmation.operationId ?? "—"}</p>
          {confirmation.action === "takeover" && <p className="text-xs font-medium text-amber-900">{copy.maintenanceOwnershipWarning}</p>}
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>{copy.cancel}</Button>
          <Button type="button" disabled={blocked || mutation.isPending} onClick={confirmAction}>
            {mutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}{confirmButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
