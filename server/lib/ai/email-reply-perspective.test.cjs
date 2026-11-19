"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// Run the actual endpoint, not a reimplementation or a claimed live model test.
const source = fs.readFileSync(path.join(__dirname, "../../routes.ts"), "utf8");
const marker = 'app.post("/api/users/:userId/ms365-ai-suggest-reply",';
const start = source.indexOf(marker);
assert(start >= 0 && source.indexOf(marker, start + 1) === -1);
const endpoint = transformSync(source.slice(start,
  source.indexOf('\n  app.post(', start + marker.length)), { loader: "ts", format: "cjs" }).code;

function fixture() {
  let handler;
  const calls = [];
  const app = { post(url, auth, fn) { handler = fn; } };
  vm.runInNewContext(endpoint, {
    app, requireAuth: () => {}, console: { error() {} },
    aiClient(service) {
      return { chat: { completions: { async create(request) {
        calls.push({ service, request });
        return { choices: [{ message: { content: "```html\n<p>Synthetic fixture response.</p>\n```" } }] };
      } } } };
    },
  });
  return {
    calls,
    async run(body) {
      const result = { status: 200, body: null };
      const response = { status(code) { result.status = code; return response; },
        json(value) { result.body = value; return response; } };
      await handler({ params: { userId: "synthetic-user" }, body }, response);
      return result;
    },
  };
}

test("receipt request includes the recipient perspective and does not confuse a request with a confirmation", async () => {
  const f = fixture();
  const result = await f.run({ emailSubject: "Test", emailFrom: "Synthetic sender",
    emailBody: "<p>Prosím, potvrďte prijatie tejto testovacej správy.</p>", language: "sk" });
  assert.equal(result.status, 200);
  const { service, request } = f.calls[0];
  assert.equal(service, "email.reply");
  const system = request.messages[0].content;
  assert.match(system, /z pohľadu príjemcu.*nie v mene odosielateľa/);
  assert.match(system, /priamo potvrďte prijatie jeho správy/);
  assert.match(system, /neďakujte mu za potvrdenie, ktoré neposlal/);
  assert.equal(request.messages[1].role, "user");
  assert.match(request.messages[1].content, /Prosím, potvrďte prijatie/);
});
test("reply instructions prohibit invented completed actions, prices and dates while preserving existing output rules", async () => {
  const f = fixture();
  await f.run({ emailBody: "Please explain the next steps.", language: "en" });
  const request = f.calls[0].request, system = request.messages[0].content;
  assert.match(system, /Nevymýšľajte vykonané rezervácie, odoslané dokumenty, zmeny údajov, ceny ani termíny/);
  assert.match(system, /neprezentujte neoverenú činnosť ako dokončenú/);
  assert.match(system, /v jazyku English/);
  assert.match(system, /Nepoužívajte pozdrav ani podpis/);
  assert.match(system, /HTML.*<p>/);
  assert.match(system, /komerčný\/spam email/);
  assert.equal(request.model, "gpt-4o"); // Existing router still selects the configured provider/model.
  assert.equal(request.temperature, 0.7);
  assert.equal(request.max_tokens, 1000);
});
test("automatic reply language and HTML cleanup remain unchanged without sending email", async () => {
  const f = fixture();
  const result = await f.run({ emailBody: "<p>Synthetic body</p>", language: "auto" });
  assert.match(f.calls[0].request.messages[0].content, /v rovnakom jazyku/);
  assert.equal(result.body.suggestion, "<p>Synthetic fixture response.</p>");
  assert.equal(f.calls.length, 1);
});
test("empty input is rejected without invoking any AI provider", async () => {
  const f = fixture();
  const result = await f.run({});
  assert.equal(result.status, 400);
  assert.equal(f.calls.length, 0);
});
