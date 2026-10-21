import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { templateAttachmentSnapshot } from "./template-attachment-snapshot";
import { emailActionIssues, emailAttachmentIssues, EMAIL_ATTACHMENT_MAX_BYTES } from "../../shared/automation-email-action";

const root = await mkdtemp(path.join(tmpdir(), "mission-template-"));
const outside = await mkdtemp(path.join(tmpdir(), "mission-outside-"));
const viewer = { role: "manager", assignedCountries: ["SK"] };
try {
  const file = path.join(root, "mission.pdf");
  const bytes = Buffer.from("%PDF-1.4\nMission attachment", "utf8");
  await writeFile(file, bytes);
  const metadata = { fileName: "mission.pdf", filePath: path.relative(process.cwd(), file), mimeType: "application/pdf" };
  const template = { isActive: true, countryCodes: ["SK"], attachments: [metadata] };
  const copied = await templateAttachmentSnapshot(template, viewer, root);
  assert.deepEqual(Buffer.from(copied[0].contentBase64, "base64"), bytes);
  const attachments = copied.map(f => ({ name: f.fileName, contentType: f.mimeType, contentBase64: f.contentBase64 }));
  assert.deepEqual(emailActionIssues({ emailActionVersion: 2, to: "one@example.test", subject: "Mission", body: "Body", attachments }), []);
  await assert.rejects(templateAttachmentSnapshot(template, { role: "manager", assignedCountries: ["CZ"] }, root));
  await assert.rejects(templateAttachmentSnapshot({ ...template, isActive: false }, viewer, root));
  assert.deepEqual(await templateAttachmentSnapshot({ ...template, attachments: [] }, viewer, root), []);
  await assert.rejects(templateAttachmentSnapshot({ ...template, attachments: [metadata, { ...metadata, filePath: "missing.pdf" }] }, viewer, root),
    "a missing file must not produce a partial snapshot");
  const secret = path.join(outside, "not-an-attachment.txt");
  await writeFile(secret, "not permitted");
  await assert.rejects(templateAttachmentSnapshot({ ...template, attachments: [{ ...metadata, filePath: path.relative(process.cwd(), secret) }] }, viewer, root));
  const link = path.join(root, "escaped.pdf");
  await symlink(secret, link);
  await assert.rejects(templateAttachmentSnapshot({ ...template, attachments: [{ ...metadata, filePath: path.relative(process.cwd(), link) }] }, viewer, root));
  await writeFile(file, Buffer.alloc(EMAIL_ATTACHMENT_MAX_BYTES + 1));
  await assert.rejects(templateAttachmentSnapshot(template, viewer, root), /permitted size/);
  assert.ok(emailAttachmentIssues([{ ...attachments[0], url: "https://example.test/file" }]).length);
  assert.ok(emailAttachmentIssues([{ ...attachments[0], contentBase64: "not base64!" }]).length);
  assert.ok(emailAttachmentIssues(Array(6).fill(attachments[0])).length);
  assert.ok(emailAttachmentIssues([{ ...attachments[0], name: "bad\r\nname.pdf" }]).length);
  console.log("Mission template attachment snapshots: exact bytes, all-or-nothing, authorization, realpath/symlink boundaries and limits passed");
} finally {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
}
