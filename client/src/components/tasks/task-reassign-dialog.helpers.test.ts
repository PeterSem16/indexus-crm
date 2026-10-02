import assert from "node:assert/strict";
import { matchesReassignSearch, normalizeReassignSearch, reassignPayload } from "./task-reassign-dialog.helpers";

assert.equal(normalizeReassignSearch("  ŠÁRKA Černá  "), "sarka cerna");
assert.equal(matchesReassignSearch("SARKA", "Šárka Černá", "sarka@example.test"), true);
assert.equal(matchesReassignSearch("cErNa EXAMPLE", "Šárka Černá", "sarka@example.test"), true);
assert.equal(matchesReassignSearch("julia", "Júlia Szűcs"), true);
assert.equal(matchesReassignSearch("targu", "Târgu Mureș"), true);
assert.equal(matchesReassignSearch("munchen", "München Service"), true);
assert.equal(matchesReassignSearch("care", "Back office", "Customer care team"), true);
assert.equal(matchesReassignSearch("  ", undefined, null), true);
assert.equal(matchesReassignSearch("other", "Back office", "Customer care team"), false);
assert.equal(reassignPayload("user", " "), null);
assert.deepEqual(reassignPayload("user", "user-a"), { newAssignedUserId: "user-a" });
assert.deepEqual(reassignPayload("group", "group-b"), { newTaskGroupId: "group-b" });
assert.equal(Object.keys(reassignPayload("user", "user-a")!).length, 1);
assert.equal(Object.keys(reassignPayload("group", "group-b")!).length, 1);

console.log("Task reassignment search and exclusive payload tests passed.");