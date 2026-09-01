import assert from "node:assert/strict";
import { cloneOperatorScript } from "./clone-campaign";

const source = {
  version: 1,
  name: "Test",
  startStepId: "step-1",
  steps: [
    {
      id: "step-1",
      title: "First",
      nextStepId: "step-2",
      elements: [
        {
          id: "element-1",
          type: "radio",
          jumpTargetStepId: "step-2",
          options: [{ value: "yes", label: "Yes", nextStepId: "step-2" }],
        },
      ],
    },
    {
      id: "step-2",
      title: "Second",
      elements: [{ id: "element-2", type: "note", content: "Done" }],
      isEndStep: true,
    },
  ],
};

const cloned = cloneOperatorScript(source) as typeof source;
assert.notEqual(cloned.startStepId, source.startStepId);
assert.notEqual(cloned.steps[0].id, source.steps[0].id);
assert.notEqual(cloned.steps[0].elements[0].id, source.steps[0].elements[0].id);
assert.equal(cloned.startStepId, cloned.steps[0].id);
assert.equal(cloned.steps[0].nextStepId, cloned.steps[1].id);
assert.equal(cloned.steps[0].elements[0].jumpTargetStepId, cloned.steps[1].id);
assert.equal(cloned.steps[0].elements[0].options?.[0].nextStepId, cloned.steps[1].id);
assert.equal(source.startStepId, "step-1");

console.log("cloneOperatorScript: all assertions passed");