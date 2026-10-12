// Plain JavaScript intentionally: runs identically in tsx and the bundled server.
// Parsing stays off the request thread, with a deadline and a bounded heap.
export const officeWorkerSource = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const { inflateRawSync } = require("node:zlib");
const bytes = Buffer.from(workerData.bytes);
const MAX_EXPANDED = 25 * 1024 * 1024;
const MAX_TEXT = 60000;
function fail() { throw new Error("analysis_document_unreadable"); }
function checkedText(text) {
  if (typeof text !== "string" || !text.trim()) fail();
  if (text.length > MAX_TEXT) throw new Error("analysis_document_text_limit");
  return text;
}
function zipEntries() {
  // Validate the actual inflated data, not just ZIP-declared sizes. ZIP64,
  // encrypted entries, ambiguous names and unsupported compression fail closed.
  const Zip = require(workerData.zipPath);
  const entries = new Zip(bytes).getEntries();
  if (!entries.length || entries.length > 2048) fail();
  let total = 0;
  const names = new Set();
  for (const entry of entries) {
    const h = entry.header;
    const name = entry.entryName;
    if (names.has(name) || name.includes("\\") || name.startsWith("/") ||
        name.split("/").includes("..") || (h.flags & 1) ||
        ![0, 8].includes(h.method) || h.size === 0xffffffff ||
        h.compressedSize === 0xffffffff || h.offset === 0xffffffff) fail();
    names.add(name);
    total += h.size;
    if (total > MAX_EXPANDED) throw new Error("analysis_document_expansion_limit");
    const o = h.offset;
    if (o + 30 > bytes.length || bytes.readUInt32LE(o) !== 0x04034b50 ||
        bytes.readUInt16LE(o + 8) !== h.method || (bytes.readUInt16LE(o + 6) & 1)) fail();
    const start = o + 30 + bytes.readUInt16LE(o + 26) + bytes.readUInt16LE(o + 28);
    if (start + h.compressedSize > bytes.length) fail();
    const compressed = bytes.subarray(start, start + h.compressedSize);
    const expanded = h.method === 8
      ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, h.size) })
      : compressed;
    if (expanded.length !== h.size) fail();
  }
  return names;
}
function legacyWord(cfb, XLSX) {
  const stream = name => {
    const entry = XLSX.CFB.find(cfb, name);
    return entry && Buffer.from(entry.content || []);
  };
  const word = stream("WordDocument");
  if (!word || word.length < 154 || word.readUInt16LE(0) !== 0xa5ec ||
      word.readUInt16LE(2) < 0xc1) fail();
  const flags = word.readUInt16LE(10);
  if (flags & 0x8100) throw new Error("analysis_document_encrypted");
  const table = stream(flags & 0x200 ? "1Table" : "0Table");
  if (!table) fail();
  let offset = 32;
  const csw = word.readUInt16LE(offset);
  offset += 2 + csw * 2;
  if (offset + 2 > word.length) fail();
  const cslw = word.readUInt16LE(offset);
  offset += 2;
  if (cslw < 4 || offset + cslw * 4 + 2 > word.length) fail();
  const characterCount = word.readUInt32LE(offset + 12);
  if (!characterCount || characterCount > MAX_TEXT) throw new Error("analysis_document_text_limit");
  offset += cslw * 4;
  const pairs = word.readUInt16LE(offset);
  offset += 2;
  if (pairs < 34 || offset + pairs * 8 > word.length) fail();
  const clxOffset = word.readUInt32LE(offset + 33 * 8);
  const clxLength = word.readUInt32LE(offset + 33 * 8 + 4);
  if (clxOffset + clxLength > table.length) fail();
  const clx = table.subarray(clxOffset, clxOffset + clxLength);
  let p = 0;
  while (p < clx.length && clx[p] === 1) {
    if (p + 3 > clx.length) fail();
    p += 3 + clx.readUInt16LE(p + 1);
  }
  if (p + 5 > clx.length || clx[p] !== 2) fail();
  const length = clx.readUInt32LE(p + 1);
  p += 5;
  if (length < 4 || (length - 4) % 12 || p + length > clx.length) fail();
  const count = (length - 4) / 12;
  const pieces = p + (count + 1) * 4;
  const language = word.readUInt16LE(6) & 0x3ff;
  const encoding = [5, 14, 24, 27].includes(language) ? "windows-1250" : "windows-1252";
  const decoder = new TextDecoder(encoding);
  let text = "";
  let covered = 0;
  for (let i = 0; i < count; i++) {
    const start = clx.readUInt32LE(p + i * 4);
    const end = clx.readUInt32LE(p + (i + 1) * 4);
    if (end < start) fail();
    if (start >= characterCount) break;
    if (start !== covered) fail();
    const chars = Math.min(end, characterCount) - start;
    const fc = clx.readUInt32LE(pieces + i * 8 + 2);
    const compressed = !!(fc & 0x40000000);
    const position = (fc & 0x3fffffff) / (compressed ? 2 : 1);
    const size = chars * (compressed ? 1 : 2);
    if (!Number.isInteger(position) || position + size > word.length) fail();
    const data = word.subarray(position, position + size);
    text += compressed ? decoder.decode(data) : data.toString("utf16le");
    covered += chars;
  }
  if (covered !== characterCount) fail();
  return checkedText(text.replace(/\r/g, "\n").replace(/\x07/g, "\t").replace(/[\x00-\x06\x08-\x1f]/g, ""));
}
async function parse() {
  const XLSX = require(workerData.xlsxPath);
  let kind;
  let cfb;
  if (bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) {
    const names = zipEntries();
    if (names.has("word/document.xml") && !names.has("xl/workbook.xml")) kind = "docx";
    else if (names.has("xl/workbook.xml") && !names.has("word/document.xml")) kind = "xlsx";
    else fail();
    // Macro-enabled containers are outside this service's supported formats.
    if ([...names].some(name => /vbaProject\.bin$/i.test(name))) fail();
  } else if (bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) {
    cfb = XLSX.CFB.read(bytes, { type: "buffer" });
    if (XLSX.CFB.find(cfb, "EncryptedPackage") || XLSX.CFB.find(cfb, "EncryptionInfo"))
      throw new Error("analysis_document_encrypted");
    if (XLSX.CFB.find(cfb, "WordDocument")) kind = "doc";
    else if (XLSX.CFB.find(cfb, "Workbook") || XLSX.CFB.find(cfb, "Book")) kind = "xls";
    else fail();
    if (cfb.FullPaths.some(name => /(?:^|\/)(?:VBA|_VBA_PROJECT_CUR)(?:\/|$)/i.test(name))) fail();
  } else fail();
  if (workerData.expected && workerData.expected !== kind) fail();
  let text;
  if (kind === "docx") {
    const mammoth = require(workerData.mammothPath);
    text = checkedText((await mammoth.extractRawText({ buffer: bytes })).value);
  } else if (kind === "doc") text = legacyWord(cfb, XLSX);
  else {
    const book = XLSX.read(bytes, { type: "buffer", cellFormula: false, bookVBA: false });
    if (!book.SheetNames.length || book.SheetNames.length > 32) fail();
    text = "";
    let cells = 0;
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name];
      if (!sheet || !sheet["!ref"]) continue;
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      cells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
      if (cells > 100000) throw new Error("analysis_document_cell_limit");
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) text += "Sheet: " + name + "\n" + csv + "\n";
      if (text.length > MAX_TEXT) throw new Error("analysis_document_text_limit");
    }
    text = checkedText(text);
  }
  parentPort.postMessage({ kind, text });
}
parse().catch(error => parentPort.postMessage({
  error: /^analysis_document_[a-z_]+$/.test(error.message) ? error.message : "analysis_document_unreadable"
}));
`;
