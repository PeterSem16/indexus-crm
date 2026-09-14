import { describe, expect, it } from "vitest";
import { getPulsePresentationState } from "./presentation-state";

describe("Pulse preflight presentation states", () => {
  it("gives the initial prerequisite screen one clear start path", () => {
    expect(getPulsePresentationState("idle", false, false, false)).toMatchObject({
      isBeginning: true, showHeader: false, showStatusBanner: false, showDetails: false, showRetry: false, showContinue: false,
    });
  });

  it("keeps the genuine running screen focused on progress", () => {
    expect(getPulsePresentationState("checking", true, false, false)).toMatchObject({
      isBeginning: false, showHeader: true, showStatusBanner: true, showDetails: true, showRetry: false, showContinue: false,
    });
  });

  it("only exposes completion actions after a completed eligible run", () => {
    expect(getPulsePresentationState("ready", false, true, true)).toMatchObject({ showRetry: true, showContinue: true });
    expect(getPulsePresentationState("blocked", false, true, false)).toMatchObject({ showRetry: true, showContinue: false });
  });

  it("keeps valid-readiness quick checks separate and allows their successful continuation", () => {
    expect(getPulsePresentationState("idle", false, false, false, true)).toMatchObject({
      isBeginning: false, showStatusBanner: false, showDetails: false, showRetry: true, showContinue: false,
    });
    expect(getPulsePresentationState("idle", false, false, true, true)).toMatchObject({
      isBeginning: false, showContinue: true,
    });
    expect(getPulsePresentationState("checking", true, false, false, true).showContinue).toBe(false);
  });
});