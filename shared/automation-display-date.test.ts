import assert from "node:assert/strict";
import test from "node:test";
import { automationDateDisplay } from "./automation-display-date";

test("Task calendar dates retain their day and do not display an invented midnight", () => {
  for (const value of ["2026-10-08", "2026-10-08T00:00:00.000Z", new Date("2026-10-08T00:00:00Z")]) {
    const result = automationDateDisplay("dueDate", value, "task", undefined, "SK");
    assert.equal(result, "8. 10. 2026");
    assert.ok(!result?.includes("00:00"));
  }
});

test("All supported template languages use their own locale, independent of server timezone", () => {
  const mappings = { en: "en-GB", sk: "sk-SK", cs: "cs-CZ", hu: "hu-HU", ro: "ro-RO", it: "it-IT", de: "de-DE" };
  for (const [language, locale] of Object.entries(mappings)) {
    assert.equal(automationDateDisplay("dueDate", "2026-10-08", "task", language, "SK"),
      new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "Europe/Bratislava" })
        .format(new Date("2026-10-08T12:00:00Z")));
  }
  assert.equal(automationDateDisplay("dueDate", "2026-10-08", "task", "en-GB", "SK"), "08/10/2026");
});

test("Real timestamps show Bratislava wall-clock time across DST and retain their instant", () => {
  const value = new Date("2026-10-09T14:47:54Z"), before = value.getTime();
  assert.equal(automationDateDisplay("createdAt", value, "task", "sk"), "9. 10. 2026 16:47");
  assert.equal(automationDateDisplay("overdueDeadlineAt", "2026-10-08T22:00:00Z", "task", "sk"), "9. 10. 2026 0:00");
  assert.equal(automationDateDisplay("startedAt", "2026-10-25T01:30:00Z", "call", "sk"), "25. 10. 2026 2:30");
  assert.equal(value.getTime(), before);
});

test("Empty values stay empty; unsupported fields stay technical; invalid timestamps fail explicitly", () => {
  assert.equal(automationDateDisplay("dueDate", null, "task", "sk"), "");
  assert.equal(automationDateDisplay("id", "2026-10-08", "task", "sk"), undefined);
  assert.equal(automationDateDisplay("dueDate", "2026-10-08", "invoice", "sk"), undefined);
  assert.throws(() => automationDateDisplay("dueDate", "2026-02-30", "task", "sk"), /Invalid/);
  assert.throws(() => automationDateDisplay("startedAt", "2026-10-09T14:47:54", "call", "sk"), /timezone/);
});
