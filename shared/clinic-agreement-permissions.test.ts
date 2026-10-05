import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missionAllowsClinicAgreementEditing, canEditClinicAgreements } from "./clinic-agreement-permissions";

for (const value of [undefined, null, "", "{", "null", {}, { readOnlyContactCards: true },
  { readOnlyContactCards: true, readOnlyExceptions: { agreements: false } },
  { readOnlyContactCards: true, readOnlyExceptions: { agreements: "true" } },
  { readOnlyContactCards: false, readOnlyExceptions: { agreements: true } }]) {
  assert.equal(missionAllowsClinicAgreementEditing(value), false);
}
const enabled = { readOnlyContactCards: true, readOnlyExceptions: { agreements: true } };
assert.equal(missionAllowsClinicAgreementEditing(enabled), true);
assert.equal(missionAllowsClinicAgreementEditing(JSON.stringify(enabled)), true);
for (const server of [false, true]) for (const ro of [false, true]) for (const exception of [false, true])
  assert.equal(canEditClinicAgreements(server, ro, exception), server && (!ro || exception));
assert.equal(canEditClinicAgreements(undefined, true, true), false);
const wizard = readFileSync("client/src/components/clinic-form-wizard.tsx", "utf8");
assert.equal((wizard.match(/allowReadOnlyEdit=\{roEx\.agreements === true\} campaignId=\{campaignId\}/g) || []).length, 2);
const workspace = readFileSync("client/src/pages/agent-workspace.tsx", "utf8");
assert.match(workspace, /onCallPhone=\{onClinicMakeCall\}[\s\S]{0,220}campaignId=\{campaign\?\.id\}/);
const translations = readFileSync("client/src/i18n/translations.ts", "utf8");
assert.equal((translations.match(/readOnlyExAgreements: "/g) || []).length, 7);
assert.equal((translations.match(/readOnlyExAgreements: string/g) || []).length, 1);
console.log("PASS: opt-in Mission exception, malformed/legacy settings deny, server permission never bypassed, both clinic views and selected Mission wired, all seven translations.");
