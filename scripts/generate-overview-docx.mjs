import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip
} from "docx";
import fs from "fs";

const COLOR_RED = "C0392B";
const COLOR_ORANGE = "E67E22";
const COLOR_GREEN = "27AE60";
const COLOR_BLUE = "2980B9";
const COLOR_GRAY = "7F8C8D";
const COLOR_DARK = "2C3E50";
const COLOR_HEADER_BG = "2C3E50";
const COLOR_CRITICAL_BG = "FDEDEC";
const COLOR_LIGHT_BG = "F2F3F4";
const COLOR_WHITE = "FFFFFF";

const FONT = "Calibri";

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    run: { font: FONT, color: COLOR_DARK, bold: true, size: 32 },
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: COLOR_DARK, font: FONT })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" } },
  });
}

function h3(text, color = COLOR_BLUE) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color, font: FONT })],
    spacing: { before: 240, after: 80 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color: COLOR_DARK, ...opts })],
    spacing: { before: 40, after: 40 },
  });
}

function note(text, color = COLOR_GRAY) {
  return new Paragraph({
    children: [new TextRun({ text: `ℹ ${text}`, font: FONT, size: 18, color, italics: true })],
    spacing: { before: 40, after: 80 },
  });
}

function bullet(text, color = COLOR_DARK) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color })],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () =>
    new Paragraph({ children: [new TextRun({ text: "", size: 18 })], spacing: { before: 0, after: 0 } })
  );
}

function cell(text, opts = {}) {
  const {
    bold = false, color = COLOR_DARK, bg = COLOR_WHITE,
    align = AlignmentType.LEFT, size = 18, width
  } = opts;
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), font: FONT, size, bold, color })],
      alignment: align,
      spacing: { before: 40, after: 40 },
    })],
    shading: bg !== COLOR_WHITE ? { type: ShadingType.SOLID, fill: bg } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

function headerRow(cols, widths) {
  return new TableRow({
    children: cols.map((c, i) =>
      cell(c, { bold: true, color: COLOR_WHITE, bg: COLOR_HEADER_BG, align: AlignmentType.CENTER, size: 18, width: widths?.[i] })
    ),
    tableHeader: true,
  });
}

function dataRow(cols, opts = []) {
  return new TableRow({
    children: cols.map((c, i) => cell(c, { size: 18, ...opts[i] })),
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      headerRow(headers, widths),
      ...rows.map(r => dataRow(r[0], r[1])),
    ],
  });
}

function priorityColor(p) {
  if (p === "Kritická") return COLOR_RED;
  if (p === "Vysoká") return COLOR_ORANGE;
  if (p === "Stredná") return COLOR_BLUE;
  return COLOR_GRAY;
}

