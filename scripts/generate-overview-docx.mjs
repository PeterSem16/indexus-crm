import fs from "node:fs";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, AlignmentType, Footer, PageNumber, PageBreak } from "docx";

// The reviewed Markdown is the single source of truth; never duplicate its content here.
const input = process.argv[2] || "indexus_overview.md";
const output = process.argv[3] || "indexus_overview.docx";
const lines = fs.readFileSync(input, "utf8").split(/\r?\n/);
const children = [];
const runs = (text) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map(part => new TextRun({ text: part.replace(/^\*\*|\*\*$/g, "").replace(/^`|`$/g, ""), bold: part.startsWith("**"), font: part.startsWith("`") ? "Consolas" : "Calibri" }));
let code = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!code && line.trim() === "<!-- pagebreak -->") {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    continue;
  }
  if (line.startsWith("```")) { code = !code; continue; }
  if (code) {
    children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas", size: 16 })], shading: { fill: "F1F5F9" }, spacing: { after: 30 } }));
    continue;
  }
  if (!line.trim() || /^---+$/.test(line)) continue;
  if (line.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) {
      if (!/^\|[\s:|\-]+\|$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map(s => s.trim()));
      i++;
    }
    i--;
    const count = rows[0].length;
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((row, index) => new TableRow({ tableHeader: index === 0, children: row.map(text => new TableCell({ width: { size: 100 / count, type: WidthType.PERCENTAGE }, margins: { top: 85, bottom: 85, left: 100, right: 100 }, shading: { fill: index === 0 ? "E2E8F0" : "FFFFFF" }, children: [new Paragraph({ children: runs(text), spacing: { after: 60 }, style: "TableText" })] })) })) }));
    children.push(new Paragraph({ text: "", spacing: { after: 90 } }));
    continue;
  }
  const heading = line.match(/^(#{1,3}) (.*)$/);
  if (heading) {
    children.push(new Paragraph({ text: heading[2], heading: [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2][heading[1].length - 1], keepNext: true, spacing: { before: heading[1].length === 1 ? 100 : 260, after: 130 } }));
    continue;
  }
  const quote = line.startsWith("> ");
  const bullet = line.startsWith("- ");
  children.push(new Paragraph({ children: runs(line.replace(/^(> |\- )/, "")), ...(bullet ? { bullet: { level: 0 } } : {}), ...(quote ? { shading: { fill: "F1F5F9" } } : {}), spacing: { after: 110, line: 265 } }));
}
const doc = new Document({
  title: "INDEXUS CRM — aktuálny prehľad a plán dokončenia", creator: "INDEXUS", description: "Revízia 14. septembra 2026; produkčné počty čakajú na potvrdenie.",
  styles: { default: { document: { run: { font: "Calibri", size: 21, color: "243247" } } }, paragraphStyles: [{ id: "TableText", name: "Table text", basedOn: "Normal", run: { size: 18 } }] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 950, right: 950 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "INDEXUS • 14. 9. 2026 | ", size: 16, color: "64748B" }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })] })] }) }, children }],
});
fs.writeFileSync(output, await Packer.toBuffer(doc));
console.log("Generated " + output + " from " + input);
