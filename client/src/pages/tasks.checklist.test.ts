import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./tasks.tsx", import.meta.url)), "utf8");
const translations = readFileSync(fileURLToPath(new URL("../i18n/translations.ts", import.meta.url)), "utf8");
const taskTiming = readFileSync(fileURLToPath(new URL("../components/tasks/task-timing.tsx", import.meta.url)), "utf8");

assert.match(source, /fetch\(`\/api\/tasks\/\$\{taskId\}\/checklist\/ai`/);
assert.match(source, /apiRequest\("POST", `\/api\/tasks\/\$\{currentTaskId\}\/checklist\/ai`, retry \? \{ retry: true \} : \{\}\)/);
assert.match(source, /itemsQuery\.isSuccess[\s\S]*items\.length === 0[\s\S]*aiStatusQuery\.data\?\.status === "idle"/);
assert.match(source, /canEdit &&[\s\S]*itemsQuery\.isSuccess[\s\S]*aiStatusQuery\.data\?\.status === "idle"/);
assert.match(source, /if \(!res\.ok\) throw new Error\(`Checklist request failed/);
assert.match(source, /data-testid=\{`button-edit-checklist-\$\{it\.id\}`\}/);
assert.match(source, /data-testid=\{`input-edit-checklist-\$\{it\.id\}`\}/);
assert.match(source, /data-testid=\{`button-save-checklist-\$\{it\.id\}`\}/);
assert.match(source, /data-testid=\{`button-checklist-ai-retry-\$\{taskId\}`\}/);
assert.match(source, /data-testid=\{`checklist-ai-status-\$\{taskId\}`\}/);
assert.match(source, /role="progressbar"[\s\S]*aria-valuemin=\{0\}[\s\S]*aria-valuemax=\{items\.length\}[\s\S]*aria-valuenow=\{doneCount\}/);
assert.match(source, /data-testid=\{`checklist-progress-\$\{taskId\}`\}/);
assert.doesNotMatch(source, /group-hover:opacity-100/);

const emailClient = readFileSync(fileURLToPath(new URL("./email-client.tsx", import.meta.url)), "utf8");
assert.match(emailClient, /data-testid="task-work-layout"/);
assert.match(emailClient, /data-testid=\{`task-request-top-\$\{selectedTask\.id\}`\}/);
assert.match(emailClient, /<TaskRequestBrief[\s\S]*<TaskAttachmentList attachments=\{taskRecord\.attachments \|\| \[\]\}/);

const checklistTranslationKeys = [
  "checklistTitle",
  "checklistAddPlaceholder",
  "checklistAdd",
  "checklistRemove",
  "checklistEdit",
  "checklistSave",
  "checklistCancel",
  "checklistLoadError",
  "checklistMutationError",
  "checklistAiGenerating",
  "checklistAiProposal",
  "checklistAiFailed",
  "checklistAiUnavailable",
  "checklistAiRetry",
  "checklistAiLoadError",
  "checklistMarkComplete",
  "checklistMarkIncomplete",
  "taskWorkElapsed",
  "taskWorkElapsedDescription",
  "taskWorkStartUnknown",
  "taskOverdueLabel",
  "taskOverdueDuration",
];
for (const key of checklistTranslationKeys) {
  assert.equal((translations.match(new RegExp(`\\b${key}:`, "g")) ?? []).length, 8, `${key} should be typed and translated in all seven locales`);
}
assert.match(taskTiming, /data-testid=\{`task-time-\$\{taskId\}`\}/);
assert.match(taskTiming, /data-testid=\{`task-overdue-\$\{taskId\}`\}/);

console.log("task checklist shared UI contract checks passed");