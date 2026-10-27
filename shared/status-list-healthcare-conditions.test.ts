import test from "node:test";
import assert from "node:assert/strict";
import { healthcareConditionMatches as matches } from "./status-list-healthcare-conditions";
import { workflowConditionSchema, workflowConditionMatches } from "./status-list-workflow";
import { automaticCondition } from "./status-list-automatic";

test("healthcare conditions share state/counter semantics and fail closed", () => {
  const facts = { state: "unreachable" as const, failedAttempts: 5 };
  assert.equal(matches(facts, "healthcare.state", "eq", "unreachable"), true);
  assert.equal(matches(facts, "healthcare.state", "not_equals", "reachable"), true);
  for (const op of ["equals", "gte", "lte"]) assert.equal(matches(facts, "healthcare.failed_attempts", op, "5"), true);
  assert.equal(matches(facts, "healthcare.failed_attempts", "gt", "5"), false);
  assert.equal(matches(facts, "healthcare.failed_attempts", "lt", "6"), true);
  for (const invalid of ["", "-1", "1.2", "NaN", "Infinity", true, "9007199254740992"]) {
    assert.equal(matches(facts, "healthcare.failed_attempts", "gte", invalid), false);
    assert.equal(workflowConditionSchema.safeParse({ field: "healthcare.failed_attempts", op: "gte", value: invalid }).success, false);
  }
  for (const field of ["healthcare.state", "healthcare.failed_attempts"])
    assert.equal(matches(null, field, "not_equals", "reachable"), false);
  assert.equal(matches(facts, "healthcare.state", "eq", "unknown"), false);
  assert.equal(workflowConditionSchema.safeParse({ field: "status", op: "gte", value: "5" }).success, false);
  assert.equal(workflowConditionSchema.safeParse({ field: "healthcare.state", op: "gte", value: "reachable" }).success, false);
  const condition = workflowConditionSchema.parse({ field: "healthcare.failed_attempts", op: "gte", value: "5" });
  assert.equal(workflowConditionMatches(condition, facts), true);
  assert.equal(workflowConditionMatches(condition, null), false);
  const compound={conditionJson:JSON.stringify({logic:"AND",rules:[
    {field:"healthcare.state",op:"eq",value:"unreachable"},{field:"healthcare.failed_attempts",op:"gte",value:"5"},
  ]})};
  assert.equal(automaticCondition(compound,null,"SK",true,facts).value,true);
  assert.equal(automaticCondition(compound,null,"SK",true,null).issue,"invalid_condition");
  assert.equal(automaticCondition({conditionField:"healthcare.failed_attempts",conditionOperator:"gte",conditionValue:"5.5"},
    null,"SK",true,facts).issue,"invalid_condition");
});
