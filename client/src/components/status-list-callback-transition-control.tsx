import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock3, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getStatusListCallbackTransitionCopy } from "./status-list-callback-transition-copy";
import "./status-list-callback-transition-control.css";

type Owner = "legacy" | "compatible";
type Readiness = {
  campaignId: string;
  missionName: string;
  fingerprint: string;
  capturedAt: string;
  owner: Owner;
  supported: boolean;
  ready: boolean;
  blockers: string[];
  callbackCount: number;
  pendingCount: number;
  failedCount: number;
  legacyOnlyCount: number;
  audit: Array<{ at: string; from: string; to: string; actorName: string | null }>;
};

const blockerCopyKeys: Record<string, keyof ReturnType<typeof getStatusListCallbackTransitionCopy>> = {
  unsupported_mission: "labelUnsupportedMission",
  callback_config_unsupported: "labelCallbackConfigUnsupported",
  legacy_config_changed: "labelLegacyConfigChanged",
  internal_workflow_dependency: "labelInternalWorkflowDependency",
  background_dependency: "labelBackgroundDependency",
  pending_events: "labelPendingEvents",
  failed_events: "labelFailedEvents",
  untracked_actions: "labelUntrackedActions",
  unsupported_references: "labelUnsupportedReferences",
  no_callbacks: "labelNoCallbacks",
  source_unavailable: "labelSourceUnavailable",
  confirmation_required: "labelConfirmationRequired",
};

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function ownerName(owner: string, copy: ReturnType<typeof getStatusListCallbackTransitionCopy>) {
  return owner === "legacy" ? copy.legacy : owner === "compatible" ? copy.compatible : owner;
}

