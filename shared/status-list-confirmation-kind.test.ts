import assert from "node:assert/strict";
import test from "node:test";
import { isStatusListInfoHeading, type StatusListConfirmationNode } from "./status-list-confirmation-kind";

const group: StatusListConfirmationNode = { id: "contract", itemType: "step", confirmationType: "info" };
const received: StatusListConfirmationNode = {
  id: "received", parentId: group.id, itemType: "step", confirmationType: "info",
};
test("legacy step/info answers remain selectable under an informational group", () => {
  const validated = { ...received, id: "validated" };
  for (const answer of [received, validated, { ...received, itemType: "option" }]) {
    assert.equal(isStatusListInfoHeading(answer, [group, answer]), false);
  }
});
test("real group headings and standalone information stay non-confirmable", () => {
  assert.equal(isStatusListInfoHeading(group, [group, received]), true);
  assert.equal(isStatusListInfoHeading(group, [group]), true);
  assert.equal(isStatusListInfoHeading(received, [received]), true, "missing/out-of-Mission parent is not enough");
  assert.equal(isStatusListInfoHeading(received, [{ ...group, confirmationType: "checkbox" }, received]), true);
});
test("nested headings and nodes with actual questions are not legacy answers", () => {
  assert.equal(isStatusListInfoHeading(received, [group, received, {
    id: "nested", parentId: received.id, itemType: "step", confirmationType: "radio",
  }]), true);
  assert.equal(isStatusListInfoHeading({ ...received, questions: [{ id: "question" }] }, [group, received]), true);
  assert.equal(isStatusListInfoHeading(received, [group, received, {
    id: "question", parentId: received.id, itemType: "question",
  }]), true);
});
test("normal manual answers and automatic items are not reclassified as info", () => {
  for (const confirmationType of ["checkbox", "radio", "auto"]) {
    assert.equal(isStatusListInfoHeading({ ...received, confirmationType }, [group]), false);
  }
});
