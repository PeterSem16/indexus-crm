import assert from "node:assert/strict";
import test from "node:test";
import {
  callRecordingPhoneMatches,
  callRecordingUploadConflict,
  resolveCallRecordingCustomer,
  type CallRecordingCampaignContact,
  type CallRecordingEntity,
} from "./call-recording-identity";

const entities: CallRecordingEntity[] = [
  { id: "customer-1", type: "customer", name: "Eva Customer" },
  { id: "clinic-1", type: "clinic", name: "Clinic One" },
  { id: "hospital-1", type: "hospital", name: "Hospital One" },
  { id: "collaborator-1", type: "collaborator", name: "Agent Contact" },
];

const contact: CallRecordingCampaignContact = {
  id: "contact-1",
  campaignId: "mission-1",
  contactType: "clinic",
  customerId: null,
  clinicId: "clinic-1",
  hospitalId: null,
  collaboratorId: null,
};

test("call-log customer ID overrides stale multipart names and resolves its exact customer", () => {
  assert.deepEqual(resolveCallRecordingCustomer({
    callLogCustomerId: "customer-1",
    callLogCampaignId: null,
    callLogCampaignContactId: null,
    entities,
  }), {
    customerId: "customer-1",
    customerName: "Eva Customer",
    entityType: "customer",
  });
});

test("exact call-time campaign contact resolves polymorphic clinic identity", () => {
  assert.deepEqual(resolveCallRecordingCustomer({
    callLogCustomerId: "clinic-1",
    callLogCampaignId: "mission-1",
    callLogCampaignContactId: "contact-1",
    campaignContact: contact,
    entities,
  }), {
    customerId: "clinic-1",
    customerName: "Clinic One",
    entityType: "clinic",
  });
});

test("campaign contact from another Mission cannot override call-log identity", () => {
  assert.deepEqual(resolveCallRecordingCustomer({
    callLogCustomerId: null,
    callLogCampaignId: "mission-2",
    callLogCampaignContactId: "contact-1",
    campaignContact: contact,
    entities,
  }), {
    customerId: null,
    customerName: null,
    entityType: null,
  });
});

test("conflicting call-log and campaign-contact polymorphic IDs fail closed", () => {
  assert.deepEqual(resolveCallRecordingCustomer({
    callLogCustomerId: "customer-1",
    callLogCampaignId: "mission-1",
    callLogCampaignContactId: "contact-1",
    campaignContact: contact,
    entities,
  }), {
    customerId: null,
    customerName: null,
    entityType: null,
  });
});

test("overlapping polymorphic IDs are unresolved unless exact campaign contact disambiguates", () => {
  const duplicateId = [
    { id: "same-id", type: "customer" as const, name: "Customer" },
    { id: "same-id", type: "clinic" as const, name: "Clinic" },
  ];
  assert.equal(resolveCallRecordingCustomer({
    callLogCustomerId: "same-id",
    callLogCampaignId: null,
    callLogCampaignContactId: null,
    entities: duplicateId,
  }).customerName, null);
  assert.equal(resolveCallRecordingCustomer({
    callLogCustomerId: "clinic-1",
    callLogCampaignId: "mission-1",
    callLogCampaignContactId: "contact-1",
    campaignContact: contact,
    entities,
  }).customerName, "Clinic One");
});

test("call upload rejects safely comparable phone mismatch but tolerates unknown local context", () => {
  assert.equal(callRecordingPhoneMatches("+421 905 123 456", "+421 905 123 456"), true);
  assert.equal(callRecordingPhoneMatches("+421 905 123 456", "+420 905 123 456"), false);
  assert.equal(callRecordingPhoneMatches("0905 123 456", "0905 123 457"), true);
});

test("any existing call recording prevents a duplicate upload from overwriting it", () => {
  assert.equal(callRecordingUploadConflict(null), false);
  assert.equal(callRecordingUploadConflict("recording-1"), true);
});