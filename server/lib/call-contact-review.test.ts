import assert from "node:assert/strict";
import test from "node:test";
import { callbackDateChanged, currentCallbackMatchingCallOption, resolveCallReviewContact, resolveUniqueCallReviewContact, summarizeCallReviewEvents, type ReviewContactLink } from "./call-contact-review";

const contact: ReviewContactLink = {
  id: "contact-1", campaignId: "mission-1", contactType: "clinic",
  customerId: "person-1", clinicId: "clinic-1", hospitalId: null, collaboratorId: null,
};

test("review opens the declared clinic for an exact Mission contact link", () => {
  assert.deepEqual(resolveCallReviewContact({
    customerId: "person-1", campaignId: "mission-1", campaignContactId: "contact-1",
  }, contact), {
    type: "clinic", entityId: "clinic-1", campaignId: "mission-1", campaignContactId: "contact-1",
  });
});

test("review rejects a different Mission or stale campaign contact", () => {
  assert.equal(resolveCallReviewContact({
    customerId: "person-1", campaignId: "mission-2", campaignContactId: "contact-1",
  }, contact), null);
  assert.equal(resolveCallReviewContact({
    customerId: "person-1", campaignId: "mission-1", campaignContactId: "contact-2",
  }, contact), null);
});

test("review rejects contradictory polymorphic identity and unknown contact type", () => {
  assert.equal(resolveCallReviewContact({
    customerId: "other-person", campaignId: "mission-1", campaignContactId: "contact-1",
  }, contact), null);
  assert.equal(resolveCallReviewContact({
    customerId: null, campaignId: "mission-1", campaignContactId: "contact-1",
  }, { ...contact, contactType: "toString" }), null);
});

test("review does not infer a contact from a missing exact link", () => {
  assert.equal(resolveCallReviewContact({
    customerId: "person-1", campaignId: null, campaignContactId: null,
  }, contact), null);
});

test("legacy call recovers only a unique saved Mission and entity link", () => {
  const call = { customerId: "person-1", campaignId: "mission-1", campaignContactId: null };
  assert.deepEqual(resolveUniqueCallReviewContact(call, [contact]), {
    type: "clinic", entityId: "clinic-1", campaignId: "mission-1", campaignContactId: "contact-1",
  });
  assert.equal(resolveUniqueCallReviewContact(call, [contact, { ...contact, id: "contact-2" }]), null);
  assert.equal(resolveUniqueCallReviewContact({ ...call, campaignId: "mission-2" }, [contact]), null);
  assert.equal(resolveUniqueCallReviewContact({ ...call, campaignId: null }, [contact]), null);
});

test("review shows confirmed status-list results, not undone choices", () => {
  const now = new Date("2026-09-24T11:00:00Z");
  const result = summarizeCallReviewEvents([
    { action: "status_list_confirmation", metadata: { statusListItemId: "b", confirmed: false }, createdAt: now },
    { action: "status_list_note_update", metadata: { statusListItemId: "a", itemNote: "Späť zavolať" }, createdAt: now },
    { action: "status_list_confirmation", metadata: { statusListItemId: "a", confirmed: true, itemLabel: "Má záujem" }, createdAt: now },
    { action: "status_list_confirmation", metadata: { statusListItemId: "b", confirmed: true }, createdAt: now },
    { action: "status_list_confirmation", metadata: { statusListItemId: "step", confirmed: true }, createdAt: now },
  ], [{ id: "a", label: "Záujem" }, { id: "b", label: "Bez záujmu" }, { id: "step", label: "Materiály odoslané" }]);
  assert.deepEqual(result.selectedOptions, [
    { id: "a", label: "Má záujem", note: "Späť zavolať", selectedAt: "2026-09-24T11:00:00.000Z" },
    { id: "step", label: "Materiály odoslané", note: null, selectedAt: "2026-09-24T11:00:00.000Z" },
  ]);
});

