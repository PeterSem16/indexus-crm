import { test } from "node:test";
import assert from "node:assert/strict";
import { emailPurposeSchema, emailPurposes } from "./email-purpose";
import { effectiveFunnelEmailPurposes, emptyFunnelConfig, funnelConfigSchema } from "./mission-funnel";
import { insertMessageTemplateSchema } from "./schema";

test("email purpose enum is retained by real insert validation and never names a postal status", () => {
  for (const emailPurpose of emailPurposes) {
    const value = insertMessageTemplateSchema.parse({
      name: "Template", type: "email", content: "Body", emailPurpose,
    });
    assert.equal(value.emailPurpose, emailPurpose);
  }
  assert.equal(emailPurposeSchema.safeParse("contract_sent").success, false);
});
test("funnel defaults to proposals, explicit empty disables it and unknown/unspecified/duplicate mappings fail", () => {
  const config = emptyFunnelConfig();
  assert.deepEqual(effectiveFunnelEmailPurposes(config), ["cooperation_proposal"]);
  assert.deepEqual(effectiveFunnelEmailPurposes({ emailPurposes: [] }), []);
  assert.equal(funnelConfigSchema.safeParse({ ...config, emailPurposes: ["information_materials"] }).success, true);
  for (const emailPurposes of [["unspecified"], ["postal_sent"], ["reminder", "reminder"]])
    assert.equal(funnelConfigSchema.safeParse({ ...config, emailPurposes }).success, false);
});
