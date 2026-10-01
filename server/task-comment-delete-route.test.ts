import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(process.env.TASK_COMMENT_DELETE_ROUTES_SOURCE || "server/routes.ts", "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let handlerSource = "";

function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === "delete"
    && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])
    && node.arguments[0].text === "/api/tasks/:taskId/comments/:commentId") {
    handlerSource = node.arguments[node.arguments.length - 1].getText(ast);
  }
  ts.forEachChild(node, visit);
}

visit(ast);
assert.ok(handlerSource, "could not extract the task comment DELETE route handler");

const compiledHandler = ts.transpileModule(`globalThis.handler = ${handlerSource}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

async function invokeHandler(options: {
  task: { id: string; country: string } | null;
  user: { id: string; role: string; countries: string[] };
  comments: Array<{ id: string; userId: string }>;
}) {
  const calls = {
    getTask: [] as string[],
    getTaskComments: [] as string[],
    deleteTaskComment: [] as string[],
    accessChecks: [] as Array<{ user: unknown; task: unknown }>,
  };
  const errors: unknown[] = [];
  const context = {
    console: { error: (...args: unknown[]) => errors.push(args) },
    storage: {
      getTask: async (taskId: string) => {
        calls.getTask.push(taskId);
        return options.task;
      },
      getTaskComments: async (taskId: string) => {
        calls.getTaskComments.push(taskId);
        return options.comments;
      },
      deleteTaskComment: async (commentId: string) => {
        calls.deleteTaskComment.push(commentId);
        return true;
      },
    },
    canAccessTaskForMutation: async (user: typeof options.user, task: typeof options.task) => {
      calls.accessChecks.push({ user, task });
      return !!task && (user.role === "admin" || user.countries.includes(task.country));
    },
  };
  vm.runInNewContext(compiledHandler, context);

  let status = 200;
  let body: unknown;
  const res = {
    status(value: number) { status = value; return res; },
    json(value: unknown) { body = value; return res; },
  };
  await (context as any).handler({
    params: { taskId: "task-1", commentId: "comment-1" },
    session: { user: options.user },
  }, res);
  return { status, body, calls, errors };
}

const parentTask = { id: "task-1", country: "SK" };
const comment = { id: "comment-1", userId: "owner" };

test("comment DELETE denies revoked country access before reading or deleting comments", async () => {
  const result = await invokeHandler({
    task: parentTask,
    user: { id: "owner", role: "user", countries: ["CZ"] },
    comments: [comment],
  });

  assert.equal(result.status, 403);
  assert.deepEqual(result.calls.getTask, ["task-1"]);
  assert.equal(result.calls.accessChecks.length, 1);
  assert.deepEqual(result.calls.getTaskComments, []);
  assert.deepEqual(result.calls.deleteTaskComment, []);
  assert.deepEqual(result.errors, []);
});

test("comment owner can delete a comment belonging to the authorized parent task", async () => {
  const result = await invokeHandler({
    task: parentTask,
    user: { id: "owner", role: "user", countries: ["SK"] },
    comments: [comment],
  });

  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(result.body), '{"success":true}');
  assert.deepEqual(result.calls.getTaskComments, ["task-1"]);
  assert.deepEqual(result.calls.deleteTaskComment, ["comment-1"]);
});

test("non-owner remains forbidden from deleting another user's comment", async () => {
  const result = await invokeHandler({
    task: parentTask,
    user: { id: "other", role: "user", countries: ["SK"] },
    comments: [comment],
  });

  assert.equal(result.status, 403);
  assert.deepEqual(result.calls.getTaskComments, ["task-1"]);
  assert.deepEqual(result.calls.deleteTaskComment, []);
});

test("admin can delete another user's comment on an existing parent task", async () => {
  const result = await invokeHandler({
    task: parentTask,
    user: { id: "admin", role: "admin", countries: [] },
    comments: [comment],
  });

  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(result.body), '{"success":true}');
  assert.deepEqual(result.calls.getTaskComments, ["task-1"]);
  assert.deepEqual(result.calls.deleteTaskComment, ["comment-1"]);
});

test("comment DELETE returns 404 for a missing parent without reading comments", async () => {
  const result = await invokeHandler({
    task: null,
    user: { id: "owner", role: "user", countries: ["SK"] },
    comments: [comment],
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.calls.getTask, ["task-1"]);
  assert.deepEqual(result.calls.accessChecks, []);
  assert.deepEqual(result.calls.getTaskComments, []);
  assert.deepEqual(result.calls.deleteTaskComment, []);
});
