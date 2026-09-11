import assert from "node:assert/strict";
import test from "node:test";
import { resolveMissedCallCardTarget } from "./missed-call-card-resolver";
import {
  getRememberedPhoneCard,
  orderPhoneMatchesWithRememberedCard,
  type RememberedPhoneCard,
} from "./phone-card-preference";
import { normalizePhonePreferenceKey } from "../../../shared/phone-preference-key";

type PhoneMatch = {
  entityType: "customer" | "hospital" | "clinic" | "collaborator";
  id: string;
  name: string;
  phone: string;
};

class AgentPhoneCardPreferences {
  private readonly preferences = new Map<string, RememberedPhoneCard>();

  get(userId: string, phone: string): RememberedPhoneCard | undefined {
    const normalizedPhone = normalizePhonePreferenceKey(phone);
    return normalizedPhone ? this.preferences.get(`${userId}:${normalizedPhone}`) : undefined;
  }

  save(userId: string, phone: string, match: PhoneMatch): void {
    const normalizedPhone = normalizePhonePreferenceKey(phone);
    assert.ok(normalizedPhone, "a live inbound number must have a preference key");
    this.preferences.set(`${userId}:${normalizedPhone}`, {
      entityType: match.entityType,
      entityId: match.id,
    });
  }
}

test("keeps an agent's chosen duplicate-number card through repeat and missed calls", () => {
  const agentId = "agent-1";
  const slovakNumber = "+421 918 751 470";
  const repeatedFormat = "00421 918 751 470";
  const matchingCards: PhoneMatch[] = [
    {
      entityType: "customer",
      id: "customer-1",
      name: "Customer card",
      phone: slovakNumber,
    },
    {
      entityType: "clinic",
      id: "clinic-1",
      name: "Clinic card",
      phone: slovakNumber,
    },
  ];
  const preferences = new AgentPhoneCardPreferences();

  // First live call: there are two current matches and the agent deliberately
  // selects the clinic card from the queue's selection dialog.
  assert.deepEqual(
    orderPhoneMatchesWithRememberedCard(
      matchingCards,
      getRememberedPhoneCard(matchingCards, preferences.get(agentId, slovakNumber)),
    ).map((match) => match.id),
    ["customer-1", "clinic-1"],
  );
  preferences.save(agentId, slovakNumber, matchingCards[1]);

  // Repeat live call: lookup results may use 00 rather than +, but the queue
  // must promote the same current card without hiding the alternative.
  const rememberedForRepeat = getRememberedPhoneCard(
    matchingCards,
    preferences.get(agentId, repeatedFormat),
  );
  assert.equal(rememberedForRepeat?.id, "clinic-1");
  assert.deepEqual(
    orderPhoneMatchesWithRememberedCard(matchingCards, rememberedForRepeat).map((match) => match.id),
    ["clinic-1", "customer-1"],
  );

  // Missed call: with no persisted call-record customer identity, the same
  // validated preference opens the selected card directly.
  assert.deepEqual(
    resolveMissedCallCardTarget(null, repeatedFormat, matchingCards, rememberedForRepeat),
    { kind: "match", match: matchingCards[1] },
  );
});

test("never reuses a remembered card for another country sharing the national suffix", () => {
  const agentId = "agent-1";
  const slovakNumber = "+421 918 751 470";
  const czechNumber = "+420 918 751 470";
  const czechCards: PhoneMatch[] = [
    {
      entityType: "customer",
      id: "customer-cz",
      name: "Czech customer",
      phone: czechNumber,
    },
    {
      entityType: "hospital",
      id: "hospital-cz",
      name: "Czech hospital",
      phone: czechNumber,
    },
  ];
  const preferences = new AgentPhoneCardPreferences();

  preferences.save(agentId, slovakNumber, {
    entityType: "clinic",
    id: "clinic-sk",
    name: "Slovak clinic",
    phone: slovakNumber,
  });

  const rememberedForCzechCall = getRememberedPhoneCard(
    czechCards,
    preferences.get(agentId, czechNumber),
  );
  assert.equal(rememberedForCzechCall, undefined);
  assert.deepEqual(
    orderPhoneMatchesWithRememberedCard(czechCards, rememberedForCzechCall).map((match) => match.id),
    ["customer-cz", "hospital-cz"],
  );
  assert.deepEqual(
    resolveMissedCallCardTarget(null, czechNumber, czechCards, rememberedForCzechCall),
    { kind: "ambiguous", matches: czechCards },
  );
});