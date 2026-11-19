"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// Exercise the real handler; mocked inference is not a live language-quality test.
const source = fs.readFileSync(path.join(__dirname, "../../routes.ts"), "utf8");
const marker = 'app.post("/api/users/:userId/ms365-ai-compose",';
const start = source.indexOf(marker);
assert(start >= 0 && source.indexOf(marker, start + marker.length) === -1);
const end = source.indexOf("\n  app.post(", start + marker.length);
assert(end > start);
const endpoint = transformSync(source.slice(start, end), { loader: "ts", format: "cjs" }).code;
function fixture(error) {
  let handler;
  const calls = [];
  vm.runInNewContext(endpoint, {
    app: { post(url, auth, fn) { handler = fn; } }, requireAuth() {}, console: { error() {} },
    aiClient(service) {
      return { chat: { completions: { async create(request) {
        calls.push({ service, request });
        if (error) throw error;
        return { choices: [{ message: { content: "```html\n<p>Synthetic draft.</p>\n```" } }] };
      } } } };
    },
  });
  return { calls, async run(body) {
    const result = { status: 200, body: null };
    const res = { status(code) { result.status = code; return res; },
      json(value) { result.body = value; return res; } };
    await handler({ params: { userId: "synthetic-user" }, body }, res);
    return result;
  } };
}
test("custom compose preserves the exact request and requires explicit delivery of materials", async () => {
  const f = fixture(), customPrompt = "Požiadaj o zaslanie informačných materiálov.";
  const result = await f.run({ templateType: "custom", language: "sk",
    customPrompt, recipientName: "testovacie oddelenie" });
  assert.equal(result.status, 200);
  const { service, request } = f.calls[0];
  assert.equal(service, "email.compose");
  assert.equal(request.messages[1].content, `Adresát: testovacie oddelenie. ${customPrompt}`);
  assert.match(request.messages[0].content, /Presne splňte účel a všetky vecné požiadavky zadania/);
  assert.match(request.messages[0].content, /žiadosť o zaslanie materiálov musí výslovne žiadať ich zaslanie/);
  assert.match(request.messages[0].content, /nestačí všeobecná žiadosť o informácie/);
});
test("compose requires natural professional wording without invented restrictions or completed actions", async () => {
  const f = fixture(); await f.run({ templateType: "custom", customPrompt: "Synthetic request." });
  const system = f.calls[0].request.messages[0].content;
  assert.match(system, /prirodzený, gramaticky správny a zdvorilý profesionálny jazyk/);
  assert.match(system, /Nepridávajte nezadané obmedzenia, úroveň podrobnosti/);
  assert.match(system, /mená, ceny, dátumy, prílohy a okolnosti preberajte iba zo zadania/);
  assert.match(system, /nesmú znieť ako už potvrdená dohoda či vykonaný úkon/);
  assert.match(system, /pri žiadosti možno poďakovať vopred, nie za neuskutočnený výsledok/);
});
test("all seven existing output languages and inference parameters are preserved", async () => {
  for (const [language, name] of Object.entries({
    sk: "slovenčina", cs: "čeština", en: "English", hu: "magyar",
    ro: "română", it: "italiano", de: "Deutsch",
  })) {
    const f = fixture(); await f.run({ templateType: "thank_you", language });
    const request = f.calls[0].request;
    assert(request.messages[0].content.includes(`v jazyku ${name}.`));
    assert.equal(request.model, "gpt-4o"); // Router still controls the configured provider and alias.
    assert.equal(request.temperature, 0.7); assert.equal(request.max_tokens, 1000);
  }
});
test("existing templates and recipient handling are unchanged", async () => {
  const f = fixture(); await f.run({ templateType: "info_request", language: "en",
    recipientName: "Synthetic recipient", customPrompt: "MUST_NOT_OVERRIDE_TEMPLATE" });
  const user = f.calls[0].request.messages[1].content;
  assert.match(user, /^Adresát: Synthetic recipient\. Napíšte žiadosť o informácie/);
  assert.doesNotMatch(user, /MUST_NOT_OVERRIDE_TEMPLATE/);
});
test("HTML paragraphs, greeting, no signature and code-fence cleanup remain unchanged", async () => {
  const f = fixture(), result = await f.run({ templateType: "custom" });
  const system = f.calls[0].request.messages[0].content;
  assert.match(system, /Nepoužívajte podpis/); assert.match(system, /Začnite pozdravom/);
  assert.match(system, /HTML.*<p>/); assert.match(system, /3-5 odstavcov/);
  assert.equal(result.body.draft, "<p>Synthetic draft.</p>");
  assert.equal(f.calls.length, 1);
});
test("missing template is rejected without inference", async () => {
  const f = fixture(), result = await f.run({});
  assert.equal(result.status, 400); assert.equal(f.calls.length, 0);
});
test("provider failure is explicit, with no automatic retry or fallback", async () => {
  const f = fixture(Error("synthetic failure")), result = await f.run({ templateType: "custom" });
  assert.equal(result.status, 500); assert.equal(result.body.error, "Failed to generate AI draft");
  assert.equal(f.calls.length, 1);
});
