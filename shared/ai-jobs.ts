export const AI_JOB_SERVICES = ["task.checklist", "task.resolution", "email.summary"] as const;
export type AIJobService = typeof AI_JOB_SERVICES[number];
export type AIJobStatus = "pending" | "processing" | "completed" | "failed";
export interface AIJobView {
  id: string;
  service: AIJobService;
  entityType: "task" | "email";
  entityId: string;
  status: AIJobStatus;
  attempts: number;
  maxAttempts: number;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  metrics?: { queueMs: number | null; gatewayMs: number | null; applyMs: number | null;
    httpStatus: number | null; requestId: string | null };
}
