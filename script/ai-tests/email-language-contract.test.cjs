"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { transformSync } = require("esbuild");
const { LANGUAGES, SERVICES, casesFor, browserScript } = require("./email-language-matrix.cjs");
// Optional source argument lets the same checks exercise exact release bytes.
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, "../../server/routes.ts"), "utf8");
const endpoints = new Map();
for (const item of casesFor()) {
  if (endpoints.has(item.endpoint)) continue;
  const marker = `app.post("/api/users/:userId/${item.endpoint}",`, start = source.indexOf(marker);
  assert(start >= 0 && source.indexOf(marker, start + marker.length) < 0);
  const end = source.indexOf("\n  app.post(", start + marker.length);
  assert(end > start);
  endpoints.set(item.endpoint, transformSync(source.slice(start, end), { loader: "ts", format: "cjs" }).code);
}
assert.deepEqual(LANGUAGES.map(x => x.code).sort(), ["cs", "de", "en", "hu", "it", "ro", "sk"]);
for (const item of casesFor()) {
  test(`${item.service} requests ${item.language} through the actual endpoint without sending email`, async () => {
    const calls = []; let handler;
    vm.runInNewContext(endpoints.get(item.endpoint), {
      app: { post(url, auth, fn) { handler = fn; } }, requireAuth() {}, console: { error() {} },
      aiClient(service) { return { chat: { completions: { async create(request) {
        calls.push({ service, request }); return { choices: [{ message: { content: "<p>Synthetic output.</p>" } }] };
      } } } }; },
    });
    const result = { status: 200 }, res = {
      status(code) { result.status = code; return res; }, json(value) { result.body = value; return res; },
    };
    await handler({ params: { userId: "synthetic-user" }, body: item.body }, res);
    assert.equal(result.status, 200); assert.equal(calls.length, 1);
    assert.equal(calls[0].service, item.service);
    const request = calls[0].request;
    assert(request.messages[0].content.includes(item.languageName));
    assert.match(request.messages[0].content, /HTML/);
    assert.equal(request.model, "gpt-4o");
    assert.equal(request.temperature, item.service === "email.translation" ? 0.3 : 0.7);
    assert.equal(request.max_tokens, item.service === "email.translation" ? 2000 : 1000);
    if (item.service === "email.translation") assert.equal(request.messages[1].content, item.body.content);
    if (item.service === "email.reply")
      assert(request.messages[1].content.includes(LANGUAGES.find(x => x.code === item.language).receipt));
    if (item.service === "email.compose") assert.equal(request.messages[1].content, item.body.customPrompt);
    assert.equal(result.body[item.responseField], "<p>Synthetic output.</p>");
  });
}
test("every selected service has all seven languages and unsupported selections fail closed", () => {
  assert.equal(casesFor().length, 21);
  for (const service of SERVICES) assert.equal(casesFor([service]).length, 7);
  assert.throws(() => casesFor(["unknown"])); assert.throws(() => casesFor([]));
  assert.throws(() => casesFor(["email.reply", "email.reply"]));
  assert.doesNotThrow(() => new vm.Script(browserScript()));
});
