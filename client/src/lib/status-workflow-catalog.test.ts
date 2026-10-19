import assert from "node:assert/strict";
import { groupWorkflowCatalog, isWorkflowBoolean, isWorkflowYesNo, workflowCatalogPath } from "./status-workflow-catalog";
import type { WorkflowCatalogItem } from "../../../shared/status-list-workflow";
import { getStatusWorkflowDesignCopy } from "../components/status-list-workflow-design-copy";

const item = (id: string, extra: Partial<WorkflowCatalogItem> = {}): WorkflowCatalogItem =>
  ({ kind: "item", id, label: id, fieldType: "checkbox", hidden: false, writable: true, sortOrder: 0, ...extra });
const catalog = [
  item("child-b", { label: "Same option", parentId: "second", itemType: "option" }),
  item("second", { label: "Second", sortOrder: 2 }),
  item("child-a", { label: "Same option", parentId: "first", itemType: "option" }),
  item("first", { label: "First", sortOrder: 1 }),
  item("question", { kind: "question", parentId: "first", fieldType: "yesno", label: "Áno / Nie" }),
  item("nested", { parentId: "child-a" }),
  item("orphan", { parentId: "deleted-parent", sortOrder: 3 }),
];
const groups = groupWorkflowCatalog(catalog);
assert.deepEqual(groups.map(node => node.item.id), ["first", "second", "orphan"]);
assert.deepEqual(groups[0].children.map(node => node.item.id).sort(), ["child-a", "question"]);
assert.equal(groups[1].children[0].item.id, "child-b");
assert.equal(groups[0].children.find(node => node.item.id === "child-a")?.children[0].item.id, "nested");
assert.deepEqual(groupWorkflowCatalog(catalog, "ano").map(node => node.item.id), ["first"]);
assert.equal(groupWorkflowCatalog(catalog, "does not exist").length, 0);
assert.equal(workflowCatalogPath(catalog[5], catalog), "First / Same option");
assert.equal(isWorkflowBoolean(catalog[0]), true);
assert.equal(isWorkflowYesNo(catalog[4]), true);
assert.equal(groupWorkflowCatalog([item("a", { parentId: "b" }), item("b", { parentId: "a" })]).length, 2);
assert.equal(groupWorkflowCatalog([item("same"), item("same", { kind: "question" })]).length, 2);
const base = getStatusWorkflowDesignCopy("en");
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  const copy = getStatusWorkflowDesignCopy(locale);
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(base).sort());
  assert.ok(Object.values(copy).every(value => value.trim() && !["True", "False"].includes(value)));
}
console.log("PASS: exact catalog identities, hierarchy, ordering, cycles, search and all seven translations");
