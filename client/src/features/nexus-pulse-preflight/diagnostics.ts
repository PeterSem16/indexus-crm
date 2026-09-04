export const GOOGLE_STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
] as const;

export type DiagnosticState = "checking" | "ready" | "warning" | "blocked" | "idle";
export type DiagnosticSeverity = "critical" | "warning";
export type DiagnosticKey = "browser" | "secure" | "online" | "microphone" | "input" | "output" | "sound" | "ice" | "sip" | "m365Account" | "notifications" | "network" | "wakeLock" | "devices";

export interface DiagnosticResult {
  key: DiagnosticKey;
  severity: DiagnosticSeverity;
  state: "pass" | "warn" | "fail" | "pending";
  detail?: string;
}

const REQUIRED_RUN_KEYS: DiagnosticKey[] = [
  "browser", "secure", "online", "microphone", "input", "output",
  "ice", "sip", "notifications", "network", "wakeLock", "devices",
];

export function isCompleteDiagnosticRun(results: DiagnosticResult[], additionalRequiredKeys: DiagnosticKey[] = []) {
  const resultKeys = new Set(results.map((result) => result.key));
  return [...REQUIRED_RUN_KEYS, ...additionalRequiredKeys].every((key) => resultKeys.has(key));
}

export function missionRequiresUserM365(channel?: string | null, settings?: string | null) {
  if (channel !== "email" && channel !== "mixed") return false;
  if (!settings) return true;
  try {
    const mode = JSON.parse(settings).nexusPulseEmailMode;
    return !mode || mode === "user";
  } catch {
    return true;
  }
}

export function isPulseSessionProtected(callState?: string | null) {
  return ["connecting", "ringing", "active", "on_hold", "ended"].includes(String(callState || ""));
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

export async function gatherIce(timeoutMs = 4500): Promise<{ ok: boolean; hasPublicCandidate: boolean }> {
  if (typeof RTCPeerConnection === "undefined") return { ok: false, hasPublicCandidate: false };
  const pc = new RTCPeerConnection({ iceServers: GOOGLE_STUN_SERVERS.map((urls) => ({ urls })) });
  let hasCandidate = false;
  let hasPublicCandidate = false;
  try {
    pc.createDataChannel("preflight");
    const gathered = new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, timeoutMs);
      pc.onicecandidate = (event) => {
        if (!event.candidate) { window.clearTimeout(timer); resolve(); return; }
        hasCandidate = true;
        if (/ typ (srflx|relay) /.test(event.candidate.candidate)) hasPublicCandidate = true;
      };
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await gathered;
    return { ok: hasCandidate, hasPublicCandidate };
  } catch {
    return { ok: false, hasPublicCandidate: false };
  } finally {
    pc.onicecandidate = null;
    pc.close();
  }
}