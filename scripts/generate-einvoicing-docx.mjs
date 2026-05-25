import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip, PageBreak
} from "docx";
import fs from "fs";

const C = {
  red:    "C0392B", orange: "D35400", green:  "1E8449",
  blue:   "1A5276", gray:   "626567", dark:   "1C2833",
  purple: "6C3483", teal:   "117A65",
  header: "1C2833", white:  "FFFFFF",
  bgRed:  "FDEDEC", bgOrange:"FEF5E7", bgGreen:"EAFAF1",
  bgBlue: "EBF5FB", bgGray: "F2F3F4", bgPurple:"F5EEF8",
};
const FONT = "Calibri";

// ── helpers ───────────────────────────────────────────────────────────────────
const tr = (text, opts={}) => new TextRun({ text: String(text??''), font: FONT, size: 20, color: C.dark, ...opts });
const sp = (n=1) => Array.from({length:n},()=>new Paragraph({children:[tr('')],spacing:{before:0,after:0}}));

function h1(text) {
  return new Paragraph({
    children:[tr(text,{bold:true,size:32,color:C.dark})],
    spacing:{before:500,after:200},
    border:{bottom:{style:BorderStyle.DOUBLE,size:2,color:C.blue}},
  });
}
function h2(text, color=C.dark) {
  return new Paragraph({
    children:[tr(text,{bold:true,size:26,color})],
    spacing:{before:360,after:120},
    border:{bottom:{style:BorderStyle.SINGLE,size:1,color:"BBBBBB"}},
  });
}
function h3(text,color=C.blue) {
  return new Paragraph({
    children:[tr(text,{bold:true,size:22,color})],
    spacing:{before:220,after:80},
  });
}
function p(text,opts={}) {
  return new Paragraph({
    children:[tr(text,opts)],
    spacing:{before:40,after:40},
  });
}
function note(text,color=C.gray) {
  return new Paragraph({
    children:[tr(`ℹ  ${text}`,{size:18,color,italics:true})],
    spacing:{before:40,after:80},
  });
}
function bullet(text,color=C.dark,bold=false) {
  return new Paragraph({
    children:[tr(text,{color,bold})],
    bullet:{level:0},
    spacing:{before:20,after:20},
  });
}
function colorBox(text,fill,textColor=C.dark,bold=false) {
  return new Paragraph({
    children:[tr(text,{bold,color:textColor,size:20})],
    shading:{type:ShadingType.SOLID,fill},
    spacing:{before:80,after:80},
    indent:{left:100,right:100},
  });
}
function alertBox(label,text,fill,labelColor) {
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[
      new TableCell({
        children:[new Paragraph({children:[tr(label,{bold:true,size:20,color:labelColor})],spacing:{before:40,after:0}})],
        shading:{type:ShadingType.SOLID,fill},
        margins:{top:80,bottom:80,left:120,right:60},
        width:{size:1200,type:WidthType.DXA},
      }),
      new TableCell({
        children:[new Paragraph({children:[tr(text,{size:20,color:C.dark})],spacing:{before:40,after:40}})],
        shading:{type:ShadingType.SOLID,fill},
        margins:{top:80,bottom:80,left:60,right:120},
      }),
    ]})]
  });
}

function mkTable(headers, rows, widths) {
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    layout:TableLayoutType.FIXED,
    rows:[
      new TableRow({
        tableHeader:true,
        children:headers.map((h,i)=>new TableCell({
          children:[new Paragraph({
            children:[tr(h,{bold:true,color:C.white,size:18})],
            alignment:AlignmentType.CENTER,spacing:{before:50,after:50},
          })],
          shading:{type:ShadingType.SOLID,fill:C.header},
          margins:{top:60,bottom:60,left:100,right:100},
          width:widths?.[i]?{size:widths[i],type:WidthType.DXA}:undefined,
        })),
      }),
      ...rows.map(r=>new TableRow({
        children:r[0].map((c,i)=>{
          const o=r[1]?.[i]||{};
          const altBg = r[2] ? C.bgGray : undefined;
          return new TableCell({
            children:[new Paragraph({
              children:[tr(c,{size:18,...o})],
              alignment:o.align||AlignmentType.LEFT,
              spacing:{before:50,after:50},
            })],
            shading:(o.bg||altBg)?{type:ShadingType.SOLID,fill:o.bg||altBg}:undefined,
            margins:{top:60,bottom:60,left:100,right:100},
            width:widths?.[i]?{size:widths[i],type:WidthType.DXA}:undefined,
          });
        }),
      })),
    ],
  });
}

