import assert from "node:assert/strict";
import test from "node:test";
import { resolveCallReviewContact, type ReviewContactLink } from "./call-contact-review";

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