import { describe, expect, it } from "vitest";
import {
  buildScheduledCallbackPatch,
  isEligibleScheduledCampaignCallback,
  normalizeLegacyScheduledCallbackStatus,
} from "./scheduled-callback";

describe("scheduled callback queue compatibility", () => {
  it("accepts canonical and legacy pending callback rows", () => {
    const callbackDate = new Date("2025-01-15T10:00:00.000Z");
    expect(isEligibleScheduledCampaignCallback("callback_scheduled", callbackDate)).toBe(true);
    expect(isEligibleScheduledCampaignCallback("pending", callbackDate)).toBe(true);
  });

  it("does not resurrect terminal or invalid callback rows", () => {
    const callbackDate = new Date("2025-01-15T10:00:00.000Z");
    expect(isEligibleScheduledCampaignCallback("contacted", callbackDate)).toBe(false);
    expect(isEligibleScheduledCampaignCallback("completed", callbackDate)).toBe(false);
    expect(isEligibleScheduledCampaignCallback("not_interested", callbackDate)).toBe(false);
    expect(isEligibleScheduledCampaignCallback("pending", null)).toBe(false);
    expect(isEligibleScheduledCampaignCallback("pending", "not-a-date")).toBe(false);
  });

  it("normalizes only legacy callback-date writes", () => {
    const callbackDate = new Date("2025-01-15T10:00:00.000Z");
    expect(normalizeLegacyScheduledCallbackStatus(undefined, callbackDate, "pending")).toBe("callback_scheduled");
    expect(normalizeLegacyScheduledCallbackStatus("pending", callbackDate, "pending")).toBe("callback_scheduled");
    expect(normalizeLegacyScheduledCallbackStatus(undefined, callbackDate, "completed")).toBeUndefined();
    expect(normalizeLegacyScheduledCallbackStatus("pending", callbackDate, "contacted")).toBe("contacted");
    expect(normalizeLegacyScheduledCallbackStatus("callback_scheduled", callbackDate, "completed")).toBe("callback_scheduled");
    expect(normalizeLegacyScheduledCallbackStatus(undefined, callbackDate)).toBe("callback_scheduled");
    expect(normalizeLegacyScheduledCallbackStatus("pending", null)).toBe("pending");
  });

  it("builds the mobile reschedule payload with canonical status", () => {
    expect(buildScheduledCallbackPatch("2025-01-15T10:00:00.000Z", "Call back after lunch"))
      .toEqual({
        status: "callback_scheduled",
        callbackDate: "2025-01-15T10:00:00.000Z",
        callbackNote: "Call back after lunch",
      });
    expect(buildScheduledCallbackPatch(null, null)).toEqual({
      status: "callback_scheduled",
      callbackDate: null,
      callbackNote: null,
    });
  });
});