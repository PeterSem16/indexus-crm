import assert from "node:assert/strict";
import { test } from "node:test";
import { createStatusListExecutionClient } from "./status-list-execution-client";
test("lost responses retain the request identity and partial Batch successes are not replayed", async () => {
  const original = globalThis.fetch;
  const commands: any[] = [];
  try {
    let fail = true;
    globalThis.fetch = (async (_url, init) => {
      commands.push(JSON.parse(String(init?.body)));
      if (fail) { fail = false; throw new Error("lost_response"); }
      return new Response(JSON.stringify({ ok: true }));
    }) as typeof fetch;
    const client = createStatusListExecutionClient();
    await assert.rejects(client.send("/step", { confirm: true }, "batch", true));
    assert.equal((await client.send("/step", { confirm: true }, "batch", true)).ok, true);
    assert.equal(commands[0].requestId, commands[1].requestId);
    assert.equal(commands[1].executionMode, "batch");
    assert.equal(commands[1].commit, true);
    await client.send("/step", { confirm: true }, "batch", true);
    assert.equal(commands.length, 2);
    client.clear();
    await client.send("/step", { confirm: true }, "batch", true);
    assert.notEqual(commands[1].requestId, commands[2].requestId);
  } finally { globalThis.fetch = original; }
});
test("explicit failure is not transformed into success or automatically executed again", async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ ok: false, status: "uncertain" }), { status: 409 }); }) as typeof fetch;
    const client = createStatusListExecutionClient();
    assert.equal((await client.send("/action", {}, "immediate")).ok, false);
    assert.equal((await client.send("/action", {}, "immediate")).ok, false);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test("Immediate success does not suppress a later intentional user action", async () => {
  const original = globalThis.fetch; const ids: string[] = [];
  try {
    globalThis.fetch = (async (_url, init) => {
      ids.push(JSON.parse(String(init?.body)).requestId);
      return new Response(JSON.stringify({ ok: true }));
    }) as typeof fetch;
    const client = createStatusListExecutionClient();
    await client.send("/action", {}, "immediate");
    await client.send("/action", {}, "immediate");
    assert.notEqual(ids[0], ids[1]);
  } finally { globalThis.fetch = original; }
});
test("authorization and stale-mode failures remain errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "status_list_mode_changed" }), { status: 409 })) as typeof fetch;
    await assert.rejects(createStatusListExecutionClient().send("/action", {}, "batch"), /mode_changed/);
  } finally { globalThis.fetch = original; }
});
