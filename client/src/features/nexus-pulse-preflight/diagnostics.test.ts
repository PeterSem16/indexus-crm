import { describe, expect, it } from "vitest";
import { audioDeviceSnapshotsEqual, canUseQuickSoundVerification, classify, classifyIceResult, classifyLatencyQuality, hasCriticalFailure, hasVoiceLevel, isChromiumDesktop, isCompleteDiagnosticRun, isCompletePulseReadinessRun, isProbableSameHeadset, isPulseAgentWorkProtected, isPulseReadinessEnvironmentValid, isPulseSessionProtected, normalizeAudioDeviceLabel, normalizeAudioDeviceSnapshot, parseAudioDeviceSnapshot, pulseAudioDeviceBaselineStorageKey, pulseReadinessStorageKey, rmsFromTimeDomain, shouldPresentDeferredRecheck, shouldRetainStoredReadiness, summarizeLatency, type DiagnosticResult } from "./diagnostics";

describe("NEXUS Pulse preflight classification", () => {
  it("rejects mobile and non-Chromium browsers", () => {
    expect(isChromiumDesktop("Mozilla/5.0 Chrome/121.0 Safari/537.36", "Win32")).toBe(true);
    expect(isChromiumDesktop("Mozilla/5.0 Firefox/122.0", "Win32")).toBe(false);
    expect(isChromiumDesktop("Mozilla/5.0 Chrome/121.0 Mobile Safari", "Android")).toBe(false);
  });
  it("invalidates saved readiness in Firefox, insecure contexts, and offline mode", () => {
    expect(isPulseReadinessEnvironmentValid("Mozilla/5.0 Chrome/121.0 Safari/537.36", "Win32", true, true)).toBe(true);
    expect(isPulseReadinessEnvironmentValid("Mozilla/5.0 Firefox/122.0", "Win32", true, true)).toBe(false);
    expect(isPulseReadinessEnvironmentValid("Mozilla/5.0 Chrome/121.0 Safari/537.36", "Win32", false, true)).toBe(false);
    expect(isPulseReadinessEnvironmentValid("Mozilla/5.0 Chrome/121.0 Safari/537.36", "Win32", true, false)).toBe(false);
  });
  it("uses the M365-required readiness storage version", () => {
    expect(pulseReadinessStorageKey("42")).toBe("nexus-pulse-ready-v2:42");
  });
  it("keeps warnings non-blocking", () => {
    const results = [{ key: "network" as const, severity: "warning" as const, state: "warn" as const }];
    expect(classify(results)).toBe("warning");
    expect(hasCriticalFailure(results)).toBe(false);
  });
  it("blocks on critical failures", () => {
    const results = [{ key: "microphone" as const, severity: "critical" as const, state: "fail" as const }];
    expect(classify(results)).toBe("blocked");
    expect(hasCriticalFailure(results)).toBe(true);
  });
  it("keeps public STUN reachability advisory", () => {
    expect(classifyIceResult({ ok: false, hasPublicCandidate: false })).toEqual({ severity: "warning", state: "warn" });
    expect(classifyIceResult({ ok: true, hasPublicCandidate: false })).toEqual({ severity: "warning", state: "warn" });
    expect(classifyIceResult({ ok: true, hasPublicCandidate: true })).toEqual({ severity: "warning", state: "pass" });
  });
  it("normalizes audio labels and only reports cautious probable headset matches", () => {
    expect(normalizeAudioDeviceLabel("Jabra Evolve 65 (USB Audio Device)")).toBe("jabra evolve 65");
    expect(isProbableSameHeadset("Jabra Evolve 65 microphone", "Jabra Evolve 65 headphones")).toBe(true);
    expect(isProbableSameHeadset("Built-in microphone", "Desk speakers")).toBe(false);
  });
  it("retains audio aliases so default-device changes invalidate readiness", () => {
    const first = normalizeAudioDeviceSnapshot([
      { kind: "videoinput", deviceId: "camera", groupId: "camera-group", label: "Camera" },
      { kind: "audiooutput", deviceId: "default", groupId: "desk", label: "Desk speakers (Default)" },
      { kind: "audiooutput", deviceId: "communications", groupId: "headset", label: "Jabra headset (Communications)" },
    ]);
    const second = normalizeAudioDeviceSnapshot([
      { kind: "audiooutput", deviceId: "communications", groupId: "headset", label: "Jabra headset (Communications)" },
      { kind: "audiooutput", deviceId: "default", groupId: "headset", label: "Jabra headset (Default)" },
    ]);
    expect(first.devices).toHaveLength(2);
    expect(audioDeviceSnapshotsEqual(first, second)).toBe(false);
    expect(parseAudioDeviceSnapshot(JSON.stringify(first))).toEqual(first);
    expect(parseAudioDeviceSnapshot("{bad")).toBeNull();
    expect(pulseAudioDeviceBaselineStorageKey("42")).toBe("nexus-pulse-audio-devices-v1:42");
  });
  it("keeps alias-only snapshots stable when their targets do not change", () => {
    const first = normalizeAudioDeviceSnapshot([
      { kind: "audiooutput", deviceId: "communications", groupId: "g-1", label: "Headset (Communications)" },
      { kind: "audiooutput", deviceId: "default", groupId: "g-1", label: "Headset (Default)" },
    ]);
    const reordered = normalizeAudioDeviceSnapshot([...first.devices].reverse());
    expect(audioDeviceSnapshotsEqual(first, reordered)).toBe(true);
  });
  it("calculates microphone RMS and keeps voice detection threshold explicit", () => {
    expect(rmsFromTimeDomain(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(hasVoiceLevel(rmsFromTimeDomain(new Uint8Array([100, 156])))).toBe(true);
    expect(hasVoiceLevel(0.014)).toBe(false);
  });
  it("summarizes practical request latency and jitter without failed samples", () => {
    expect(summarizeLatency([24, 30, 26, 40])).toEqual({ latency: 28, jitter: 16, samples: 4 });
    expect(summarizeLatency([])).toBeNull();
  });
  it("can space latency samples over a meaningful measurement window", async () => {
    const started = performance.now();
    const samples: Array<{ sample: number | null; index: number; total: number }> = [];
    const result = await import("./diagnostics").then(({ measureSameOriginLatency }) =>
      measureSameOriginLatency(async () => new Response(null, { status: 204 }), "/", 3, 10, (sample, index, total) => samples.push({ sample, index, total })));
    expect(result?.samples).toBe(3);
    expect(samples).toHaveLength(3);
    expect(samples.map(({ index, total }) => ({ index, total }))).toEqual([{ index: 0, total: 3 }, { index: 1, total: 3 }, { index: 2, total: 3 }]);
    expect(samples.every(({ sample }) => sample !== null)).toBe(true);
    expect(performance.now() - started).toBeGreaterThanOrEqual(18);
  });
  it("classifies practical latency into clear call-quality levels", () => {
    expect(classifyLatencyQuality(26, 4)).toBe("good");
    expect(classifyLatencyQuality(180, 35)).toBe("warning");
    expect(classifyLatencyQuality(310, 20)).toBe("poor");
    expect(classifyLatencyQuality(90, 100)).toBe("poor");
  });
  it("never treats sound confirmation as a completed diagnostic run", () => {
    const soundOnly: DiagnosticResult[] = [
      { key: "sound", severity: "critical", state: "pass" },
    ];
    expect(isCompleteDiagnosticRun(soundOnly)).toBe(false);
  });
  it("allows a sound-only recheck only while an existing readiness result is still valid", () => {
    expect(canUseQuickSoundVerification({
      hasValidReadiness: true,
      diagnosticState: "idle",
      runCompleted: false,
      heard: true,
      soundError: false,
    })).toBe(true);
    expect(canUseQuickSoundVerification({
      hasValidReadiness: false,
      diagnosticState: "idle",
      runCompleted: false,
      heard: true,
      soundError: false,
    })).toBe(false);
  });
  it("does not let sound confirmation bypass a started or failed full check", () => {
    for (const diagnosticState of ["checking", "ready", "warning", "blocked"] as const) {
      expect(canUseQuickSoundVerification({
        hasValidReadiness: true,
        diagnosticState,
        runCompleted: diagnosticState !== "checking",
        heard: true,
        soundError: false,
      })).toBe(false);
    }
  });
  it("requires every environment check before completion", () => {
    const keys = ["browser", "secure", "online", "microphone", "input", "output", "voice", "ice", "sip", "notifications", "network", "latency", "wakeLock", "devices"] as const;
    const complete = keys.map((key): DiagnosticResult => ({
      key,
      severity: ["ice", "notifications", "network", "latency", "wakeLock", "devices"].includes(key) ? "warning" : "critical",
      state: "pass",
    }));
    expect(isCompleteDiagnosticRun(complete)).toBe(true);
    expect(isCompleteDiagnosticRun(complete.filter((result) => result.key !== "sip"))).toBe(false);
    expect(isCompleteDiagnosticRun(complete, ["m365Account"])).toBe(false);
    expect(isCompleteDiagnosticRun([...complete, { key: "m365Account", severity: "critical", state: "pass" }], ["m365Account"])).toBe(true);
    expect(isCompletePulseReadinessRun(complete)).toBe(false);
    expect(isCompletePulseReadinessRun([...complete, { key: "m365Account", severity: "critical", state: "pass" }])).toBe(true);
  });
  it("protects an in-progress call and post-call transition from readiness unmounts", () => {
    for (const state of ["connecting", "ringing", "active", "on_hold", "ended"]) {
      expect(isPulseSessionProtected(state)).toBe(true);
    }
    expect(isPulseSessionProtected("idle")).toBe(false);
    expect(isPulseSessionProtected(null)).toBe(false);
  });
  it("never presents a deferred recheck while a call or wrap-up is protected", () => {
    expect(shouldPresentDeferredRecheck(true, true)).toBe(false);
    expect(shouldPresentDeferredRecheck(true, false)).toBe(false);
    expect(shouldPresentDeferredRecheck(false, true)).toBe(true);
    expect(shouldPresentDeferredRecheck(false, false)).toBe(false);
  });
  it("retains saved readiness during a protected offline incident", () => {
    expect(shouldRetainStoredReadiness(true, false, true)).toBe(true);
    expect(shouldRetainStoredReadiness(true, true, false)).toBe(true);
    expect(shouldRetainStoredReadiness(true, false, false)).toBe(false);
    expect(shouldRetainStoredReadiness(false, true, true)).toBe(false);
  });
  it("protects the complete timed wrap-up lifecycle even after call state becomes idle", () => {
    expect(isPulseAgentWorkProtected("idle", false, true)).toBe(true);
    expect(shouldPresentDeferredRecheck(isPulseAgentWorkProtected("idle", false, true), true)).toBe(false);
    expect(isPulseAgentWorkProtected("idle", false, false)).toBe(false);
    expect(shouldPresentDeferredRecheck(isPulseAgentWorkProtected("idle", false, false), true)).toBe(true);
  });
});