import assert from "node:assert/strict";
import { resolveStatusListDestination, statusListConfirmationDestinations } from "./status-list-navigation";
import { getStatusListNavigationCopy } from "../i18n/status-list-navigation-copy";

const items = [
  { id: "parent", stepId: "P", tab: "contract" },
  { id: "child", stepId: "C", parentId: "parent", tab: null },
];
assert.equal(resolveStatusListDestination(items, "C")?.target.id, "child");
assert.equal(resolveStatusListDestination(items, "C")?.tab, "contract");
assert.equal(resolveStatusListDestination(items, "missing"), null);
assert.equal(resolveStatusListDestination([{ ...items[0], isHidden: true }, items[1]], "C"), null);
assert.equal(resolveStatusListDestination([items[0], { ...items[1], isHidden: true }], "C"), null);
assert.equal(resolveStatusListDestination([{ ...items[0], confirmationType: "auto" }, items[1]], "C"), null);
assert.equal(resolveStatusListDestination([{ ...items[0], itemType: "option" }], "P"), null);
assert.equal(resolveStatusListDestination([items[1]], "C"), null);
assert.equal(resolveStatusListDestination([{ ...items[0], parentId: "child" }, items[1]], "C"), null);
const sources = [
  ...items,
  { id: "source", stepId: "S", label: "Source", nextStepId: "C" },
  { id: "other", stepId: "O", label: "Other", nextStepId: "P" },
];
assert.deepEqual(statusListConfirmationDestinations(sources, [{ kind: "item", id: "source", value: false }]), []);
assert.deepEqual(statusListConfirmationDestinations(sources, [{ kind: "question", id: "source", value: true }]), []);
assert.equal(statusListConfirmationDestinations(sources, [{ kind: "item", id: "source", value: true }])[0].stepId, "C");
assert.equal(statusListConfirmationDestinations(sources, [
  { kind: "item", id: "source", value: true }, { kind: "item", id: "other", value: true },
])[0].stepId, "P");
assert.equal(statusListConfirmationDestinations([{ id: "source", nextStepId: "gone" }], [
  { kind: "item", id: "source", value: true },
])[0].available, false);
for (const language of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  assert.ok(Object.values(getStatusListNavigationCopy(language)).every(value => !!value));
}
console.log("Status List navigation: destination, inherited phase, visibility, cycles and seven locales passed.");
