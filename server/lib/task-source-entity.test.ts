import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import {
  resolveAccessibleTaskSourceEntityDisplayName,
  getTaskCompletionNoticeSourceLookupId,
  resolveTaskSourceEntity,
  resolveTaskSourceEntityDisplayName,
  type LegacyTaskSourceConfirmation,
  type TaskSourceTask,
} from "./task-source-entity";
import { registerTaskSourceEntityRoute } from "./task-source-entity";
import { buildPulseCompletionNotification, userMayAccessTaskCountry } from "./task-contract";

const task: TaskSourceTask = {
  id: "task-1",
  country: "SK",
  tags: ["status_list"],
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

const displayNames: Record<string, string> = {
  "customer:customer-1": "Client Display",
  "clinic:clinic-1": "Clinic Display",
  "hospital:hospital-1": "Hospital Display",
  "collaborator:collaborator-1": "Collaborator Display",
};
for (const [type, id] of [
  ["customer", "customer-1"],
  ["clinic", "clinic-1"],
  ["hospital", "hospital-1"],
  ["collaborator", "collaborator-1"],
] as const) {
  assert.equal(
    await resolveTaskSourceEntityDisplayName({ ...task, tags: [`source_entity:${type}:${id}`] }, {
      findLegacyConfirmations: async () => [],
      entityExists: async (entityType, entityId) => `${entityType}:${entityId}` in displayNames,
      getEntityCountry: async () => "SK",
      getEntityDisplayName: async (entityType, entityId) => displayNames[`${entityType}:${entityId}`] ?? null,
    }),
    displayNames[`${type}:${id}`],
    `verified ${type} source resolves to its display name`,
  );
}

let accessibleDisplayNameReads = 0;
const accessibleTaskDependencies = {
  getTask: async (id: string) => id === task.id ? { ...task, tags: ["source_entity:clinic:clinic-1"] } : null,
  canAccessTask: async (user: any, id: string) => user?.id === "creator" && id === task.id,
  findLegacyConfirmations: async () => [],
  entityExists: async (_type: string, _id: string) => true,
  getEntityCountry: async () => "SK",
  getEntityDisplayName: async () => {
    accessibleDisplayNameReads++;
    return "Verified clinic";
  },
};
assert.equal(
  await resolveAccessibleTaskSourceEntityDisplayName({ id: "creator" }, task.id, accessibleTaskDependencies),
  "Verified clinic",
  "an authorized notice recipient may see a still-valid task source name",
);
assert.equal(
  await resolveAccessibleTaskSourceEntityDisplayName({ id: "other-user" }, task.id, accessibleTaskDependencies),
  null,
  "a notice recipient without current task access cannot resolve its client name",
);
assert.equal(
  await resolveAccessibleTaskSourceEntityDisplayName({ id: "creator" }, "missing-task", accessibleTaskDependencies),
  null,
  "a deleted task cannot resolve a source name",
);
assert.equal(accessibleDisplayNameReads, 1, "unauthorized and missing tasks never read a client display name");

for (const source of ["nexus_pulse", "back_office", undefined]) {
  assert.equal(
    getTaskCompletionNoticeSourceLookupId({
      type: "back_office_resolved",
      entityType: "task",
      entityId: "task-ordinary",
      title: "SL: Healthcare Provider",
      metadata: { taskId: "task-ordinary", taskTitle: "SL: Healthcare Provider", source },
    }),
    "task-ordinary",
    `a completion notice with ${String(source)} source metadata can resolve its verified task source`,
  );
}
assert.equal(
  getTaskCompletionNoticeSourceLookupId({
    type: "back_office_resolved",
    entityType: "task",
    entityId: "task-ordinary",
    title: "CARE Clinic",
    metadata: { taskId: "task-ordinary", taskTitle: "SL: Healthcare Provider", source: "back_office" },
  }),
  null,
  "an already resolved client heading is never replaced by a subsequent lookup",
);
assert.equal(
  getTaskCompletionNoticeSourceLookupId({
    type: "back_office_resolved",
    entityType: "email",
    entityId: "task-ordinary",
    title: "SL: Healthcare Provider",
    metadata: { taskId: "task-ordinary", taskTitle: "SL: Healthcare Provider", source: "back_office" },
  }),
  null,
  "non-task notifications never trigger source lookups",
);

let crossCountryDisplayNameReads = 0;
for (const [type, id] of [
  ["customer", "foreign-customer"],
  ["clinic", "foreign-clinic"],
] as const) {
  const foreignDisplayName = await resolveTaskSourceEntityDisplayName({
    ...task,
    tags: ["status_list", `source_entity:${type}:${id}`],
  }, {
    findLegacyConfirmations: async () => [],
    entityExists: async (entityType, entityId) => entityType === type && entityId === id,
    getEntityCountry: async () => "CZ",
    getEntityDisplayName: async () => {
      crossCountryDisplayNameReads++;
      return "Foreign existing entity";
    },
  });
  assert.equal(foreignDisplayName, null, `an existing foreign-country ${type} cannot supply a notification title`);
  assert.equal(
    buildPulseCompletionNotification({
      id: "task-1",
      title: "Task title",
      tags: ["status_list"],
      relatedEntityType: "status_list_item",
    }, undefined, foreignDisplayName ?? undefined).title,
    "Task title",
    `a foreign ${type} name falls back to the task title`,
  );
}
assert.equal(crossCountryDisplayNameReads, 0, "foreign entity names are never fetched for notification titles");

let displayNameReads = 0;
assert.equal(
  await resolveTaskSourceEntityDisplayName({
    ...task,
    tags: ["source_entity:clinic:forged-clinic"],
    customerId: "customer-1",
  }, {
    findLegacyConfirmations: async () => [],
    entityExists: async () => false,
    getEntityCountry: async () => "SK",
    getEntityDisplayName: async () => {
      displayNameReads++;
      return "Must not be used";
    },
  }),
  null,
  "a forged tag pointing at a nonexistent entity falls back to the task title",
);
assert.equal(displayNameReads, 0, "invalid source links are never used to fetch a display name");
const ambiguousTagDisplayName = await resolveTaskSourceEntityDisplayName({
  ...task,
  tags: ["source_entity:clinic:clinic-1", "source_entity:hospital:hospital-1"],
}, {
  findLegacyConfirmations: async () => [],
  entityExists: async () => true,
  getEntityCountry: async () => "SK",
  getEntityDisplayName: async () => "Ambiguous source",
});
assert.equal(ambiguousTagDisplayName, null, "ambiguous source tags do not resolve a display name");
assert.equal(
  buildPulseCompletionNotification({
    id: "task-fallback",
    title: "Task fallback title",
  }, undefined, ambiguousTagDisplayName ?? undefined).title,
  "Task fallback title",
  "ambiguous source tags fall back to the task title",
);
assert.equal(
  await resolveTaskSourceEntityDisplayName({
    ...task,
    relatedEntityType: null,
    relatedEntityId: null,
    customerId: null,
    tags: [],
  }, {
    findLegacyConfirmations: async () => [],
    entityExists: async () => true,
    getEntityCountry: async () => "SK",
    getEntityDisplayName: async () => "Unrelated entity",
  }),
  null,
  "a task with no verified source uses its own title",
);
assert.equal(
  await resolveTaskSourceEntityDisplayName(task, {
    findLegacyConfirmations: async () => [
      confirmation(),
      confirmation({ contactType: "clinic", clinicId: "clinic-1" }),
    ],
    entityExists: async () => true,
    getEntityCountry: async () => "SK",
    getEntityDisplayName: async () => "Ambiguous legacy source",
  }),
  null,
  "ambiguous legacy confirmation fallback does not select a display name",
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
    ["foreign-country", {
      id: "foreign-country",
      country: "SK",
      tags: ["source_entity:customer:customer-1"],
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    }],
  ]);
  const requireAuth: RequestHandler = (req, res, next) => {
    if (req.header("authorization") !== "Bearer test-token") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as any).session = {
      user: { id: "viewer", role: "user", assignedCountries: ["CZ"] },
    };
    return next();
  };

  let taskReads = 0;
  registerTaskSourceEntityRoute(app, requireAuth, {
    getTask: async (id) => {
      taskReads++;
      return tasks.get(id) ?? null;
    },
    canAccessTask: async (user, taskId) => {
      const task = tasks.get(taskId);
      return !!task && userMayAccessTaskCountry(user?.role, user?.assignedCountries, task.country);
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

    const foreignCountry = await request("foreign-country");
    assert.equal(foreignCountry.status, 404, "the mounted source route hides tasks outside the session country scope");

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
console.log("Task source entity HTTP route checks passed (13 assertions)");