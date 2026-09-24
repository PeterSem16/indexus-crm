export interface CallRecordingIdentity {
  callLogId?: string;
  customerId?: string;
  campaignId?: string;
  customerName?: string;
  campaignName?: string;
  agentName?: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  recordingSnapshot?: Record<string, unknown>;
  inboundQueueId?: string;
  inboundQueueName?: string;
}

export interface CallRecordingBinding {
  readonly identity: Readonly<CallRecordingIdentity>;
  callLogId: string | null;
  readonly chunks: Blob[];
  readonly customerActivitySegments: Array<{ startMs: number; endMs: number }>;
  stopping: boolean;
  acceptingChunks: boolean;
}

export interface SessionCallRecordingAuthority {
  callLogId: string | number | null;
  recordingSnapshot?: Record<string, unknown>;
  identity: Readonly<CallRecordingIdentity>;
}

export function resolveSessionRecordingAuthority(
  authority: SessionCallRecordingAuthority | undefined,
  binding?: CallRecordingBinding,
) {
  return {
    callLogId: authority?.callLogId ?? binding?.callLogId ?? null,
    recordingSnapshot: authority?.recordingSnapshot ?? binding?.identity.recordingSnapshot,
    identity: authority?.identity ?? binding?.identity,
  };
}

export function resolveForceResetCallLogId(
  authority: SessionCallRecordingAuthority | undefined,
  binding: CallRecordingBinding | undefined,
  fallbackCallLogId?: string | number | null,
): string | number | null {
  return authority?.callLogId ?? binding?.callLogId ?? fallbackCallLogId ?? null;
}

export function isCurrentCallSession<T>(session: T, activeSession: T | null | undefined): boolean {
  return session === activeSession;
}

export function createSequentialCallLogPatchQueue<T>(
  patchCallLog: (patch: T) => Promise<unknown>,
): (patch: T) => Promise<unknown> {
  let tail = Promise.resolve();
  return (patch) => {
    const next = tail.then(() => patchCallLog(patch));
    tail = next.then(() => undefined, () => undefined);
    return next;
  };
}

export function createCallRecordingBinding(
  identity: CallRecordingIdentity,
  callLogId?: string | number | null,
): CallRecordingBinding {
  const stableIdentity: CallRecordingIdentity = {
    ...identity,
    recordingSnapshot: identity.recordingSnapshot
      ? JSON.parse(JSON.stringify(identity.recordingSnapshot))
      : undefined,
  };
  return {
    identity: Object.freeze(stableIdentity),
    callLogId: callLogId === undefined
      ? (identity.callLogId ? String(identity.callLogId) : null)
      : callLogId === null ? null : String(callLogId),
    chunks: [],
    customerActivitySegments: [],
    stopping: false,
    acceptingChunks: true,
  };
}

export function bindCallRecordingLog(
  binding: CallRecordingBinding,
  callLogId: string | number,
): boolean {
  const key = String(callLogId);
  if (binding.callLogId && binding.callLogId !== key) return false;
  binding.callLogId = key;
  return true;
}

export function recordingBindingMatchesCall(
  binding: CallRecordingBinding | undefined,
  callLogId: string | number,
): binding is CallRecordingBinding {
  return !!binding && binding.callLogId === String(callLogId);
}

export function appendCallRecordingChunk(binding: CallRecordingBinding, chunk: Blob): void {
  if (binding.acceptingChunks && chunk.size > 0) binding.chunks.push(chunk);
}