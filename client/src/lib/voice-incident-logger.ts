export type VoiceIncidentKind =
  | "browser_offline"
  | "sip_transport_disconnected"
  | "sip_registration_disconnected"
  | "ice_failed"
  | "ice_disconnected_sustained"
  | "audio_no_flow"
  | "audio_one_way"
  | "network_quality_degraded";

const lastReported = new Map<VoiceIncidentKind, number>();
const DEDUPE_MS = 30_000;
const QUEUE_KEY = "voice-incident-queue-v1";
let activeCallLogId: string | null = null;

export function setVoiceIncidentCallContext(callLogId?: string | number | null) {
  activeCallLogId = callLogId ? String(callLogId) : null;
}

type IncidentPayload = VoiceIncidentMetrics & {
  kind: VoiceIncidentKind;
  severity: "warning" | "error";
};

function readQueue(): IncidentPayload[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-25) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: IncidentPayload[]) {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-25)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Telemetry storage must never interfere with calling.
  }
}

async function sendPayload(payload: IncidentPayload): Promise<"sent" | "retry" | "drop"> {
  try {
    const response = await fetch("/api/voice-network-incidents", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (response.ok) return "sent";
    return response.status === 429 || response.status >= 500 ? "retry" : "drop";
  } catch {
    return "retry";
  }
}

export async function flushVoiceIncidentQueue() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const queue = readQueue();
  if (!queue.length) return;
  const remaining = [...queue];
  while (remaining.length) {
    const outcome = await sendPayload(remaining[0]);
    if (outcome === "sent" || outcome === "drop") {
      remaining.shift();
      writeQueue(remaining);
    } else {
      return;
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushVoiceIncidentQueue(); });
  window.setTimeout(() => { void flushVoiceIncidentQueue(); }, 2_000);
}

type VoiceIncidentMetrics = {
  callLogId?: string | number | null;
  connectionState?: string;
  iceState?: string;
  rttMs?: number;
  jitterMs?: number;
  packetLossPermille?: number;
};

// Only bounded operational metrics are accepted. Never send call content,
// addresses, SDP, candidates, SIP credentials, phone numbers or raw errors.
export function reportVoiceIncident(kind: VoiceIncidentKind, severity: "warning" | "error" = "error", metrics: VoiceIncidentMetrics = {}) {
  const callLogId = metrics.callLogId ? String(metrics.callLogId) : activeCallLogId;
  if (!callLogId) return;
  const now = Date.now();
  if (now - (lastReported.get(kind) ?? 0) < DEDUPE_MS) return;
  lastReported.set(kind, now);
  const payload: IncidentPayload = {
    kind,
    severity,
    ...(callLogId ? { callLogId } : {}),
    ...(metrics.connectionState ? { connectionState: metrics.connectionState } : {}),
    ...(metrics.iceState ? { iceState: metrics.iceState } : {}),
    ...(Number.isFinite(metrics.rttMs) ? { rttMs: Math.round(metrics.rttMs!) } : {}),
    ...(Number.isFinite(metrics.jitterMs) ? { jitterMs: Math.round(metrics.jitterMs!) } : {}),
    ...(Number.isFinite(metrics.packetLossPermille) ? { packetLossPermille: Math.round(metrics.packetLossPermille!) } : {}),
  };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    writeQueue([...readQueue(), payload]);
    return;
  }
  void sendPayload(payload).then((outcome) => {
    if (outcome === "retry") writeQueue([...readQueue(), payload]);
  });
}