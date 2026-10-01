import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import {
  resolveTaskSourceEntity,
  type LegacyTaskSourceConfirmation,
  type TaskSourceTask,
} from "./task-source-entity";
import { registerTaskSourceEntityRoute } from "./task-source-entity";

const task: TaskSourceTask = {
  id: "task-1",
  relatedEntityType: "status_list_item",
  relatedEntityId: "step-1",
  createdByUserId: "user-1",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

function confirmation(
  overrides: Partial<LegacyTaskSourceConfirmation> = {},
): LegacyTaskSourceConfirmation {
  return {
    statusListItemId: "step-1",
    confirmedByUserId: "user-1",
    confirmedAt: new Date("2025-01-01T00:00:00.000Z"),
    contactType: "customer",
    customerId: "customer-1",
    ...overrides,
  };
}

async function resolve(
  candidateTask: TaskSourceTask,
  confirmations: LegacyTaskSourceConfirmation[] = [],
  existing: (type: string, id: string) => boolean = () => true,
) {
  return resolveTaskSourceEntity(candidateTask, {
    findLegacyConfirmations: async () => confirmations,
    entityExists: async (type, id) => existing(type, id),
  });
}

assert.deepEqual(
  await resolve(task, [
    confirmation(),
    confirmation({ contactType: "clinic", clinicId: "clinic-1" }),
  ]),
  null,
  "distinct nearby legacy confirmation contacts fail closed",
);

assert.deepEqual(
  await resolve({ ...task, tags: ["source_entity:hospital:hospital-1"] }, [
    confirmation({ contactType: "clinic", clinicId: "clinic-1" }),
  ]),
  { type: "hospital", id: "hospital-1" },
  "explicit source tags take precedence over legacy confirmation matching",
);
assert.deepEqual(
  await resolve({ ...task, relatedEntityType: "collaborator", relatedEntityId: "collaborator-1" }),
  { type: "collaborator", id: "collaborator-1" },
  "supported direct related-entity links resolve",
);
assert.deepEqual(
  await resolve({ ...task, relatedEntityType: null, relatedEntityId: null, customerId: "customer-2" }),
  { type: "customer", id: "customer-2" },
  "customerId remains a validated fallback source",
);

assert.equal(
  await resolve({ ...task, tags: ["source_entity:customer:deleted-customer"] }, [], (_type, id) => id !== "deleted-customer"),
  null,
  "a deleted explicit source is never returned",
);
assert.equal(
  await resolve({ ...task, relatedEntityType: "clinic", relatedEntityId: "deleted-clinic" }, [], (_type, id) => id !== "deleted-clinic"),
  null,
  "a deleted direct related entity is never returned",
);

assert.deepEqual(
  await resolve(task, [
    confirmation({ confirmedAt: new Date("2024-12-31T23:55:00.000Z") }),
    confirmation({ confirmedByUserId: "another-user", contactType: "clinic", clinicId: "clinic-wrong-user" }),
    confirmation({ confirmedAt: new Date("2025-01-01T00:05:00.001Z"), contactType: "hospital", hospitalId: "hospital-too-late" }),
  ]),
  { type: "customer", id: "customer-1" },
  "same-creator confirmation at the inclusive 300-second boundary is accepted; other creators and later rows are ignored",
);

assert.equal(
  await resolve(task, [
    confirmation({ confirmedAt: new Date("2025-01-01T00:05:00.001Z") }),
  ]),
  null,
  "a confirmation just outside the five-minute window is not a source",
);

let queriedWithInvalidTaskDate = false;
assert.equal(
  await resolveTaskSourceEntity({ ...task, createdAt: "invalid-date" }, {
    findLegacyConfirmations: async () => {
      queriedWithInvalidTaskDate = true;
      return [confirmation()];
    },
    entityExists: async () => true,
  }),
  null,
  "an invalid task creation date cannot anchor a legacy source",
);
assert.equal(queriedWithInvalidTaskDate, false, "invalid task dates do not trigger a legacy-history query");

console.log("Task source entity resolution checks passed (10 assertions)");

async function verifyHttpRoute() {
  const app = express();
  const tasks = new Map<string, TaskSourceTask>([
    ["supported", {
      id: "supported",
      tags: ["source_entity:clinic:clinic-1"],
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    }],
    ["deleted-with-fallback", {
      id: "deleted-with-fallback",
      tags: ["source_entity:clinic:deleted-clinic"],
      customerId: "customer-1",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    }],
    ["conflicting-with-fallback", {
      id: "conflicting-with-fallback",
      tags: [
        "source_entity:clinic:clinic-1",
        "source_entity:hospital:hospital-1",
      ],
      customerId: "customer-1",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    }],
    ["database-failure", {
      id: "database-failure",
      tags: ["source_entity:customer:database-failure"],
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    }],
  ]);
  const requireAuth: RequestHandler = (req, res, next) => {
    if (req.header("authorization") !== "Bearer test-token") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  };

  let taskReads = 0;
  registerTaskSourceEntityRoute(app, requireAuth, {
    getTask: async (id) => {
      taskReads++;
      return tasks.get(id) ?? null;
    },
    findLegacyConfirmations: async () => [],
    entityExists: async (type, id) => {
      if (id === "database-failure") throw new Error("private database detail");
      return id !== "deleted-clinic"
        && ["clinic-1", "hospital-1", "customer-1"].includes(id)
        && ["customer", "clinic", "hospital", "collaborator"].includes(type);
    },
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string", "ephemeral HTTP server has a TCP address");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = (id: string, authenticated = true) => fetch(`${baseUrl}/api/tasks/${id}/source-entity`, {
      headers: authenticated ? { authorization: "Bearer test-token" } : {},
    });

    const unauthenticated = await request("supported", false);
    assert.equal(unauthenticated.status, 401, "the mounted source route rejects unauthenticated requests");
    assert.equal(taskReads, 0, "unauthenticated requests never reach task/source resolution");

    const missing = await request("missing");
    assert.equal(missing.status, 404, "the mounted source route preserves missing-task behavior");

    const supported = await request("supported");
    assert.equal(supported.status, 200, "the mounted source route returns a supported card");
    assert.deepEqual(await supported.json(), { type: "clinic", id: "clinic-1" });

    const deleted = await request("deleted-with-fallback");
    assert.equal(deleted.status, 200);
    assert.equal(await deleted.json(), null, "a deleted explicit source does not fall through to customerId");

    const conflicting = await request("conflicting-with-fallback");
    assert.equal(conflicting.status, 200);
    assert.equal(await conflicting.json(), null, "conflicting source tags do not fall through to customerId");

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const failure = await request("database-failure");
      assert.equal(failure.status, 500, "database errors become a generic server error");
      assert.deepEqual(await failure.json(), { error: "Failed to resolve task source card" });
    } finally {
      console.error = originalConsoleError;
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

await verifyHttpRoute();
console.log("Task source entity HTTP route checks passed (12 assertions)");