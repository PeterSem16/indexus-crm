import { apiRequest } from "@/lib/queryClient";
import type { TaskAttachment } from "@shared/task-attachments";
import type { ManualPulseTaskOriginRequest } from "@shared/task-provenance";

export interface AgentWorkspaceTaskCreateInput {
  title: string;
  description: string;
  priority: string;
  customerId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  dueDate?: string;
  country?: string;
  groupId?: string;
  recipients?: { groupIds: string[]; userIds: string[] };
  requestTypeId?: string;
  attachments: TaskAttachment[];
}

export function buildAgentWorkspaceTaskCreatePayload(
  task: AgentWorkspaceTaskCreateInput,
  assignedUserId: string | undefined,
  pulseOrigin: ManualPulseTaskOriginRequest,
) {
  return {
    title: task.title,
    priority: task.priority,
    ...(task.description ? { description: task.description } : {}),
    ...(task.dueDate ? { dueDate: new Date(task.dueDate).toISOString() } : {}),
    ...(task.customerId ? { customerId: task.customerId } : {}),
    ...(task.relatedEntityType ? { relatedEntityType: task.relatedEntityType } : {}),
    ...(task.relatedEntityId ? { relatedEntityId: task.relatedEntityId } : {}),
    ...(task.country ? { country: task.country } : {}),
    ...(task.recipients ? { recipients: task.recipients, requestTypeId: task.requestTypeId } : task.groupId ? { groupId: task.groupId } : { assignedUserId }),
    attachments: task.attachments,
    pulseOrigin,
  };
}

export function createAgentWorkspaceTask(
  task: AgentWorkspaceTaskCreateInput,
  assignedUserId: string | undefined,
  pulseOrigin: ManualPulseTaskOriginRequest,
) {
  return apiRequest(
    "POST",
    "/api/tasks",
    buildAgentWorkspaceTaskCreatePayload(task, assignedUserId, pulseOrigin),
  );
}