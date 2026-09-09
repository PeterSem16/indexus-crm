import assert from "node:assert/strict";
import {
  normalizeMissionFaqCategoryOrder,
  normalizeMissionFaqItems,
  sanitizeMissionFaqAnswer,
} from "./mission-faq";

assert.equal(
  sanitizeMissionFaqAnswer(
    '<img src=x onerror=alert(1)><strong onclick="alert(1)">Safe</strong><script>alert(1)</script><br>Next',
  ),
  "<strong>Safe</strong><br>Next",
);

assert.equal(
  sanitizeMissionFaqAnswer("<div>First</div><div><b>Second</b></div>"),
  "First<br><strong>Second</strong>",
);

assert.equal(
  sanitizeMissionFaqAnswer('<i onclick="x()">Italic</i> <em style="x">also</em> <u onmouseover="x()">underlined</u>'),
  "<em>Italic</em> <em>also</em> <u>underlined</u>",
);

assert.deepEqual(
  normalizeMissionFaqItems([
    { id: "bad id!", question: " Question ", answer: "<b>Answer</b>", category: "<b> General </b>" },
    { id: "incomplete", question: "", answer: "Answer" },
    { id: "also-incomplete", question: "Question", answer: "<strong></strong>" },
  ]),
  [{ id: "badid", question: "Question", answer: "<strong>Answer</strong>", category: "General" }],
);

assert.deepEqual(
  normalizeMissionFaqCategoryOrder(
    [" Pricing ", "<b>General</b>", "Pricing", "", 123],
    [
      { id: "1", question: "Q", answer: "A", category: "Process" },
      { id: "2", question: "Q", answer: "A" },
    ],
    "Other",
  ),
  ["Pricing", "General", "Process", "Other"],
);

assert.deepEqual(
  normalizeMissionFaqCategoryOrder(
    undefined,
    [{ id: "1", question: "Q", answer: "A" }],
  ),
  [],
  "server-side normalization must not invent an English category for localized legacy FAQ",
);

console.log("Mission FAQ tests passed");