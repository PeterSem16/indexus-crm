import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import ts from "typescript";
import { statusListCallbackParts } from "../../shared/status-list-callback-calendar";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../../shared/status-list-transition-audit";
import { serviceCallbackDate, callbackOverride } from "./status-list-service-calendar";

// Test against the ACTUAL old runtime helpers, not compareTransitionModels.
const routes = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
const parsed = ts.createSourceFile("routes.ts", routes, ts.ScriptTarget.Latest, true);
const helpers = ["tzOffsetMinutes", "zonedWallClockToUtc", "bratislavaCalendarParts", "parseCallbackDateInput", "computeStatusListCallbackDate"];
const calendar = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && helpers.includes(node.name?.text ?? ""))
  .map(node => node.getText(parsed)).join("\n");
assert.ok(calendar.includes("function computeStatusListCallbackDate("), "must extract the real runtime calendar");
const code = transformSync(calendar, { loader: "ts", target: "es2022" }).code;
const legacy = new Function("statusListCallbackParts", "APP_TIMEZONE", `${code};return {computeStatusListCallbackDate,parseCallbackDateInput};`)(statusListCallbackParts, "Europe/Bratislava");
const RealDate = Date;
function at<T>(now: string, fn: () => T): T {
  class Clock extends RealDate {
    constructor(value?: any) { super(value === undefined ? now : value); }
    static now() { return new RealDate(now).getTime(); }
  }
  globalThis.Date = Clock as DateConstructor;
  try { return fn(); } finally { globalThis.Date = RealDate; }
}
const actions = medicalPartnerAudit(MEDICAL_PARTNER_AUDIT_CAMPAIGN)!.actions.filter(a => a.callback);
assert.equal(actions.length, 8);
for (const action of actions) {
  for (const now of ["2026-10-23T23:30:00Z", "2026-10-24T12:00:00Z",
    "2027-03-26T12:00:00Z", "2026-10-23T12:00:00Z", "2026-12-23T12:00:00Z"]) {
    const expected = at(now, () => legacy.computeStatusListCallbackDate(action.callback!.days, action.callback!.time, action.callback!.weekdaysOnly));
    assert.equal(serviceCallbackDate(action.callback!, new Date(now)).toISOString(), expected.toISOString(), `${action.stepCode} ${now}`);
  }
}
for (const manual of ["2026-11-01T10:30", "2026-11-01T10:30:00+01:00", "2026-11-01T09:30:00Z"]) {
  assert.equal(callbackOverride(manual)?.toISOString(), legacy.parseCallbackDateInput(manual)?.toISOString());
  assert.equal(serviceCallbackDate(actions[0].callback!, new Date(), manual).toISOString(), "2026-11-01T09:30:00.000Z");
}
assert.equal(callbackOverride("not a date"), null);
console.log("Callback calendar: all eight actions match the actual legacy calendar, DST, weekends, holiday policy and manual override.");
