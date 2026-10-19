import assert from "node:assert/strict";
import { isStatusListSourceGroup } from "./status-list-source-group";
const parent = { kind: "item", itemType: "step", confirmationType: "info" };
const option = { kind: "item", itemType: "option", confirmationType: "checkbox" };
const radio = { kind: "item", itemType: "step", confirmationType: "radio" };
assert.equal(isStatusListSourceGroup(parent, [option, option]), true);
assert.equal(isStatusListSourceGroup(parent, [radio, radio, radio]), true);
for (const children of [[], [radio], [radio, option], [radio, { ...radio, confirmationType: "checkbox" }],
  [radio, { ...radio, confirmationType: "auto" }], [radio, { ...radio, kind: "question" }]]) {
  assert.equal(isStatusListSourceGroup(parent, children), false);
}
assert.equal(isStatusListSourceGroup(undefined, [radio, radio]), false);
assert.equal(isStatusListSourceGroup({ ...parent, confirmationType: "auto" }, [radio, radio]), false);
assert.equal(isStatusListSourceGroup({ ...parent, kind: "question" }, [option, option]), false);
console.log("Status List source group eligibility: 11 checks passed");
