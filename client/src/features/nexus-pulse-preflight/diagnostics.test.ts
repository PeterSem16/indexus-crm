import { describe, expect, it } from "vitest";
import { classify, classifyIceResult, hasCriticalFailure, isChromiumDesktop } from "./diagnostics";

describe("NEXUS Pulse preflight classification", () => {
  it("rejects mobile and non-Chromium browsers", () => {
    expect(isChromiumDesktop("Mozilla/5.0 Chrome/121.0 Safari/537.36", "Win32")).toBe(true);
    expect(isChromiumDesktop("Mozilla/5.0 Firefox/122.0", "Win32")).toBe(false);
    expect(isChromiumDesktop("Mozilla/5.0 Chrome/121.0 Mobile Safari", "Android")).toBe(false);
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
});