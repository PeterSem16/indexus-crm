import { describe, expect, it } from "vitest";
import { classify, classifyIceResult, hasCriticalFailure, isChromiumDesktop, isCompleteDiagnosticRun, isCompletePulseReadinessRun, isPulseReadinessEnvironmentValid, isPulseSessionProtected, pulseReadinessStorageKey, type DiagnosticResult } from "./diagnostics";

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
  it("never treats sound confirmation as a completed diagnostic run", () => {
    const soundOnly: DiagnosticResult[] = [
      { key: "sound", severity: "critical", state: "pass" },
    ];
    expect(isCompleteDiagnosticRun(soundOnly)).toBe(false);
  });
  it("requires every environment check before completion", () => {
    const keys = ["browser", "secure", "online", "microphone", "input", "output", "ice", "sip", "notifications", "network", "wakeLock", "devices"] as const;
    const complete = keys.map((key): DiagnosticResult => ({
      key,
      severity: ["ice", "notifications", "network", "wakeLock", "devices"].includes(key) ? "warning" : "critical",
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
});