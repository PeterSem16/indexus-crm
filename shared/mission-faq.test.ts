import assert from "node:assert/strict";
import { normalizeMissionFaqItems, sanitizeMissionFaqAnswer } from "./mission-faq";

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

assert.deepEqual(
  normalizeMissionFaqItems([
    { id: "bad id!", question: " Question ", answer: "<b>Answer</b>" },
    { id: "incomplete", question: "", answer: "Answer" },
    { id: "also-incomplete", question: "Question", answer: "<strong></strong>" },
  ]),
  [{ id: "badid", question: "Question", answer: "<strong>Answer</strong>" }],
);

console.log("Mission FAQ tests passed");