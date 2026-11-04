import { strict as assert } from "node:assert";
import { test } from "node:test";
import { statusListPhaseProgress, type PhaseProgressItem } from "./status-list-phase-progress";

const heading = (extra: Partial<PhaseProgressItem> = {}): PhaseProgressItem => ({
  id: "heading", itemType: "step", confirmationType: "info", tab: "contract", ...extra,
});
test("information headings count real questions and both yes/no spellings", () => {
  const items = [heading({ questions: [
    { id: "yes", fieldType: "yesno" }, { id: "no", fieldType: "yes_no" },
    { id: "pending", fieldType: "yesno" },
  ] })];
  assert.deepEqual(statusListPhaseProgress(items, new Set(), { yes: "yes", no: false }).contract,
    { total: 3, confirmed: 2, pct: 67 });
});
test("one-choice questions and radio alternatives each count once", () => {
  const items = [heading({ questions: [
    { id: "a", groupName: "choice", logicOperator: "ONE" },
    { id: "b", groupName: "choice", logicOperator: "ONE" },
    { id: "c", groupName: "radio", fieldType: "radio" },
    { id: "d", groupName: "radio", fieldType: "radio" },
  ] })];
  assert.deepEqual(statusListPhaseProgress(items, new Set(), { b: true, c: true }).contract,
    { total: 2, confirmed: 2, pct: 100 });
  assert.equal(statusListPhaseProgress([heading({ ...items[0], questionSelectionMode: "single" })],
    new Set(), { b: true }).contract.total, 1);
});
test("legacy info answer leaves inherit the phase and collapse exclusive siblings", () => {
  const items = [heading({ questionSelectionMode: "single" }),
    heading({ id: "a", tab: null, parentId: "heading" }),
    heading({ id: "b", tab: null, parentId: "heading" })];
  assert.deepEqual(statusListPhaseProgress(items, new Set(["b"]), {}).contract,
    { total: 1, confirmed: 1, pct: 100 });
  assert.equal(statusListPhaseProgress(items, new Set(), {}).contract.pct, 0);
  const multi = items.map(item => ({ ...item, questionSelectionMode: null }));
  assert.deepEqual(statusListPhaseProgress(multi, new Set(["a"]), {}).contract,
    { total: 2, confirmed: 1, pct: 50 });
});
test("empty headings, hidden subtrees, technical actions, quick options and orphans are excluded", () => {
  const items = [
    heading(), heading({ id: "hidden", isHidden: true }),
    heading({ id: "child", parentId: "hidden", confirmationType: "checkbox", tab: null }),
    heading({ id: "auto", confirmationType: "auto" }),
    heading({ id: "option", itemType: "option" }),
    heading({ id: "orphan", parentId: "missing", confirmationType: "checkbox" }),
    heading({ id: "shared", tab: null, confirmationType: "checkbox" }),
  ];
  assert.deepEqual(statusListPhaseProgress(items, new Set(items.map(item => item.id)), {}).contract,
    { total: 0, confirmed: 0, pct: 0 });
});
test("visible read-only outcomes remain measurable rather than becoming hidden diagnostics", () => {
  const item = heading({ sourceManaged: true, questions: [{ id: "q", fieldType: "yesno" }] });
  assert.equal(statusListPhaseProgress([item], new Set(), { q: "no" }).contract.pct, 100);
});
test("draft selection/removal and answer clearing recompute without mutating source state", () => {
  const item = heading({ questions: [{ id: "q", fieldType: "checkbox" }] });
  const saved = { q: true };
  assert.equal(statusListPhaseProgress([item], new Set(), saved).contract.pct, 100);
  for (const value of [null, undefined, "", false, " "])
    assert.equal(statusListPhaseProgress([item], new Set(), { q: value }).contract.pct, 0);
  assert.deepEqual(saved, { q: true });
  const step = heading({ confirmationType: "checkbox" });
  assert.equal(statusListPhaseProgress([step], new Set(["heading"]), {}).contract.pct, 100);
  assert.equal(statusListPhaseProgress([step], new Set(), {}).contract.pct, 0);
});
test("selected branch questions count, unselected branch questions cannot block completion", () => {
  const items = [heading({ questionSelectionMode: "single" }),
    heading({ id: "a", parentId: "heading", tab: null, questions: [{ id: "a-q" }] }),
    heading({ id: "b", parentId: "heading", tab: null, questions: [{ id: "b-q" }] })];
  assert.deepEqual(statusListPhaseProgress(items, new Set(["a"]), { "a-q": true }).contract,
    { total: 2, confirmed: 2, pct: 100 });
  assert.equal(statusListPhaseProgress(items, new Set(["b"]), { "a-q": true }).contract.pct, 50);
});
