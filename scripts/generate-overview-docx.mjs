import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip
} from "docx";
import fs from "fs";

const COLOR_RED    = "C0392B";
const COLOR_ORANGE = "E67E22";
const COLOR_GREEN  = "27AE60";
const COLOR_BLUE   = "2980B9";
const COLOR_GRAY   = "7F8C8D";
const COLOR_DARK   = "2C3E50";
const COLOR_HEADER_BG = "2C3E50";
const COLOR_WHITE  = "FFFFFF";
const FONT = "Calibri";

// ── helpers ──────────────────────────────────────────────────────────────────
function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: COLOR_DARK, font: FONT })],
    spacing: { before: 380, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" } },
  });
}
function h3(text, color = COLOR_BLUE) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color, font: FONT })],
    spacing: { before: 220, after: 80 },
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
function bullet(text, color = COLOR_DARK, bold = false) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color, bold })],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
  });
}
function subbullet(text, color = COLOR_GRAY) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 18, color })],
    bullet: { level: 1 },
    spacing: { before: 10, after: 10 },
  });
}
function sp(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ children: [new TextRun({ text: "", size: 14 })], spacing: { before: 0, after: 0 } })
  );
}
function redBox(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color: COLOR_RED, bold: true })],
    spacing: { before: 80, after: 80 },
    shading: { type: ShadingType.SOLID, fill: "FDEDEC" },
  });
}
function infoBox(text, fill = "EBF5FB") {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color: COLOR_BLUE })],
    spacing: { before: 80, after: 80 },
    shading: { type: ShadingType.SOLID, fill },
  });
}

function cell(text, opts = {}) {
  const { bold=false, color=COLOR_DARK, bg=COLOR_WHITE, align=AlignmentType.LEFT, size=18 } = opts;
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(text ?? ""), font: FONT, size, bold, color })],
      alignment: align,
      spacing: { before: 50, after: 50 },
    })],
    shading: bg !== COLOR_WHITE ? { type: ShadingType.SOLID, fill: bg } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}
function headerRow(cols, widths) {
  return new TableRow({
    children: cols.map((c, i) => {
      const tc = cell(c, { bold: true, color: COLOR_WHITE, bg: COLOR_HEADER_BG, align: AlignmentType.CENTER, size: 18 });
      if (widths?.[i]) {
        tc.options = tc.options || {};
        tc.properties = { width: { size: widths[i], type: WidthType.DXA } };
      }
      return tc;
    }),
    tableHeader: true,
  });
}
function dataRow(cols, opts = []) {
  return new TableRow({ children: cols.map((c, i) => cell(c, { size: 18, ...opts[i] })) });
}
function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((c, i) => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: c, font: FONT, size: 18, bold: true, color: COLOR_WHITE })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 50 },
          })],
          shading: { type: ShadingType.SOLID, fill: COLOR_HEADER_BG },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          width: widths?.[i] ? { size: widths[i], type: WidthType.DXA } : undefined,
        })),
      }),
      ...rows.map(r => new TableRow({
        children: r[0].map((c, i) => {
          const o = r[1]?.[i] || {};
          return new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: String(c ?? ""), font: FONT, size: 18, ...o })],
              alignment: o.align || AlignmentType.LEFT,
              spacing: { before: 50, after: 50 },
            })],
            shading: o.bg ? { type: ShadingType.SOLID, fill: o.bg } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            width: widths?.[i] ? { size: widths[i], type: WidthType.DXA } : undefined,
          });
        }),
      })),
    ],
  });
}

function pColor(pri) {
  if (pri === "Kritická") return COLOR_RED;
  if (pri === "Vysoká")   return COLOR_ORANGE;
  if (pri === "Stredná")  return COLOR_BLUE;
  return COLOR_GRAY;
}
function planTable(rows) {
  return makeTable(
    ["Priorita", "Úprava", "Odhadovaný čas"],
    rows.map(([pri, uprava, cas]) => [
      [pri, uprava, cas ?? ""],
      [{ bold: true, color: pColor(pri) }, {}, { align: AlignmentType.LEFT }],
    ]),
    [1200, 5800, 1800]
  );
}
function zodp(text) {
  return p(`Predpokladaný dátum dokončenia: ___________  |  Zodpovedná osoba: ${text}`, { color: COLOR_GRAY });
}