function useReadiness(campaignId: string) {
  return useQuery<Readiness>({
    queryKey: ["/api/campaigns", campaignId, "status-list-workflows", "transition-readiness"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/transition-readiness`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      const data: unknown = await response.json();
      if (!isReadiness(data) || data.campaignId !== campaignId) throw new Error("invalid_readiness_response");
      return data;
    },
    enabled: Boolean(campaignId),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

function isReadiness(value: unknown): value is Readiness {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.campaignId === "string"
    && typeof data.missionName === "string"
    && typeof data.fingerprint === "string"
    && typeof data.capturedAt === "string"
    && (data.owner === "legacy" || data.owner === "compatible")
    && typeof data.supported === "boolean"
    && typeof data.ready === "boolean"
    && Array.isArray(data.blockers) && data.blockers.every(item => typeof item === "string")
    && typeof data.callbackCount === "number"
    && typeof data.pendingCount === "number"
    && typeof data.failedCount === "number"
    && typeof data.legacyOnlyCount === "number"
    && Array.isArray(data.audit) && data.audit.every(item => Boolean(item) && typeof item.at === "string"
      && typeof item.from === "string" && typeof item.to === "string"
      && (item.actorName === null || typeof item.actorName === "string"));
}

export function StatusListCallbackTransitionControl({ campaignId, locale }: { campaignId: string; locale: string }) {
  const copy = getStatusListCallbackTransitionCopy(locale);
  const query = useReadiness(campaignId);
  const readiness = !query.isError ? query.data : undefined;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [missionConfirmation, setMissionConfirmation] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<"generic" | "stale" | null>(null);
  const [success, setSuccess] = useState(false);
  const [reviewKey, setReviewKey] = useState("");
  const currentReviewKey = readiness ? `${campaignId}:${readiness.owner}:${readiness.fingerprint}` : "";

  useEffect(() => {
    setDialogOpen(false);
    setMissionConfirmation("");
    setBackupConfirmed(false);
    setRequestError(null);
    setSuccess(false);
  }, [campaignId]);
  useEffect(() => {
    if (dialogOpen && !submitting && (query.isFetching || currentReviewKey !== reviewKey)) {
      setDialogOpen(false);
      setMissionConfirmation("");
      setBackupConfirmed(false);
      setRequestError("stale");
    }
  }, [currentReviewKey, reviewKey, dialogOpen, submitting, query.isFetching]);

  const targetOwner: Owner | null = readiness ? (readiness.owner === "legacy" ? "compatible" : readiness.owner === "compatible" ? "legacy" : null) : null;
  const canSwitch = Boolean(readiness && readiness.supported && readiness.ready && targetOwner && !query.isFetching && !submitting);
  const typedExactName = Boolean(readiness && missionConfirmation === readiness.missionName);
  const submit = async () => {
    if (!readiness || !targetOwner || !canSwitch || !typedExactName || !backupConfirmed || currentReviewKey !== reviewKey) return;
    setSubmitting(true);
    setRequestError(null);
    setSuccess(false);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/transition-switch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: readiness.fingerprint,
          expectedOwner: readiness.owner,
          targetOwner,
          backupConfirmed: true,
          missionNameConfirmation: missionConfirmation,
        }),
      });
      if (!response.ok) {
        setRequestError(response.status === 409 ? "stale" : "generic");
        setDialogOpen(false);
        setMissionConfirmation("");
        setBackupConfirmed(false);
        await query.refetch();
        return;
      }
      setDialogOpen(false);
      setMissionConfirmation("");
      setBackupConfirmed(false);
      const refreshed = await query.refetch();
      if (refreshed.isError || refreshed.data?.owner !== targetOwner) setRequestError("generic");
      else setSuccess(true);
    } catch {
      setRequestError("generic");
      setDialogOpen(false);
      setMissionConfirmation("");
      setBackupConfirmed(false);
      await query.refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  };

  return <section className="slct" data-testid="callback-transition-control" aria-labelledby="slct-title">
    <header className="slct-head">
      <div>
        <span className="slct-kicker">{copy.eyebrow}</span>
        <h4 id="slct-title">{copy.title}</h4>
        <p>{copy.intro}</p>
      </div>
      <Button variant="outline" size="sm" data-testid="callback-transition-refresh" disabled={query.isFetching || submitting} onClick={() => { setRequestError(null); setSuccess(false); void query.refetch(); }}>
        <RefreshCw size={13} className="mr-1" />{copy.refresh}
      </Button>
    </header>
    <div className="slct-body">
      {query.isFetching && <div className="slct-skeleton" role="status" aria-label={copy.loading} data-testid="callback-transition-loading" />}
      {query.isError && <div className="slct-message slct-message-error" role="alert" data-testid="callback-transition-load-error">
        <AlertTriangle size={15} /><span>{copy.error}</span>
        <Button variant="outline" size="sm" data-testid="callback-transition-retry" onClick={() => void query.refetch()}><RefreshCw size={13} className="mr-1" />{copy.retry}</Button>
      </div>}
      {requestError && <div className="slct-message slct-message-error" role="alert" data-testid="callback-transition-switch-error">
        <AlertTriangle size={15} /><span>{requestError === "stale" ? copy.staleError : copy.switchError}</span>
      </div>}
      {success && readiness && <div className="slct-message slct-message-success" role="status" data-testid="callback-transition-switch-success">
        <CheckCircle2 size={15} /><span>{copy.success}</span>
      </div>}
      {readiness && !query.isFetching && <>
        {!readiness.supported && <div className="slct-unavailable" role="status" data-testid="callback-transition-unavailable">{copy.unavailable}</div>}
        <div className="slct-overview">
          <div className="slct-owner">
            <span>{copy.owner}</span>
            <strong>{ownerName(readiness.owner, copy)}</strong>
            <span className={`slct-readiness ${readiness.ready && readiness.supported ? "is-ready" : "is-blocked"}`}>
              {readiness.ready && readiness.supported ? copy.ready : copy.blocked}
            </span>
          </div>
          <div className="slct-counts" aria-label={copy.callbacks}>
            <div><strong>{readiness.callbackCount}</strong><span>{copy.callbacks}</span></div>
            <div><strong>{readiness.pendingCount}</strong><span>{copy.pending}</span></div>
            <div><strong>{readiness.failedCount}</strong><span>{copy.failed}</span></div>
            <div><strong>{readiness.legacyOnlyCount}</strong><span>{copy.legacyOnly}</span></div>
          </div>
        </div>
        <div className="slct-meta"><span>{copy.captured}: {date(readiness.capturedAt)}</span></div>
        {readiness.blockers.length > 0 && <section className="slct-blockers" aria-label={copy.blockers} data-testid="callback-transition-blockers">
          <strong>{copy.blockers}</strong>
          <ul>{readiness.blockers.map((code, index) => <li key={`${code}-${index}`}>{copy[blockerCopyKeys[code] || "labelUnknown"]}</li>)}</ul>
        </section>}
        {readiness.audit.length > 0 ? <details className="slct-audit">
          <summary><Clock3 size={13} />{copy.audit}</summary>
          <ul>{readiness.audit.map((entry, index) => <li key={`${entry.at}-${index}`}>
            <time dateTime={entry.at}>{date(entry.at)}</time>
            <span>{interpolate(copy.fromTo, { from: ownerName(entry.from, copy), to: ownerName(entry.to, copy) })}</span>
            {entry.actorName && <small>{interpolate(copy.by, { name: entry.actorName })}</small>}
          </li>)}</ul>
        </details> : <p className="slct-no-audit">{copy.noAudit}</p>}
        {readiness.supported && <div className="slct-action">
          <Button data-testid="callback-transition-open-confirm" disabled={!canSwitch} onClick={() => {
            setRequestError(null);
            setSuccess(false);
            setMissionConfirmation("");
            setBackupConfirmed(false);
            setReviewKey(currentReviewKey);
            setDialogOpen(true);
          }}>
            <ArrowLeftRight size={14} className="mr-2" />{targetOwner ? interpolate(copy.switchTo, { owner: ownerName(targetOwner, copy) }) : copy.blocked}
          </Button>
          {!readiness.ready && <span>{copy.blocked}</span>}
        </div>}
      </>}
    </div>
    <AlertDialog open={dialogOpen} onOpenChange={open => {
      setDialogOpen(open);
      if (!open) { setMissionConfirmation(""); setBackupConfirmed(false); }
    }}>
      <AlertDialogContent className="slct-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {readiness && targetOwner ? interpolate(copy.confirmIntro, {
              mission: readiness.missionName,
              from: ownerName(readiness.owner, copy),
              to: ownerName(targetOwner, copy),
            }) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="slct-confirm-fields">
          <label>{copy.typeName}
            <input data-testid="callback-transition-mission-confirmation" autoComplete="off" value={missionConfirmation} onChange={event => setMissionConfirmation(event.target.value)} />
          </label>
          <label className="slct-checkbox">
            <input data-testid="callback-transition-backup-confirmation" type="checkbox" checked={backupConfirmed} onChange={event => setBackupConfirmed(event.target.checked)} />
            <span><strong>{copy.backupCheck}</strong><small>{copy.backupCaveat}</small></span>
          </label>
          <details className="slct-help">
            <summary><HelpCircle size={14} />{copy.helpTitle}</summary>
            <p>{copy.releaseAcknowledgment}</p>
            <p>{copy.help}</p>
          </details>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="callback-transition-cancel">{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button data-testid="callback-transition-submit" disabled={!canSwitch || !typedExactName || !backupConfirmed || submitting} onClick={event => { event.preventDefault(); void submit(); }}>
              {submitting ? copy.submitting : copy.submit}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
