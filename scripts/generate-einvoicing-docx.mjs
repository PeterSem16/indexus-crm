import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip, PageBreak
} from "docx";
import fs from "fs";

const C = {
  red:"C0392B", orange:"D35400", green:"1E8449", blue:"1A5276",
  gray:"626567", dark:"1C2833", purple:"6C3483", teal:"117A65",
  header:"1C2833", white:"FFFFFF",
  bgRed:"FDEDEC", bgOrange:"FEF5E7", bgGreen:"EAFAF1",
  bgBlue:"EBF5FB", bgGray:"F2F3F4", bgPurple:"F5EEF8", bgTeal:"E8F8F5",
  bgYellow:"FEFDE7",
};
const FONT = "Calibri";
const shd = (fill) => ({type:ShadingType.CLEAR, color:"auto", fill});

const tr  = (t,o={}) => new TextRun({text:String(t??''),font:FONT,size:20,color:C.dark,...o});
const sp  = (n=1) => Array.from({length:n},()=>new Paragraph({children:[tr('')],spacing:{before:0,after:0}}));

function h1(text){
  return new Paragraph({
    children:[tr(text,{bold:true,size:32,color:C.dark})],
    spacing:{before:500,after:200},
    border:{bottom:{style:BorderStyle.DOUBLE,size:2,color:C.blue}},
  });
}
function h2(text,color=C.dark){
  return new Paragraph({
    children:[tr(text,{bold:true,size:26,color})],
    spacing:{before:360,after:120},
    border:{bottom:{style:BorderStyle.SINGLE,size:1,color:"BBBBBB"}},
  });
}
function h3(text,color=C.blue){
  return new Paragraph({children:[tr(text,{bold:true,size:22,color})],spacing:{before:200,after:80}});
}
function note(text,color=C.gray){
  return new Paragraph({
    children:[tr(`ℹ  ${text}`,{size:18,color,italics:true})],
    spacing:{before:40,after:80},
  });
}
function bullet(text,color=C.dark,bold=false){
  return new Paragraph({children:[tr(text,{color,bold})],bullet:{level:0},spacing:{before:20,after:20}});
}
function sub(text){
  return new Paragraph({children:[tr(text,{color:C.gray,size:18})],bullet:{level:1},spacing:{before:8,after:8}});
}
function colorBox(text,fill,textColor=C.dark){
  return new Paragraph({
    children:[tr(text,{color:textColor,size:19})],
    shading:shd(fill),
    spacing:{before:80,after:80},
    indent:{left:100,right:100},
  });
}
function alertBox(label,text,fill,labelColor){
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[
      new TableCell({
        children:[new Paragraph({children:[tr(label,{bold:true,size:20,color:labelColor})],spacing:{before:40,after:0}})],
        shading:shd(fill),
        margins:{top:80,bottom:80,left:120,right:60},
        width:{size:1300,type:WidthType.DXA},
      }),
      new TableCell({
        children:[new Paragraph({children:[tr(text,{size:19,color:C.dark})],spacing:{before:40,after:40}})],
        shading:shd(fill),
        margins:{top:80,bottom:80,left:60,right:120},
      }),
    ]})]
  });
}

