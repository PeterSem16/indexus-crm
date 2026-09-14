import { describe, expect, it } from "vitest";
import { buildOutsideMissionCallbackDialMetadata } from "./outside-mission-callback";

describe("outside-mission callback dialing", () => {
  it("keeps the real customer identity while omitting Mission identity", () => {
    expect(buildOutsideMissionCallbackDialMetadata({
      phone: " +421 900 123 456 ",
      customerId: 42,
      customerName: "Ada Lovelace",
    })).toEqual({
      phoneNumber: "+421 900 123 456",
      customerId: "42",
      customerName: "Ada Lovelace",
      campaignId: undefined,
      campaignContactId: undefined,
      campaignName: undefined,
      isOutsideMission: true,
    });
  });

  it("supports a phone-only callback without fabricating a customer id", () => {
    expect(buildOutsideMissionCallbackDialMetadata({
      phone: "+421900000000",
      customerId: null,
      customerName: null,
    })).toMatchObject({
      phoneNumber: "+421900000000",
      customerName: undefined,
      isOutsideMission: true,
    });
    expect(buildOutsideMissionCallbackDialMetadata({ phone: " " })).toBeNull();
  });
});