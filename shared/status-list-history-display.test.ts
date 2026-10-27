import test from "node:test";
import assert from "node:assert/strict";
import { formatStatusListHistory } from "./status-list-history-display";

test("answers show the question and saved transition, never the audit event code", () => {
  const display = formatStatusListHistory({ action: "status_list_answer", metadata: {
    questionLabel: "Chcem preplánovať hovor", previous: false, value: true,
  } }, "sk")!;
  assert.equal(display.source, "Status list");
  assert.equal(display.title, "Odpoveď uložená: Chcem preplánovať hovor");
  assert.equal(display.details, "Nevybrané → Vybrané");
});
test("answer clearing and false/zero values are not lost", () => {
  assert.match(formatStatusListHistory({ action: "status_list_answer", metadata: { value: null } }, "sk")!.title, /zrušená/);
  assert.equal(formatStatusListHistory({ action: "status_list_answer", metadata: { value: false } }, "sk")!.details, "Nevybrané");
  assert.equal(formatStatusListHistory({ action: "status_list_answer", metadata: { value: 0 } }, "sk")!.details, "0");
});
test("status actions explain the result, step and Bratislava callback time", () => {
  const display = formatStatusListHistory({ action: "status_list_action", metadata: {
    actionType: "set_contact_status", dispositionCode: "no_time", callbackDate: "2026-10-28T08:00:00Z",
    statusListHistory: { dispositionName: "Nemá čas", itemLabel: "Prvý kontakt" },
  } }, "sk")!;
  assert.equal(display.title, "Stav hovoru zmenený: Nemá čas");
  assert.match(display.details, /Prvý kontakt/);
  assert.match(display.details, /9:00/);
  assert.doesNotMatch(JSON.stringify(display), /no_time|status_list_action/);
});
test("snapshots survive renaming and explicit empty snapshots never revive current labels", () => {
  const display = formatStatusListHistory({ action: "status_list_answer", metadata: {
    questionLabel: "Pôvodná otázka", statusListHistory: { questionLabel: "Nová otázka" }, value: true,
  } }, "sk")!;
  assert.match(display.title, /Pôvodná/);
  assert.doesNotMatch(display.title, /Nová/);
  assert.doesNotMatch(formatStatusListHistory({ action: "status_list_answer",
    metadata: { questionLabel: null, statusListHistory: { questionLabel: "Nová otázka" } } }, "sk")!.title, /Nová/);
});
test("missing/deleted definitions and unknown future events never expose codes or JSON", () => {
  for (const action of ["status_list_answer", "status_list_action", "status_list_workflow", "status_list_future"]) {
    const display = formatStatusListHistory({ action, metadata: {
      automationId: "hidden-id", dispositionCode: "internal_status_code", actionType: "unknown_internal_action",
    } }, "sk")!;
    assert.equal(display.source, "Status list");
    assert.doesNotMatch(JSON.stringify(display), /status_list_|hidden-id|internal_status_code|unknown_internal_action/);
  }
  assert.equal(formatStatusListHistory({ action: "status_change" }, "sk"), null);
});
test("failures, skips and kept callbacks must not claim successful execution", () => {
  const action = "status_list_action";
  assert.equal(formatStatusListHistory({ action, metadata: { actionType: "send_sms", ok: false } }, "sk")!.title, "Akcia zlyhala");
  assert.equal(formatStatusListHistory({ action, metadata: { skipped: true } }, "sk")!.title, "Akcia preskočená");
  assert.equal(formatStatusListHistory({ action, metadata: { keptExisting: true } }, "sk")!.title, "Pôvodné spätné volanie zachované");
});
test("all seven languages render human titles without technical event codes", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const display = formatStatusListHistory({ action: "status_list_answer", metadata: { value: true } }, locale)!;
    assert.ok(display.title.length > 5);
    assert.ok(display.details);
    assert.doesNotMatch(display.title, /status_list_/);
  }
});
