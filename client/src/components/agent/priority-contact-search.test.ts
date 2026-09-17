import { describe, expect, it } from "vitest";
import {
  getPriorityContactSearchDetails,
  getPriorityContactSearchMatches,
  getPriorityTextMatchRanges,
  type PrioritySearchField,
} from "./priority-contact-search";
import type { PriorityContact } from "./priority-builder";

const contact = (
  contactType: PriorityContact["contactType"],
  entity: Partial<PriorityContact>,
): PriorityContact => ({
  id: `${contactType}-1`,
  campaignId: "campaign",
  contactType,
  status: "pending",
  assignedTo: null,
  attemptCount: 0,
  priorityScore: 50,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  ...entity,
});

describe("priority contact search data", () => {
  it("maps the declared clinic source, including doctor and alternate contacts", () => {
    const clinic = contact("clinic", {
      clinic: {
        name: "Central Clinic",
        doctorTitle: "Dr.",
        doctorFirstName: "Jana",
        doctorLastName: "Kováčová",
        phone: "+421 900 111",
        phone2: "+421 900 222",
        phone3: "+421 900 333",
        email: "one@example.com",
        email2: "two@example.com",
        email3: "three@example.com",
        city: "Žilina",
      },
    });
    expect(getPriorityContactSearchDetails(clinic)).toMatchObject({
      name: "Dr. Jana Kováčová",
      organization: "Central Clinic",
      phones: ["+421 900 111", "+421 900 222", "+421 900 333"],
      emails: ["one@example.com", "two@example.com", "three@example.com"],
      city: "Žilina",
    });
    expect(getPriorityContactSearchMatches(clinic, "kovac", "name")).toHaveLength(1);
  });

  it("maps hospital contact people and all entity-specific fields without mixing entities", () => {
    const hospital = contact("hospital", {
      hospital: {
        name: "City Hospital",
        contactPerson: "Dr. Éva Nagy",
        phone: "+421 911 111",
        email: "hospital@example.com",
        city: "Brno",
      },
      customer: {
        firstName: "Secret",
        lastName: "Customer",
        phone: "999999999",
        email: "secret@example.com",
      },
    });
    expect(getPriorityContactSearchDetails(hospital)).toMatchObject({
      name: "Dr. Éva Nagy",
      organization: "City Hospital",
    });
    expect(getPriorityContactSearchMatches(hospital, "secret", "all")).toEqual([]);
    expect(getPriorityContactSearchMatches(hospital, "nagy", "name")).toHaveLength(1);
  });

  it("maps customers and collaborators while excluding unrelated and sensitive fields", () => {
    const customer = contact("customer", {
      customer: {
        firstName: "Mária",
        lastName: "Nováková",
        phone: "123",
        mobile: "0900 123 456",
        mobile2: "0900 654 321",
        otherContact: "customer.alt@example.com",
        email: "maria@example.com",
        email2: "maria+alt@example.com",
        city: "Košice",
      },
    });
    expect(getPriorityContactSearchDetails(customer).phones).toEqual(["123", "0900 123 456", "0900 654 321"]);
    expect(getPriorityContactSearchDetails(customer).emails).toEqual([
      "maria@example.com",
      "maria+alt@example.com",
      "customer.alt@example.com",
    ]);
    expect(getPriorityContactSearchMatches(customer, "Mária", "name")).toHaveLength(1);
    expect(getPriorityContactSearchMatches(customer, "password", "all")).toEqual([]);

    const collaborator = contact("collaborator", {
      priorityCity: "Praha",
      collaborator: {
        titleBefore: "Mgr.",
        firstName: "Adam",
        lastName: "Horváth",
        workplaceName: "Partner Office",
        phone: "+421 901 222 333",
        email: "adam@example.com",
      },
    });
    expect(getPriorityContactSearchDetails(collaborator)).toMatchObject({
      name: "Mgr. Adam Horváth",
      organization: "Partner Office",
      city: "Praha",
    });
  });

  it("uses all occurrences and safe visible offsets for diacritics, combining marks, and phones", () => {
    expect(getPriorityTextMatchRanges("Ána ána", "ana")).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ]);
    const combining = "Cafe\u0301 Cafe\u0301";
    expect(getPriorityTextMatchRanges(combining, "café")).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ]);
    const phone = "+421 (905) 123-456";
    const ranges = getPriorityTextMatchRanges(phone, "905123", true);
    expect(ranges).toEqual([{ start: 6, end: 14 }]);
    expect(phone.slice(ranges[0].start, ranges[0].end)).toBe("905) 123");
  });

  it("returns no matches for blank queries and preserves filter-field typing", () => {
    const fields: PrioritySearchField[] = ["all", "name", "phone", "email", "city"];
    expect(fields).toHaveLength(5);
    expect(getPriorityTextMatchRanges("anything", "   ")).toEqual([]);
    const empty = contact("clinic", { clinic: { name: "Visible" } });
    expect(getPriorityContactSearchMatches(empty, "", "all")).toEqual([]);
  });
});