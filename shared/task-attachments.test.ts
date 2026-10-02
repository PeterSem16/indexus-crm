import assert from "node:assert/strict";
import { normalizeAttachmentName } from "./task-attachments";

const unicode = "Snímka obrazovky – žiadosť_číslo_Ľ.docx";
const multerName = Buffer.from(unicode, "utf8").toString("latin1");
assert.equal(normalizeAttachmentName(multerName), unicode);
assert.equal(normalizeAttachmentName(Buffer.from(multerName, "utf8").toString("latin1")), unicode);
assert.equal(normalizeAttachmentName("Sni\u0301mka obrazovky.png"), "Snímka obrazovky.png");
assert.equal(normalizeAttachmentName("SnÃ­mka.pdf"), "Snímka.pdf");
assert.equal(normalizeAttachmentName("PrÃ­loha â€“ ÄÃ­slo.pdf"), "Príloha – číslo.pdf");
assert.equal(normalizeAttachmentName("Ärzte_Überweisung.docx"), "Ärzte_Überweisung.docx");
assert.equal(normalizeAttachmentName("Åsa_école.pdf"), "Åsa_école.pdf");
assert.equal(normalizeAttachmentName("Výsledok_Иван_中文.pdf"), "Výsledok_Иван_中文.pdf");
assert.equal(normalizeAttachmentName("plain-document.pdf"), "plain-document.pdf");
assert.equal(normalizeAttachmentName("invoice\r\n.pdf"), "invoice.pdf");
assert.equal(normalizeAttachmentName(""), "");
console.log("Attachment filename normalization passed");