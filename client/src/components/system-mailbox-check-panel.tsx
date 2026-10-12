import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Circle, Clock3, LoaderCircle, MailCheck, Send } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type VerificationResult = {
  phase: "idle" | "checking" | "sent" | "received" | "failed" | "timeout";
  auth: "pending" | "ok" | "failed";
  send: "pending" | "ok" | "failed";
  receive: "pending" | "ok" | "failed" | "timeout";
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  providerCode?: string | null;
  senderAligned: boolean;
};

type RequestError = Error & { status?: number };

interface SystemMailboxCheckPanelProps {
  countryCode: string;
  connected: boolean;
  connectionKey?: string;
}

const initialResult: VerificationResult = {
  phase: "idle",
  auth: "pending",
  send: "pending",
  receive: "pending",
  startedAt: null,
  finishedAt: null,
  errorCode: null,
  providerCode: null,
  senderAligned: false,
};

function readableDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function SystemMailboxCheckPanel({ countryCode, connected, connectionKey }: SystemMailboxCheckPanelProps) {
  const { t, locale } = useI18n();
  const copy = t.systemMailboxCheck;
  const [actionError, setActionError] = useState<{ message: string; kind: "conflict" | "cooldown" | "generic" } | null>(null);
  const endpoint = `/api/config/system-ms365-connections/${encodeURIComponent(countryCode)}/check`;
  const queryKey = [endpoint, connectionKey ?? ""] as const;

  const statusQuery = useQuery<VerificationResult>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", endpoint);
      return response.json() as Promise<VerificationResult>;
    },
    enabled: Boolean(countryCode),
    staleTime: 0,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase === "checking" || phase === "sent" ? 2000 : false;
    },
  });

  const startCheck = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", endpoint, {});
      return response.json() as Promise<VerificationResult>;
    },
    onSuccess: (result) => {
      setActionError(null);
      queryClient.setQueryData(queryKey, result);
    },
  });

  const result = statusQuery.data ?? initialResult;
  const inFlight = result.phase === "checking" || result.phase === "sent";
  const submitting = startCheck.isPending;

  const beginVerification = async () => {
    if (!connected || statusQuery.isLoading || submitting || inFlight) return;
    setActionError(null);
    try {
      await startCheck.mutateAsync();
    } catch (error) {
      const requestError = error as RequestError;
      const statusCode = requestError.status ?? Number(requestError.message.match(/^(\d{3}):/)?.[1]);
      if (statusCode === 409) {
        setActionError({ kind: "conflict", message: copy.conflict });
        await statusQuery.refetch();
      } else if (statusCode === 429) {
        setActionError({ kind: "cooldown", message: copy.cooldown });
      } else {
        setActionError({ kind: "generic", message: copy.requestFailed });
      }
    }
  };

  const phaseText = {
    idle: copy.phaseIdle,
    checking: copy.phaseChecking,
    sent: copy.phaseSent,
    received: copy.phaseReceived,
    failed: copy.phaseFailed,
    timeout: copy.phaseTimeout,
  }[result.phase];

  const stage = (label: string, value: "pending" | "ok" | "failed" | "timeout") => {
    const isPending = value === "pending";
    const isSuccess = value === "ok";
    const isTimeout = value === "timeout";
    const statusText = isSuccess ? copy.succeeded : isTimeout ? copy.timedOut : value === "failed" ? copy.failed : copy.pending;
    const Icon = isPending ? inFlight ? LoaderCircle : Circle : isSuccess ? Check : isTimeout ? Clock3 : AlertCircle;
    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-border/70 bg-background/70 px-2.5 py-2">
        <Icon
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 ${isPending && inFlight ? "animate-spin text-muted-foreground" : isSuccess ? "text-emerald-700 dark:text-emerald-400" : isTimeout || value === "failed" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
        />
        <span className="min-w-0 flex-1 text-xs font-medium leading-4">{label}</span>
        <span className={`shrink-0 text-[11px] ${isSuccess ? "text-emerald-700 dark:text-emerald-400" : isTimeout || value === "failed" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
          {statusText}
        </span>
      </div>
    );
  };

  const startedAt = readableDate(result.startedAt, locale);
  const finishedAt = readableDate(result.finishedAt, locale);
  const phaseTone = result.phase === "received"
    ? "text-emerald-800 dark:text-emerald-300"
    : result.phase === "failed" || result.phase === "timeout"
      ? "text-amber-800 dark:text-amber-300"
      : "text-foreground";

  return (
    <section data-testid="system-mailbox-check" aria-labelledby="system-mailbox-check-title" className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MailCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
            <h3 id="system-mailbox-check-title" className="text-sm font-semibold">{copy.title}</h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{copy.description}</p>
        </div>
        <Button
          type="button"
          data-testid="button-system-mailbox-check"
          size="sm"
          variant="outline"
          onClick={beginVerification}
          disabled={!connected || statusQuery.isLoading || statusQuery.isFetching || submitting || inFlight}
          className="w-full shrink-0 sm:w-auto"
          aria-describedby="system-mailbox-check-description"
        >
          {submitting || inFlight ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="mr-2 h-4 w-4" />}
          {submitting || inFlight ? copy.phaseChecking : copy.action}
        </Button>
      </div>
      <span id="system-mailbox-check-description" className="sr-only">{copy.description}</span>

      {!connected && (
        <p className="mt-3 text-xs text-muted-foreground" role="note">{copy.notConnected}</p>
      )}

      {statusQuery.isLoading ? (
        <div className="mt-3 grid animate-pulse gap-2 sm:grid-cols-3" aria-label={copy.phaseChecking} aria-busy="true">
          <div className="h-9 rounded-md bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
      ) : (
        <div className="mt-3" aria-live="polite">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className={`text-xs font-semibold ${phaseTone}`}>{phaseText}</p>
            {result.phase !== "idle" && (
              <p className="text-[11px] text-muted-foreground">
                {result.phase === "checking" || result.phase === "sent" ? copy.startedAt : copy.finishedAt}
                {": "}
                {finishedAt && result.phase !== "checking" && result.phase !== "sent" ? finishedAt : startedAt ?? "—"}
              </p>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {stage(copy.authStep, result.auth)}
            {stage(copy.sendStep, result.send)}
            {stage(copy.receiveStep, result.receive)}
          </div>

          {result.phase !== "idle" && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className={result.senderAligned ? "text-emerald-700 dark:text-emerald-400" : ""}>
                {result.senderAligned ? copy.senderAligned : copy.senderNotAligned}
              </span>
              {result.errorCode && <span><span className="font-medium">{copy.errorLabel}:</span> {result.errorCode}</span>}
              {result.providerCode && <span><span className="font-medium">{copy.providerCodeLabel}:</span> {result.providerCode}</span>}
            </div>
          )}
          {result.phase === "timeout" && <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.timeoutExplanation}</p>}
        </div>
      )}

      {(statusQuery.isError || actionError) && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{actionError?.message ?? (statusQuery.error instanceof Error ? statusQuery.error.message : copy.statusError)}</p>
            {statusQuery.isError && (
              <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-1 text-xs text-destructive hover:text-destructive" onClick={() => statusQuery.refetch()}>
                {copy.retry}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
