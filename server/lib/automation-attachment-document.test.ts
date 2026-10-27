import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { createRequire } from "node:module";
import { prepareAnalysisAttachment } from "./automation-attachment-document";
const XLSX: typeof import("xlsx") = createRequire(import.meta.url)("xlsx");

function wordPackage(text: string): Buffer {
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(`<?xml version="1.0"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`));
  zip.addFile("_rels/.rels", Buffer.from(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`));
  zip.addFile("word/document.xml", Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`));
  return zip.toBuffer();
}
function legacyWord(text: string, compressed = false, encrypted = false): Buffer {
  const cfb = XLSX.CFB.utils.cfb_new();
  const content = Buffer.from(text, compressed ? "latin1" : "utf16le");
  const word = Buffer.alloc(512 + content.length);
  word.writeUInt16LE(0xa5ec, 0);
  word.writeUInt16LE(0xc1, 2);
  word.writeUInt16LE(0x409, 6);
  word.writeUInt16LE(0x204 | (encrypted ? 0x100 : 0), 10);
  word.writeUInt16LE(14, 32);
  word.writeUInt16LE(22, 62);
  word.writeUInt32LE(text.length, 76);
  word.writeUInt16LE(93, 152);
  word.writeUInt32LE(0, 418);
  word.writeUInt32LE(21, 422);
  // Complete FibRgFcLcb97 is 744 bytes; text must start beyond it.
  const fullWord = Buffer.alloc(1024 + content.length);
  word.copy(fullWord, 0, 0, 512);
  content.copy(fullWord, 1024);
  const clx = Buffer.alloc(21);
  clx[0] = 2;
  clx.writeUInt32LE(16, 1);
  clx.writeUInt32LE(text.length, 9);
  clx.writeUInt32LE(compressed ? 0x40000800 : 1024, 15);
  XLSX.CFB.utils.cfb_add(cfb, "WordDocument", fullWord);
  XLSX.CFB.utils.cfb_add(cfb, "1Table", clx);
  return XLSX.CFB.write(cfb, { type: "buffer" });
}

async function main() {
  const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const docx = wordPackage("Faktúra 2026-001. Suma na úhradu: 120 EUR.");
  const prepared = await prepareAnalysisAttachment(docx, docxMime, "invoice.docx");
  assert.match(prepared.text!, /Faktúra.*120 EUR/);
  assert.deepEqual(prepared.bytes, docx, "Task keeps the original binary document");
  assert.equal(prepared.mime, docxMime);
  assert.equal((await prepareAnalysisAttachment(docx, "application/octet-stream", "invoice.DOCX")).mime, docxMime);
  for (const compressed of [false, true]) {
    const doc = legacyWord("Invoice 2026-002. Pay 120 EUR.", compressed);
    const result = await prepareAnalysisAttachment(doc, "application/msword", "invoice.doc");
    assert.match(result.text!, /Invoice 2026-002.*120 EUR/);
    assert.deepEqual(result.bytes, doc);
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Faktúra", "Suma"], ["2026-003", 120]]), "Fakturácia");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["IBAN", "TEST-ACCOUNT"], ["Nula", 0]]), "Platba");
  for (const [bookType, mime] of [["xlsx", xlsxMime], ["xls", "application/vnd.ms-excel"]] as const) {
    const bytes = XLSX.write(book, { type: "buffer", bookType });
    const result = await prepareAnalysisAttachment(bytes, mime, `invoice.${bookType}`);
    assert.match(result.text!, /Fakturácia/);
    assert.match(result.text!, /2026-003,120/);
    assert.match(result.text!, /TEST-ACCOUNT/);
    assert.match(result.text!, /Nula,0/);
    assert.deepEqual(result.bytes, bytes);
  }
  // Known image signatures are accepted even with .jpge/.img or generic MIME.
  const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
  const jpg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
  for (const name of ["scan.jpg", "scan.jpeg", "scan.jpge", "scan.img"]) {
    assert.equal((await prepareAnalysisAttachment(jpg, "application/octet-stream", name)).mime, "image/jpeg");
  }
  assert.equal((await prepareAnalysisAttachment(jpg, "image/pjpeg", "scan.jpg")).mime, "image/jpeg");
  assert.equal((await prepareAnalysisAttachment(png, "image/img", "scan.img")).mime, "image/png");
  assert.equal((await prepareAnalysisAttachment(Buffer.from("%PDF-1.7\nexample"), "application/pdf", "a.pdf")).mime, "application/pdf");
  await assert.rejects(prepareAnalysisAttachment(Buffer.from("%PDF-1.7\ntrailer << /Encrypt 5 0 R >>"), "application/pdf", "a.pdf"),
    /analysis_document_encrypted/);
  await assert.rejects(prepareAnalysisAttachment(legacyWord("Invoice", false, true), "application/msword", "a.doc"),
    /analysis_document_encrypted/);
  assert.equal((await prepareAnalysisAttachment(Buffer.from("Faktúra,120 EUR"), "text/csv; charset=utf-8", "a.csv")).text, "Faktúra,120 EUR");

  for (const [bytes, mime, name] of [
    [Buffer.from("<html>not an image</html>"), "image/jpeg", "scan.jpg"],
    [Buffer.alloc(2048), "application/octet-stream", "disk.img"],
    [Buffer.from("Invoice 120"), "application/msword", "fake.doc"],
    [docx, xlsxMime, "fake.xlsx"],
    [wordPackage(""), docxMime, "empty.docx"],
    [legacyWord("Invoice 120", false, true), "application/msword", "encrypted.doc"],
    [Buffer.from("a\0b"), "text/plain", "binary.txt"],
    [Buffer.from("x".repeat(60001)), "text/plain", "large.txt"],
    [Buffer.alloc(15 * 1024 * 1024 + 1), "image/jpeg", "large.jpg"],
  ] as const) await assert.rejects(prepareAnalysisAttachment(bytes, mime, name), /analysis_/);

  const bomb = new AdmZip();
  bomb.addFile("word/document.xml", Buffer.alloc(26 * 1024 * 1024, 65));
  await assert.rejects(prepareAnalysisAttachment(bomb.toBuffer(), docxMime, "bomb.docx"), /analysis_document_expansion_limit/);
  const disguisedBomb = new AdmZip();
  disguisedBomb.addFile("word/document.xml", Buffer.alloc(1024 * 1024, 65));
  const forged = disguisedBomb.toBuffer();
  const central = forged.indexOf(Buffer.from("504b0102", "hex"));
  forged.writeUInt32LE(1, central + 24);
  await assert.rejects(prepareAnalysisAttachment(forged, docxMime, "forged.docx"), /analysis_document_unreadable/);
  const macro = new AdmZip(docx);
  macro.addFile("word/vbaProject.bin", Buffer.from("macro"));
  await assert.rejects(prepareAnalysisAttachment(macro.toBuffer(), docxMime, "macro.docx"), /analysis_document_unreadable/);
  console.log("Automation attachment document tests passed: DOC/DOCX/XLS/XLSX, image aliases, original bytes, malformed/encrypted/oversized archives.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
