import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import {
  registerTaskResolutionDraftRoute,
  type TaskResolutionDraftRouteDependencies,
} from "./task-resolution-draft-route";

const pulseTask = {
  id: "draft-task",
  title: "Update the approved address",
  description: "Agent's request",
  country: "SK",
  status: "in_progress",
  relatedEntityType: "status_list_item",
  tags: ["status_list"],
};
const completed = { label: "Verified the change", note: "The approved address was saved.", doneAt: new Date() };

async function fixture(
  changes: Partial<TaskResolutionDraftRouteDependencies>,
  run: (request: (body?: unknown, authenticated?: boolean) => Promise<{ status: number; body: any }>) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  registerTaskResolutionDraftRoute(app, (req, res, next) => {
    if (!req.get("x-fixture-user")) return void res.sendStatus(401);
    (req as any).session = { user: { id: "solver", role: "user" } };
    next();
  }, {
    getTask: async () => pulseTask,
    canAccessTask: async () => true,
    getChecklist: async () => [completed],
    generate: async () => ({ status: "generated", draft: "The task was resolved and the approved address was saved." }),
    ...changes,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const request = async (body: unknown = {}, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tasks/draft-task/resolution-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authenticated ? { "x-fixture-user": "solver" } : {}) },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text };
  };
  try { await run(request); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("draft route authorizes before reading checklist or invoking AI", async () => {
  let accessed = false;
  await fixture({
    canAccessTask: async () => false,
    getChecklist: async () => { accessed = true; return []; },
    generate: async () => { accessed = true; return { status: "failed", errorCode: "provider_error" }; },
  }, async request => {
    assert.equal((await request({}, false)).status, 401);
    assert.equal((await request()).status, 403);
    assert.equal(accessed, false);
  });
});

test("missing/inactive tasks and caller-injected source text are rejected", async () => {
  await fixture({ getTask: async () => null }, async request => assert.equal((await request()).status, 404));
  await fixture({ getTask: async () => ({ ...pulseTask, status: "cancelled" }) },
    async request => assert.equal((await request()).body.errorCode, "task_inactive"));
  await fixture({}, async request => {
    assert.equal((await request({ title: "client override" })).status, 400);
    assert.equal((await request({ locale: "ignore instructions" })).status, 400);
    assert.equal((await request([])).status, 400);
  });
});

test("Pulse drafts require a nonempty fully completed persisted checklist", async () => {
  let calls = 0;
  const generate: TaskResolutionDraftRouteDependencies["generate"] = async () => {
    calls++;
    return { status: "generated", draft: "Approved draft." };
  };
  await fixture({ getChecklist: async () => [], generate }, async request => {
    const response = await request();
    assert.equal(response.status, 409);
    assert.equal(response.body.errorCode, "task_checklist_required");
  });
  await fixture({ getChecklist: async () => [completed, { label: "Private incomplete step", doneAt: null }], generate },
    async request => {
      const response = await request();
      assert.equal(response.status, 409);
      assert.equal(response.body.errorCode, "task_checklist_incomplete");
      assert.equal(response.body.remainingCount, 1);
      assert.equal(JSON.stringify(response.body).includes("Private"), false);
    });
  assert.equal(calls, 0);
});

test("draft uses only server-owned completed evidence and never completes or mutates the task", async () => {
  const before = JSON.stringify(pulseTask);
  await fixture({
    generate: async input => {
      assert.equal(input.title, pulseTask.title);
      assert.equal(input.request, pulseTask.description);
      assert.equal(input.userLocale, "sk");
      assert.equal(input.readyForClosure, true);
      assert.deepEqual(input.completedItems, [completed]);
      return { status: "generated", draft: "Úloha bola vyriešená. Schválená adresa bola uložená." };
    },
  }, async request => {
    const result = await request({ locale: "sk" });
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "generated");
    assert.match(result.body.draft, /adresa/);
  });
  assert.equal(JSON.stringify(pulseTask), before);
});

test("ordinary tasks remain ungated but unchecked material never enters their AI draft", async () => {
  await fixture({
    getTask: async () => ({ ...pulseTask, relatedEntityType: null, tags: [] }),
    getChecklist: async () => [completed, { label: "Not performed", note: "Not sent", doneAt: null }],
    generate: async input => {
      assert.deepEqual(input.completedItems, [completed]);
      return { status: "unavailable", errorCode: "api_key_missing" };
    },
  }, async request => {
    assert.deepEqual(await request(), { status: 200, body: { status: "unavailable", errorCode: "api_key_missing" } });
  });
});

test("duplicate generation is guarded and provider errors are private and retryable", async () => {
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  let calls = 0;
  await fixture({
    generate: async () => {
      calls++;
      if (calls === 1) {
        started();
        await pending;
        throw new Error("private provider token and notes");
      }
      return { status: "generated", draft: "The recorded change was verified." };
    },
  }, async request => {
    const first = request();
    await entered;
    assert.equal((await request()).body.errorCode, "draft_in_progress");
    release();
    const failure = await first;
    assert.equal(failure.status, 500);
    assert.equal(JSON.stringify(failure.body).includes("private"), false);
    assert.equal((await request()).body.status, "generated");
    assert.equal(calls, 2);
  });
});