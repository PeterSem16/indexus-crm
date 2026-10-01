import type { TaskAttachment } from "@shared/task-attachments";
import {
  canAccessTaskByPolicy,
  type TaskAccessRow,
  type TaskAccessUser,
} from "./task-contract";

export const TASK_ATTACHMENT_MAX_FILES = 10;
export const TASK_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const TASK_ATTACHMENT_PREVIEW_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export function taskAttachmentPreviewAllowed(type: string): boolean {
  return (TASK_ATTACHMENT_PREVIEW_TYPES as readonly string[]).includes(type);
}

export interface TaskAttachmentRegistryRow {
  id: string;
  uploaderUserId: string;
  name: string;
  type: string;
  size: number;
  everAssociated: boolean;
  associationHistory: TaskAttachmentAssociationSnapshot[];
}

export interface TaskAttachmentAssociationSnapshot extends TaskAccessRow {
  taskId: string;
}

// History identifies source tasks, never supplies an authorization policy.
// Reassignment/country changes must take effect, and deleted tasks fail closed.
export function liveTaskAttachmentSources<T extends { id: string }>(
  history: readonly { taskId: string }[],
  liveTasks: readonly T[],
): T[] {
  const liveById = new Map(liveTasks.map(task => [task.id, task]));
  return history.flatMap(source => {
    const task = liveById.get(source.taskId);
    return task ? [task] : [];
  });
}

export class TaskAttachmentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskAttachmentInputError";
  }
}

export function assertTaskAttachmentSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > TASK_ATTACHMENT_MAX_BYTES) {
    throw new TaskAttachmentInputError("Task attachments must be 15 MB or smaller");
  }
}

/**
 * Resolve client references into server-owned metadata. Only the id is ever
 * trusted from the request; name, URL, MIME type, and size are always taken
 * from the private upload registry.
 */
export function resolveTaskAttachmentMetadata(
  requested: unknown,
  uploaderUserId: string,
  existingTaskAttachmentIds: ReadonlySet<string>,
  registryRows: readonly TaskAttachmentRegistryRow[],
  canReuseAssociatedUpload?: (upload: TaskAttachmentRegistryRow) => boolean,
): TaskAttachment[] {
  if (!Array.isArray(requested)) {
    throw new TaskAttachmentInputError("attachments must be an array");
  }
  if (requested.length > TASK_ATTACHMENT_MAX_FILES) {
    throw new TaskAttachmentInputError("A task can have at most 10 attachments");
  }

  const ids = requested.map((item: any) => {
    const id = item && typeof item === "object" && !Array.isArray(item) ? item.id : undefined;
    if (typeof id !== "string" || !id.trim() || id.length > 200) {
      throw new TaskAttachmentInputError("Each attachment must reference a valid upload id");
    }
    return id;
  });
  if (new Set(ids).size !== ids.length) {
    throw new TaskAttachmentInputError("Attachment ids must be distinct");
  }

  const uploads = new Map(registryRows.map(row => [row.id, row]));
  return ids.map(id => {
    const upload = uploads.get(id);
    if (!upload) throw new TaskAttachmentInputError("Unknown task attachment upload");
    const alreadyOnTargetTask = existingTaskAttachmentIds.has(id);
    if (!alreadyOnTargetTask && upload.uploaderUserId !== uploaderUserId) {
      throw new TaskAttachmentInputError("Task attachment is not owned by you or already attached to this task");
    }
    if (!alreadyOnTargetTask
      && (upload.everAssociated || upload.associationHistory.length > 0)
      && !canReuseAssociatedUpload?.(upload)) {
      throw new TaskAttachmentInputError("You are no longer authorized to reuse this associated task attachment");
    }
    assertTaskAttachmentSize(upload.size);
    return {
      id: upload.id,
      name: upload.name,
      url: `/api/tasks/attachments/${encodeURIComponent(upload.id)}`,
      type: upload.type,
      size: upload.size,
    };
  });
}

export function taskAttachmentReadAllowed(
  user: TaskAccessUser,
  uploaderUserId: string,
  associatedTasks: readonly TaskAccessRow[],
  groupIds: ReadonlySet<string> = new Set<string>(),
  everAssociated = false,
  canAccessAssociatedTask?: (task: TaskAccessRow) => boolean,
): boolean {
  if (associatedTasks.length === 0) return !everAssociated && user.id === uploaderUserId;
  const isAuthorizedForTask = canAccessAssociatedTask
    || ((task: TaskAccessRow) => canAccessTaskByPolicy(user, task, groupIds));
  return associatedTasks.some(isAuthorizedForTask);
}

export function taskCommentHasContentOrAttachments(content: unknown, attachmentCount: number): boolean {
  return (typeof content === "string" && content.trim().length > 0) || attachmentCount > 0;
}