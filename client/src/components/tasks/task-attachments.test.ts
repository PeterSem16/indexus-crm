import assert from "node:assert/strict";
import {
  getTaskAttachmentContextKey,
  getTaskFileTypeLabel,
  isSafeTaskAttachmentUrl,
  TaskAttachmentList,
} from "./task-attachments";

assert.equal(getTaskFileTypeLabel("brief.pdf", "application/pdf"), "PDF");
assert.equal(getTaskFileTypeLabel("report.docx", ""), "DOCX");
assert.equal(getTaskFileTypeLabel("sheet.xlsx", ""), "XLSX");
assert.equal(getTaskFileTypeLabel("photo.jpg", "image/jpeg"), "IMG");
assert.equal(getTaskFileTypeLabel("word-file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "DOCX");
assert.equal(getTaskFileTypeLabel("spreadsheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "XLSX");
assert.equal(getTaskFileTypeLabel("slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"), "PPTX");

assert.equal(isSafeTaskAttachmentUrl("/api/tasks/attachments/abc-123"), true);
assert.equal(isSafeTaskAttachmentUrl("/uploads/task-file.pdf"), true);
assert.equal(isSafeTaskAttachmentUrl("/data/task-file.pdf"), true);
assert.equal(isSafeTaskAttachmentUrl("https://example.com/file.pdf"), false);
assert.equal(isSafeTaskAttachmentUrl("javascript:alert(1)"), false);
assert.equal(isSafeTaskAttachmentUrl("/api/tasks/attachments/../private"), false);
assert.equal(TaskAttachmentList({ attachments: { name: "bad metadata" } as any }), null);

const taskContext = { isOpen: true, campaignId: "campaign-1", entityType: "customer", entityId: "customer-1" };
assert.notEqual(
  getTaskAttachmentContextKey(taskContext),
  getTaskAttachmentContextKey({ ...taskContext, campaignId: "campaign-2" }),
);
assert.notEqual(
  getTaskAttachmentContextKey(taskContext),
  getTaskAttachmentContextKey({ ...taskContext, entityId: "customer-2" }),
);

console.log("task attachment component checks passed");