// ─────────────────────────────────────────────────────────────────────────────

const doc = new Document({
  creator: "INDEXUS CRM",
  title: "INDEXUS CRM — Prehľad modulov & Plán úprav",
  sections: [{
    properties: {
      page: { margin: {
        top: convertInchesToTwip(1), bottom: convertInchesToTwip(1),
        left: convertInchesToTwip(1.1), right: convertInchesToTwip(1.1),
      }},
    },
    children: [

      // ── TITULNÁ STRANA ──────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "INDEXUS CRM", bold: true, size: 56, color: COLOR_HEADER_BG, font: FONT })],
        alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Prehľad modulov, Control Check & Plán úprav", size: 32, color: COLOR_GRAY, font: FONT })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Máj 2026  ·  CORPCRM01 (77.72.181.113)  ·  indexus_crm  ·  205 tabuliek", size: 20, color: COLOR_GRAY, font: FONT })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1600 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Dokument je editovateľný — časy, zodpovedné osoby a dátumy doplňte ručne.", size: 20, italics: true, color: COLOR_ORANGE, font: FONT })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 2400 },
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
      ...sp(1),

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
      ...sp(1),

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
      ...sp(1),
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
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Import zdravotných poisťovní pre SK, CZ, HU zákazníkov", "Nebude potrebné riešiť, nie je to nutné"],
        ["Vysoká", "Aktivácia web form registrácie (test prebehol — 6 submissions)", "1 deň"],
        ["Stredná", "Segmentácia zákazníkov pre kampane", "Nebude potrebné riešiť pri spustení Indexus"],
        ["Nízka", "Čistenie 14 záznamov bez data_source", "1 hodina"],
      ]),
      zodp("Peter Seman"),
      ...sp(1),

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
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Overiť 25 zmlúv s pending_signature — sú stále aktuálne?", "1 hod."],
        ["Vysoká", "Overiť 9 zmlúv v draft stave — dokončiť alebo zmazať", "1 hod."],
        ["Stredná", "Automatické upozornenie pri zmluvách dlho v 'sent' stave", "Automatizacia 1 hod."],
        ["Nízka", "Automatická obnova zmlúv pri vypršaní", ""],
      ]),
      zodp("Peter Seman"),
      ...sp(1),

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
      ...sp(1),
      h3("Collection States (číselné kódy — doplniť názvy)"),
      makeTable(
        ["State ID", "Počet", "Názov stavu (doplniť ručne)"],
        [
          [["6", "187 911", "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["8", "8 688",  "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["4", "446",    "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["5", "411",    "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["3", "315",    "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["10","134",    "Pavličko"], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["ostatné", "171", ""], [{}, { align: AlignmentType.RIGHT }, {}]],
          [["evaluated (text)", "14", "Starý formát — migrovať"], [{}, { align: AlignmentType.RIGHT }, { color: COLOR_ORANGE }]],
        ],
        [1000, 1500, 6000]
      ),
      note("Dekódovanie: SELECT id, name FROM collection_statuses ORDER BY sort_order;"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Doplniť contract_id pre 89 odberov bez zmluvy", "1 deň"],
        ["Stredná", "Migrácia 14 záznamov so starým text state 'evaluated'", ""],
        ["Stredná", "Lab results workflow — dokončenie procesu", ""],
        ["Nízka",   "CBU report automatizácia pre nové odbery", "3 hod."],
      ]),
      zodp("Peter Seman, David Pavličko"),
      ...sp(1),

      // ── 4. FAKTÚRY ──────────────────────────────────────────────────────
      h2("4. Faktúry (invoices) ⚠️ KRITICKÉ"),
      redBox("Tabuľka invoices má 0 záznamov. Fakturačná infraštruktúra je pripravená, ale fakturácia nebola aktivovaná."),
      ...sp(1),
      h3("Dostupná infraštruktúra"),
      bullet("invoice_items — 15 testovacích položiek"),
      bullet("billing_company_accounts — fakturačné firmy"),
      bullet("number_ranges — číslovacie rady (nakonfigurovať per krajina)"),
      bullet("scheduled_invoices — periodická fakturácia"),
      bullet("invoice_payments, invoice_layouts, invoice_templates — pripravené"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Kritická", "Rozhodnutie: import histórie z ISCBC alebo štart od nuly?", ""],
        ["Kritická", "Konfigurácia number_ranges per krajina (SK, RO, HU, CZ)", "Pripravené, treba presne zadefinovať aké číslovacie rady sa majú používať"],
        ["Kritická", "Konfigurácia billing_company_accounts", "Pripravené, doplniť a zadefinovať fakturačné spoločnosti"],
        ["Vysoká",   "Test generovania faktúry pre 1 zákazníka / krajinu", "Zadefinovať kto bude testovať v jednotlivých krajinách"],
        ["Vysoká",   "Aktivácia scheduled_invoices (periodická fakturácia)", "Zadefinovať kto bude testovať v jednotlivých krajinách"],
        ["Stredná",  "PDF šablóny per krajina a jazyk", "Pripraviť súbor šablón pre jednotlivé krajiny"],
        ["Stredná",  "QR kód platba (EPC QR — SK/CZ/AT)", "Pripravené"],
      ]),
      p("Predpokladaný dátum dokončenia: 1 mesiac  |  Zodpovedná osoba: Peter Seman + osoby ktoré vyplývajú z plánu úprav", { color: COLOR_GRAY }),
      ...sp(1),

      // ── 5. MPN ──────────────────────────────────────────────────────────
      h2("5. Medical Partner Network — MPN (Healthcare Network)"),

      h3("Čo je MPN?", COLOR_DARK),
      infoBox(
        "MPN (Medical Partner Network) je systém na riadenie vzťahov s medicínskymi partnermi — " +
        "nemocnicami, klinikami, gynekológmi, pôrodnými asistentkami a ďalšími odborníkmi, " +
        "ktorí prichádzajú do kontaktu s tehotnými pacientkami a môžu odporučiť služby INDEXUS."
      ),
      ...sp(1),

      h3("Kto sú medicínski partneri?"),
      p("INDEXUS rozlišuje tri typy partnerských inštitúcií a k nim prislúchajúce kategórie osôb:"),
      ...sp(1),

      makeTable(
        ["Typ inštitúcie", "Kategória partnerov", "Počet v systéme"],
        [
          [["Nemocnica\n(pôrodnícke oddelenie)", "Riaditeľ nemocnice", "1 213 nemocníc"], [{}, {}, {}]],
          [["", "Vedúci pôrodníckeho oddelenia", ""], [{}, {}, {}]],
          [["", "Hlavná/vrchná sestra", ""], [{}, {}, {}]],
          [["", "Pôrodné asistentky / hebamme", ""], [{}, {}, {}]],
          [["", "Lekári pôrodníckeho oddelenia", ""], [{}, {}, {}]],
          [["Gynekologická ambulancia", "Súkromný gynekológ", "10 078 kliník"], [{}, {}, {}]],
          [["Nezávislí odborníci", "Lektorka predpôrodnej prípravy", "14 887 spoluprac."], [{}, {}, {}]],
          [["", "Dula", ""], [{}, {}, {}]],
          [["", "Laktačná poradkyňa", ""], [{}, {}, {}]],
        ],
        [2500, 3500, 2500]
      ),
      ...sp(1),

      h3("Čo sú MPN harmonogramy (Communication Schedules)?"),
      p("Harmonogram hovorí: kto má byť kontaktovaný, ako často a akým spôsobom.", { bold: true }),
      p("Každá kategória partnera má definovaný plán komunikácie — napríklad:"),
      ...sp(1),
      makeTable(
        ["Kategória partnera", "Frekvencia", "Kanál kontaktu"],
        [
          [["Riaditeľ nemocnice", "Každé 3 mesiace", "Osobná návšteva"], [{}, {}, {}]],
          [["Vedúci pôrodníckeho oddelenia", "Každý mesiac", "Telefón + email"], [{}, {}, {}]],
          [["Pôrodné asistentky", "Každé 2 mesiace", "Osobná návšteva"], [{}, {}, {}]],
          [["Súkromný gynekológ", "Každý mesiac", "Email + návšteva"], [{}, {}, {}]],
          [["Lektorka pred. prípravy", "Každé 3 mesiace", "Email"], [{}, {}, {}]],
          [["Dula / Laktačná poradkyňa", "Každý mesiac", "Email"], [{}, {}, {}]],
        ],
        [3000, 2000, 3500]
      ),
      note("Harmonogramy sú nakonfigurovateľné v INDEXUS — každá krajina môže mať vlastné nastavenia."),
      ...sp(1),

      h3("First Contact Protocol — Prvý kontakt"),
      p("Pre každú novú inštitúciu je definovaný krokový postup prvého kontaktu (napr. 5-krokový protokol pre nemocnice):"),
      bullet("Krok 1: Identifikácia správnej kontaktnej osoby"),
      bullet("Krok 2: Úvodný email / telefonát"),
      bullet("Krok 3: Zaslanie informačných materiálov"),
      bullet("Krok 4: Osobná prezentácia na pracovisko"),
      bullet("Krok 5: Podpis spolupráce / zaradenie do harmonogramu"),
      ...sp(1),

      h3("Contact Assignments — Kto má na starosti koho?"),
      p("Každý obchodný zástupca má priradené inštitúcie, za ktoré zodpovedá. INDEXUS sleduje:"),
      bullet("ktorý zástupca bol u ktorého partnera"),
      bullet("kedy prebehol posledný kontakt"),
      bullet("či bola splnená frekvencia stanovená harmonogramom"),
      bullet("záznamy o každej návšteve (visit events)"),
      ...sp(1),

      h3("Aktuálny stav (produkcia)"),
      makeTable(
        ["Entita", "Počet"],
        [
          [["Nemocnice (hospitals)", "1 213"], [{}, { align: AlignmentType.RIGHT }]],
          [["Kliniky (clinics)", "10 078"], [{}, { align: AlignmentType.RIGHT }]],
          [["Spolupracovníci (collaborators)", "14 887"], [{}, { align: AlignmentType.RIGHT }]],
          [["Záznamy návštev (visit_events)", "29"], [{}, { align: AlignmentType.RIGHT, color: COLOR_ORANGE }]],
        ],
        [4000, 2000]
      ),
      note("29 visit_events naznačuje, že terénni zástupcovia systém ešte aktívne nevyužívajú — je to kľúčová oblasť na aktiváciu."),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Dokončenie MPN komunikačných harmonogramov", "3 týždne (Melichar a Seman) — SK a CZ spracované k dnešnému dňu"],
        ["Stredná", "Kliniky bez kontaktnej osoby — overiť a doplniť", "Seman"],
        ["Stredná", "First Contact Protocols pre nových partnerov", "Seman"],
        ["Nízka",   "Import nových nemocníc a kliník z externých zdrojov", "Melichar, Seman"],
      ]),
      zodp("Seman, Melichar"),
      ...sp(1),

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
      ...sp(1),
      makeTable(
        ["Status kampane", "Počet"],
        [
          [["active", "2"], [{}, { align: AlignmentType.RIGHT }]],
          [["paused ⚠️", "2"], [{ color: COLOR_ORANGE }, { align: AlignmentType.RIGHT, color: COLOR_ORANGE }]],
          [["draft", "1"], [{}, { align: AlignmentType.RIGHT }]],
        ],
        [3000, 1500]
      ),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Aktivácia/preverenie 2 pozastavených kampaní", "1 deň"],
        ["Vysoká", "Dokončenie 1 draft kampane", "detto"],
        ["Stredná", "Mailchimp sync konfigurácia pre aktívne kampane", "dokončené"],
        ["Stredná", "SOP články — rozšírenie (aktuálne len 25)", "dokončené"],
        ["Nízka",   "Automatické správy pri zmene stavu zmluvy/odberu", "Automatizácia, Seman"],
      ]),
      zodp("Seman"),
      ...sp(1),

      // ── 7. POUŽÍVATELIA ─────────────────────────────────────────────────
      h2("7. Používatelia & Oprávnenia (users)"),
      bullet("12 aktívnych používateľov"),
      bullet("Všetci 12 nemajú záznam v user_roles — používajú starý role stĺpec ⚠️", COLOR_ORANGE),
      bullet("role_module_permissions tabuľka je naplnená (RBAC je pripravený)"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Migrácia používateľov z role stĺpca na RBAC (user_roles)", "1 hod."],
        ["Vysoká", "Overenie assigned_countries per používateľ", "1 hod."],
        ["Stredná", "Nastavenie role_field_permissions pre citlivé polia", "2 hod. — Zadefinovanie zodpovednými osobami"],
        ["Nízka",   "Onboarding dokumentácia pre nových používateľov", "2 hod."],
      ]),
      zodp("Seman + osoby poverené podľa plánu"),
      ...sp(1),

      // ── 8. NEXUSPOINT ───────────────────────────────────────────────────
      h2("8. NexusPoint (SharePoint integrácia)"),
      bullet("MS365 integrácia aktívna"),
      bullet("Download fix nasadený (máj 2026) ✅ — streaming cez Graph API"),
      bullet("Cross-drive move fix nasadený (máj 2026) — čaká na produkčný test"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Test cross-drive move v produkcii", "1 hod."],
        ["Stredná", "Oprávnenia na úrovni priečinkov (per krajina/používateľ)", "1 hod."],
        ["Nízka",   "Tagy a poznámky k súborom — UI rozšírenie", "1 hod."],
      ]),
      zodp("Seman"),
      ...sp(1),

      // ── 9. CALL CENTER ──────────────────────────────────────────────────
      h2("9. Call Center & SIP Telefónia"),
      bullet("Asterisk ARI na 10.1.2.112:8088 — ECONNREFUSED ⚠️", COLOR_RED),
      bullet("SIP settings nakonfigurované, SIP extensions v DB"),
      bullet("Virtual agent configs prítomné (AI voice bot)"),
      bullet("call_logs: 1 087 záznamov"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Kritická", "Opraviť Asterisk ARI spojenie (mediagateway 10.1.2.112)", "1 hod."],
        ["Vysoká",   "Overenie SIP extensions a prihlásenia agentov", "1 hod."],
        ["Stredná",  "Virtual AI Agent — kalibrácia odpovedí per krajina", "4 hod."],
        ["Nízka",    "Nahrávky hovorov — archivácia a prístup cez UI", "dokončené"],
      ]),
      zodp("Seman"),
      ...sp(1),

      // ── 10. AI & LEAD INTELLIGENCE ──────────────────────────────────────
      h2("10. AI & Lead Intelligence"),
      bullet("Lead Intelligence V3 nakonfigurovaný (7 vrstiev)"),
      bullet("OpenAI GPT-4o integrácia aktívna"),
      bullet("Tabuľky: lead_entities, lead_scoring_criteria, lead_campaigns, lead_sources, contact_scores"),
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Spustenie lead search kampaní pre SK/RO", "5 hod."],
        ["Vysoká", "Kalibrácia scoring kritérií podľa výsledkov", "5 hod."],
        ["Stredná", "Feedback loop — naučenie z uzavretých leadov", "5 hod."],
        ["Nízka",   "Entity Knowledge Graph — vizualizácia vzťahov", "1 hod."],
      ]),
      zodp("Seman"),
      ...sp(1),

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
      ...sp(1),
      h3("Plán úprav"),
      planTable([
        ["Vysoká", "Aktivácia verejných formulárov pre SK/RO (marketing)", "1 hod."],
        ["Stredná", "Pipeline nastavenie pre predajný proces", "1 deň"],
        ["Nízka",   "Webhook konfigurácia pre externé CRM systémy", "Zatiaľ nie je potrebné"],
      ]),
      zodp("Seman, Melichar"),
      ...sp(1),

      // ── 12. INDEXUS CONNECT (MOBILNÁ APLIKÁCIA) ─────────────────────────
      h2("12. INDEXUS Connect — Mobilná aplikácia pre terénnych reprezentantov"),

      h3("Čo je INDEXUS Connect?", COLOR_DARK),
      infoBox(
        "INDEXUS Connect je mobilná Android aplikácia pre terénnych obchodných zástupcov. " +
        "Umožňuje im pracovať aj bez internetu, zaznamenávať návštevy u lekárov, " +
        "sledovať polohu GPS, volať cez VoIP a synchronizovať všetky dáta s centrálnym INDEXUS CRM.",
        "E9F7EF"
      ),
      ...sp(1),

      h3("Technické parametre"),
      makeTable(
        ["Parameter", "Hodnota"],
        [
          [["Platforma", "React Native (Expo) — Android APK"], [{}, {}]],
          [["Aktuálna verzia", "1.2.27 (build 42)"], [{}, { bold: true }]],
          [["Jazyk kódu", "TypeScript"], [{}, {}]],
          [["Lokálna databáza", "SQLite (expo-sqlite) — offline-first"], [{}, {}]],
          [["Navigácia", "Expo Router (file-based)"], [{}, {}]],
          [["APK na stiahnutie", "/data/mobil-app/indexus-connect-latest.apk"], [{}, { color: COLOR_BLUE }]],
        ],
        [3000, 5500]
      ),
      ...sp(1),

      h3("Funkcie aplikácie"),
      makeTable(
        ["Funkcia", "Popis", "Stav"],
        [
          [["GPS sledovanie", "Poloha zástupcu sa zaznamenáva každých 30s / 50m počas návštevy. Background tracking podporovaný.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Správa návštev", "Kalendár, zoznam, tvorba novej návštevy, poznámky (konkurencia, feedback lekára), hlasové záznamy.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Interaktívna mapa", "Mapa okolitých nemocníc farebne podľa stavu návštevy (Leaflet).", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["VoIP telefónia", "Vstavaný SIP telefón (SIP.js + WebRTC). Odchádzajúce/prichádzajúce hovory, mute, hold, DTMF, nahrávanie.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Offline + sync", "Všetky zmeny sa ukladajú lokálne a automaticky synchronizujú po obnovení internetu.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Reporty", "Vizuálne grafy — návštevy, pracovné hodiny, čas hovorov.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Hlasové záznamy", "Nahrávanie hlasových poznámok k návštevám.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
          [["Multi-jazyčnosť", "SK/CS/HU/RO/EN — vrátane medicínskej terminológie.", "✅ Hotové"], [{}, {}, { color: COLOR_GREEN }]],
        ],
        [2000, 4800, 1700]
      ),
      ...sp(1),

      h3("Kontrolné body (Checkpoints)"),
      makeTable(
        ["Check", "Výsledok"],
        [
          [["Verzia v app.json aktuálna", "1.2.27 / build 42 ✅"], [{}, { color: COLOR_GREEN }]],
          [["APK dostupné na stiahnutie", "✅ /data/mobil-app/indexus-connect-latest.apk"], [{}, { color: COLOR_GREEN }]],
          [["GPS tracking implementovaný", "✅ expo-location, background mode"], [{}, { color: COLOR_GREEN }]],
          [["Offline sync implementovaný", "✅ SQLite + sync_queue + netinfo"], [{}, { color: COLOR_GREEN }]],
          [["SIP/WebRTC telefónia", "✅ sip.js — závisí od Asterisk ARI (aktuálne down)"], [{}, { color: COLOR_ORANGE }]],
          [["Terénni zástupcovia aktívne používajú", "⚠️ visit_events = 29 (nízke číslo — treba aktiváciu)"], [{}, { color: COLOR_ORANGE }]],
          [["iOS verzia", "❌ Nie je — len Android APK"], [{}, { color: COLOR_RED }]],
        ],
        [4000, 4500]
      ),
      ...sp(1),

      h3("Plán úprav"),
      planTable([
        ["Kritická", "Aktivácia Asterisk ARI → sprístupnenie VoIP v mobile app", "Viazané na Asterisk fix (sekcia 9)"],
        ["Vysoká",   "Onboarding terénnych zástupcov — aktívne nasadenie aplikácie", "___"],
        ["Vysoká",   "Monitoring GPS track dát v CRM (visit_events)", "___"],
        ["Stredná",  "Push notifikácie pre nové úlohy a visitové plány", "___"],
        ["Nízka",    "iOS verzia (Expo — technicky možné, vyžaduje Apple Developer account)", "___"],
      ]),
      zodp("Seman"),
      ...sp(1),

      // ── 13. WEB PORTÁL — ROZŠÍRENIE ─────────────────────────────────────
      h2("13. Web Portál pre reprezentantov — Možnosť rozšírenia"),

      h3("Čo je to web portál pre reprezentantov?", COLOR_DARK),
      infoBox(
        "Okrem mobilnej aplikácie (INDEXUS Connect) existuje možnosť vytvoriť aj webovú verziu " +
        "pracovného prostredia pre terénnych zástupcov — prístupnú cez prehliadač na tablete alebo laptope. " +
        "Nešlo by o náhradu mobilnej aplikácie, ale o doplnkovú platformu pre iné situácie.",
        "F4ECF7"
      ),
      ...sp(1),

      h3("Varianty rozšírenia"),
      makeTable(
        ["Variant", "Popis", "Náročnosť"],
        [
          [
            ["PWA (Progressive Web App)",
             "Mobilná aplikácia sa sprístupní aj cez webový prehliadač — rovnaký kód, offline podpora, bez APK inštalácie.",
             "Stredná"],
            [{}, {}, {}]
          ],
          [
            ["Dedikovaný web modul v INDEXUS",
             "Nová sekcia v existujúcom INDEXUS CRM špeciálne pre terénnych zástupcov — zjednodušené UI, optimalizované pre tablet.",
             "Nízka"],
            [{}, {}, {}]
          ],
          [
            ["Plnohodnotný samostatný portál",
             "Samostatná webová aplikácia s vlastnou doménou, prihlásením a synchronizáciou s CRM.",
             "Vysoká"],
            [{}, {}, {}]
          ],
        ],
        [2200, 4800, 1500]
      ),
      ...sp(1),

      h3("Porovnanie: Mobilná aplikácia vs. Web portál"),
      makeTable(
        ["Vlastnosť", "INDEXUS Connect (mobile)", "Web portál"],
        [
          [["Offline práca",         "✅ Plná podpora (SQLite)",         "⚠️ Obmedzená (service worker)"], [{}, { color: COLOR_GREEN }, { color: COLOR_ORANGE }]],
          [["GPS tracking",          "✅ Presný (background mode)",      "⚠️ Len pri otvorenom tab"], [{}, { color: COLOR_GREEN }, { color: COLOR_ORANGE }]],
          [["VoIP telefónia",        "✅ WebRTC natívny",                "✅ WebRTC cez prehliadač"], [{}, { color: COLOR_GREEN }, { color: COLOR_GREEN }]],
          [["Push notifikácie",      "✅ Native push",                   "⚠️ Len web push (obmedzené)"], [{}, { color: COLOR_GREEN }, { color: COLOR_ORANGE }]],
          [["Inštalácia",            "APK (manuálna)",                   "Žiadna — otvoriť URL"], [{}, {}, { color: COLOR_GREEN }]],
          [["iOS podpora",           "❌ Nie",                           "✅ Áno (prehliadač)"], [{}, { color: COLOR_RED }, { color: COLOR_GREEN }]],
          [["Náklady na vývoj",      "Nulové (hotové)",                  "1–3 týždne (existujúci kód)"], [{}, { color: COLOR_GREEN }, {}]],
        ],
        [2500, 3000, 3000]
      ),
      ...sp(1),

      h3("Odporúčanie"),
      p("Najrýchlejšia cesta: Dedikovaný web modul v INDEXUS CRM — využíva existujúcu infraštruktúru, " +
        "prihlásenie a API. Vhodný pre zástupcov, ktorí preferujú tablet/laptop pred telefónom.", { bold: false }),
      ...sp(1),

      h3("Plán úprav"),
      planTable([
        ["Stredná", "Rozhodnutie: PWA alebo web modul v INDEXUS?", "___"],
        ["Stredná", "Prototyp web modulu pre terénnych zástupcov (tablet UI)", "1–2 týždne"],
        ["Nízka",   "iOS podpora cez PWA (bez Apple Developer account)", "___"],
        ["Nízka",   "Offline podpora pre web (service worker + IndexedDB)", "___"],
      ]),
      zodp("Seman"),
      ...sp(2),

      // ── CELKOVÝ PLÁN ────────────────────────────────────────────────────
      h2("Celkový plán — Prehľad"),
      makeTable(
        ["Modul", "Priorita", "Odh. čas", "Zodpovedná osoba", "Dátum dokončenia"],
        [
          [["Faktúry — aktivácia", "Kritická", "1 mesiac", "Seman – doplniť zodpovedné osoby", "___________"], [{}, { bold: true, color: COLOR_RED }, {}, {}, {}]],
          [["Asterisk ARI fix",    "Kritická", "1 hod.",   "Seman", "26.5.2026"], [{}, { bold: true, color: COLOR_RED }, {}, {}, {}]],
          [["RBAC migrácia",       "Vysoká",   "1 hod.",   "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Zmluvy pending review","Vysoká",  "1 hod.",   "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Poistovne import",    "Vysoká",   "Nie je potrebné", "___________", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Kampane aktivácia",   "Vysoká",   "2 hod.",   "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["NexusPoint move test","Vysoká",   "1 hod.",   "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Lead Intelligence",   "Vysoká",   "5 hod.",   "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["INDEXUS Connect nasadenie","Vysoká","___",    "Seman", "___________"], [{}, { bold: true, color: COLOR_ORANGE }, {}, {}, {}]],
          [["Collections — 89 bez zmluvy","Stredná","1 deň","Pavličko, Seman","___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["Web Forms aktivácia", "Stredná",  "2 hod.",   "Seman, Melichar", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["MPN harmonogramy",    "Stredná",  "3 týž.",   "Seman, Melichar", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["Web portál pre repr.","Stredná",  "___",      "___________", "___________"], [{}, { bold: true, color: COLOR_BLUE }, {}, {}, {}]],
          [["SOP rozšírenie",      "Nízka",    "dokončené","Seman", "___________"], [{}, { bold: true, color: COLOR_GRAY }, {}, {}, {}]],
        ],
        [2500, 1200, 1000, 2000, 1800]
      ),
      ...sp(2),

      // ── PRÍLOHA SQL ─────────────────────────────────────────────────────
      h2("Príloha — SQL Control Check Skript"),
      note("Spustenie: PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f /tmp/indexus_final.sql"),
      new Paragraph({
        children: [new TextRun({
          text: [
            "SELECT 'customers' AS modul, COUNT(*) AS pocet FROM customers",
            "UNION ALL SELECT 'contract_instances', COUNT(*) FROM contract_instances",
            "UNION ALL SELECT 'collections',        COUNT(*) FROM collections",
            "UNION ALL SELECT 'invoices',           COUNT(*) FROM invoices",
            "UNION ALL SELECT 'hospitals',          COUNT(*) FROM hospitals",
            "UNION ALL SELECT 'clinics',            COUNT(*) FROM clinics",
            "UNION ALL SELECT 'collaborators',      COUNT(*) FROM collaborators",
            "UNION ALL SELECT 'campaigns',          COUNT(*) FROM campaigns",
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
            "UNION ALL SELECT 'Collections bez contract_id', COUNT(*) FROM collections WHERE contract_id IS NULL",
            "UNION ALL SELECT 'Tasks po termine (open)', COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'done'",
            "UNION ALL SELECT 'Users bez roly', COUNT(*) FROM users u",
            "  LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE ur.role_id IS NULL AND u.is_active=true",
            "ORDER BY pocet DESC;",
            "",
            "-- Collection statuses dekodovanie",
            "SELECT id, name FROM collection_statuses ORDER BY sort_order;",
          ].join("\n"),
          font: "Courier New", size: 16, color: "1A1A2E",
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
