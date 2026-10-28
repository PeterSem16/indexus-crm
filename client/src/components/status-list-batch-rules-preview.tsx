import { useEffect, useState } from "react";
import { CalendarClock, ClipboardCheck, Loader2 } from "lucide-react";
import type { ConfirmationChange, ConfirmationPreview } from "@shared/status-list-confirmation-preview";
import { getStatusListRecapCopy, statusListRecapActionLabel } from "./status-list-recap-copy";

export type BatchRulesPreviewRequest = {
  campaignId: string;
  contactId: string;
  changes: ConfirmationChange[];
  manualActionIds?: string[];
  manualActionDetails?: Record<string, { callbackDate?: string; callbackNote?: string }>;
};

function dateLabel(value: string, locale: string) {
  const wall = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const date = wall ? new Date(Date.UTC(+wall[1], +wall[2] - 1, +wall[3], +wall[4], +wall[5])) : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: wall ? "UTC" : "Europe/Bratislava", weekday: "short", day: "numeric",
    month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

/** The same read-only server plan as final confirmation; never run automations here. */
export function StatusListBatchRulesPreview({ request, locale }: { request?: BatchRulesPreviewRequest; locale: string }) {
  const copy = getStatusListRecapCopy(locale);
  const key = JSON.stringify(request || null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; plan?: ConfirmationPreview; error?: boolean } | null>(null);
  useEffect(() => {
    const input = JSON.parse(key) as BatchRulesPreviewRequest | null;
    const abort = new AbortController();
    let current = true;
    setState(null);
    if (!input?.changes.length) {
      setState({ key, plan: { readOnly: true, mode: "batch", actions: [] } });
      return () => { current = false; abort.abort(); };
    }
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/contacts/${encodeURIComponent(input.contactId)}/status-list-workflows/confirmation-preview`, {
          method: "POST", credentials: "same-origin", signal: abort.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes: input.changes, manualActionIds: input.manualActionIds || [] }),
        });
        if (!response.ok) throw new Error("preview_failed");
        const plan = await response.json() as ConfirmationPreview;
        if (plan.readOnly !== true || !Array.isArray(plan.actions)) throw new Error("invalid_preview");
        if (current) setState({ key, plan });
      } catch {
        if (current && !abort.signal.aborted) setState({ key, error: true });
      }
    })();
    return () => { current = false; abort.abort(); };
  }, [key, retry]);
  const visible = state?.key === key ? state : null;
  return <section className="sl-batch-rules" data-testid="status-list-batch-rules-preview" aria-busy={!visible}>
    <h3><ClipboardCheck className="h-4 w-4" aria-hidden="true" />{copy.summaryOverview}</h3>
    {!visible ? <p role="status"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{copy.loading}</p>
      : visible.error ? <div role="alert"><p>{copy.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div>
      : !visible.plan?.actions.length ? <p>{copy.empty}</p>
      : <div className="sl-batch-rule-list">{visible.plan.actions.map((action, index) => {
        const details = request?.manualActionDetails?.[action.id];
        const date = action.keptExistingCallback ? action.callbackDate : details?.callbackDate || action.callbackDate;
        const note = action.keptExistingCallback ? action.callbackNote : details?.callbackNote ?? action.callbackNote;
        return <article key={`${action.id}:${index}`} data-condition={action.condition}>
          <span className="sl-batch-rule-source">{action.sourceLabel}</span>
          <strong>{statusListRecapActionLabel(action.actionType, locale)}</strong>
          <span>{copy[action.condition]}</span>
          {action.targetLabel && <p>{action.targetLabel}</p>}
          {action.keptExistingCallback && <p>{copy.callbackKept}</p>}
          {date && <p className="sl-batch-rule-date"><CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" /><strong>{copy.callbackRuleDate}: {dateLabel(date, locale)}</strong></p>}
          {note && <p>{copy.callbackNote}: {note}</p>}
        </article>;
      })}</div>}
    <p className="sl-batch-rule-caution">{copy.caution}</p>
  </section>;
}
