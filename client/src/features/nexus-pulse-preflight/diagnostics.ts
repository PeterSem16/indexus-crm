export const GOOGLE_STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
] as const;

export type DiagnosticState = "checking" | "ready" | "warning" | "blocked" | "idle";
export type DiagnosticSeverity = "critical" | "warning";
export type DiagnosticKey = "browser" | "secure" | "online" | "microphone" | "input" | "output" | "sound" | "ice" | "sip" | "notifications" | "network" | "wakeLock" | "devices";

export interface DiagnosticResult {
  key: DiagnosticKey;
  severity: DiagnosticSeverity;
  state: "pass" | "warn" | "fail" | "pending";
  detail?: string;
}

export function isChromiumDesktop(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", platform = typeof navigator !== "undefined" ? navigator.platform : "") {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua) || /iPhone|iPad/i.test(platform);
  const chromium = /Chrome|Chromium|Edg\//i.test(ua) && !/Firefox|OPR\/|Opera|SamsungBrowser/i.test(ua);
  return chromium && !mobile;
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