import assert from "node:assert/strict";
import { test } from "node:test";
import { createStatusListLabelTranslationHandler } from "./status-list-label-translation";

const names = { en: "Reschedule call", sk: "Preplánovať hovor", cs: "Přeplánovat hovor", hu: "Hívás átütemezése", ro: "Reprogramează apelul", it: "Riprogramma chiamata", de: "Anruf verschieben" };
async function run(body: unknown, overrides: Record<string, unknown> = {}) {
  let calls = 0, text = "", status = 200, result: any;
  const handler = createStatusListLabelTranslationHandler({
    authorize: async () => {}, configured: () => true,
    translate: async value => { calls++; text = value; return names; }, ...overrides,
  });
  const response = { status: (value: number) => { status = value; return response; }, json: (value: unknown) => { result = value; return response; } };
  await handler({ body, params: { campaignId: "mission" } }, response);
  return { calls, text, status, result };
}
test("AI name translation returns seven editable names and trims the input", async () => {
  const result = await run({ text: "  preplánovať hovor  " });
  assert.equal(result.status, 200);
  assert.equal(result.text, "preplánovať hovor");
  assert.deepEqual(result.result, { translations: names });
});
test("permission and Mission failures never call the model", async () => {
  for (const status of [401, 403, 404]) {
    const result = await run({ text: "Call back" }, { authorize: async () => { throw { status }; } });
    assert.equal(result.status, status); assert.equal(result.calls, 0);
  }
});
test("empty, oversized and unexpected input is rejected before translation", async () => {
  for (const body of [{}, { text: "" }, { text: "a".repeat(241) }, { text: "Name", campaignId: "other" }]) {
    const result = await run(body);
    assert.equal(result.status, 400); assert.equal(result.calls, 0);
  }
});
test("unavailable AI is explicit and incomplete or nonstring translations cannot be saved", async () => {
  assert.equal((await run({ text: "Call back" }, { configured: () => false })).status, 503);
  for (const value of [{ en: "Call back" }, { ...names, de: "" }, { ...names, it: {} }, { ...names, fr: "Rappel" }]) {
    assert.equal((await run({ text: "Call back" }, { translate: async () => value })).status, 502);
  }
});
test("provider failure does not expose provider details or replace saved names", async () => {
  const result = await run({ text: "Call back" }, { translate: async () => { throw new Error("private provider details"); } });
  assert.equal(result.status, 502);
  assert.deepEqual(result.result, { error: "translation_failed" });
});
