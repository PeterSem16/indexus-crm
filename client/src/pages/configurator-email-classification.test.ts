import { test } from "node:test";
import assert from "node:assert/strict";
import { templateEmailClassification } from "./configurator-email-classification";
import { missionFunnelTranslations } from "../i18n/mission-funnel-translations";
import { funnelSteps } from "../../../shared/mission-funnel";

test("new email templates start with unspecified legacy purpose and no Funnel-step classification", () => {
  assert.deepEqual(templateEmailClassification({
    type: "email", existing: null, purpose: "unspecified", funnelSteps: [], funnelStepsEdited: false,
  }), { emailPurpose: "unspecified", emailFunnelSteps: [] });
});

test("editing an untouched legacy template preserves its legacy purpose and null classification", () => {
  assert.deepEqual(templateEmailClassification({
    type: "email",
    existing: { type: "email", emailPurpose: "reminder", emailFunnelSteps: null },
    purpose: "unspecified",
    funnelSteps: [],
    funnelStepsEdited: false,
  }), { emailPurpose: "reminder", emailFunnelSteps: null });
});

test("editing a classified template preserves its exact step array and legacy purpose", () => {
  const steps = ["email", "sent"] as const;
  assert.deepEqual(templateEmailClassification({
    type: "email",
    existing: { type: "email", emailPurpose: "contract_for_signature", emailFunnelSteps: [...steps] },
    purpose: "unspecified",
    funnelSteps: [...steps],
    funnelStepsEdited: false,
  }), { emailPurpose: "contract_for_signature", emailFunnelSteps: [...steps] });
});

test("changing step selections replaces only the step array; non-email templates use empty classification", () => {
  assert.deepEqual(templateEmailClassification({
    type: "email",
    existing: { type: "email", emailPurpose: "reminder", emailFunnelSteps: null },
    purpose: "unspecified",
    funnelSteps: ["email", "received"],
    funnelStepsEdited: true,
  }), { emailPurpose: "reminder", emailFunnelSteps: ["email", "received"] });
  assert.deepEqual(templateEmailClassification({
    type: "sms", existing: null, purpose: "reminder", funnelSteps: ["email"], funnelStepsEdited: true,
  }), { emailPurpose: "unspecified", emailFunnelSteps: [] });
});

test("an explicitly cleared step selection remains [] and does not fall back to legacy purpose", () => {
  assert.deepEqual(templateEmailClassification({
    type: "email",
    existing: { type: "email", emailPurpose: "cooperation_proposal", emailFunnelSteps: null },
    purpose: "unspecified",
    funnelSteps: [],
    funnelStepsEdited: true,
  }), { emailPurpose: "cooperation_proposal", emailFunnelSteps: [] });
});

test("all supported locales provide the step-classification and legacy-safety copy", () => {
  for (const copy of Object.values(missionFunnelTranslations)) {
    assert.ok(copy.templateEmailPurposeHelp);
    assert.ok(copy.templateEmailFunnelStepsHelp);
    assert.ok(copy.funnelEmailPurposeLabel);
    assert.ok(copy.funnelEmailStepsHelp);
    assert.ok(copy.funnelEmailLegacyLabel);
    assert.ok(copy.funnelEmailNoOtherMilestones);
    assert.ok(copy.emailPurposePostalBoundary);
    assert.ok(copy.funnelEmailStepsCount.includes("{selected}"));
    assert.ok(copy.funnelEmailStepsCount.includes("{total}"));
    for (const step of funnelSteps) assert.ok(copy.stepLabels[step]);
  }
});
