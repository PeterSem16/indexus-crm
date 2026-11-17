import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Clock3, Copy, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type NoteStatus = "pending" | "processing" | "review_required" | "failed" | "approved";

interface EmailNoteRecord {
  id: string | number;
  status: NoteStatus;
  note: string | null;
  error_code?: string | null;
  approved_note?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  version: number;
}

interface NoteResponse {
  enabled: boolean;
  record: EmailNoteRecord | null;
}

interface ApiFailure extends Error {
  status?: number;
}

interface EmailNoteDraftProps {
  userId?: string | number | null;
  emailId?: string | number | null;
  mailbox?: string | null;
}

const getApiError = async (response: Response): Promise<ApiFailure> => {
  const error = new Error(`email_note_${response.status}`) as ApiFailure;
  error.status = response.status;
  return error;
};

export function EmailNoteDraft({ userId, emailId, mailbox }: EmailNoteDraftProps) {
  const { locale, t } = useI18n();
  const text = t.emailNoteDraft;
  const fieldId = `email-note-edit-${useId().replace(/:/g, "")}`;
  const queryClient = useQueryClient();
  const scope = useMemo(() => ["/api/users", userId ?? null, "ms365-email", emailId ?? null, "ai-note", mailbox ?? ""], [userId, emailId, mailbox]);
  const queryKey = useMemo(() => [...scope], [scope]);
  const apiUrl = userId && emailId
    ? `/api/users/${encodeURIComponent(String(userId))}/ms365-email/${encodeURIComponent(String(emailId))}/ai-note?mailbox=${encodeURIComponent(mailbox || "")}`
    : "";
  const noteQuery = useQuery<NoteResponse, ApiFailure>({
    queryKey,
    enabled: !!apiUrl,
    queryFn: async ({ signal }) => {
      const response = await fetch(apiUrl, { credentials: "include", signal });
      if (!response.ok) throw await getApiError(response);
      return response.json() as Promise<NoteResponse>;
    },
    refetchInterval: query => {
      const response = query.state.data as NoteResponse | undefined;
      const status = response?.record?.status;
      return status === "pending" || status === "processing" ? 5000 : false;
    },
    retry: false,
  });
  const response = noteQuery.data;
  const record = response?.record ?? null;
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [actionError, setActionError] = useState<ApiFailure | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    setDraft("");
    setDirty(false);
    setActionError(null);
    setCopyDone(false);
    setCopyFailed(false);
  }, [userId, emailId, mailbox]);

  useEffect(() => {
    if (record?.status === "review_required" && !dirty) setDraft(record.note || "");
    if (record?.status === "approved" && !dirty) setDraft(record.approved_note || record.note || "");
  }, [record?.id, record?.status, record?.version, record?.note, record?.approved_note, dirty]);

  const createMutation = useMutation<NoteResponse, ApiFailure>({
    mutationFn: async () => {
      const result = await fetch(apiUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!result.ok) throw await getApiError(result);
      return result.json() as Promise<NoteResponse>;
    },
    retry: false,
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data);
      setActionError(null);
    },
    onError: error => setActionError(error),
  });

  const approveMutation = useMutation<NoteResponse, ApiFailure, void>({
    mutationFn: async () => {
      const result = await fetch(apiUrl, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft, version: record?.version }),
      });
      if (!result.ok) throw await getApiError(result);
      return result.json() as Promise<NoteResponse>;
    },
    retry: false,
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data);
      setDirty(false);
      setActionError(null);
    },
    onError: error => setActionError(error),
  });

  if (response?.enabled === false) return null;

  const error = noteQuery.isError ? noteQuery.error : null;
  const errorText = error?.status === 401 || error?.status === 403
    ? text.authorizationError
    : text.loadError;
  const errorHint = error?.status === 401 || error?.status === 403 ? "" : text.genericError;
  const status = record?.status;
  const isReview = status === "review_required";
  const isApproved = status === "approved";
  const displayedNote = isApproved ? (record?.approved_note || record?.note || "") : record?.note || "";
  const canCopy = !!(isReview ? draft : displayedNote);
  const statusDetails: Record<NoteStatus, { label: string; hint: string; icon: typeof Clock3; style: string }> = {
    pending: { label: text.pending, hint: text.pendingHint, icon: Clock3, style: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100" },
    processing: { label: text.processing, hint: text.processingHint, icon: Loader2, style: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100" },
    review_required: { label: text.reviewRequired, hint: text.reviewHint, icon: AlertTriangle, style: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100" },
    failed: { label: text.failed, hint: text.failedHint, icon: AlertTriangle, style: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100" },
    approved: { label: text.approved, hint: text.approvedHint, icon: CheckCircle2, style: "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100" },
  };

  const copyNote = async () => {
    const value = isReview ? draft : displayedNote;
    try {
      await navigator.clipboard.writeText(value);
      setCopyDone(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopyDone(false), 1800);
    } catch {
      setCopyFailed(true);
      setCopyDone(false);
    }
  };

  const HeaderIcon = status ? statusDetails[status].icon : Sparkles;
  const loadingInitial = noteQuery.isLoading && !response;

  return (
    <section className="my-3 rounded-md border border-teal-200 bg-teal-50/40 p-3 text-foreground transition-colors dark:border-teal-900 dark:bg-teal-950/20" aria-label={text.title} data-testid="email-note-draft">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
            <HeaderIcon className={`h-4 w-4 ${status === "processing" ? "animate-spin" : ""}`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{text.title}</h3>
            {record && !isApproved && (
              <p className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-teal-800 dark:text-teal-200">{text.aiDraft}</p>
            )}
          </div>
        </div>
        {status && (
          <Badge variant="outline" className={`h-6 gap-1.5 border text-[11px] font-medium ${statusDetails[status].style}`}>
            {statusDetails[status].label}
          </Badge>
        )}
      </header>

      {loadingInitial ? (
        <div className="mt-3 space-y-2" aria-label={text.loadError} aria-busy="true">
          <div className="h-3 w-2/5 animate-pulse rounded bg-teal-100 dark:bg-teal-900/50" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-teal-100 dark:bg-teal-900/50" />
        </div>
      ) : error ? (
        <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2.5 dark:border-rose-800 dark:bg-rose-950/50" role="alert">
          <p className="text-xs font-semibold text-rose-900 dark:text-rose-100">{text.errorTitle}</p>
          <p className="mt-1 text-xs text-rose-800 dark:text-rose-200">{errorText}</p>
          {errorHint && <p className="mt-1 text-xs text-rose-800/80 dark:text-rose-200/80">{errorHint}</p>}
          {noteQuery.isError && (
            <Button variant="outline" size="sm" className="mt-2 h-7" onClick={() => { setActionError(null); void noteQuery.refetch(); }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />{text.refresh}
            </Button>
          )}
        </div>
      ) : !record ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{text.noDraft}</p>
            <Button size="sm" className="h-8 bg-teal-800 text-white hover:bg-teal-900 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {createMutation.isPending ? text.generating : text.generate}
            </Button>
          </div>
          {actionError && (
            <p role="alert" className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
              <span className="font-semibold">{text.errorTitle}: </span>
              {actionError.status === 401 || actionError.status === 403 ? text.authorizationError : text.genericError}
            </p>
          )}
        </>
      ) : (
        <>
          <div className={`mt-3 rounded border px-2.5 py-2 ${statusDetails[status!].style}`}>
              <p className="text-xs">{statusDetails[status!].hint}</p>
          </div>

          {status === "failed" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-7" onClick={() => { setActionError(null); void noteQuery.refetch(); }} disabled={noteQuery.isFetching}>
                {noteQuery.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                {text.refresh}
              </Button>
            </div>
          )}

          {isReview && (
            <div className="mt-3 space-y-2">
              <label htmlFor={fieldId} className="text-xs font-medium">{text.editLabel}</label>
              <textarea
                id={fieldId}
                value={draft}
                onChange={event => { setDraft(event.target.value); setDirty(true); }}
                rows={5}
                maxLength={20000}
                className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:focus-visible:ring-teal-400"
                aria-describedby={`${fieldId}-hint`}
                data-testid="email-note-edit"
              />
              <p id={`${fieldId}-hint`} className="text-[11px] text-muted-foreground">{text.editHint}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={copyNote} disabled={!canCopy}>
                  {copyDone ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copyDone ? text.copied : text.copy}
                </Button>
                <Button type="button" size="sm" className="h-8 bg-teal-800 text-white hover:bg-teal-900 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200" onClick={() => { if (draft.trim().length >= 12 && draft.length <= 20000) approveMutation.mutate(); }} disabled={approveMutation.isPending || draft.trim().length < 12 || draft.length > 20000}>
                  {approveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                  {approveMutation.isPending ? text.saving : text.approve}
                </Button>
              </div>
              {copyFailed && <p role="alert" className="text-xs text-destructive">{text.copyError}</p>}
            </div>
          )}

          {(status === "pending" || status === "processing") && record.note && (
            <div className="mt-3 rounded-md border border-border bg-background/80 p-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{record.note}</p>
            </div>
          )}

          {isApproved && (
            <div className="mt-3 rounded-md border border-teal-200 bg-background p-3 dark:border-teal-900">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-[0.08em] text-teal-800 dark:text-teal-200">{text.approved}</p>
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={copyNote} disabled={!canCopy}>
                  {copyDone ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copyDone ? text.copied : text.copy}
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{displayedNote}</p>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2 text-[11px]">
                {record.approved_by && <div className="flex gap-1"><dt className="text-muted-foreground">{text.approvedBy}:</dt><dd className="font-medium">{record.approved_by}</dd></div>}
                {record.approved_at && <div className="flex gap-1"><dt className="text-muted-foreground">{text.approvedAt}:</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.approved_at))}</dd></div>}
              </dl>
            </div>
          )}
          {isReview && <p className="mt-2 text-[11px] text-muted-foreground">{text.notApprovedNotice}</p>}
          {actionError && (
            <p role="alert" className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
              <span className="font-semibold">{text.errorTitle}: </span>
              {actionError.status === 401 || actionError.status === 403 ? text.authorizationError : createMutation.isError ? text.genericError : text.saveError}
            </p>
          )}
          {isApproved && <p className="sr-only">{text.approvedHint}</p>}
        </>
      )}
    </section>
  );
}
