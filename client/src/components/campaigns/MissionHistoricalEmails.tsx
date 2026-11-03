import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock3, Search } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MissionHistoricalEmailsCopy } from "./mission-historical-emails-translations";

interface HistoricalEmail {
  id: string; clinicName: string; subject: string; recipientEmail: string;
  senderName: string; sentAt: string | null; recordedAt: string;
}
interface PreviewEmail extends HistoricalEmail { body: string; contactId: string }
interface Props { campaignId: string; missionName?: string }
type Purpose = "contract_proposal" | "informational";
type Phase = "" | "search" | "preview" | "apply";

function formatDate(value: string | null, locale: string, unknown: string) {
  if (!value) return unknown;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava",
  }).format(date);
}

function statusMessage(status: number, copy: MissionHistoricalEmailsCopy) {
  if (status === 403) return copy.forbidden;
  if (status === 409) return copy.stalePreview;
  if (status === 410) return copy.expired;
  if (status === 400 || status === 422) return copy.invalidRequest;
  return status >= 500 ? copy.serverError : copy.invalidRequest;
}

export default function MissionHistoricalEmails({ campaignId, missionName }: Props) {
  const { locale, t } = useI18n();
  const copy = t.missionHistoricalEmails;
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [rows, setRows] = useState<HistoricalEmail[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("contract_proposal");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ reviewToken: string; fingerprint: string; expiresAt: number; missionId: string; purpose: Purpose; rows: PreviewEmail[]; unknownSendingTimes: number } | null>(null);
  const [approved, setApproved] = useState(false);
  const [phase, setPhase] = useState<Phase>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [retryApply, setRetryApply] = useState(false);
  const alive = useRef(true);
  const activeRequest = useRef<AbortController | null>(null);
  const busy = phase !== "";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      activeRequest.current?.abort();
    };
  }, []);

  const clearReview = () => {
    setPreview(null);
    setApproved(false);
    setRetryApply(false);
    setNotice("");
    setError("");
  };

  const request = async (url: string, init: RequestInit) => {
    const controller = new AbortController();
    activeRequest.current = controller;
    return fetch(url, { ...init, signal: controller.signal, credentials: "include" });
  };

  const runSearch = async (cursor: string | null, newSearch: boolean) => {
    if (busy) return;
    setPhase("search");
    setError("");
    setNotice("");
    clearReview();
    if (newSearch) {
      setRows([]);
      setSelected([]);
    }
    const params = new URLSearchParams();
    const q = searchText.trim();
    if (q) params.set("q", q);
    if (cursor) params.set("before", cursor);
    try {
      const response = await request(`/api/campaigns/${encodeURIComponent(campaignId)}/mission-funnel/historical-emails?${params}`, {});
      if (!alive.current) return;
      if (!response.ok) { setError(statusMessage(response.status, copy)); return; }
      const result = await response.json() as { rows: HistoricalEmail[]; nextCursor: string | null };
      if (!alive.current) return;
      setRows(result.rows);
      setNextCursor(result.nextCursor);
    } catch {
      if (alive.current) setError(copy.networkError);
    } finally {
      if (alive.current) setPhase("");
    }
  };

  const changeSearch = (value: string) => {
    setSearchText(value);
    setRows([]);
    setSelected([]);
    setNextCursor(null);
    clearReview();
  };

  const toggleRow = (id: string, checked: boolean) => {
    clearReview();
    setSelected(current => checked
      ? current.length >= 50 ? current : [...current, id]
      : current.filter(item => item !== id));
  };

  const prepareReview = async () => {
    if (busy) return;
    if (!selected.length) { setError(copy.chooseMessages); return; }
    if (reason.trim().length < 10) { setReasonError(copy.reasonTooShort); return; }
    if (reason.length > 1000) { setReasonError(copy.reasonTooLong); return; }
    setReasonError("");
    clearReview();
    setPhase("preview");
    setError("");
    try {
      const response = await request(`/api/campaigns/${encodeURIComponent(campaignId)}/mission-funnel/historical-emails/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: selected, purpose, reason: reason.trim() }),
      });
      if (!alive.current) return;
      if (!response.ok) { setError(statusMessage(response.status, copy)); return; }
      const result = await response.json() as NonNullable<typeof preview>;
      if (!alive.current) return;
      setPreview(result);
    } catch {
      if (alive.current) setError(copy.networkError);
    } finally {
      if (alive.current) setPhase("");
    }
  };

  const applyReview = async () => {
    if (!preview || !approved || busy) return;
    setPhase("apply");
    setError("");
    setNotice("");
    try {
      const response = await request(`/api/campaigns/${encodeURIComponent(campaignId)}/mission-funnel/historical-emails/apply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewToken: preview.reviewToken, approved: true }),
      });
      if (!alive.current) return;
      if (!response.ok) {
        const message = statusMessage(response.status, copy);
        if ([409, 403, 410].includes(response.status)) {
          setPreview(null);
          setApproved(false);
          setRetryApply(false);
        } else setRetryApply(true);
        setError(response.status === 409 || response.status === 403 || response.status === 410
          ? message : response.status >= 500 ? copy.applyError : message);
        return;
      }
      const result = await response.json() as { status: "applied" | "already_applied"; updates: number };
      if (!alive.current) return;
      setPreview(null);
      setApproved(false);
      setRetryApply(false);
      const appliedIds = new Set(selected);
      setSelected([]);
      setRows(current => current.filter(row => !appliedIds.has(row.id)));
      setNotice(result.status === "already_applied" ? copy.alreadyApplied : copy.applied);
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mission-funnel"] });
    } catch {
      if (alive.current) {
        setError(copy.networkError);
        setRetryApply(true);
      }
    } finally {
      if (alive.current) setPhase("");
    }
  };

  return (
    <section aria-labelledby="historical-email-title" className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="historical-email-title" className="text-base font-semibold">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.help}</p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <p role="note" className="flex gap-2 rounded-md border border-amber-600/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
          <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{copy.warning}
        </p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void runSearch(null, true); }}>
          <label className="min-w-0 flex-1">
            <span className="sr-only">{copy.searchLabel}</span>
            <input value={searchText} disabled={busy} onChange={event => changeSearch(event.target.value)}
              placeholder={copy.searchPlaceholder} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
          </label>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-muted/50 px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Search aria-hidden="true" className="h-4 w-4" />{phase === "search" ? copy.loading : copy.search}
          </button>
        </form>
        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
        {notice && <p role="status" className="rounded-md border border-teal-700/25 bg-teal-700/5 p-3 text-sm text-teal-900 dark:text-teal-200">{notice}</p>}
        {phase === "search" ? (
          <div aria-label={copy.loading} aria-live="polite" className="space-y-2">
            <div className="h-12 animate-pulse rounded-md bg-muted/70" /><div className="h-12 animate-pulse rounded-md bg-muted/70" />
          </div>
        ) : rows.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground"><tr>
                  <th className="w-10 px-3 py-2"><span className="sr-only">{copy.selected}</span></th>
                  <th className="px-3 py-2">{copy.clinic}</th><th className="px-3 py-2">{copy.subject}</th>
                  <th className="px-3 py-2">{copy.recipient}</th><th className="px-3 py-2">{copy.sender}</th>
                  <th className="px-3 py-2">{copy.sentAt}</th><th className="px-3 py-2">{copy.recordedAt}</th>
                </tr></thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map(row => <tr key={row.id} className="hover:bg-muted/25">
                    <td className="px-3 py-2.5"><input type="checkbox" aria-label={`${copy.selected}: ${row.subject}`} disabled={busy || (!selected.includes(row.id) && selected.length >= 50)}
                      checked={selected.includes(row.id)} onChange={event => toggleRow(row.id, event.target.checked)}
                      className="h-4 w-4 rounded border-input accent-teal-700 focus-visible:ring-2 focus-visible:ring-ring" /></td>
                    <td className="px-3 py-2.5 font-medium">{row.clinicName}</td><td className="max-w-[240px] truncate px-3 py-2.5">{row.subject}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.recipientEmail}</td><td className="px-3 py-2.5 text-muted-foreground">{row.senderName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{formatDate(row.sentAt, locale, copy.unknown)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{formatDate(row.recordedAt, locale, copy.unknown)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{selected.length} {copy.selected}. {copy.maxSelected}</span>
              <div className="flex gap-2">
                {nextCursor && <button type="button" disabled={busy} onClick={() => {
                  void runSearch(nextCursor, false);
                }} className="rounded border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50">{copy.next}</button>}
              </div>
            </div>
          </>
        ) : <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{copy.noRows}</p>}

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            {copy.purpose}
            <select value={purpose} disabled={busy} onChange={event => { setPurpose(event.target.value as Purpose); clearReview(); }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60">
              <option value="contract_proposal">{copy.contractProposal}</option><option value="informational">{copy.informational}</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            {copy.reason}
            <textarea value={reason} maxLength={1000} disabled={busy} onChange={event => {
              setReason(event.target.value); setReasonError(""); clearReview();
            }} placeholder={copy.reasonHint} rows={2} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60" />
            <span className="block text-right font-normal tabular-nums">{reason.length}/1000</span>
          </label>
        </div>
        {reasonError && <p role="alert" className="text-sm text-destructive">{reasonError}</p>}
        <button type="button" disabled={busy || selected.length === 0} onClick={() => void prepareReview()}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {phase === "preview" ? copy.previewing : copy.preview}
        </button>

        {preview && <section aria-label={copy.preview} className="space-y-4 rounded-lg border border-teal-700/25 bg-teal-700/[0.035] p-3 sm:p-4">
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <p><span className="font-semibold">{copy.mission}: </span>{missionName || preview.missionId}</p>
            <p><span className="font-semibold">{copy.purpose}: </span>{preview.purpose === "contract_proposal" ? copy.contractProposal : copy.informational}</p>
            <p className="break-all"><span className="font-semibold">{copy.fingerprint}: </span>{preview.fingerprint}</p>
            <p><span className="font-semibold">{copy.expiresAt}: </span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(preview.expiresAt)}</p>
          </div>
          {Boolean(preview.unknownSendingTimes) && <p role="note" className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-950 dark:text-amber-100">{copy.unknownSendingTimes}</p>}
          <div className="space-y-3">
            {preview.rows.map(row => <article key={row.id} className="rounded-md border border-border bg-card p-3">
              <h3 className="font-semibold">{row.subject}</h3>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                <div><dt className="inline font-medium">{copy.clinic}: </dt><dd className="inline">{row.clinicName}</dd></div>
                <div><dt className="inline font-medium">{copy.recipient}: </dt><dd className="inline">{row.recipientEmail}</dd></div>
                <div><dt className="inline font-medium">{copy.sender}: </dt><dd className="inline">{row.senderName}</dd></div>
                <div><dt className="inline font-medium">{copy.sentAt}: </dt><dd className="inline">{formatDate(row.sentAt, locale, copy.unknown)}</dd></div>
                <div><dt className="inline font-medium">{copy.recordedAt}: </dt><dd className="inline">{formatDate(row.recordedAt, locale, copy.unknown)}</dd></div>
              </dl>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.messageBody}</p>
                <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm leading-relaxed">{row.body}</div>
              </div>
            </article>)}
          </div>
          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <input type="checkbox" checked={approved} disabled={busy} onChange={event => {
              setApproved(event.target.checked); setRetryApply(false); setError("");
            }} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-teal-700 focus-visible:ring-2 focus-visible:ring-ring" />
            <span>{copy.approvalLabel}</span>
          </label>
          <button type="button" disabled={!approved || busy} onClick={() => void applyReview()}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-teal-800/30 bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
            {phase === "apply" ? copy.applying : retryApply ? copy.retry : copy.apply}
          </button>
        </section>}
      </div>
    </section>
  );
}
