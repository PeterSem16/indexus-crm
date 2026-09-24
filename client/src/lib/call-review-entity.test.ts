import assert from "node:assert/strict";
import test from "node:test";
import { fullCardEntityFromReview } from "./call-review-entity";

for (const type of ["customer", "clinic", "hospital"] as const) {
  test(`opens the saved ${type} entity, not the call's polymorphic customer ID`, () => {
    assert.deepEqual(fullCardEntityFromReview({ type, entityId: `${type}-123` }), {
      type, id: `${type}-123`,
    });
  });
}

test("does not offer a full card for an unsupported collaborator or missing identity", () => {
  assert.equal(fullCardEntityFromReview({ type: "collaborator", entityId: "collab-123" }), null);
  assert.equal(fullCardEntityFromReview({ type: "clinic", entityId: null }), null);
  assert.equal(fullCardEntityFromReview({ type: "hospital", entityId: "  " }), null);
});