function statusBadge(status) {
  if (status.includes('POVINNÉ') || status.includes('MANDATORY') || status.includes('AKTÍVNE')) return {color:C.red,bold:true};
  if (status.includes('DOBROVOĽNÉ') || status.includes('VOLUNTARY') || status.includes('QR'))    return {color:C.orange,bold:true};
  if (status.includes('PLÁNOVANÉ') || status.includes('2027') || status.includes('2028'))         return {color:C.blue,bold:true};
  if (status.includes('NIE') || status.includes('ŽIADNA'))  return {color:C.green,bold:false};
  return {color:C.gray};
}

// ─────────────────────────────────────────────────────────────────────────────

const doc = new Document({
  creator:"INDEXUS CRM",
  title:"e-Invoicing — Prehľad požiadaviek SK, CH, RO, CZ, HU",
  sections:[{
    properties:{page:{margin:{
      top:convertInchesToTwip(1), bottom:convertInchesToTwip(1),
      left:convertInchesToTwip(1.1), right:convertInchesToTwip(1.1),
    }}},
    children:[

      // ── TITULNÁ STRANA ────────────────────────────────────────────────────
      new Paragraph({
        children:[tr("e-Invoicing",{bold:true,size:64,color:C.blue})],
        alignment:AlignmentType.CENTER, spacing:{before:1200,after:100},
      }),
      new Paragraph({
        children:[tr("Elektronická fakturácia — Analýza požiadaviek",{size:30,color:C.gray})],
        alignment:AlignmentType.CENTER, spacing:{before:0,after:120},
      }),
      new Paragraph({
        children:[tr("CBC AG · SK · RO · CZ · HU",{size:24,color:C.dark,bold:true})],
        alignment:AlignmentType.CENTER, spacing:{before:0,after:400},
      }),
      new Paragraph({
        children:[tr("Máj 2026  ·  Pripravil: INDEXUS CRM",{size:20,color:C.gray})],
        alignment:AlignmentType.CENTER, spacing:{before:0,after:2000},
      }),
      alertBox("⚠️  KRITICKÉ", "Rumunsko (RO) — e-fakturácia je POVINNÁ od 1. júla 2024. Ak sa fakturuje v Rumunsku, treba okamžitú akciu.", C.bgRed, C.red),
      ...sp(1),
      alertBox("✅  OK", "Švajčiarsko (CBC AG matka) — žiadna povinná B2B e-fakturácia. Len QR-bill na platobnom doklade.", C.bgGreen, C.green),
      ...sp(2),

      // ── SÚHRNNÁ TABUĽKA ───────────────────────────────────────────────────
      h1("Súhrnný prehľad — všetky krajiny"),
      mkTable(
        ["Krajina","Fakturujúca entita","Status e-fakturácie","Povinné od","Platforma / Sieť","Urgentnosť"],
        [
          [
            ["🇨🇭 Švajčiarsko","CBC AG (materská)","ŽIADNA povinnosť B2B","—","QR-bill (platby)","🟢 Nízka"],
            [{bold:true},{},{color:C.green,bold:true},{align:AlignmentType.CENTER},{},{color:C.green,bold:true,align:AlignmentType.CENTER}],
          ],
          [
            ["🇸🇰 Slovensko","CBC SK / lokálna","DOBROVOĽNÉ → POVINNÉ","1. jan 2027","Peppol / Digitálny poštár","🟡 Pripraviť v 2026"],
            [{bold:true},{},{color:C.orange,bold:true},{align:AlignmentType.CENTER},{},{color:C.orange,bold:true,align:AlignmentType.CENTER}],
          ],
          [
            ["🇷🇴 Rumunsko","CBC RO / lokálna","POVINNÉ (B2B clearance)","1. júl 2024","RO e-Factura (ANAF)","🔴 OKAMŽITÁ AKCIA"],
            [{bold:true},{},{color:C.red,bold:true},{align:AlignmentType.CENTER},{},{color:C.red,bold:true,align:AlignmentType.CENTER}],
          ],
          [
            ["🇨🇿 Česko","CBC CZ / lokálna","ŽIADNA povinnosť B2B","—","Dobrovoľné (UBL/ISDOC)","🟢 Nízka"],
            [{bold:true},{},{color:C.green,bold:true},{align:AlignmentType.CENTER},{},{color:C.green,bold:true,align:AlignmentType.CENTER}],
          ],
          [
            ["🇭🇺 Maďarsko","CBC HU / lokálna","RTIR povinné (reporting)","1. júl 2018","NAV Online Számla","🟡 Overiť súlad"],
            [{bold:true},{},{color:C.orange,bold:true},{align:AlignmentType.CENTER},{},{color:C.orange,bold:true,align:AlignmentType.CENTER}],
          ],
        ],
        [1200,1800,2200,1300,2200,1800]
      ),
      ...sp(2),

      // ── ČASOVÁ OS ─────────────────────────────────────────────────────────
      h1("Časová os — kedy čo treba urobiť"),
      mkTable(
        ["Dátum","Krajina","Udalosť","Akcia pre INDEXUS"],
        [
          [["Júl 2024","🇷🇴 RO","B2B clearance POVINNÉ — platí ŽUŽ","Overiť či máme RO e-Factura napojenie!"],
           [{bold:true,color:C.red},{},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["Jan 2025","🇷🇴 RO","B2C e-reporting povinné","Rozšíriť RO napojenie na B2C"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["Nov 2025","🇨🇭 CH","QR-bill v2.3 — štruktúrované adresy povinné","Aktualizovať formát adries na QR-bill"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["Jan 2026","🇸🇰 SK","Dobrovoľná testovacia fáza — START","Začať prípravu Peppol napojenia"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Sep 2026","🇨🇭 CH","QR-bill v2.3 — deadline na štrukt. adresy","Dokončiť konverziu adries"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["Q3 2026","🇸🇰 SK","FA Corner 5 (C5) reporting infraštr. live","Test reporting do FA"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Dec 2026","🇸🇰 SK","Deadline pre testovanie — koniec vol. fázy","Finalizovať Peppol integráciu"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["Jan 2027","🇸🇰 SK","POVINNÁ B2B e-fakturácia","Go-live Peppol pre SK"],
           [{bold:true,color:C.red},{},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["2028","🇭🇺 HU","Plánovaná povinná B2B e-fakturácia (ViDA)","Sledovať vývoj NAV"],
           [{bold:true,color:C.gray},{},{},{}]],
          [["Júl 2030","Všetky krajiny EÚ","Cezhraničná B2B e-fakturácia (ViDA)","EU-wide Peppol"],
           [{bold:true,color:C.gray},{},{},{}]],
        ],
        [1000,900,3000,3600]
      ),
      ...sp(2),

      // ── STRANA: SK ────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇸🇰 Slovensko — Detailná analýza"),

      h2("Stav a legislatíva"),
      bullet("Zákon č. 385/2025 Z.z. — platný od 1. januára 2026"),
      bullet("Povinná B2B e-fakturácia od 1. januára 2027"),
      bullet("Dobrovoľná testovacia fáza: celý rok 2026"),
      bullet("Peppol 5-rohový model — faktúra prechádza cez Digitálnych poštárov"),
      bullet("Oznamovanie do Finančnej správy (Corner 5) do 15 dní od vystavenia"),
      ...sp(1),

      h2("Formát faktúry"),
      mkTable(
        ["Požiadavka","Detail"],
        [
          [["Formát","UBL 2.1 XML alebo CII (Cross-Industry Invoice)"],[{bold:true},{}]],
          [["Štandard","EN 16931 (európsky štandard pre e-faktúry)"],[{bold:true},{}]],
          [["PDF faktúra emailom","❌ NEPRIJATEĽNÉ od 2027 — len štruktúrované XML"],[{bold:true},{color:C.red}]],
          [["Peppol ID","0245:[DIČ] — napr. 0245:1234567890"],[{bold:true},{color:C.blue}]],
          [["Sieť","Peppol (cez certifikovaného Digitálneho poštára)"],[{bold:true},{}]],
          [["Opravný doklad","Credit note + nová faktúra (štandard Peppol BIS 3.0)"],[{bold:true},{}]],
          [["Archivácia","Minimálne 5 rokov"],[{bold:true},{}]],
          [["Reporting","Do 15 dní od vystavenia/prijatia — automaticky cez AP"],[{bold:true},{}]],
        ],
        [3000,5500]
      ),
      ...sp(1),

      h2("Certifikovaní Digitálni poštári (Peppol Access Points) — SK"),
      colorBox(
        "Finančná správa SR publikovala zoznam certifikovaných poskytovateľov 11. marca 2026. " +
        "Zoznam je priebežne aktualizovaný na financnasprava.sk",
        C.bgBlue, C.blue
      ),
      ...sp(1),
      mkTable(
        ["Poskytovateľ","Status (máj 2026)","Poznámka","Kontakt / Web"],
        [
          [["Asseco QASIDA","✅ CERTIFIKOVANÝ","Slovenský provider, splnil technické požiadavky Peppol Authority","asseco-peppol.com"],
           [{bold:true},{color:C.green,bold:true},{},{}]],
          [["mySupply (mySupply ApS)","🔄 V procese certifikácie","Dánsky provider aktívny na SK trhu","mysupply.dk"],
           [{bold:true},{color:C.orange,bold:true},{},{}]],
          [["Ďalší poskytovatelia","🔄 V procese akreditácie","Zoznam sa priebežne aktualizuje na financnasprava.sk","financnasprava.sk"],
           [{bold:true},{color:C.orange,bold:true},{},{}]],
        ],
        [2200,1800,2500,2000]
      ),
      note("Aktuálny certifikovaný zoznam (PDF): financnasprava.sk → e-Faktura → Zoznam certifikovaných poskytovateľov"),
      ...sp(1),

      h2("Kroky implementácie pre SK"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","Vybrať certifikovaného Digitálneho poštára (odporúčame Asseco QASIDA)","Q2 2026","Seman"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["2","Zaregistrovať Peppol ID pre CBC SK: 0245:[DIČ CBC SK]","Q2 2026","Seman + účtovník"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["3","Implementovať generovanie UBL 2.1 XML faktúry v INDEXUS","Q2–Q3 2026","IT (INDEXUS dev)"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["4","Napojenie INDEXUS na API Digitálneho poštára (odoslanie + príjem)","Q3 2026","IT"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["5","Implementovať Corner 5 reporting (keď FA spustí C5 infraštruktúru)","Q3 2026","IT"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["6","Testovanie v dobrovoľnej fáze — odosielanie testovacích faktúr cez Peppol","Q3–Q4 2026","IT + Seman"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["7","Go-live — všetky SK faktúry cez Peppol","1. jan 2027","Seman"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── STRANA: CH ────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇨🇭 Švajčiarsko (CBC AG) — Detailná analýza"),

      alertBox("✅  Dobrá správa", "Pre B2B fakturáciu medzi firmami v Švajčiarsku NEEXISTUJE žiadna povinnosť e-fakturácie. CBC AG môže vystavovať faktúry aj ako PDF, aj ako UBL XML — žiadna zákonná požiadavka.", C.bgGreen, C.green),
      ...sp(1),

      h2("Čo je povinné v CH"),
      mkTable(
        ["Segment","Status","Odkedy","Podmienka"],
        [
          [["B2G (dodávky štátu)","✅ Povinné","Od 2016","Zmluvy nad CHF 5 000"],
           [{},{color:C.red,bold:true},{},{}]],
          [["B2B (firma → firma)","✅ Dobrovoľné","—","Žiadna zákonná povinnosť"],
           [{},{color:C.green,bold:true},{},{}]],
          [["B2C (firma → spotrebiteľ)","✅ Dobrovoľné","—","Žiadna zákonná povinnosť"],
           [{},{color:C.green,bold:true},{},{}]],
        ],
        [1800,1600,1600,3500]
      ),
      ...sp(1),

      h2("QR-bill — povinná súčasť každej švajčiarskej faktúry s platbou"),
      colorBox(
        "QR-bill je štandardizovaný platobný doklad s QR kódom. Od 1. októbra 2022 nahradil " +
        "všetky staré platobné poukážky (BVR/ESR) a je povinný na každej faktúre so žiadosťou o platbu v CHF alebo EUR.",
        C.bgOrange, C.dark
      ),
      ...sp(1),
      h3("Aktuálne požiadavky (QR-bill v2.3 — od 22. novembra 2025)"),
      bullet("Adresa musí byť štruktúrovaná — ulica, číslo, PSČ, mesto, krajina — SEPARATE polia"),
      bullet("Voľný text adresy (combined address) sa od novembra 2025 NEAKCEPTUJE"),
      bullet("Deadline na dokončenie konverzie: 30. september 2026"),
      bullet("QR-bill obsahuje 42 štandardizovaných polí: príjemca, platca, suma, mena, referencia"),
      ...sp(1),
      mkTable(
        ["Požiadavka","Stav pre INDEXUS","Priorita"],
        [
          [["QR-bill generovanie","Overit či INDEXUS generuje QR-bill pre CH faktúry","Vysoká"],
           [{bold:true},{color:C.orange},{}]],
          [["Štruktúrované adresy (v2.3)","Adresy musia byť rozdelené do polí — nie jeden text riadok","Vysoká — deadline sep 2026"],
           [{bold:true},{color:C.red},{}]],
          [["eBill platforma (voliteľné)","PostFinance eBill — elektronická faktúra priamo do banky zákazníka","Nízka — dobrovoľné"],
           [{bold:true},{color:C.green},{}]],
        ],
        [2500,4000,2000]
      ),
      ...sp(1),

      h2("Kroky implementácie pre CH (CBC AG)"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","Overiť generovanie QR-bill v INDEXUS pre CH faktúry","Ihneď","IT"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["2","Implementovať štruktúrované adresy (QR-bill v2.3) — deadline sep 2026","Do sep 2026","IT"],
           [{bold:true,color:C.orange},{color:C.orange,bold:true},{color:C.orange,bold:true},{}]],
          [["3","Definovať IBAN CBC AG pre QR kód","Ihneď","Účtovník CBC AG"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["4","Voliteľne: napojenie na eBill (PostFinance) pre komfort zákazníkov","2026–2027","IT"],
           [{bold:true,color:C.gray},{},{}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── STRANA: RO ────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇷🇴 Rumunsko — POVINNÉ UŽ OD 2024 🔴"),

      alertBox("🔴  KRITICKÉ", "Rumunsko zaviedlo povinnú B2B e-fakturáciu (clearance model) od 1. júla 2024. Ak CBC fakturuje v Rumunsku a nemá napojenie na RO e-Factura (ANAF), ide o PORUŠENIE ZÁKONA s pokutami.", C.bgRed, C.red),
      ...sp(1),

      h2("Stav a legislatíva"),
      bullet("Zákon 296/2023 — B2B e-fakturácia povinná od 1. januára 2024 (reporting)"),
      bullet("Od 1. júla 2024 — clearance model: faktúra musí byť SCHVÁLENÁ ANAF pred odoslaním zákazníkovi"),
      bullet("B2C e-reporting povinný od 1. januára 2025"),
      bullet("SAF-T (D406) — povinný reporting pre všetky veľké a stredné firmy"),
      bullet("Rumunský VIES číslo a DIČ povinné na každej faktúre"),
      ...sp(1),

      h2("Ako funguje clearance model (RO špecifické)"),
      colorBox(
        "CLEARANCE MODEL = faktúra sa NAJPRV nahrá do ANAF systému (RO e-Factura), ANAF ju overí a vydá " +
        "elektronický podpis / potvrdenie. Až POTOM môže byť faktúra odoslaná zákazníkovi. " +
        "Faktúra bez ANAF potvrdenia je NEPLATNÁ.",
        C.bgRed, C.dark
      ),
      ...sp(1),
      mkTable(
        ["Požiadavka","Detail"],
        [
          [["Platforma","RO e-Factura (ANAF) — anaf.ro"],[{bold:true},{}]],
          [["Formát","UBL 2.1 XML (RO_CIUS — rumunský profil)"],[{bold:true},{}]],
          [["Postup","1. Generuj XML → 2. Nahraj na ANAF → 3. ANAF potvrdí → 4. Odošli zákazníkovi"],[{bold:true},{}]],
          [["Reporting B2B","Do 5 pracovných dní od vystavenia faktúry"],[{bold:true},{}]],
          [["Reporting B2C","Povinný od jan 2025 — do 5 dní"],[{bold:true},{}]],
          [["SAF-T","Mesačný / štvrťročný reporting všetkých DPH transakcií"],[{bold:true},{}]],
          [["PDF faktúra","❌ Neplatná bez ANAF potvrdenia"],[{bold:true},{color:C.red}]],
          [["Pokuty","Za každú nenahlásená faktúru — progresívne pokuty"],[{bold:true},{color:C.red}]],
        ],
        [2500,6000]
      ),
      ...sp(1),

      h2("Kroky implementácie pre RO — URGENTNÉ"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","OVERIŤ: fakturuje CBC v RO? Ak áno — je to v súlade s ANAF od júla 2024?","IHNEĎ","Seman + RO účtovník"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["2","Registrácia na ANAF portáli — získať prístup k RO e-Factura API","IHNEĎ","RO účtovník / právnik"],
           [{bold:true,color:C.red},{},{},{}]],
          [["3","Implementovať UBL 2.1 XML generovanie pre RO (RO_CIUS profil) v INDEXUS","Q2–Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["4","Napojenie INDEXUS na ANAF API (upload → potvrdenie → odoslanie)","Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["5","Implementovať SAF-T reporting pre RO (ak applicable)","Q3 2026","IT + RO účtovník"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["6","Testovanie na ANAF sandbox prostredí","Q3 2026","IT"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["7","Go-live — všetky RO faktúry cez ANAF clearance","Čo najskôr","Seman"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── STRANA: CZ + HU ───────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇨🇿 Česko & 🇭🇺 Maďarsko"),

      h2("🇨🇿 Česká republika — Žiadna povinnosť B2B"),
      alertBox("✅  Bez mandátu", "Česká republika nemá žiadnu povinnosť B2B e-fakturácie. Faktúra môže byť PDF aj XML — záleží na dohode medzi firmami. ViDA (2030) to zmení.", C.bgGreen, C.green),
      ...sp(1),
      mkTable(
        ["Požiadavka","Status","Detail"],
        [
          [["B2B e-fakturácia","✅ Dobrovoľné","Žiadna zákonná povinnosť — ani plánovaná pre CZ"],
           [{bold:true},{color:C.green,bold:true},{}]],
          [["B2G faktúry","Čiastočne povinné","Verejné inštitúcie musia PRIJÍMAŤ EN 16931 XML — ale vy nemusíte POSIELAŤ"],
           [{bold:true},{color:C.orange},{}]],
          [["Podporované formáty","ISDOC, UBL 2.1, Peppol BIS 3.0","ISDOC je národný česky formát"],
           [{bold:true},{},{}]],
          [["Kontrolný výkaz DPH","⚠️ Povinné (elektronicky)","Mesačný / štvrťročný XML výkaz cez portál FS ČR — NIE faktúry, len súhrn"],
           [{bold:true},{color:C.orange},{}]],
          [["Archivácia","10 rokov","Dlhšie ako SK (5 rokov) alebo EU štandard"],
           [{bold:true},{color:C.orange},{}]],
          [["ViDA / povinnosť","Plánované ~2028–2030","Sledovať legislatívny vývoj"],
           [{bold:true},{color:C.gray},{}]],
        ],
        [2500,1800,4200]
      ),
      ...sp(1),
      h3("Kroky pre CZ"),
      bullet("Zatiaľ žiadna akcia potrebná pre e-fakturáciu"),
      bullet("Overiť: podáva CBC CZ kontrolný výkaz DPH elektronicky? (povinné od 2016)"),
      bullet("Sledovať ViDA implementáciu — pravdepodobne 2028–2030"),
      bullet("Odporučiť: začať vystavovať XML faktúry dobrovoľne (ISDOC / UBL) pre väčších zákazníkov"),
      ...sp(2),

      h2("🇭🇺 Maďarsko — RTIR (Real-Time Invoice Reporting)"),
      alertBox("🟡  Pozor — RTIR je povinné", "Maďarsko nežiada e-faktúry (nie clearance model), ale KAŽDÁ faktúra musí byť do 24 hodín nahlásená Finančnej správe (NAV) v XML v3.0 — Online Számla systém. Platí aj pre zahraničné firmy registrované na DPH v HU.", C.bgOrange, C.orange),
      ...sp(1),
      mkTable(
        ["Požiadavka","Status","Detail"],
        [
          [["RTIR (Online Számla)","🔴 POVINNÉ od 2018","Všetky B2B, B2C, export faktúry — reporting do NAV do 24 hodín"],
           [{bold:true},{color:C.red,bold:true},{}]],
          [["Formát reportingu","XML v3.0 (NAV XSD)","XML v2.0 zrušené od mája 2025 — len v3.0"],
           [{bold:true},{color:C.red,bold:true},{color:C.red}]],
          [["Platforma","NAV Online Invoicing (onlineszamla.nav.gov.hu)","Webový portál + API"],
           [{bold:true},{},{}]],
          [["B2B e-fakturácia (clearance)","Dobrovoľné (B2B)","Nie clearance model — len reporting"],
           [{bold:true},{color:C.green},{}]],
          [["Energetický sektor","Povinná e-fakturácia od júl 2025","Len pre elektrina a plyn"],
           [{bold:true},{color:C.orange},{}]],
          [["ViDA / plné B2B","Plánované 2028","Phased roll-out"],
           [{bold:true},{color:C.gray},{}]],
          [["Platí pre zahraničné firmy?","ÁNO — ak má HU DPH číslo","Non-resident VAT-registered entity musí reportovať"],
           [{bold:true},{color:C.red,bold:true},{}]],
        ],
        [2500,1800,4200]
      ),
      ...sp(1),
      h3("Kroky pre HU"),
      bullet("OVERIŤ: je CBC HU (alebo CBC AG s HU DPH číslom) registrovaná na NAV Online Számla?", C.red, true),
      bullet("Skontrolovať: používa sa XML v3.0 (nie zastaraný v2.0 — zakázaný od mája 2025)"),
      bullet("Implementovať RTIR reporting v INDEXUS pre HU faktúry (ak ešte nie je)"),
      bullet("Sledovať ViDA implementáciu — plné B2B ~2028"),
      ...sp(2),

      // ── IMPLEMENTAČNÝ PLÁN ────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Implementačný plán pre INDEXUS — Reálny harmonogram"),

      colorBox(
        "Postup od najurgentnejšieho po najmenej urgentné. " +
        "Priorita 1 = okamžitá akcia, Priorita 4 = sledovať do 2030.",
        C.bgBlue, C.blue
      ),
      ...sp(1),

      h2("Priorita 1 — IHNEĎ (Q2 2026)"),
      mkTable(
        ["Krajina","Úloha","Kto","Poznámka"],
        [
          [["🇷🇴 RO","Overiť súlad s ANAF — fakturujeme v RO? Je to reportované?","Seman + RO účtovník","POVINNÉ od júla 2024 — ak nie, hrozí pokuta"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{},{}]],
          [["🇭🇺 HU","Overiť registráciu na NAV Online Számla a XML v3.0","Seman + HU účtovník","RTIR povinné od 2018"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{},{}]],
          [["🇨🇭 CH","Overiť QR-bill generovanie a aktualizácia na v2.3 (štrukt. adresy)","IT","Deadline sep 2026"],
           [{bold:true,color:C.orange},{color:C.orange},{},{}]],
        ],
        [900,3800,1800,2500]
      ),
      ...sp(1),

      h2("Priorita 2 — Q2–Q3 2026 (príprava SK + opravy RO/HU)"),
      mkTable(
        ["Krajina","Úloha","Kto","Odhad čas"],
        [
          [["🇸🇰 SK","Vybrať certifikovaného Digitálneho poštára (odp. Asseco QASIDA)","Seman","1 deň — rozhodnutie"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["🇸🇰 SK","Registrovať Peppol ID pre CBC SK","Seman + účtovník","1–3 dni"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["🇷🇴 RO","Implementovať UBL XML generovanie pre RO (RO_CIUS profil)","IT","1–2 týždne"],
           [{bold:true,color:C.red},{},{},{}]],
          [["🇷🇴 RO","Napojenie na ANAF API (upload + potvrdenie)","IT","1–2 týždne"],
           [{bold:true,color:C.red},{},{},{}]],
          [["🇭🇺 HU","Implementovať NAV RTIR reporting v INDEXUS (XML v3.0)","IT","1 týždeň"],
           [{bold:true,color:C.orange},{},{},{}]],
        ],
        [900,3800,1800,2500]
      ),
      ...sp(1),

      h2("Priorita 3 — Q3–Q4 2026 (SK testovanie + dokončenie)"),
      mkTable(
        ["Krajina","Úloha","Kto","Odhad čas"],
        [
          [["🇸🇰 SK","Implementovať UBL 2.1 XML generátor pre SK faktúry","IT","1–2 týždne"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["🇸🇰 SK","Napojenie na API Digitálneho poštára (Asseco QASIDA)","IT","1 týždeň"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["🇸🇰 SK","Corner 5 testing (keď FA spustí C5 infraštruktúru)","IT","závisí od FA"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["🇸🇰 SK","Live testovanie SK faktúr cez Peppol sieť","IT + Seman","2–4 týždne"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Všetky","Archivácia e-faktúr — min. 5 rokov (SK), 10 rokov (CZ)","IT","1 deň — nastavenie"],
           [{bold:true},{},{},{}]],
        ],
        [900,3800,1800,2500]
      ),
      ...sp(1),

      h2("Priorita 4 — 2027–2030 (sledovať)"),
      mkTable(
        ["Krajina","Udalosť","Kedy"],
        [
          [["🇸🇰 SK","Go-live povinnej Peppol e-fakturácie","1. jan 2027"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.red}]],
          [["🇨🇿 CZ","ViDA implementácia — pravdepodobne povinné B2B","~2028–2030"],
           [{bold:true},{},{}]],
          [["🇭🇺 HU","Povinná B2B e-fakturácia (ViDA-aligned)","~2028"],
           [{bold:true},{},{}]],
          [["Všetky EÚ","Cezhraničná B2B e-fakturácia (ViDA)","1. júl 2030"],
           [{bold:true},{},{}]],
        ],
        [900,5400,2200]
      ),
      ...sp(2),

      // ── TECHNICKÉ POŽIADAVKY NA INDEXUS ───────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Čo treba implementovať v INDEXUS — Technický prehľad"),

      mkTable(
        ["Komponenta","Popis","Krajiny","Odhad"],
        [
          [["UBL 2.1 XML generátor","Generovanie faktúry v štandardnom XML formáte z existujúcich dát v INDEXUS","SK, RO, (CZ, HU)","2–3 týž."],
           [{bold:true},{},{},{}]],
          [["RO_CIUS profil","Rumunský národný profil UBL — špecifické polia ANAF (CIF, CNP, VAT kódy)","RO","2–3 dní navyše"],
           [{bold:true},{},{},{}]],
          [["ANAF API klient","Upload XML na ANAF → čakaj na potvrdenie → stiahni podpísaný XML","RO","1 týž."],
           [{bold:true},{},{},{}]],
          [["Peppol AP klient","API klient pre Digitálneho poštára (Asseco QASIDA alebo iný)","SK","1 týž."],
           [{bold:true},{},{},{}]],
          [["NAV RTIR klient","Reporting XML v3.0 do NAV Online Számla API (do 24 hod.)","HU","1 týž."],
           [{bold:true},{},{},{}]],
          [["QR-bill generátor","Platobný QR kód podľa Swiss QR-bill štandardu (CHF/EUR, strukt. adresy)","CH","3–5 dní"],
           [{bold:true},{},{},{}]],
          [["Archivačný modul","Ukladanie podpísaných XML faktúr + auditný log odoslania/potvrdenia","Všetky","1–2 dní"],
           [{bold:true},{},{},{}]],
          [["ESO dátový export","Export faktúr z INDEXUS do formátu pre ESO ekonomický systém","SK, CH...","závisí od ESO API"],
           [{bold:true},{},{},{}]],
          [["CELKOVÝ ODHAD","","Všetky krajiny","8–12 týždňov"],
           [{bold:true},{},{},{bold:true,color:C.blue}]],
        ],
        [2200,3500,1500,1300]
      ),
      ...sp(1),

      note("UBL 2.1 XML generátor je spoločný základ pre SK, RO aj CZ — oplatí sa implementovať raz a prispôsobiť per krajina (profilom)."),
      note("Doporučený postup: RO najprv (urgentné) → HU RTIR → SK Peppol → CH QR-bill."),
      ...sp(2),

      // ── ZDROJE ───────────────────────────────────────────────────────────
      h1("Kľúčové zdroje & kontakty"),
      mkTable(
        ["Krajina","Zdroj","URL"],
        [
          [["🇸🇰 SK","Finančná správa SR — e-Faktura","financnasprava.sk → e-Faktura"],
           [{bold:true},{},{}]],
          [["🇸🇰 SK","Asseco QASIDA — certifikovaný AP","asseco-peppol.com"],
           [{bold:true},{},{}]],
          [["🇸🇰 SK","Peppol BIS 3.0 špecifikácia","docs.peppol.eu/poacc/billing/3.0/"],
           [{bold:true},{},{}]],
          [["🇸🇰 SK","EN 16931 štandard","ec.europa.eu/digital-building-blocks"],
           [{bold:true},{},{}]],
          [["🇷🇴 RO","ANAF e-Factura portál","efactura.mfinante.gov.ro"],
           [{bold:true},{},{}]],
          [["🇷🇴 RO","ANAF API dokumentácia","mfinante.gov.ro → API e-Factura"],
           [{bold:true},{},{}]],
          [["🇭🇺 HU","NAV Online Számla","onlineszamla.nav.gov.hu"],
           [{bold:true},{},{}]],
          [["🇭🇺 HU","NAV API dokumentácia (XML v3.0)","onlineszamla.nav.gov.hu/api"],
           [{bold:true},{},{}]],
          [["🇨🇭 CH","SIX QR-bill štandard","www.six-group.com/en/products-services/banking-services/standardization/qr-bill.html"],
           [{bold:true},{},{}]],
          [["EÚ","ViDA direktíva (2025/516)","ec.europa.eu/taxation_customs/vat/digital-age"],
           [{bold:true},{},{}]],
        ],
        [900,2500,5100]
      ),

    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("einvoicing_analysis.docx", buffer);
console.log("✅ einvoicing_analysis.docx vygenerovaný");
