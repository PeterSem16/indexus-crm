import assert from "node:assert/strict";
import { isRoutineGeneratedTask, taskSentimentText, taskTextIdentity } from "./task-sentiment";

const task = { id: "task-1", title: "Customer is unhappy", description: "Please call back." };
assert.equal(taskSentimentText(task), "Customer is unhappy\nPlease call back.");
assert.equal(taskTextIdentity(task), taskTextIdentity({ ...task, description: "Please   call back." }));
assert.notEqual(taskTextIdentity(task), taskTextIdentity({ ...task, title: "Customer is satisfied" }));

assert.equal(isRoutineGeneratedTask({ id: "generated", title: "Customer complaint", sourceRunId: "run-1" }), true);
assert.equal(isRoutineGeneratedTask({ id: "routine", title: "Follow-up" }), true);
assert.equal(isRoutineGeneratedTask({ id: "customer", title: "Follow-up", description: "Customer says service was unacceptable" }), false);
assert.equal(isRoutineGeneratedTask({ id: "ordinary", title: "Customer unhappy", description: "Call them" }), false);

console.log("task sentiment tests passed");