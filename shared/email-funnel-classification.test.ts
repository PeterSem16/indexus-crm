import { test } from "node:test";
import assert from "node:assert/strict";
import { emailFunnelStepsSchema, validEmailFunnelStepsForType } from "./email-purpose";
import { effectiveFunnelEmailSteps, emptyFunnelConfig, funnelConfigSchema, funnelSteps } from "./mission-funnel";

test("classification accepts multiple stable Funnel IDs, not labels, duplicates or legacy purposes", () => {
  assert.deepEqual(emailFunnelStepsSchema.parse(["cooperating","packageSent"]),["cooperating","packageSent"]);
  assert.deepEqual(emailFunnelStepsSchema.parse([...funnelSteps]),[...funnelSteps]);
  for (const value of ["email",["Spolupracuje"],["email","email"],["cooperation_proposal"],[null]])
    assert.equal(emailFunnelStepsSchema.safeParse(value).success,false);
});
test("nullable legacy state differs from an explicit empty classification and non-email templates cannot classify", () => {
  for (const value of [undefined,null,[]]) assert.equal(validEmailFunnelStepsForType(value,"email"),true);
  assert.equal(validEmailFunnelStepsForType(["email"],"email"),true);
  for (const type of ["sms","task","notification"]) {
    assert.equal(validEmailFunnelStepsForType(["email"],type),false);
    assert.equal(validEmailFunnelStepsForType([],type),true);
  }
});
test("saved configuration preserves independent legacy purposes and explicit opt-outs", () => {
  const config=emptyFunnelConfig();
  assert.deepEqual(effectiveFunnelEmailSteps(config),[...funnelSteps]);
  config.emailPurposes=[];
  assert.deepEqual(effectiveFunnelEmailSteps(config),[]);
  config.emailFunnelSteps=["cooperating","materials"];
  const saved=funnelConfigSchema.parse(config);
  assert.deepEqual(saved.emailPurposes,[]);
  assert.deepEqual(effectiveFunnelEmailSteps(saved),["cooperating","materials"]);
  saved.emailFunnelSteps=[];
  assert.deepEqual(effectiveFunnelEmailSteps(saved),[]);
});
