import assert from "node:assert/strict";
import { statusListRecordValues, STATUS_LIST_RECORD_TEMPLATE_FIELDS } from "../../shared/status-list-template-context";
import { taskTemplateContext } from "./task-template-variables";
import { renderEmailValue } from "./automation-email-policy";
import { templateEligibility } from "../../client/src/components/automation-template-eligibility";

const clinic = statusListRecordValues("clinic", { id: "clinic", name: "Mission clinic", doctor_title: "MUDr.",
  doctor_first_name: "Anna", doctor_last_name: "Nováková", email: "clinic@example.test", mobile_password_hash: "must-not-leak" });
assert.equal(clinic.doctorLastName, "Nováková");
assert.equal(clinic.mobilePasswordHash, undefined);
const base = { statusListService: true, entityId: "clinic", event: { module: "clinic", source: "status_list",
  createdAt: new Date("2026-12-31T23:30:00Z"), countryCode: "SK" },
  newValues: clinic, clinic, user: { fullName: "Manager", email: "sender@example.test", phone: "+421900000000" } };
for (const language of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
  const ctx = taskTemplateContext(base, language);
  assert.equal(ctx.currentYear, "2027", "calendar variables use Bratislava, not the UTC server date");
  assert.equal(ctx.clinic.doctorFullName, "MUDr. Anna Nováková");
  assert.ok(ctx.clinic.doctorSalutationDoc);
  const template = { id: "mission-email", name: "Mission", subject: "{{clinic.doctorTitle}} {{clinic.doctorLastName}}",
    contentHtml: "<p>{{clinic.doctorSalutationDoc}} {{clinic.doctorLastName}}</p><p>{{user.fullName}} {{user.email}} {{user.phone}}</p>" };
  assert.equal(templateEligibility(template, STATUS_LIST_RECORD_TEMPLATE_FIELDS, "status_list").usable, true);
  assert.equal(renderEmailValue(template.subject, ctx, false), "MUDr. Nováková");
  assert.doesNotMatch(renderEmailValue(template.contentHtml, ctx, true), /{{/);
}
const hospital = taskTemplateContext({ ...base, event: { ...base.event, module: "hospital" }, clinic: undefined,
  hospital: statusListRecordValues("hospital", { name: "Mission hospital", contact_person: "Anna Nováková" }) }, "sk");
assert.equal(hospital.hospital.fullName, "Mission hospital");
assert.equal(hospital.hospital.contactPersonSalutationFull, "Vážená pani");
console.log("Mission email variables: exact composer aliases, all seven languages, trusted fields, hospital salutations and Bratislava calendar passed");
