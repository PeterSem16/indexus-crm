import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Eye, Loader2, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAutomaticInitialCopy } from "./status-list-automatic-initial-copy";
import "./status-list-automatic-initial.css";

type Scope = "mission" | "contact";
type PreviewAction = {
  id: string;
  actionType: string;
  questionLabel: string | null;
  condition: boolean | null;
  status: string;
  issues: string[];
};
type PreviewContact = { id: string; label: string; actions: PreviewAction[] };
type Preview = {
  fingerprint: string;
  mode: "immediate" | "batch";
  contacts: PreviewContact[];
  summary: { contacts: number; readyContacts: number; readyActions: number; skippedActions: number };
};
type Props = {
  campaignId: string;
  itemId: string;
  locale: string;
  selectedContactId: string;
  disabled: boolean;
  revisionIdentity: string;
};
type TaggedPreview = { identity: string; data: Preview };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

const issueAliases: Record<string, string> = {
  invalid_native_config: "native_config",
  invalid_native_action_config: "native_config",
  missing_owner: "owner_required",
  missing_role: "owner_required",
  invalid_condition_config: "invalid_condition",
  unsupported: "unsupported_action",
  action_unsupported: "unsupported_action",
  missing_required_answer: "missing_answer",
  missing_template: "invalid_template",
  target_required: "missing_target",
  stale_revision: "revision_conflict",
  previously_attempted: "previous_attempt",
  already_attempted: "previous_attempt",
};

