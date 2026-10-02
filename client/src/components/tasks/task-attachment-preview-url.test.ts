import assert from "node:assert/strict";
import { taskAttachmentPreviewUrl } from "./task-attachment-preview-url";

const original = "/api/tasks/attachments/example";
assert.equal(taskAttachmentPreviewUrl(original), `${original}?preview=1`);
assert.equal(original, "/api/tasks/attachments/example");
assert.equal(taskAttachmentPreviewUrl(`${original}?preview=0&other=value#page=2`), `${original}?preview=1&other=value#page=2`);
assert.equal(taskAttachmentPreviewUrl("/uploads/legacy.pdf"), "/uploads/legacy.pdf?preview=1");
assert.throws(() => taskAttachmentPreviewUrl("https://other.example/file.pdf"));
assert.throws(() => taskAttachmentPreviewUrl("//other.example/file.pdf"));
console.log("task attachment inline preview URL checks passed");