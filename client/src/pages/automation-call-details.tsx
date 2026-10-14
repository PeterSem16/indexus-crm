import { useQuery } from "@tanstack/react-query";
import { FileAudio, PhoneCall, RefreshCw, ShieldAlert } from "lucide-react";
import { useRoute } from "wouter";
import { CallRecordingPlayer } from "@/components/call-recording-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { getAutomationCallPageCopy } from "@/i18n/automation-call-page-copy";
import {
  fetchAutomationCallRecordings,
  filterCallRecordingsForPage,
  isCallRecordingUnavailable,
} from "./automation-call-recordings";

export default function AutomationCallDetailsPage() {
  const [, routeParams] = useRoute("/automation-calls/:callLogId");
  const callLogId = routeParams?.callLogId ?? "";
  const recordingId = new URLSearchParams(window.location.search).get("recordingId")?.trim() || null;
  const { locale } = useI18n();
  const copy = getAutomationCallPageCopy(locale);

  const recordingsQuery = useQuery({
    queryKey: ["/api/call-recordings", "automation-call-page", callLogId],
    queryFn: () => fetchAutomationCallRecordings(callLogId),
    enabled: callLogId.length > 0,
    retry: (failureCount, error) => !isCallRecordingUnavailable(error) && failureCount < 2,
  });

  const selectedRecordings = recordingsQuery.data
    ? filterCallRecordingsForPage(recordingsQuery.data, recordingId)
    : [];
  const requestedRecordingMissing = !!recordingId
    && recordingsQuery.isSuccess
    && selectedRecordings.length === 0;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 py-2" data-testid="automation-call-details">
      <header className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/8 text-primary">
          <PhoneCall className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
      </header>

      {recordingsQuery.isLoading && (
        <Card aria-busy="true" data-testid="call-recording-loading">
          <CardContent className="space-y-4 p-6">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded-xl bg-muted/70" />
            <span className="sr-only" role="status">{copy.loading}</span>
          </CardContent>
        </Card>
      )}

      {!recordingsQuery.isLoading && (isCallRecordingUnavailable(recordingsQuery.error) || !callLogId) && (
        <Card data-testid="call-recording-unavailable">
          <CardContent className="flex items-start gap-4 p-6">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{copy.unavailableTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.unavailableDescription}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!recordingsQuery.isLoading && recordingsQuery.isError && !isCallRecordingUnavailable(recordingsQuery.error) && (
        <Card role="alert" data-testid="call-recording-error">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FileAudio className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{copy.errorTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.errorDescription}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void recordingsQuery.refetch()} data-testid="button-retry-call-recordings">
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!recordingsQuery.isLoading && recordingsQuery.isSuccess && (
        requestedRecordingMissing ? (
          <Card data-testid="call-recording-unavailable">
            <CardContent className="flex items-start gap-4 p-6">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{copy.unavailableTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.selectedRecordingUnavailable}</p>
              </div>
            </CardContent>
          </Card>
        ) : selectedRecordings.length === 0 ? (
          <Card data-testid="call-recording-empty">
            <CardContent className="flex items-start gap-4 p-6">
              <FileAudio className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{copy.emptyTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section aria-label={copy.playerLabel} data-testid="call-recording-player-section">
            <CallRecordingPlayer callLogId={callLogId} recordingId={recordingId ?? undefined} />
          </section>
        )
      )}
    </main>
  );
}
