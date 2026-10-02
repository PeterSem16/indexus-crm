import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildValidatedTaskPatch, canAccessTaskByPolicy } from "./task-contract";
import {
  assertTaskAttachmentSize,
  resolveTaskAttachmentMetadata,
  liveTaskAttachmentSources,
  taskAttachmentReadAllowed,
  taskAttachmentPreviewAllowed,
  taskCommentHasContentOrAttachments,
  TASK_ATTACHMENT_MAX_BYTES,
  TASK_ATTACHMENT_MAX_FILES,
  TaskAttachmentInputError,
} from "./task-attachment-contract";

describe("task attachment contract", () => {
  it("never restores the original assignee policy after reassignment and task deletion", () => {
    const user = { id: "former-assignee", role: "user", assignedCountries: ["SK"] };
    const original = { id: "task-source", country: "SK", assignedUserId: user.id, createdByUserId: "someone-else", tags: [] };
    const history = [{ taskId: original.id, ...original }];
    const canRead = (rows: typeof original[]) => taskAttachmentReadAllowed(
      user, user.id, liveTaskAttachmentSources(history, rows), new Set(), true,
    );
    assert.equal(canRead([original]), true);
    assert.equal(canRead([{ ...original, assignedUserId: "new-assignee" }]), false);
    assert.equal(canRead([]), false);
    const removedUpload = {
      id: "removed-upload", uploaderUserId: user.id, name: "private.pdf",
      type: "application/pdf", size: 24, everAssociated: true, associationHistory: history,
    };
    assert.throws(() => resolveTaskAttachmentMetadata(
      [{ id: removedUpload.id }], user.id, new Set(), [removedUpload],
      () => canRead([]),
    ), TaskAttachmentInputError);
  });
  const upload = {
    id: "upload-1",
    uploaderUserId: "creator",
    name: "server-name.pdf",
    type: "application/pdf",
    size: 42,
    everAssociated: false,
    associationHistory: [],
  };

  it("uses registry metadata rather than accepting client metadata or URLs", () => {
    const [canonical] = resolveTaskAttachmentMetadata([{
      id: upload.id,
      name: "spoofed.html",
      url: "https://attacker.example/file",
      type: "text/html",
      size: 999_999,
    }], "creator", new Set(), [upload]);

    assert.deepEqual(canonical, {
      id: upload.id,
      name: upload.name,
      url: "/api/tasks/attachments/upload-1",
      type: upload.type,
      size: upload.size,
    });
    assert.throws(
      () => resolveTaskAttachmentMetadata([{ id: upload.id }], "another-user", new Set(), [upload]),
      TaskAttachmentInputError,
    );
    assert.deepEqual(
      resolveTaskAttachmentMetadata([{ id: upload.id }], "another-user", new Set([upload.id]), [upload]),
      [canonical],
      "a previously associated target-task attachment remains reusable",
    );
  });

  it("restricts staged downloads to their uploader, then switches to task access policy", () => {
    const stagedUser = { id: "creator", role: "user", assignedCountries: ["SK"] };
    const task = {
      country: "SK",
      createdByUserId: "task-creator",
      assignedUserId: "assignee",
      tags: [],
    };

    assert.equal(taskAttachmentReadAllowed(stagedUser, "creator", []), true);
    assert.equal(taskAttachmentReadAllowed({ ...stagedUser, id: "stranger" }, "creator", []), false);
    assert.equal(taskAttachmentReadAllowed(stagedUser, "creator", [], new Set(), true), false,
      "an upload that has ever been associated cannot fall back to staged-uploader access");
    assert.equal(taskAttachmentReadAllowed(stagedUser, "creator", [task]), false);
    assert.equal(taskAttachmentReadAllowed({ ...stagedUser, id: "assignee" }, "creator", [task]), true);
    assert.equal(taskAttachmentReadAllowed(
      { ...stagedUser, id: "assignee", assignedCountries: ["CZ"] },
      "creator",
      [task],
    ), false);
  });

  it("requires current source-task authority before an owner can reuse an associated upload", () => {
    const source = {
      taskId: "source-task",
      country: "SK",
      createdByUserId: "creator",
      assignedUserId: "assignee",
      tags: [],
    };
    const associatedUpload = {
      ...upload,
      everAssociated: true,
      associationHistory: [source],
    };
    const creatorStillAuthorized = { id: "creator", role: "user", assignedCountries: ["SK"] };
    const creatorCountryRevoked = { ...creatorStillAuthorized, assignedCountries: ["CZ"] };
    const mayReadSource = (user: typeof creatorStillAuthorized) =>
      associatedUpload.associationHistory.some(policy => canAccessTaskByPolicy(user, policy));

    assert.doesNotThrow(() => resolveTaskAttachmentMetadata(
      [{ id: upload.id }],
      creatorStillAuthorized.id,
      new Set(),
      [associatedUpload],
      () => mayReadSource(creatorStillAuthorized),
    ), "a Pulse creator may reuse the upload while still authorized for its source task");
    assert.throws(() => resolveTaskAttachmentMetadata(
      [{ id: upload.id }],
      creatorCountryRevoked.id,
      new Set(),
      [associatedUpload],
      () => mayReadSource(creatorCountryRevoked),
    ), /no longer authorized/);
    assert.deepEqual(resolveTaskAttachmentMetadata(
      [{ id: upload.id }],
      creatorCountryRevoked.id,
      new Set([upload.id]),
      [associatedUpload],
    ).map(attachment => attachment.id), [upload.id],
    "an already-referenced upload can remain on a target task the user may edit");
  });

  it("allows country-authorized Back Office thread readers and denies detached uploads", () => {
    const boTask = {
      country: "SK",
      createdByUserId: "agent",
      assignedUserId: "nominal-assignee",
      tags: ["back_office"],
    };
    const backOfficeReader = { id: "bo-staff", role: "user", assignedCountries: ["SK"] };
    const canReadBoThread = (candidate: typeof boTask) =>
      candidate.tags.includes("back_office")
      && (!candidate.country || backOfficeReader.assignedCountries?.includes(candidate.country));

    assert.equal(taskAttachmentReadAllowed(backOfficeReader, "uploader", [boTask]), false,
      "a non-assignee is not visible through the generic participant policy alone");
    assert.equal(taskAttachmentReadAllowed(
      backOfficeReader,
      "uploader",
      [boTask],
      new Set(),
      true,
      canReadBoThread,
    ), true);
    assert.equal(taskAttachmentReadAllowed(
      { ...backOfficeReader, assignedCountries: ["CZ"] },
      "uploader",
      [boTask],
      new Set(),
      true,
      candidate => candidate.tags.includes("back_office")
        && (!candidate.country || ["CZ"].includes(candidate.country)),
    ), false);
    assert.equal(taskAttachmentReadAllowed(backOfficeReader, "uploader", [], new Set(), true), false,
      "deleting the task or removing every reference does not make the upload staged again");
  });

  it("enforces the 15 MB upload ceiling and ten-attachment task cap", () => {
    assert.doesNotThrow(() => assertTaskAttachmentSize(TASK_ATTACHMENT_MAX_BYTES));
    assert.throws(() => assertTaskAttachmentSize(TASK_ATTACHMENT_MAX_BYTES + 1), /15 MB/);
    assert.equal(TASK_ATTACHMENT_MAX_FILES, 10);
    const ten = Array.from({ length: TASK_ATTACHMENT_MAX_FILES }, (_, index) => ({
      ...upload,
      id: `upload-${index}`,
    }));
    assert.equal(resolveTaskAttachmentMetadata(
      ten.map(({ id }) => ({ id })),
      "creator",
      new Set(),
      ten,
    ).length, TASK_ATTACHMENT_MAX_FILES);
    assert.throws(() => resolveTaskAttachmentMetadata(
      [...ten, { ...upload, id: "upload-11" }].map(({ id }) => ({ id })),
      "creator",
      new Set(),
      [...ten, { ...upload, id: "upload-11" }],
    ), /at most 10/);
  });

  it("only permits canonical raster images and PDFs for inline previews", () => {
    assert.equal(taskAttachmentPreviewAllowed("image/jpeg"), true);
    assert.equal(taskAttachmentPreviewAllowed("application/pdf"), true);
    assert.equal(taskAttachmentPreviewAllowed("image/svg+xml"), false);
    assert.equal(taskAttachmentPreviewAllowed("text/html"), false);
  });

  it("omits attachments when a PATCH omits them, allows explicit clearing, and permits attachment-only comments", () => {
    const omitted = buildValidatedTaskPatch({ title: "Edited" });
    assert.equal(Object.prototype.hasOwnProperty.call(omitted, "attachments"), false);
    assert.deepEqual(buildValidatedTaskPatch({ attachments: [] }).attachments, []);
    assert.equal(taskCommentHasContentOrAttachments("", 1), true);
    assert.equal(taskCommentHasContentOrAttachments("  ", 0), false);
    assert.equal(taskCommentHasContentOrAttachments("Comment", 0), true);
  });
});