function planTable(rows) {
  return makeTable(
    ["Priorita", "Úprava", "Odhadovaný čas"],
    rows.map(([pri, uprava, cas]) => [
      [pri, uprava, cas],
      [
        { bold: true, color: priorityColor(pri) },
        {},
        { align: AlignmentType.CENTER },
      ],
    ]),
    [1200, 6000, 1500]
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const doc = new Document({
  creator: "INDEXUS CRM",
  title: "INDEXUS CRM — Prehľad modulov & Plán úprav",
  description: "Control check produkčnej databázy a plán úprav",
  styles: {
    default: {
      document: { run: { font: FONT } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1.1),
          right: convertInchesToTwip(1.1),
        },
      },
    },
    children: [

      // ── TITULNÁ STRANA ──────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "INDEXUS CRM", bold: true, size: 56, color: COLOR_HEADER_BG, font: FONT })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Prehľad modulov, Control Check & Plán úprav", size: 32, color: COLOR_GRAY, font: FONT })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Máj 2026  ·  CORPCRM01 (77.72.181.113)  ·  indexus_crm  ·  205 tabuliek", size: 20, color: COLOR_GRAY, font: FONT })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 1600 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Dokument je editovateľný — časy, zodpovedné osoby a dátumy doplňte ručne.", size: 20, italics: true, color: COLOR_ORANGE, font: FONT })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 2400 },
      }),

      // ── SÚHRNNÁ TABUĽKA ─────────────────────────────────────────────────
      h2("Súhrnná tabuľka záznamov (produkcia)"),
      makeTable(
        ["Modul", "Tabuľka DB", "Počet záznamov"],
        [
          [["Komunikácia", "communication_messages", "1 163 268"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Zmluvy", "contract_instances", "236 935"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Odbery", "collections", "198 066"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Zákazníci", "customers", "165 462"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Spolupracovníci", "collaborators", "14 887"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Kliniky", "clinics", "10 078"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Nemocnice", "hospitals", "1 213"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Hovorový log", "call_logs", "1 087"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Kampaňové kontakty", "campaign_contacts", "734"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Používatelia", "users", "12"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["Kampane", "campaigns", "5"], [{}, {}, { align: AlignmentType.RIGHT }]],
          [["⚠️ Faktúry", "invoices", "0 — KRITICKÉ"], [{}, {}, { color: COLOR_RED, bold: true, align: AlignmentType.RIGHT }]],
        ],
        [3000, 3500, 2000]
      ),

      ...spacer(1),

      // ── KRITICKÉ NÁLEZY ─────────────────────────────────────────────────
      h2("🔴 Kritické nálezy"),
      makeTable(
        ["#", "Nález", "Detail"],
        [
          [["1", "Žiadne faktúry", "invoices = 0 — fakturácia nebola aktivovaná"], [{}, { bold: true, color: COLOR_RED }, { color: COLOR_RED }]],
          [["2", "Zákazníci bez poistovne", "165 448 z 165 462 nemá health_insurance_id"], [{}, { bold: true, color: COLOR_ORANGE }, {}]],
          [["3", "Používatelia bez RBAC", "12/12 bez záznamu v user_roles — len starý role stĺpec"], [{}, { bold: true, color: COLOR_ORANGE }, {}]],
          [["4", "89 odberov bez zmluvy", "contract_id = NULL na 89 záznamoch"], [{}, { bold: true, color: COLOR_ORANGE }, {}]],
        ],
        [400, 2800, 5300]
      ),

      ...spacer(1),

      // ── 1. ZÁKAZNÍCI ────────────────────────────────────────────────────
      h2("1. Zákazníci (customers)"),
      h3("Počty per krajina"),
      makeTable(
        ["Krajina", "Počet"],
        [
          [["RO", "78 912"], [{}, { align: AlignmentType.RIGHT }]],
          [["SK", "57 461"], [{}, { align: AlignmentType.RIGHT }]],
          [["HU", "16 961"], [{}, { align: AlignmentType.RIGHT }]],
          [["CZ", "9 777"], [{}, { align: AlignmentType.RIGHT }]],
          [["IT", "1 196"], [{}, { align: AlignmentType.RIGHT }]],
          [["AT", "717"], [{}, { align: AlignmentType.RIGHT }]],
          [["Ostatné (39 krajín)", "438"], [{}, { align: AlignmentType.RIGHT }]],
          [["SPOLU", "165 462"], [{ bold: true }, { bold: true, align: AlignmentType.RIGHT }]],
        ],
        [3000, 1500]
      ),
      ...spacer(1),
      h3("Kontrolné body"),
      makeTable(
        ["Check", "Výsledok"],
        [
          [["Zákazníci bez telefónu aj emailu", "0 ✅"], [{}, { color: COLOR_GREEN, bold: true }]],
          [["Zákazníci bez krajiny", "0 ✅"], [{}, { color: COLOR_GREEN, bold: true }]],
          [["Zákazníci bez poistovne", "165 448 ⚠️"], [{}, { color: COLOR_ORANGE, bold: true }]],
          [["ISCBC migrácia (data_source)", "165 448 / 165 462 ✅"], [{}, { color: COLOR_GREEN, bold: true }]],
        ],
        [5000, 3500]
      ),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Import zdravotných poisťovní pre SK, CZ, HU zákazníkov", "___"],
        ["Vysoká", "Aktivácia web form registrácie (test prebehol — 6 submissions)", "___"],
        ["Stredná", "Segmentácia zákazníkov pre kampane", "___"],
        ["Nízka", "Čistenie 14 záznamov bez data_source", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 2. ZMLUVY ───────────────────────────────────────────────────────
      h2("2. Zmluvy (contract_instances)"),
      h3("Počty per status"),
      makeTable(
        ["Status", "Počet"],
        [
          [["completed", "221 467"], [{}, { align: AlignmentType.RIGHT }]],
          [["cancelled", "14 118"], [{}, { align: AlignmentType.RIGHT }]],
          [["signed", "671"], [{}, { align: AlignmentType.RIGHT }]],
          [["sent", "645"], [{}, { align: AlignmentType.RIGHT }]],
          [["pending_signature ⚠️", "25"], [{ color: COLOR_ORANGE }, { align: AlignmentType.RIGHT, color: COLOR_ORANGE }]],
          [["draft ⚠️", "9"], [{ color: COLOR_ORANGE }, { align: AlignmentType.RIGHT, color: COLOR_ORANGE }]],
          [["SPOLU", "236 935"], [{ bold: true }, { bold: true, align: AlignmentType.RIGHT }]],
        ],
        [3000, 1500]
      ),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Overiť 25 zmlúv s pending_signature — sú stále aktuálne?", "___"],
        ["Vysoká", "Overiť 9 zmlúv v draft stave — dokončiť alebo zmazať", "___"],
        ["Stredná", "Automatické upozornenie pri zmluvách dlho v 'sent' stave", "___"],
        ["Nízka", "Automatická obnova zmlúv pri vypršaní", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 3. ODBERY ───────────────────────────────────────────────────────
      h2("3. Odbery (collections)"),
      h3("Počty per krajina"),
      makeTable(
        ["Krajina", "Počet"],
        [
          [["RO", "91 502"], [{}, { align: AlignmentType.RIGHT }]],
          [["SK", "74 041"], [{}, { align: AlignmentType.RIGHT }]],
          [["HU", "19 445"], [{}, { align: AlignmentType.RIGHT }]],
          [["CZ", "11 589"], [{}, { align: AlignmentType.RIGHT }]],
          [["AT", "724"], [{}, { align: AlignmentType.RIGHT }]],
          [["IT", "722"], [{}, { align: AlignmentType.RIGHT }]],
          [["MD + DE", "43"], [{}, { align: AlignmentType.RIGHT }]],
          [["SPOLU", "198 066"], [{ bold: true }, { bold: true, align: AlignmentType.RIGHT }]],
        ],
        [3000, 1500]
      ),
      ...spacer(1),
      h3("Collection States (číselné kódy — doplniť názvy)"),
      makeTable(
        ["State ID", "Počet", "Názov stavu (doplniť ručne)"],
        [
          [["6", "187 911", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["8", "8 688", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["4", "446", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["5", "411", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["3", "315", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["10", "134", "___________"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["ostatné", "171", ""], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["evaluated (text)", "14", "Starý formát — migrovať"], [{}, { align: AlignmentType.RIGHT }, { color: COLOR_ORANGE }]],
        ],
        [1000, 1500, 5000]
      ),
      note("Dekódovanie: SELECT id, name FROM collection_statuses ORDER BY sort_order;"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Doplniť contract_id pre 89 odberov bez zmluvy", "___"],
        ["Stredná", "Migrácia 14 záznamov so starým text state 'evaluated'", "___"],
        ["Stredná", "Lab results workflow — dokončenie procesu", "___"],
        ["Nízka", "CBU report automatizácia pre nové odbery", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 4. FAKTÚRY ──────────────────────────────────────────────────────
      h2("4. Faktúry (invoices) ⚠️ KRITICKÉ"),
      new Paragraph({
        children: [new TextRun({ text: "Tabuľka invoices má 0 záznamov. Fakturačná infraštruktúra je pripravená, ale fakturácia nebola aktivovaná.", font: FONT, size: 20, color: COLOR_RED, bold: true })],
        spacing: { before: 80, after: 80 },
        shading: { type: ShadingType.SOLID, fill: "FDEDEC" },
      }),
      ...spacer(1),
      h3("Dostupná infraštruktúra"),
      bullet("invoice_items — 15 testovacích položiek"),
      bullet("billing_company_accounts — fakturačné firmy"),
      bullet("number_ranges — číslovacie rady (nakonfigurovať per krajina)"),
      bullet("scheduled_invoices — periodická fakturácia"),
      bullet("invoice_payments, invoice_layouts, invoice_templates — pripravené"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Kritická", "Rozhodnutie: import histórie z ISCBC alebo štart od nuly?", "___"],
        ["Kritická", "Konfigurácia number_ranges per krajina (SK, RO, HU, CZ)", "___"],
        ["Kritická", "Konfigurácia billing_company_accounts", "___"],
        ["Vysoká", "Test generovania faktúry pre 1 zákazníka / krajinu", "___"],
        ["Vysoká", "Aktivácia scheduled_invoices (periodická fakturácia)", "___"],
        ["Stredná", "PDF šablóny per krajina a jazyk", "___"],
        ["Stredná", "QR kód platba (EPC QR — SK/CZ/AT)", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 5. HEALTHCARE ───────────────────────────────────────────────────
      h2("5. Healthcare Network (hospitals / clinics / collaborators)"),
      makeTable(
        ["Entita", "Počet"],
        [
          [["Nemocnice (hospitals)", "1 213"], [{}, { align: AlignmentType.RIGHT }]],
          [["Kliniky (clinics)", "10 078"], [{}, { align: AlignmentType.RIGHT }]],
          [["Spolupracovníci (collaborators)", "14 887"], [{}, { align: AlignmentType.RIGHT }]],
        ],
        [4000, 1500]
      ),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Dokončenie MPN komunikačných harmonogramov", "___"],
        ["Stredná", "Kliniky bez kontaktnej osoby — overiť a doplniť", "___"],
        ["Stredná", "First Contact Protocols pre nových partnerov", "___"],
        ["Nízka", "Import nových nemocníc a kliník z externých zdrojov", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 6. KOMUNIKÁCIA & KAMPANE ────────────────────────────────────────
      h2("6. Komunikácia & Kampane"),
      makeTable(
        ["Typ", "Počet"],
        [
          [["communication_messages (email/SMS)", "1 163 268"], [{}, { align: AlignmentType.RIGHT }]],
          [["call_logs", "1 087"], [{}, { align: AlignmentType.RIGHT }]],
          [["campaign_contacts", "734"], [{}, { align: AlignmentType.RIGHT }]],
        ],
        [4500, 1500]
      ),
      ...spacer(1),
      makeTable(
        ["Status kampane", "Počet"],
        [
          [["active", "2"], [{}, { align: AlignmentType.RIGHT }]],
          [["paused ⚠️", "2"], [{ color: COLOR_ORANGE }, { align: AlignmentType.RIGHT, color: COLOR_ORANGE }]],
          [["draft", "1"], [{}, { align: AlignmentType.RIGHT }]],
        ],
        [3000, 1500]
      ),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Aktivácia/preverenie 2 pozastavených kampaní", "___"],
        ["Vysoká", "Dokončenie 1 draft kampane", "___"],
        ["Stredná", "Mailchimp sync konfigurácia pre aktívne kampane", "___"],
        ["Stredná", "SOP články — rozšírenie (aktuálne len 25)", "___"],
        ["Nízka", "Automatické správy pri zmene stavu zmluvy/odberu", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 7. POUŽÍVATELIA ─────────────────────────────────────────────────
      h2("7. Používatelia & Oprávnenia (users)"),
      bullet("12 aktívnych používateľov"),
      bullet("Všetci 12 nemajú záznam v user_roles — používajú starý role stĺpec ⚠️"),
      bullet("role_module_permissions tabuľka je naplnená (RBAC je pripravený)"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Migrácia používateľov z role stĺpca na RBAC (user_roles)", "___"],
        ["Vysoká", "Overenie assigned_countries per používateľ", "___"],
        ["Stredná", "Nastavenie role_field_permissions pre citlivé polia", "___"],
        ["Nízka", "Onboarding dokumentácia pre nových používateľov", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 8. NEXUSPOINT ───────────────────────────────────────────────────
      h2("8. NexusPoint (SharePoint integrácia)"),
      bullet("MS365 integrácia aktívna"),
      bullet("Download fix nasadený (máj 2026) ✅ — streaming cez Graph API"),
      bullet("Cross-drive move fix nasadený (máj 2026) — čaká na produkčný test"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Test cross-drive move v produkcii", "___"],
        ["Stredná", "Oprávnenia na úrovni priečinkov (per krajina/používateľ)", "___"],
        ["Nízka", "Tagy a poznámky k súborom — UI rozšírenie", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 9. CALL CENTER ──────────────────────────────────────────────────
      h2("9. Call Center & SIP Telefónia"),
      bullet("Asterisk ARI na 10.1.2.112:8088 — ECONNREFUSED ⚠️", COLOR_RED),
      bullet("SIP settings nakonfigurované, SIP extensions v DB"),
      bullet("Virtual agent configs prítomné (AI voice bot)"),
      bullet("call_logs: 1 087 záznamov"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Kritická", "Opraviť Asterisk ARI spojenie (mediagateway 10.1.2.112)", "___"],
        ["Vysoká", "Overenie SIP extensions a prihlásenia agentov", "___"],
        ["Stredná", "Virtual AI Agent — kalibrácia odpovedí per krajina", "___"],
        ["Nízka", "Nahrávky hovorov — archivácia a prístup cez UI", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 10. AI & LEAD INTELLIGENCE ──────────────────────────────────────
      h2("10. AI & Lead Intelligence"),
      bullet("Lead Intelligence V3 nakonfigurovaný (7 vrstiev)"),
      bullet("OpenAI GPT-4o integrácia aktívna"),
      bullet("Tabuľky: lead_entities, lead_scoring_criteria, lead_campaigns, lead_sources, contact_scores"),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Spustenie lead search kampaní pre SK/RO", "___"],
        ["Vysoká", "Kalibrácia scoring kritérií podľa výsledkov", "___"],
        ["Stredná", "Feedback loop — naučenie z uzavretých leadov", "___"],
        ["Nízka", "Entity Knowledge Graph — vizualizácia vzťahov", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(1),

      // ── 11. WEB FORMS & PIPELINES ───────────────────────────────────────
      h2("11. Web Forms & Pipelines"),
      makeTable(
        ["Entita", "Počet"],
        [
          [["web_form_submissions", "10 (testovacie)"], [{}, {}]],
          [["pipelines", "2"], [{}, {}]],
          [["deals", "10"], [{}, {}]],
        ],
        [4000, 2000]
      ),
      ...spacer(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Aktivácia verejných formulárov pre SK/RO (marketing)", "___"],
        ["Stredná", "Pipeline nastavenie pre predajný proces", "___"],
        ["Nízka", "Webhook konfigurácia pre externé CRM systémy", "___"],
      ]),
      p("Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ___________", { color: COLOR_GRAY }),

      ...spacer(2),

      // ── CELKOVÝ PLÁN ────────────────────────────────────────────────────
      h2("Celkový plán — Prehľad"),
      makeTable(
        ["Modul", "Priorita", "Odh. čas", "Zodpovedná osoba", "Dátum dokončenia"],
        [
          [["Faktúry — aktivácia", "Kritická", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_RED }, {}, {}, {}]],
          [["Asterisk ARI fix", "Kritická", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_RED }, {}, {}, {}]],
          [["RBAC migrácia", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Zmluvy pending review", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Poistovne import", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Kampane aktivácia", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["NexusPoint move test", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Lead Intelligence", "Vysoká", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Collections — 89 bez zmluvy", "Stredná", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["Web Forms aktivácia", "Stredná", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["MPN harmonogramy", "Stredná", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["SOP rozšírenie", "Nízka", "___", "___________", "___________"], [{}, { bold: true, color: COLOR_GRAY }, {}, {}, {}]],
        ],
        [2800, 1200, 900, 2000, 2000]
      ),

      ...spacer(2),

      // ── PRÍLOHA SQL ─────────────────────────────────────────────────────
      h2("Príloha — SQL Control Check Skript"),
      note("Spustenie: PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f /tmp/indexus_final.sql"),
      new Paragraph({
        children: [new TextRun({
          text: [
            "SELECT 'customers' AS modul, COUNT(*) AS pocet FROM customers",
            "UNION ALL SELECT 'contract_instances', COUNT(*) FROM contract_instances",
            "UNION ALL SELECT 'collections', COUNT(*) FROM collections",
            "UNION ALL SELECT 'invoices', COUNT(*) FROM invoices",
            "UNION ALL SELECT 'hospitals', COUNT(*) FROM hospitals",
            "UNION ALL SELECT 'clinics', COUNT(*) FROM clinics",
            "UNION ALL SELECT 'collaborators', COUNT(*) FROM collaborators",
            "UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns",
            "ORDER BY pocet DESC;",
            "",
            "-- Customers per krajina",
            "SELECT COALESCE(country,'?') AS krajina, COUNT(*) AS pocet",
            "FROM customers GROUP BY country ORDER BY pocet DESC;",
            "",
            "-- Contract instances per status",
            "SELECT COALESCE(status,'?') AS status, COUNT(*) AS pocet",
            "FROM contract_instances GROUP BY status ORDER BY pocet DESC;",
            "",
            "-- Collections per state",
            "SELECT COALESCE(state,'?') AS state, COUNT(*) AS pocet",
            "FROM collections GROUP BY state ORDER BY pocet DESC;",
            "",
            "-- Control checks",
            "SELECT 'Customers bez tel aj email' AS check_name, COUNT(*) AS pocet",
            "FROM customers WHERE (phone IS NULL OR phone='') AND (email IS NULL OR email='')",
            "UNION ALL SELECT 'Customers bez krajiny', COUNT(*) FROM customers",
            "  WHERE country IS NULL OR country=''",
            "UNION ALL SELECT 'Collections bez contract_id', COUNT(*) FROM collections",
            "  WHERE contract_id IS NULL",
            "UNION ALL SELECT 'Tasks po termine (open)', COUNT(*) FROM tasks",
            "  WHERE due_date < NOW() AND status != 'done'",
            "UNION ALL SELECT 'Users bez roly', COUNT(*) FROM users u",
            "  LEFT JOIN user_roles ur ON ur.user_id=u.id",
            "  WHERE ur.role_id IS NULL AND u.is_active=true",
            "ORDER BY pocet DESC;",
            "",
            "-- Collection statuses dekodovanie",
            "SELECT id, name FROM collection_statuses ORDER BY sort_order;",
          ].join("\n"),
          font: "Courier New",
          size: 16,
          color: "1A1A2E",
        })],
        shading: { type: ShadingType.SOLID, fill: "F0F0F0" },
        spacing: { before: 80, after: 80 },
      }),

    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("indexus_overview.docx", buffer);
console.log("✅ indexus_overview.docx vygenerovaný");