export function StatusListAutomaticInitial({
  campaignId,
  itemId,
  locale,
  selectedContactId,
  disabled,
  revisionIdentity,
}: Props) {
  const t = getAutomaticInitialCopy(locale);
  const [scope, setScope] = useState<Scope>("contact");
  const [preview, setPreview] = useState<TaggedPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<"preview" | "confirm" | "changed" | "large" | null>(null);
  const [result, setResult] = useState<{ queued: number; deferred: number } | null>(null);
  const requestIdentity = useRef(0);
  const identity = JSON.stringify([campaignId, itemId, locale, scope, selectedContactId, revisionIdentity, disabled]);
  const identityRef = useRef(identity);
  identityRef.current = identity;

  useEffect(() => {
    requestIdentity.current += 1;
    setPreview(null);
    setPreviewLoading(false);
    setConfirming(false);
    setAcknowledged(false);
    setError(null);
    setResult(null);
  }, [identity]);

  const buildPreview = async () => {
    if (disabled || previewLoading || confirming || (scope === "contact" && !selectedContactId)) return;
    const request = ++requestIdentity.current;
    const requestedIdentity = identity;
    setPreview(null);
    setAcknowledged(false);
    setError(null);
    setResult(null);
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/automatic-items/${encodeURIComponent(itemId)}/initial-preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, ...(scope === "contact" ? { contactId: selectedContactId } : {}) }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const body = await response.json();
          code = String(body?.code ?? body?.errorCode ?? body?.error ?? "");
        } catch { /* Localized fallback below. */ }
        if (request !== requestIdentity.current || requestedIdentity !== identityRef.current) return;
        setError(code === "scope_too_large" ? "large" : response.status === 409 || code === "preview_changed" ? "changed" : "preview");
        return;
      }
      const data = await response.json() as Preview;
      if (request !== requestIdentity.current || requestedIdentity !== identityRef.current) return;
      if (!data || !/^[a-f0-9]{64}$/.test(data.fingerprint) || !Array.isArray(data.contacts) ||
        data.contacts.some(contact=>!Array.isArray(contact.actions)) || !data.summary ||
        !["contacts","readyContacts","readyActions","skippedActions"].every(key=>
          Number.isInteger(data.summary[key as keyof Preview["summary"]]) && data.summary[key as keyof Preview["summary"]]>=0) ||
        !["immediate", "batch"].includes(data.mode)) {
        setError("preview");
        return;
      }
      setPreview({ identity: requestedIdentity, data });
    } catch {
      if (request === requestIdentity.current && requestedIdentity === identityRef.current) setError("preview");
    } finally {
      if (request === requestIdentity.current && requestedIdentity === identityRef.current) setPreviewLoading(false);
    }
  };

  const confirm = async () => {
    const current = preview;
    if (!current || current.identity !== identity || disabled || confirming || !acknowledged || current.data.summary.readyActions <= 0) return;
    const request = ++requestIdentity.current;
    const requestedIdentity = identity;
    setConfirming(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/automatic-items/${encodeURIComponent(itemId)}/initial-confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          ...(scope === "contact" ? { contactId: selectedContactId } : {}),
          fingerprint: current.data.fingerprint,
          acknowledged: true,
        }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const body = await response.json();
          code = String(body?.code ?? body?.errorCode ?? body?.error ?? "");
        } catch { /* Localized fallback below. */ }
        if (request !== requestIdentity.current || requestedIdentity !== identityRef.current) return;
        setPreview(null);
        setAcknowledged(false);
        if (code === "scope_too_large") {
          setError("large");
        } else if (response.status === 409 || code === "preview_changed") {
          setError("changed");
        } else {
          setError("confirm");
        }
        return;
      }
      const data = await response.json() as { queued: number; deferred: number };
      if (request !== requestIdentity.current || requestedIdentity !== identityRef.current) return;
      if (typeof data?.queued !== "number" || typeof data?.deferred !== "number") {
        setPreview(null);
        setAcknowledged(false);
        setError("confirm");
        return;
      }
      setResult(data);
      setPreview(null);
      setAcknowledged(false);
    } catch {
      if (request === requestIdentity.current && requestedIdentity === identityRef.current) {
        setPreview(null);
        setAcknowledged(false);
        setError("confirm");
      }
    } finally {
      if (request === requestIdentity.current && requestedIdentity === identityRef.current) setConfirming(false);
    }
  };

  const visiblePreview = preview?.identity === identity ? preview.data : null;
  const actionName = (value: string) => t.actionNames[normalize(value)] || t.unknownAction;
  const statusName = (value: string) => t.statusNames[normalize(value)] || t.unknownStatus;
  const issueName = (value: string) => {
    const key = normalize(value);
    const mapped = issueAliases[key] || (key.startsWith("native_config_") ? "native_config" : key.startsWith("owner_required_") ? "owner_required" : key);
    return t.issueNames[mapped] || t.unknownIssue;
  };

  return <section className="slai" data-testid="automatic-initial-panel" aria-busy={previewLoading || confirming}>
    <header className="slai-heading">
      <div className="slai-icon"><ShieldCheck size={16}/></div>
      <div><h4>{t.title}</h4><p>{t.intro}</p></div>
    </header>
    <div className="slai-scope">
      <span className="slai-label">{t.scopeLabel}</span>
      <label><input data-testid="automatic-initial-scope-contact" type="radio" name={`initial-scope-${itemId}`} checked={scope === "contact"} onChange={() => setScope("contact")} disabled={disabled || confirming}/><span>{t.contactScope}</span></label>
      <label><input data-testid="automatic-initial-scope-mission" type="radio" name={`initial-scope-${itemId}`} checked={scope === "mission"} onChange={() => setScope("mission")} disabled={disabled || confirming}/><span>{t.missionScope}</span></label>
    </div>
    {scope === "mission" && <p className="slai-caution"><AlertTriangle size={14}/><span>{t.missionCaution}</span></p>}
    <p className="slai-note">{t.transitionNote}</p>
    {scope === "contact" && !selectedContactId && <p className="slai-note">{t.noContact}</p>}
    <div className="slai-controls">
      <Button data-testid="automatic-initial-preview" type="button" size="sm" variant="outline" onClick={() => void buildPreview()} disabled={disabled || previewLoading || confirming || (scope === "contact" && !selectedContactId)}>
        {previewLoading ? <Loader2 size={14} className="mr-1.5 animate-spin"/> : <Eye size={14} className="mr-1.5"/>}
        {previewLoading ? t.refreshing : t.preview}
      </Button>
      {visiblePreview && <span className="slai-mode">{visiblePreview.mode === "batch" ? t.batch : t.immediate}</span>}
    </div>
    {error && <p className="slai-error" role="alert"><AlertTriangle size={14}/>{error === "changed" ? t.previewChanged : error === "large" ? t.tooMany : error === "confirm" ? t.confirmError : t.previewError}</p>}
    {result && <div className="slai-success" role="status"><Check size={15}/><span>{t.complete} {t.queued}: {result.queued} · {t.deferred}: {result.deferred}</span></div>}
    {visiblePreview && <div className="slai-plan" aria-live="polite">
      <h5>{t.summary}</h5>
      <div className="slai-totals">
        <div><strong>{visiblePreview.summary.contacts}</strong><span>{t.contacts}</span></div>
        <div><strong>{visiblePreview.summary.readyContacts}</strong><span>{t.eligibleContacts}</span></div>
        <div><strong>{visiblePreview.summary.readyActions}</strong><span>{t.eligibleActions}</span></div>
        <div><strong>{visiblePreview.summary.skippedActions}</strong><span>{t.skippedActions}</span></div>
      </div>
      <div className="slai-contacts">
        {visiblePreview.contacts.map(contact => <article className="slai-contact" key={contact.id}>
          <header><h6>{contact.label}</h6><span>{contact.actions.length} {t.actionCount}</span></header>
          {contact.actions.length ? contact.actions.map((action, index) => {
            const ready = normalize(action.status) === "ready" || normalize(action.status) === "batch_deferred";
            return <div className="slai-action" key={`${action.id}-${index}`}>
              <div className="slai-action-copy">
                <strong>{actionName(action.actionType)}</strong>
                {action.questionLabel && <small>{action.questionLabel}</small>}
                <small>{t.condition}: {action.condition === true ? t.conditionTrue : action.condition === false ? t.conditionFalse : t.conditionUnknown}</small>
                {action.issues?.length > 0 && <ul>{action.issues.map((issue, issueIndex) => <li key={`${issue}-${issueIndex}`}>{issueName(issue)}</li>)}</ul>}
              </div>
              <span className={`slai-status ${ready ? "is-ready" : "is-skipped"}`}>{statusName(action.status)}</span>
            </div>;
          }) : <p className="slai-note">{t.noActions}</p>}
        </article>)}
      </div>
      {visiblePreview.summary.readyActions === 0 && <p className="slai-note">{t.noEligible}</p>}
      {visiblePreview.summary.readyActions > 0 && <>
        <label className="slai-ack"><input data-testid="automatic-initial-acknowledgement" type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={disabled || confirming}/><span>{t.acknowledge}</span></label>
        <Button data-testid="automatic-initial-confirm" type="button" size="sm" onClick={() => void confirm()} disabled={disabled || confirming || !acknowledged}>
          {confirming ? <Loader2 size={14} className="mr-1.5 animate-spin"/> : <Play size={13} className="mr-1.5"/>}
          {confirming ? t.confirming : t.confirm}
        </Button>
      </>}
    </div>}
  </section>;
}

export default StatusListAutomaticInitial;
