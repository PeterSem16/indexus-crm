import assert from "node:assert/strict";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../../shared/status-list-transition-audit";
import { compareTransitionModels } from "../../shared/status-list-transition";
import { callbackDecision, type CallbackEnvelope } from "./status-list-callback-compatible";

const inventory = medicalPartnerAudit(MEDICAL_PARTNER_AUDIT_CAMPAIGN)!;
let checks = 0;
for (const action of inventory.actions.filter(a => a.callback)) {
  for (const now of ["2026-10-20T12:00:00Z", "2026-10-23T12:00:00Z", "2026-10-24T12:00:00Z",
    "2026-10-23T22:30:00Z", "2027-03-26T12:00:00Z", "2027-03-28T00:30:00Z"]) {
    for (const callCount of [0, 1, 2]) {
      for (const manualDate of [null, "2026-11-02T09:30:00.000Z"]) {
        const payload: CallbackEnvelope = { action, now, callCount, manualDate, note: null, dispositionCode: "CB" };
        const actual = callbackDecision(payload, { status: "pending", callback_date: null });
        const legacy = compareTransitionModels(inventory, { itemId: action.itemId, now, callCount,
          ...(manualDate ? { manualDate } : {}) }).find(r => r.id === action.id)!.legacy;
        assert.equal(actual.status, legacy.status);
        if (actual.status === "callback") assert.equal(actual.callbackDate, legacy.callbackDate);
        checks++;
      }
    }
  }
}
const action = structuredClone(inventory.actions.find(a => a.callback)!);
action.callback!.existing = "keep_existing";
const payload: CallbackEnvelope = { action, now: "2026-10-20T12:00:00Z", callCount: 0, manualDate: "2026-11-03T09:00:00Z",
  note: "new", dispositionCode: "CB" };
for (const status of ["pending", "callback_scheduled"]) assert.equal(
  callbackDecision(payload, { status, callback_date: "2020-01-01T09:00:00Z" }).status, "kept_existing");
assert.equal(callbackDecision(payload, { status: "completed", callback_date: "2020-01-01T09:00:00Z" }).status, "callback");
assert.equal(callbackDecision({ ...payload, callCount: null }, { status: "pending", callback_date: null }).status, "condition_false");
assert.throws(() => callbackDecision({ ...payload, action: { ...action, issues: ["reference_missing"] } },
  { status: "pending", callback_date: null }), /unsupported/);
console.log(`Compatible callback decisions: ${checks} legacy comparisons, pending/no-op and invalid-source boundaries passed.`);
