export interface AutomationCallRecording {
  id: string | number;
  callLogId?: string | number | null;
  [key: string]: unknown;
}

export class CallRecordingsRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Call recordings request failed (${status})`);
    this.name = "CallRecordingsRequestError";
  }
}

export function isCallRecordingUnavailable(error: unknown): boolean {
  return error instanceof CallRecordingsRequestError
    && [401, 403, 404].includes(error.status);
}

export async function fetchAutomationCallRecordings(
  callLogId: string,
  fetcher: typeof fetch = fetch,
): Promise<AutomationCallRecording[]> {
  const params = new URLSearchParams({ callLogId });
  const response = await fetcher(`/api/call-recordings?${params.toString()}`, {
    credentials: "include",
  });
  if ([401, 403, 404].includes(response.status)) {
    throw new CallRecordingsRequestError(response.status);
  }
  if (!response.ok) throw new CallRecordingsRequestError(response.status);

  const recordings: unknown = await response.json();
  if (!Array.isArray(recordings)) throw new CallRecordingsRequestError(response.status);
  return recordings as AutomationCallRecording[];
}

export function filterCallRecordingsForPage(
  recordings: AutomationCallRecording[],
  recordingId: string | null,
): AutomationCallRecording[] {
  if (!recordingId) return recordings;
  return recordings.filter(recording => String(recording.id) === recordingId);
}
