export const GOOGLE_STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
] as const;

export type DiagnosticState = "checking" | "ready" | "warning" | "blocked" | "idle";
export type DiagnosticSeverity = "critical" | "warning";
export type DiagnosticKey = "browser" | "secure" | "online" | "microphone" | "input" | "output" | "voice" | "sound" | "ice" | "sip" | "m365Account" | "notifications" | "network" | "latency" | "wakeLock" | "devices";

export interface DiagnosticResult {
  key: DiagnosticKey;
  severity: DiagnosticSeverity;
  state: "pass" | "warn" | "fail" | "pending";
  detail?: string;
}

const REQUIRED_RUN_KEYS: DiagnosticKey[] = [
  "browser", "secure", "online", "microphone", "input", "output", "voice",
  "ice", "sip", "notifications", "network", "latency", "wakeLock", "devices",
];

export function pulseReadinessStorageKey(userId: string) {
  return `nexus-pulse-ready-v2:${userId}`;
}

export function isCompleteDiagnosticRun(results: DiagnosticResult[], additionalRequiredKeys: DiagnosticKey[] = []) {
  const resultKeys = new Set(results.map((result) => result.key));
  return [...REQUIRED_RUN_KEYS, ...additionalRequiredKeys].every((key) => resultKeys.has(key));
}

export function isCompletePulseReadinessRun(results: DiagnosticResult[]) {
  return isCompleteDiagnosticRun(results, ["m365Account"]);
}

export function isPulseSessionProtected(callState?: string | null) {
  return ["connecting", "ringing", "active", "on_hold", "ended"].includes(String(callState || ""));
}

export function canUseQuickSoundVerification(options: {
  hasValidReadiness: boolean;
  diagnosticState: DiagnosticState;
  runCompleted: boolean;
  heard: boolean;
  soundError: boolean;
}) {
  return options.hasValidReadiness
    && options.diagnosticState === "idle"
    && !options.runCompleted
    && options.heard
    && !options.soundError;
}

export function isChromiumDesktop(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", platform = typeof navigator !== "undefined" ? navigator.platform : "") {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua) || /iPhone|iPad/i.test(platform);
  const chromium = /Chrome|Chromium|Edg\//i.test(ua) && !/Firefox|OPR\/|Opera|SamsungBrowser/i.test(ua);
  return chromium && !mobile;
}

export function isPulseReadinessEnvironmentValid(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? navigator.platform : "",
  secure = typeof window !== "undefined" ? window.isSecureContext || window.location.hostname === "localhost" : false,
  online = typeof navigator !== "undefined" ? navigator.onLine !== false : false,
) {
  return isChromiumDesktop(ua, platform) && secure && online;
}

export function classify(results: DiagnosticResult[]): DiagnosticState {
  if (results.some((r) => r.state === "pending")) return "checking";
  if (results.some((r) => r.severity === "critical" && r.state === "fail")) return "blocked";
  if (results.some((r) => r.state === "warn")) return "warning";
  return "ready";
}

export function hasCriticalFailure(results: DiagnosticResult[]) {
  return results.some((r) => r.severity === "critical" && r.state === "fail");
}

export function classifyIceResult(result: { ok: boolean; hasPublicCandidate: boolean }): Pick<DiagnosticResult, "severity" | "state"> {
  return result.ok && result.hasPublicCandidate
    ? { severity: "warning", state: "pass" }
    : { severity: "warning", state: "warn" };
}

export function normalizeAudioDeviceLabel(label: string) {
  return label.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\b(default|communications|audio|device|headset|headphones|microphone|speakers?)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function isProbableSameHeadset(inputLabel: string, outputLabel: string) {
  const input = normalizeAudioDeviceLabel(inputLabel);
  const output = normalizeAudioDeviceLabel(outputLabel);
  return !!input && !!output && (input === output || input.includes(output) || output.includes(input));
}

export function rmsFromTimeDomain(samples: Uint8Array) {
  if (!samples.length) return 0;
  const squared = Array.from(samples).reduce((total, value) => {
    const sample = (value - 128) / 128;
    return total + sample * sample;
  }, 0);
  return Math.sqrt(squared / samples.length);
}

export function hasVoiceLevel(rms: number, threshold = 0.015) {
  return rms >= threshold;
}

export function summarizeLatency(samples: number[]) {
  const usable = samples.filter((sample) => Number.isFinite(sample) && sample >= 0);
  if (!usable.length) return null;
  const sorted = [...usable].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const latency = sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  const jitter = usable.length < 2 ? 0 : Math.max(...usable) - Math.min(...usable);
  return { latency: Math.round(latency), jitter: Math.round(jitter), samples: usable.length };
}

export function classifyLatencyQuality(latency: number, jitter: number): "good" | "warning" | "poor" {
  if (latency <= 120 && jitter <= 30) return "good";
  if (latency <= 250 && jitter <= 80) return "warning";
  return "poor";
}

export async function measureSameOriginLatency(request = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init), url = typeof window === "undefined" ? "/" : window.location.href, attempts = 4, delayMs = 0) {
  const samples: number[] = [];
  for (let index = 0; index < attempts; index += 1) {
    const started = performance.now();
    try {
      await request(url, { method: "HEAD", cache: "no-store", credentials: "same-origin" });
      samples.push(performance.now() - started);
    } catch {
      // A failed request is intentionally omitted: this advisory must not block calling.
    }
    if (delayMs > 0 && index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return summarizeLatency(samples);
}

export async function gatherIce(timeoutMs = 4500): Promise<{ ok: boolean; hasPublicCandidate: boolean; pathType: "relay" | "server-reflexive" | "host" | "unavailable" }> {
  if (typeof RTCPeerConnection === "undefined") return { ok: false, hasPublicCandidate: false, pathType: "unavailable" };
  const pc = new RTCPeerConnection({ iceServers: GOOGLE_STUN_SERVERS.map((urls) => ({ urls })) });
  let hasCandidate = false;
  let hasPublicCandidate = false;
  let pathType: "relay" | "server-reflexive" | "host" | "unavailable" = "unavailable";
  try {
    pc.createDataChannel("preflight");
    const gathered = new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, timeoutMs);
      pc.onicecandidate = (event) => {
        if (!event.candidate) { window.clearTimeout(timer); resolve(); return; }
        hasCandidate = true;
        if (/ typ relay /.test(event.candidate.candidate)) { hasPublicCandidate = true; pathType = "relay"; }
        else if (/ typ srflx /.test(event.candidate.candidate)) { hasPublicCandidate = true; if (pathType !== "relay") pathType = "server-reflexive"; }
        else if (/ typ host /.test(event.candidate.candidate) && pathType === "unavailable") pathType = "host";
      };
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await gathered;
    return { ok: hasCandidate, hasPublicCandidate, pathType };
  } catch {
    return { ok: false, hasPublicCandidate: false, pathType: "unavailable" };
  } finally {
    pc.onicecandidate = null;
    pc.close();
  }
}