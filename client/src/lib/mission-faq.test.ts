import assert from "node:assert/strict";
import { readMissionFaq } from "./mission-faq";

const defaults = readMissionFaq("{}", "en");
assert.equal(defaults.length, 8);
assert.equal(defaults[0].question, "What is cord blood?");
assert.equal(defaults[0].category, "General");

assert.deepEqual(
  readMissionFaq('{"faq":[]}', "en"),
  [],
  "an explicitly empty campaign FAQ must not restore defaults",
);

assert.deepEqual(
  readMissionFaq('{"faq":[{"id":"custom","question":"Mission question","answer":"Mission answer","category":"Mission"}]}', "en"),
  [{ id: "custom", question: "Mission question", answer: "Mission answer", category: "Mission" }],
  "campaign FAQ must replace defaults",
);

console.log("Mission FAQ campaign-source tests passed");