function mkTable(headers,rows,widths){
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
          shading:shd(C.header),
          margins:{top:60,bottom:60,left:100,right:100},
          width:widths?.[i]?{size:widths[i],type:WidthType.DXA}:undefined,
        })),
      }),
      ...rows.map((r,ri)=>new TableRow({
        children:r[0].map((c,i)=>{
          const o=r[1]?.[i]||{};
          const bg=o.bg||(ri%2===1?C.bgGray:undefined);
          return new TableCell({
            children:[new Paragraph({
              children:[tr(c,{size:18,...o})],
              alignment:o.align||AlignmentType.LEFT,
              spacing:{before:50,after:50},
            })],
            shading:bg?shd(bg):undefined,
            margins:{top:60,bottom:60,left:100,right:100},
            width:widths?.[i]?{size:widths[i],type:WidthType.DXA}:undefined,
          });
        }),
      })),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const doc = new Document({
  creator:"INDEXUS CRM",
  title:"e-Invoicing — Prehľad požiadaviek SK, CH, RO, CZ, HU, IT",
  sections:[{
    properties:{page:{margin:{
      top:convertInchesToTwip(1), bottom:convertInchesToTwip(1),
      left:convertInchesToTwip(1.1), right:convertInchesToTwip(1.1),
    }}},
    children:[

      // ── TITULNÁ STRANA ────────────────────────────────────────────────────
      new Paragraph({
        children:[tr("e-Invoicing",{bold:true,size:64,color:C.blue})],
        alignment:AlignmentType.CENTER,spacing:{before:1200,after:100},
      }),
      new Paragraph({
        children:[tr("Elektronická fakturácia — Analýza požiadaviek",{size:30,color:C.gray})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:120},
      }),
      new Paragraph({
        children:[tr("CBC AG · SK · RO · CZ · HU · IT",{size:24,color:C.dark,bold:true})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:400},
      }),
      new Paragraph({
        children:[tr("Máj 2026  ·  Pripravil: INDEXUS CRM",{size:20,color:C.gray})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:1600},
      }),
      alertBox("⚠️  KRITICKÉ — RO","Rumunsko (RO) — e-fakturácia je POVINNÁ od 1. júla 2024. Ak sa fakturuje v Rumunsku, treba okamžitú akciu.", C.bgRed, C.red),
      ...sp(1),
      alertBox("⚠️  KRITICKÉ — IT","Taliansko (IT) — e-fakturácia je POVINNÁ pre všetky talianské VAT-registrované subjekty od 1. januára 2019. Ak má CBC talianské IČ DPH, treba okamžitú akciu.", C.bgRed, C.red),
      ...sp(1),
      alertBox("✅  OK — CH","Švajčiarsko (CBC AG) — žiadna povinná B2B e-fakturácia. Len QR-bill na platobnom doklade.", C.bgGreen, C.green),
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
          [
            ["🇮🇹 Taliansko","CBC IT / lokálna","POVINNÉ (SDI clearance)","1. jan 2019","SDI — FatturaPA XML","🔴 OVERIŤ IHNEĎ"],
            [{bold:true},{},{color:C.red,bold:true},{align:AlignmentType.CENTER},{},{color:C.red,bold:true,align:AlignmentType.CENTER}],
          ],
        ],
        [1200,1800,2100,1200,2200,1900]
      ),
      note("Taliansko: ak CBC nemá talianské IČ DPH ani stálu prevádzkareň v Taliansku, povinnosť sa NEVZŤAHUJE. Treba overiť."),
      ...sp(2),

      // ── ČASOVÁ OS ─────────────────────────────────────────────────────────
      h1("Časová os — kedy čo treba urobiť"),
      mkTable(
        ["Dátum","Krajina","Udalosť","Akcia pre INDEXUS"],
        [
          [["Jan 2019","🇮🇹 IT","FatturaPA B2B/B2C/B2G povinné","Overiť či CBC IT má talianské VAT číslo!"],
           [{bold:true,color:C.red},{},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["Júl 2024","🇷🇴 RO","B2B clearance POVINNÉ — platí ŽUŽ","Overiť RO e-Factura napojenie!"],
           [{bold:true,color:C.red},{},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["Jan 2025","🇷🇴 RO","B2C e-reporting povinné","Rozšíriť RO napojenie na B2C"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["Apr 2025","🇮🇹 IT","FatturaPA v1.9 — nové TD29, RF20 kódy povinné","Aktualizovať FatturaPA XML schému na v1.9"],
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
          [["Dec 2027","🇮🇹 IT","EU derogácia pre SDI platí do konca 2027","Sledovať ViDA implementáciu pre IT"],
           [{bold:true,color:C.gray},{},{},{}]],
          [["2028","🇭🇺 HU","Plánovaná povinná B2B e-fakturácia (ViDA)","Sledovať vývoj NAV"],
           [{bold:true,color:C.gray},{},{},{}]],
          [["Júl 2030","Všetky EÚ krajiny","Cezhraničná B2B e-fakturácia (ViDA)","EU-wide Peppol"],
           [{bold:true,color:C.gray},{},{},{}]],
        ],
        [900,900,3100,3600]
      ),
      ...sp(2),

      // ── SK ────────────────────────────────────────────────────────────────
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
          [["Štandard","EN 16931 (európsky štandard)"],[{bold:true},{}]],
          [["PDF faktúra emailom","❌ NEPRIJATEĽNÉ od 2027 — len štruktúrované XML"],[{bold:true},{color:C.red}]],
          [["Peppol ID","0245:[DIČ] — napr. 0245:1234567890"],[{bold:true},{color:C.blue}]],
          [["Sieť","Peppol (cez certifikovaného Digitálneho poštára)"],[{bold:true},{}]],
          [["Reporting","Do 15 dní od vystavenia/prijatia — automaticky cez AP"],[{bold:true},{}]],
          [["Archivácia","Minimálne 5 rokov"],[{bold:true},{}]],
        ],
        [3000,5500]
      ),
      ...sp(1),
      h2("Certifikovaní Digitálni poštári (máj 2026)"),
      colorBox("Finančná správa SR publikovala zoznam certifikovaných poskytovateľov 11. marca 2026. Zoznam je priebežne aktualizovaný na financnasprava.sk", C.bgBlue),
      ...sp(1),
      mkTable(
        ["Poskytovateľ","Status (máj 2026)","Poznámka","Kontakt / Web"],
        [
          [["Asseco QASIDA","✅ CERTIFIKOVANÝ","Slovenský provider, splnil technické požiadavky Peppol Authority","asseco-peppol.com"],
           [{bold:true},{color:C.green,bold:true},{},{}]],
          [["mySupply (mySupply ApS)","🔄 V procese certifikácie","Dánsky provider aktívny na SK trhu","mysupply.dk"],
           [{bold:true},{color:C.orange,bold:true},{},{}]],
          [["Ďalší poskytovatelia","🔄 V procese akreditácie","Zoznam na financnasprava.sk — priebežne aktualizovaný","financnasprava.sk"],
           [{bold:true},{color:C.orange,bold:true},{},{}]],
        ],
        [2200,1800,2500,2000]
      ),
      ...sp(1),
      h2("Implementačné kroky — SK"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","Vybrať certifikovaného Digitálneho poštára (odp. Asseco QASIDA)","Q2 2026","Seman"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["2","Zaregistrovať Peppol ID pre CBC SK: 0245:[DIČ CBC SK]","Q2 2026","Seman + účtovník"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["3","Implementovať generovanie UBL 2.1 XML faktúry v INDEXUS","Q2–Q3 2026","IT"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["4","Napojenie INDEXUS na API Digitálneho poštára (odoslanie + príjem)","Q3 2026","IT"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["5","Corner 5 reporting (keď FA spustí C5 infraštruktúru)","Q3 2026","IT"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["6","Testovanie v dobrovoľnej fáze — testovací faktúry cez Peppol","Q3–Q4 2026","IT + Seman"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["7","Go-live — všetky SK faktúry cez Peppol","1. jan 2027","Seman"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── CH ────────────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇨🇭 Švajčiarsko (CBC AG) — Detailná analýza"),
      alertBox("✅  Dobrá správa","Pre B2B fakturáciu medzi firmami v Švajčiarsku NEEXISTUJE žiadna povinnosť e-fakturácie. CBC AG môže vystavovať faktúry aj ako PDF — žiadna zákonná požiadavka.", C.bgGreen, C.green),
      ...sp(1),
      h2("Čo je povinné v CH"),
      mkTable(
        ["Segment","Status","Odkedy","Podmienka"],
        [
          [["B2G (dodávky štátu)","✅ Povinné","Od 2016","Zmluvy nad CHF 5 000"],[{},{color:C.red,bold:true},{},{}]],
          [["B2B (firma → firma)","Dobrovoľné","—","Žiadna zákonná povinnosť"],[{},{color:C.green,bold:true},{},{}]],
          [["B2C (firma → spotrebiteľ)","Dobrovoľné","—","Žiadna zákonná povinnosť"],[{},{color:C.green,bold:true},{},{}]],
        ],
        [1800,1600,1600,3500]
      ),
      ...sp(1),
      h2("QR-bill — povinná súčasť každej CH faktúry s platbou"),
      colorBox("QR-bill je štandardizovaný platobný doklad s QR kódom. Od 1. októbra 2022 nahradil všetky staré platobné poukážky (BVR/ESR). QR-bill v2.3 (od novembra 2025): adresy musia byť štruktúrované — ulica, číslo, PSČ, mesto, krajina — v separátnych poliach. Deadline na dokončenie konverzie: 30. september 2026.", C.bgOrange),
      ...sp(1),
      h2("Implementačné kroky — CH"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","Overiť generovanie QR-bill v INDEXUS pre CH faktúry","Ihneď","IT"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["2","Implementovať štruktúrované adresy (QR-bill v2.3) — deadline sep 2026","Do sep 2026","IT"],
           [{bold:true,color:C.orange},{color:C.orange,bold:true},{color:C.orange,bold:true},{}]],
          [["3","Definovať IBAN CBC AG pre QR kód","Ihneď","Účtovník CBC AG"],
           [{bold:true,color:C.orange},{},{},{}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── RO ────────────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇷🇴 Rumunsko — POVINNÉ UŽ OD 2024 🔴"),
      alertBox("🔴  KRITICKÉ","Rumunsko zaviedlo povinnú B2B e-fakturáciu (clearance model) od 1. júla 2024. Ak CBC fakturuje v Rumunsku bez napojenia na RO e-Factura (ANAF), ide o porušenie zákona s pokutami.", C.bgRed, C.red),
      ...sp(1),
      h2("Stav"),
      bullet("Zákon 296/2023 — B2B e-fakturácia povinná od 1. januára 2024 (reporting)"),
      bullet("Od 1. júla 2024 — clearance model: faktúra musí byť SCHVÁLENÁ ANAF pred odoslaním zákazníkovi"),
      bullet("B2C e-reporting povinný od 1. januára 2025"),
      bullet("SAF-T (D406) — povinný mesačný/štvrťročný reporting"),
      ...sp(1),
      colorBox("CLEARANCE MODEL = faktúra sa NAJPRV nahrá do ANAF, ANAF ju overí a vydá elektronický podpis. Až POTOM môže byť faktúra odoslaná zákazníkovi. Faktúra bez ANAF potvrdenia je NEPLATNÁ.", C.bgRed),
      ...sp(1),
      mkTable(
        ["Požiadavka","Detail"],
        [
          [["Platforma","RO e-Factura (ANAF) — anaf.ro"],[{bold:true},{}]],
          [["Formát","UBL 2.1 XML (RO_CIUS — rumunský profil)"],[{bold:true},{}]],
          [["Postup","1. Generuj XML → 2. Nahraj na ANAF → 3. ANAF potvrdí → 4. Odošli zákazníkovi"],[{bold:true},{}]],
          [["Reporting","Do 5 pracovných dní od vystavenia faktúry"],[{bold:true},{}]],
          [["PDF faktúra","❌ Neplatná bez ANAF potvrdenia"],[{bold:true},{color:C.red}]],
        ],
        [2500,6000]
      ),
      ...sp(1),
      h2("Implementačné kroky — RO (URGENTNÉ)"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","OVERIŤ: fakturuje CBC v RO? Je to v súlade s ANAF od júla 2024?","IHNEĎ","Seman + RO účtovník"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["2","Registrácia na ANAF portáli — získať API prístup","IHNEĎ","RO účtovník / právnik"],
           [{bold:true,color:C.red},{},{},{}]],
          [["3","Implementovať UBL 2.1 XML pre RO (RO_CIUS profil) v INDEXUS","Q2–Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["4","Napojenie INDEXUS na ANAF API (upload → potvrdenie → odoslanie)","Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["5","Implementovať SAF-T reporting pre RO","Q3 2026","IT + RO účtovník"],
           [{bold:true,color:C.orange},{},{},{}]],
        ],
        [400,4200,1400,2500]
      ),
      ...sp(2),

      // ── CZ + HU ───────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇨🇿 Česko & 🇭🇺 Maďarsko"),

      h2("🇨🇿 Česká republika — Žiadna povinnosť B2B"),
      alertBox("✅  Bez mandátu","Česká republika nemá žiadnu povinnosť B2B e-fakturácie. Faktúra môže byť PDF aj XML. ViDA (2030) to zmení.", C.bgGreen, C.green),
      ...sp(1),
      mkTable(
        ["Požiadavka","Status","Detail"],
        [
          [["B2B e-fakturácia","Dobrovoľné","Žiadna zákonná povinnosť"],[{bold:true},{color:C.green,bold:true},{}]],
          [["B2G faktúry","Čiastočne povinné","Verejné inštitúcie musia PRIJÍMAŤ EN 16931 XML"],[{bold:true},{color:C.orange},{}]],
          [["Kontrolný výkaz DPH","Povinné (elektronicky)","Mesačný/štvrťročný XML výkaz — nie faktúry, len súhrn"],[{bold:true},{color:C.orange},{}]],
          [["Archivácia","10 rokov","Dlhšie ako SK (5 rokov)"],[{bold:true},{color:C.orange},{}]],
          [["ViDA / povinnosť","Plánované ~2028–2030","Sledovať legislatívny vývoj"],[{bold:true},{color:C.gray},{}]],
        ],
        [2500,1800,4200]
      ),
      ...sp(2),

      h2("🇭🇺 Maďarsko — RTIR (Real-Time Invoice Reporting)"),
      alertBox("🟡  Pozor — RTIR je povinné","Maďarsko nežiada e-faktúry (nie clearance model), ale KAŽDÁ faktúra musí byť do 24 hodín nahlásená Finančnej správe (NAV) v XML v3.0 — Online Számla systém. Platí aj pre zahraničné firmy registrované na DPH v HU.", C.bgOrange, C.orange),
      ...sp(1),
      mkTable(
        ["Požiadavka","Status","Detail"],
        [
          [["RTIR (Online Számla)","POVINNÉ od 2018","Všetky B2B, B2C, export faktúry — reporting do NAV do 24 hodín"],[{bold:true},{color:C.red,bold:true},{}]],
          [["Formát","XML v3.0 (NAV XSD)","XML v2.0 zrušené od mája 2025 — len v3.0"],[{bold:true},{color:C.red,bold:true},{color:C.red}]],
          [["Platforma","NAV Online Invoicing (onlineszamla.nav.gov.hu)","Webový portál + API"],[{bold:true},{},{}]],
          [["Platí pre zahraničné firmy?","ÁNO — ak má HU DPH číslo","Non-resident VAT-registered entity musí reportovať"],[{bold:true},{color:C.red,bold:true},{}]],
          [["ViDA / plné B2B","Plánované 2028","Phased roll-out"],[{bold:true},{color:C.gray},{}]],
        ],
        [2500,1800,4200]
      ),
      bullet("OVERIŤ: je CBC HU registrovaná na NAV Online Számla?", C.red, true),
      bullet("Skontrolovať: používa sa XML v3.0 (zakázaný v2.0 od mája 2025)"),
      bullet("Sledovať ViDA implementáciu — plné B2B ~2028"),
      ...sp(2),

      // ── TALIANSKO ─────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("🇮🇹 Taliansko — POVINNÉ UŽ OD 2019 🔴"),

      alertBox("🔴  KRITICKÉ","Taliansko má povinné e-fakturácia pre VŠETKY domáce transakcie (B2B, B2C, B2G) od 1. januára 2019. Od jan 2024 sú odstránené posledné výnimky. POZOR: ak CBC nemá talianské IČ DPH ani stálu prevádzkareň (fixed establishment), povinnosť sa NEVZŤAHUJE.", C.bgRed, C.red),
      ...sp(1),

      h2("Stav a legislatíva"),
      bullet("FatturaPA povinné pre B2G od júna 2014 (centrálna vláda) a marca 2015 (všetky verejné inštitúcie)"),
      bullet("FatturaPA B2B + B2C povinné od 1. januára 2019 — najdlhšia história v EÚ"),
      bullet("Od 1. januára 2024: VŠETKY zvyšné výnimky zrušené — každý VAT-registrovaný subjekt v IT musí byť v súlade"),
      bullet("FatturaPA v1.9 — nové technické špecifikácie povinné od 1. apríla 2025 (TD29, RF20 kódy)"),
      bullet("EU derogácia pre SDI mandát predĺžená do 31. decembra 2027"),
      ...sp(1),

      h2("Ako funguje SDI (Sistema di Interscambio)"),
      colorBox("SDI je centrálna clearance platforma Talianskej daňovej správy (Agenzia delle Entrate). KAŽDÁ faktúra prechádza cez SDI — podobne ako RO cez ANAF. Faktúra sa odošle do SDI, SDI ju overí (formát, DIČ), doručí príjemcovi a uloží kópiu. Faktúra mimo SDI je NEPLATNÁ.", C.bgRed),
      ...sp(1),
      mkTable(
        ["Požiadavka","Detail"],
        [
          [["Platforma","SDI (Sistema di Interscambio) — fatturapa.agenziaentrate.gov.it"],[{bold:true},{}]],
          [["Formát","FatturaPA XML — TALIANSKY národný formát (NIE UBL — iný ako SK/RO)"],[{bold:true},{color:C.orange,bold:true}]],
          [["Verzia","FatturaPA v1.9 (povinná od apríla 2025) — TD29, RF20 kódy"],[{bold:true},{}]],
          [["Clearance","ÁNO — faktúra musí prejsť cez SDI pred doručením príjemcovi"],[{bold:true},{}]],
          [["B2B + B2C","Povinné — vrátane faktúr fyzickým osobám"],[{bold:true},{}]],
          [["Cezhraničné transakcie","Reporting cez SDI (TD17–TD19, TD28 kódy) nahrádza starý Esterometro"],[{bold:true},{}]],
          [["Výnimky","Zdravotnícke B2C (trvalá výnimka od júna 2025)"],[{bold:true},{}]],
          [["Non-resident bez IT establishment","VYLÚČENÍ — aj keď miesto plnenia je Taliansko"],[{bold:true},{color:C.green,bold:true}]],
          [["Pokuty","Za každú nenahlásená faktúru — progresívne pokuty"],[{bold:true},{color:C.red}]],
        ],
        [2500,6000]
      ),
      ...sp(1),

      h2("Kľúčová otázka: vzťahuje sa povinnosť na CBC?"),
      colorBox("Povinnosť FatturaPA / SDI sa vzťahuje VÝLUČNE na subjekty, ktoré sú: (1) registrované pre DPH v Taliansku A (2) majú stálu prevádzkareň (fixed establishment) v Taliansku. Ak CBC nemá ani jedno — nie je povinnosť.", C.bgYellow),
      ...sp(1),
      mkTable(
        ["Situácia","Povinnosť SDI","Akcia"],
        [
          [["CBC IT s.r.o. — talianská entita s talianskym IČ DPH","🔴 ÁNO — POVINNÉ od 2019","Implementovať FatturaPA XML + SDI napojenie IHNEĎ"],
           [{bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["CBC AG Švajčiarsko fakturuje talianskemu zákazníkovi — bez IT VAT reg.","🟢 NIE — vylúčená","Štandardná CH faktúra PDF je OK pre IT zákazníka"],
           [{bold:true},{color:C.green,bold:true},{color:C.green}]],
          [["CBC AG má talianské VAT číslo pre DPH registráciu bez stálej prevádzkarne","🟡 Čiastočne — len reporting cezhraničných plnení","Reporting cez SDI (TD17–TD19) pre IT transakcie"],
           [{bold:true},{color:C.orange,bold:true},{}]],
        ],
        [3200,2000,3300]
      ),
      ...sp(1),

      h2("Implementačné kroky — IT"),
      mkTable(
        ["#","Krok","Kedy","Zodpovedný"],
        [
          [["1","OVERIŤ: má CBC talianské IČ DPH alebo stálu prevádzkareň v IT?","IHNEĎ","Seman + právnik / daňový poradca"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{color:C.red,bold:true},{color:C.red,bold:true}]],
          [["2","AK ÁNO: kontaktovať Agenzia delle Entrate — získať prístup k SDI","IHNEĎ po potvrdení","IT účtovník / daňový poradca"],
           [{bold:true,color:C.red},{},{},{}]],
          [["3","Implementovať FatturaPA v1.9 XML generátor v INDEXUS (iný formát ako UBL!)","Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["4","Napojenie INDEXUS na SDI API alebo cez IT e-invoicing provider (napr. Aruba, TeamSystem, Zucchetti)","Q3 2026","IT"],
           [{bold:true,color:C.red},{},{},{}]],
          [["5","Testovanie na SDI testovacím prostredí","Q3–Q4 2026","IT"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["6","AK NIE: žiadna akcia potrebná — len dokumentovať rozhodnutie","—","Seman"],
           [{bold:true,color:C.green},{color:C.green},{},{}]],
        ],
        [400,4200,1400,2500]
      ),
      note("Certifikovaní IT intermediári (Intermediario FatturaPA): Aruba PEC, TeamSystem, Zucchetti, Wolters Kluwer. Fungujú podobne ako Peppol AP pre SK."),
      ...sp(2),

      // ── IMPLEMENTAČNÝ PLÁN ────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Implementačný plán — Priority"),

      h2("Priorita 1 — IHNEĎ"),
      mkTable(
        ["Krajina","Úloha","Kto"],
        [
          [["🇷🇴 RO","Overiť súlad s ANAF — fakturujeme v RO? Je reportované?","Seman + RO účtovník"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{}]],
          [["🇮🇹 IT","Overiť: má CBC talianské IČ DPH / fixed establishment?","Seman + daňový poradca"],
           [{bold:true,color:C.red},{color:C.red,bold:true},{}]],
          [["🇭🇺 HU","Overiť registráciu na NAV Online Számla a XML v3.0","Seman + HU účtovník"],
           [{bold:true,color:C.orange},{color:C.orange},{}]],
          [["🇨🇭 CH","Overiť QR-bill generovanie a aktualizácia na v2.3","IT"],
           [{bold:true,color:C.orange},{color:C.orange},{}]],
        ],
        [1000,5000,2500]
      ),
      ...sp(1),

      h2("Priorita 2 — Q2–Q3 2026"),
      mkTable(
        ["Krajina","Úloha","Odhad"],
        [
          [["🇸🇰 SK","Vybrať Digitálneho poštára + registrovať Peppol ID","1–3 dni"],
           [{bold:true,color:C.blue},{},{}]],
          [["🇷🇴 RO","Implementovať UBL XML (RO_CIUS) + ANAF API napojenie","2–3 týždne"],
           [{bold:true,color:C.red},{},{}]],
          [["🇮🇹 IT","Implementovať FatturaPA v1.9 XML + SDI napojenie (ak applicable)","2–3 týždne"],
           [{bold:true,color:C.red},{},{}]],
          [["🇭🇺 HU","Implementovať NAV RTIR reporting XML v3.0","1 týždeň"],
           [{bold:true,color:C.orange},{},{}]],
        ],
        [1000,5500,2000]
      ),
      ...sp(1),

      h2("Priorita 3 — Q3–Q4 2026"),
      mkTable(
        ["Krajina","Úloha","Odhad"],
        [
          [["🇸🇰 SK","UBL 2.1 XML generátor + Peppol AP napojenie + C5 testing","3–4 týždne"],
           [{bold:true,color:C.blue},{},{}]],
          [["🇨🇭 CH","Dokončiť QR-bill v2.3 štruktúrované adresy — deadline sep 2026","3–5 dní"],
           [{bold:true,color:C.orange},{},{}]],
          [["Všetky","Archivácia e-faktúr — min. 5 rokov (SK), 10 rokov (CZ)","1 deň"],
           [{bold:true},{},{}]],
        ],
        [1000,5500,2000]
      ),
      ...sp(1),

      h2("Priorita 4 — 2027–2030 (sledovať)"),
      mkTable(
        ["Krajina","Udalosť","Kedy"],
        [
          [["🇸🇰 SK","Go-live povinnej Peppol e-fakturácie","1. jan 2027"],[{bold:true,color:C.blue},{},{bold:true,color:C.red}]],
          [["🇮🇹 IT","EU derogácia pre SDI predĺžená do konca 2027","Dec 2027"],[{bold:true},{},{}]],
          [["🇨🇿 CZ","ViDA — pravdepodobne povinné B2B","~2028–2030"],[{bold:true},{},{}]],
          [["🇭🇺 HU","Povinná B2B e-fakturácia (ViDA-aligned)","~2028"],[{bold:true},{},{}]],
          [["Všetky EÚ","Cezhraničná B2B e-fakturácia (ViDA)","1. júl 2030"],[{bold:true},{},{}]],
        ],
        [1000,5500,2000]
      ),
      ...sp(2),

      // ── TECHNICKÉ POŽIADAVKY ───────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Čo treba implementovať v INDEXUS — Technický prehľad"),
      mkTable(
        ["Komponenta","Popis","Krajiny","Odhad"],
        [
          [["UBL 2.1 XML generátor","Generovanie faktúry v UBL XML formáte","SK, RO, (CZ, HU)","2–3 týž."],
           [{bold:true},{},{},{}]],
          [["RO_CIUS profil","Rumunský národný profil UBL — špecifické ANAF polia","RO","2–3 dni navyše"],
           [{bold:true},{},{},{}]],
          [["ANAF API klient","Upload XML → ANAF potvrdenie → stiahnutie podpísaného XML","RO","1 týž."],
           [{bold:true},{},{},{}]],
          [["FatturaPA v1.9 XML generátor","Talianský formát — INÝ ako UBL, vlastná XML schéma","IT","2–3 týž."],
           [{bold:true},{},{color:C.orange,bold:true},{}]],
          [["SDI API / IT intermediár klient","Odosielanie FatturaPA cez SDI alebo cez IT intermediára","IT","1 týž."],
           [{bold:true},{},{},{}]],
          [["Peppol AP klient","API klient pre Digitálneho poštára (Asseco QASIDA)","SK","1 týž."],
           [{bold:true},{},{},{}]],
          [["NAV RTIR klient","Reporting XML v3.0 do NAV Online Számla API (do 24 hod.)","HU","1 týž."],
           [{bold:true},{},{},{}]],
          [["QR-bill generátor","Platobný QR kód podľa Swiss QR-bill v2.3 (štrukt. adresy)","CH","3–5 dní"],
           [{bold:true},{},{},{}]],
          [["Archivačný modul","Ukladanie podpísaných XML faktúr + audit log","Všetky","1–2 dni"],
           [{bold:true},{},{},{}]],
          [["CELKOVÝ ODHAD","","Všetky krajiny","10–14 týždňov"],
           [{bold:true},{},{},{bold:true,color:C.blue}]],
        ],
        [2200,3500,1500,1300]
      ),
      note("FatturaPA (IT) je samostatný formát — nedá sa použiť rovnaký UBL generátor ako pre SK/RO. Treba implementovať zvlášť."),
      note("Odporúčaný postup: RO + IT overenie ihneď → HU RTIR → SK Peppol → CH QR-bill."),
      ...sp(2),

      // ── ZDROJE ────────────────────────────────────────────────────────────
      h1("Kľúčové zdroje & kontakty"),
      mkTable(
        ["Krajina","Zdroj","URL"],
        [
          [["🇸🇰 SK","Finančná správa SR — e-Faktura","financnasprava.sk → e-Faktura"],[{bold:true},{},{}]],
          [["🇸🇰 SK","Asseco QASIDA — certifikovaný AP","asseco-peppol.com"],[{bold:true},{},{}]],
          [["🇸🇰 SK","Peppol BIS 3.0 špecifikácia","docs.peppol.eu/poacc/billing/3.0/"],[{bold:true},{},{}]],
          [["🇷🇴 RO","ANAF e-Factura portál","efactura.mfinante.gov.ro"],[{bold:true},{},{}]],
          [["🇷🇴 RO","ANAF API dokumentácia","mfinante.gov.ro → API e-Factura"],[{bold:true},{},{}]],
          [["🇭🇺 HU","NAV Online Számla","onlineszamla.nav.gov.hu"],[{bold:true},{},{}]],
          [["🇮🇹 IT","SDI / FatturaPA portál","fatturapa.agenziaentrate.gov.it"],[{bold:true},{},{}]],
          [["🇮🇹 IT","FatturaPA v1.9 špecifikácia","www.agenziaentrate.gov.it/portale/fatturazione-elettronica"],[{bold:true},{},{}]],
          [["🇨🇭 CH","SIX QR-bill štandard","www.six-group.com → QR-bill"],[{bold:true},{},{}]],
          [["EÚ","ViDA direktíva (2025/516)","ec.europa.eu/taxation_customs/vat/digital-age"],[{bold:true},{},{}]],
        ],
        [900,2500,5100]
      ),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("einvoicing_analysis.docx", buffer);
console.log("✅ einvoicing_analysis.docx vygenerovaný (SK+CH+RO+CZ+HU+IT, fixed shading)");