test("review shows only the newest callback action and a later clear removes it", () => {
  const now = new Date("2026-09-24T11:00:00Z");
  const events = [
    { action: "callback_change", metadata: { callbackDate: "2026-09-28T08:00:00Z", callbackNote: "Ráno" }, createdAt: now },
    { action: "status_list_action", metadata: { actionType: "set_callback", callbackDate: "2026-09-25T08:00:00Z" }, createdAt: now },
  ];
  assert.deepEqual(summarizeCallReviewEvents(events, []).reschedule, { date: "2026-09-28T08:00:00.000Z", note: "Ráno", setAt: "2026-09-24T11:00:00.000Z" });
  assert.equal(summarizeCallReviewEvents([
    { action: "callback_change", metadata: { callbackDate: null }, createdAt: now }, ...events,
  ], []).reschedule, null);
  assert.equal(summarizeCallReviewEvents([
    { action: "status_list_action", metadata: { actionType: "send_sms", callbackDate: "2026-09-28T08:00:00Z" }, createdAt: now },
  ], []).reschedule, null);
  assert.deepEqual(summarizeCallReviewEvents([
    { action: "status_list_action", metadata: { actionType: "set_contact_status", callbackDate: null }, createdAt: now },
    ...events,
  ], []).reschedule, { date: "2026-09-28T08:00:00.000Z", note: "Ráno", setAt: "2026-09-24T11:00:00.000Z" });
});

test("a call-time option snapshot survives deletion or later relabeling", () => {
  const event = {
    action: "status_list_confirmation",
    metadata: { statusListItemId: "deleted-option", confirmed: true, itemType: "option", itemLabel: "Dohodnuté" },
    createdAt: new Date("2026-09-24T11:00:00Z"),
  };
  assert.equal(summarizeCallReviewEvents([event], []).selectedOptions[0]?.label, "Dohodnuté");
  assert.equal(summarizeCallReviewEvents([event], [{ id: "deleted-option", label: "Nový názov" }]).selectedOptions[0]?.label, "Dohodnuté");
  assert.equal(summarizeCallReviewEvents([{ ...event, metadata: { ...event.metadata, itemType: "step" } }], []).selectedOptions[0]?.label, "Dohodnuté");
  assert.deepEqual(summarizeCallReviewEvents([{ ...event, metadata: { ...event.metadata, itemType: "question" } }], []).selectedOptions, []);
});

test("note-only edits and unchanged callback dates do not create scheduling evidence", () => {
  const sameDate = new Date("2026-09-28T08:00:00Z");
  assert.equal(callbackDateChanged(sameDate, sameDate, false), false);
  assert.equal(callbackDateChanged(sameDate, new Date(sameDate), true), false);
  assert.equal(callbackDateChanged(sameDate, null, true), true);
  assert.equal(callbackDateChanged(null, sameDate, true), true);
});

test("current callback fallback is labeled separately and requires this call's exact confirmed option", () => {
  const current = {
    status: "callback_scheduled",
    callbackDate: new Date("2026-09-29T08:30:00Z"),
    callbackNote: " Zavolať po 10:00 ",
    callbackStatusListItemId: "reschedule",
  };
  const selectedOptions = [{ id: "reschedule", label: "Preplánovať hovor", note: null, selectedAt: "2026-09-24T09:22:00.000Z" }];
  assert.deepEqual(currentCallbackMatchingCallOption(current, selectedOptions), {
    date: "2026-09-29T08:30:00.000Z",
    note: "Zavolať po 10:00",
  });
  assert.equal(currentCallbackMatchingCallOption(current, [{ ...selectedOptions[0], id: "other" }]), null);
  assert.equal(currentCallbackMatchingCallOption({ ...current, status: "completed" }, selectedOptions), null);
  assert.equal(currentCallbackMatchingCallOption({ ...current, callbackDate: null }, selectedOptions), null);
  assert.equal(currentCallbackMatchingCallOption({ ...current, callbackStatusListItemId: null }, selectedOptions), null);
});

test("a recorded callback event retains its own date and note instead of the later current schedule", () => {
  const event = {
    action: "status_list_action",
    metadata: { actionType: "set_contact_status", callbackDate: "2026-09-25T08:00:00Z", callbackNote: "Po dovolenke" },
    createdAt: new Date("2026-09-24T09:22:00Z"),
  };
  assert.deepEqual(summarizeCallReviewEvents([event], []).reschedule, {
    date: "2026-09-25T08:00:00.000Z",
    note: "Po dovolenke",
    setAt: "2026-09-24T09:22:00.000Z",
  });
});