import assert from "node:assert/strict";
import { readMissionFaq, readMissionFaqCategoryOrder } from "./mission-faq";

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

const orderedItems = readMissionFaq(
  '{"faq":[{"id":"1","question":"Q1","answer":"A1","category":"Pricing"},{"id":"2","question":"Q2","answer":"A2","category":"General"}],"faqCategoryOrder":["General","Empty category","Pricing"]}',
  "en",
);
assert.deepEqual(
  readMissionFaqCategoryOrder(
    '{"faqCategoryOrder":["General","Empty category","Pricing"]}',
    orderedItems,
    "Other",
  ),
  ["General", "Empty category", "Pricing"],
  "explicit category order, including empty categories, must be preserved",
);
assert.deepEqual(
  readMissionFaqCategoryOrder("{}", orderedItems, "Other"),
  ["Pricing", "General"],
  "legacy FAQ category order must follow first appearance",
);

console.log("Mission FAQ campaign-source tests passed");