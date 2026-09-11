import { describe, expect, it } from "vitest";
import { getInboundSelectionContext, resolveMissedCallCardTarget } from "./missed-call-card-resolver";

describe("resolveMissedCallCardTarget", () => {
  it("prefers the persisted customer id", () => {
    const result = resolveMissedCallCardTarget("customer-42", "+421900000", [
      { entityType: "hospital", id: "hospital-1", name: "Hospital" },
      { entityType: "customer", id: "other", name: "Other" },
    ]);
    expect(result).toEqual({
      kind: "match",
      match: { entityType: "customer", id: "customer-42", name: "", phone: "+421900000" },
    });
  });

  it("opens the only phone match", () => {
    const match = { entityType: "clinic" as const, id: "clinic-1", name: "Clinic" };
    expect(resolveMissedCallCardTarget(undefined, "+421900000", [match])).toEqual({
      kind: "match",
      match,
    });
  });

  it("keeps mixed entity matches pending for explicit selection", () => {
    const matches = [
      { entityType: "customer" as const, id: "customer-1", name: "Customer" },
      { entityType: "hospital" as const, id: "hospital-1", name: "Hospital" },
    ];
    expect(resolveMissedCallCardTarget(null, "+421900000", matches)).toEqual({
      kind: "ambiguous",
      matches,
    });
  });

  it("uses the remembered card when a missed number still has multiple matches", () => {
    const matches = [
      { entityType: "customer" as const, id: "customer-1", name: "Customer" },
      { entityType: "hospital" as const, id: "hospital-1", name: "Hospital" },
    ];

    expect(resolveMissedCallCardTarget(null, "+421900000", matches, matches[1])).toEqual({
      kind: "match",
      match: matches[1],
    });
  });

  it("does not create live inbound context for a historical missed call", () => {
    const liveContext = { callId: "live-call", campaignId: "campaign-1", callerNumber: "+421900000" };
    expect(getInboundSelectionContext("missed-call-1", liveContext)).toBeUndefined();
    expect(getInboundSelectionContext(undefined, liveContext)).toBe(liveContext);
  });
});