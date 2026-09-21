import { describe, expect, it } from "vitest";
import {
  contactMatchesRepresentative,
  hasCampaignContactVisibilityChange,
  isCampaignContactVisibleToAgent,
  parseCampaignContactVisibility,
  preserveCampaignContactVisibility,
  resolveCampaignContactEntityType,
} from "./campaign-contact-visibility";

describe("campaign contact visibility", () => {
  it("defaults safely to all contacts", () => {
    expect(parseCampaignContactVisibility(undefined)).toBe("all");
    expect(parseCampaignContactVisibility("{not-json")).toBe("all");
    expect(parseCampaignContactVisibility(JSON.stringify({ other: true }))).toBe("all");
  });

  it("accepts only the assigned representative mode", () => {
    expect(parseCampaignContactVisibility({ contactVisibility: "assigned_representative" })).toBe("assigned_representative");
    expect(parseCampaignContactVisibility({ contactVisibility: "unknown" })).toBe("all");
  });

  it("does not treat omitted visibility as a change", () => {
    expect(hasCampaignContactVisibilityChange(
      { contactVisibility: "assigned_representative" },
      { otherSetting: true },
    )).toBe(false);
    expect(hasCampaignContactVisibilityChange(
      { contactVisibility: "all" },
      { contactVisibility: "assigned_representative" },
    )).toBe(true);
  });

  it("preserves assigned visibility when a settings patch omits it", () => {
    expect(preserveCampaignContactVisibility(
      { contactVisibility: "assigned_representative" },
      { workflowMode: "status_list" },
    )).toEqual({
      workflowMode: "status_list",
      contactVisibility: "assigned_representative",
    });
  });

  it("keeps the access decision independent of route details", () => {
    expect(isCampaignContactVisibleToAgent({
      settings: { contactVisibility: "all" },
      contact: { contactType: "customer" },
      userId: "u1",
    })).toBe(true);
    expect(isCampaignContactVisibleToAgent({
      settings: { contactVisibility: "assigned_representative" },
      contact: { contactType: "customer" },
      userId: "u1",
    })).toBe(false);
    expect(isCampaignContactVisibleToAgent({
      settings: { contactVisibility: "assigned_representative" },
      contact: { contactType: "clinic" },
      userId: "u1",
      representativeId: "u1",
    })).toBe(true);
  });

  it("matches normal entities and collaborators", () => {
    expect(contactMatchesRepresentative({ contactType: "clinic" }, "u1", "u1")).toBe(true);
    expect(contactMatchesRepresentative({ contactType: "hospital" }, "u2", "u1")).toBe(false);
    expect(contactMatchesRepresentative({ contactType: "customer" }, null, "u1")).toBe(false);
    expect(contactMatchesRepresentative({ contactType: "collaborator" }, "u2", "u1", ["u1"])).toBe(true);
    expect(contactMatchesRepresentative({ contactType: "collaborator" }, null, "u1", [])).toBe(false);
  });

  it("uses the real linked entity when legacy contactType is wrong", () => {
    expect(resolveCampaignContactEntityType({ contactType: "customer", clinicId: "clinic-1" })).toBe("clinic");
    expect(resolveCampaignContactEntityType({ contactType: "customer", hospitalId: "hospital-1" })).toBe("hospital");
    expect(resolveCampaignContactEntityType({ contactType: "clinic", collaboratorId: "person-1" })).toBe("collaborator");
  });
});