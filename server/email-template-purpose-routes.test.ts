import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { emailPurposeSchema, validEmailFunnelStepsForType } from "../shared/email-purpose";

const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
function fixture(method: "post" | "patch", existing: {
  id: string; type: string; emailPurpose: string; emailFunnelSteps?: string[] | null;
} = { id: "template", type: "email", emailPurpose: "reminder" }) {
  let handler: any;
  let saved: any;
  const path = method === "post" ? "/api/message-templates" : "/api/message-templates/:id";
  const start = source.indexOf(`  app.${method}("${path}"`);
  const end = source.indexOf("\n  });", start) + "\n  });".length;
  assert.ok(start >= 0 && end > start);
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  runInNewContext(js, {
    app: { [method]: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); } },
    requireAuth() {}, requireAdminOrManager() {}, emailPurposeSchema, validEmailFunnelStepsForType,
    validMessageTemplateCountries: () => true, validTaskMessageTemplate: () => true,
    validNotificationMessageTemplate: () => true,
    storage: {
      getMessageTemplate: async () => existing,
      createMessageTemplate: async (value: any) => { saved = value; return value; },
      updateMessageTemplate: async (_id: string, value: any) => { saved = value; return { ...existing, ...value }; },
    },
    console: { error() {} },
  });
  return {
    async request(body: unknown) {
      let status = 200, result: any;
      const res = {
        status(value: number) { status = value; return this; },
        json(value: unknown) { result = value; return this; },
      };
      await handler({ body, params: { id: "template" }, session: { user: { id: "manager" } } }, res);
      return { status, result, saved };
    },
  };
}
for (const method of ["post", "patch"] as const) {
  test(`${method} template validates stable purpose and persists the exact choice`, async () => {
    const ok = await fixture(method).request({ type: "email", name: "Proposal", content: "Body", emailPurpose: "cooperation_proposal" });
    assert.equal(ok.status, method === "post" ? 201 : 200);
    assert.equal(ok.saved.emailPurpose, "cooperation_proposal");
    assert.equal(ok.saved.updatedBy, "manager");
    for (const emailPurpose of ["postal_sent", null, ["cooperation_proposal"]]) {
      const bad = await fixture(method).request({ type: "email", emailPurpose });
      assert.equal(bad.status, 400);
      assert.equal(bad.saved, undefined);
    }
    assert.equal((await fixture(method).request({ type: "sms", emailPurpose: "contract_for_signature" })).status, 400);
  });
  test(`${method} persists multi-step classification and rejects unsafe or non-email assignments`, async () => {
    const ok=await fixture(method).request({type:"email",emailFunnelSteps:["cooperating","materials"]});
    assert.equal(ok.status,method==="post"?201:200);
    assert.deepEqual(ok.saved.emailFunnelSteps,["cooperating","materials"]);
    for (const emailFunnelSteps of [["email","email"],["contract_proposal"],"email",[null]]) {
      const bad=await fixture(method).request({type:"email",emailFunnelSteps});
      assert.equal(bad.status,400);assert.equal(bad.saved,undefined);
    }
    assert.equal((await fixture(method).request({type:"sms",emailFunnelSteps:["email"]})).status,400);
  });
}
test("unrelated edits preserve multi-step classification; clearing and changing type are explicit", async () => {
  const existing={id:"template",type:"email",emailPurpose:"reminder",emailFunnelSteps:["agreed","email"]};
  assert.deepEqual((await fixture("patch",existing).request({name:"Renamed"})).result.emailFunnelSteps,["agreed","email"]);
  assert.deepEqual((await fixture("patch",existing).request({emailFunnelSteps:[]})).result.emailFunnelSteps,[]);
  const converted=await fixture("patch",existing).request({type:"sms"});
  assert.equal(converted.result.emailFunnelSteps.length,0);
  assert.equal(converted.result.emailPurpose,"unspecified");
});
test("editing unrelated template fields preserves purpose; conversion to SMS clears it", async () => {
  const rename = await fixture("patch").request({ name: "Renamed" });
  assert.equal(rename.result.emailPurpose, "reminder");
  const converted = await fixture("patch").request({ type: "sms" });
  assert.equal(converted.status, 200);
  assert.equal(converted.result.emailPurpose, "unspecified");
});
