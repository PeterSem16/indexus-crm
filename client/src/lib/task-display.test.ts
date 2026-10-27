import assert from "node:assert/strict";
import { taskDisplayText } from "./task-display";

const raw = "Termín: 2026-06-23T07:00:00.000Z\nČas udalosti: 26. 10. 2026 14:40";
const displayed = taskDisplayText(raw, "sk");
assert.match(displayed, /23\.\s*06\.\s*2026 09:00/);
assert.match(displayed, /Čas udalosti: 26\. 10\. 2026 14:40/);
assert.match(taskDisplayText("Termín: 2026-01-23T07:00:00.000Z", "sk"), /08:00/);
assert.match(taskDisplayText("Termín: 2026-06-23T09:00:00\+02:00", "sk"), /09:00/);
assert.match(taskDisplayText(raw, "en"), /Jun 23, 2026|06\/23\/2026/);
assert.equal(taskDisplayText("Termín: 2026-02-30T07:00:00.000Z"), "Termín: 2026-02-30T07:00:00.000Z");
assert.equal(taskDisplayText("https://example.com/2026-06-23T07:00:00.000Z"), "https://example.com/2026-06-23T07:00:00.000Z");
assert.equal(taskDisplayText("Termín: zatiaľ neurčený"), "Termín: zatiaľ neurčený");
assert.equal(taskDisplayText("Termín: 2026-06-23T07:00:00.000Z"), displayed.split("\n")[0]);
assert.equal(taskDisplayText("Úloha (ID: 12345678-1234-1234-1234-123456789abc)"), "Úloha");
console.log("Task timestamps: Bratislava DST, locales, invalid values, URLs and unchanged text passed");
