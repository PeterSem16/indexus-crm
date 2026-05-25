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
};
const FONT = "Calibri";

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
function p(text,opts={}){
  return new Paragraph({children:[tr(text,opts)],spacing:{before:40,after:40}});
}
function note(text,color=C.gray){
  return new Paragraph({
    children:[tr(`ℹ  ${text}`,{size:18,color,italics:true})],
    spacing:{before:40,after:80},
  });
}
function bullet(text,color=C.dark,bold=false,level=0){
  return new Paragraph({
    children:[tr(text,{color,bold})],
    bullet:{level},
    spacing:{before:20,after:20},
  });
}
function sub(text,color=C.dark){
  return new Paragraph({
    children:[tr(text,{color})],
    bullet:{level:1},
    spacing:{before:10,after:10},
  });
}

function alertBox(label,text,fill,labelColor){
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
        children:[new Paragraph({children:[tr(text,{size:19,color:C.dark})],spacing:{before:40,after:40}})],
        shading:{type:ShadingType.SOLID,fill},
        margins:{top:80,bottom:80,left:60,right:120},
      }),
    ]})]
  });
}

function colorBox(text,fill,textColor=C.dark){
  return new Paragraph({
    children:[tr(text,{color:textColor,size:19})],
    shading:{type:ShadingType.SOLID,fill},
    spacing:{before:80,after:80},
    indent:{left:100,right:100},
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
          shading:{type:ShadingType.SOLID,fill:C.header},
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
            shading:bg?{type:ShadingType.SOLID,fill:bg}:undefined,
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
  title:"ESO Ekonomický Systém — Návrh Integrácie s INDEXUS CRM",
  sections:[{
    properties:{page:{margin:{
      top:convertInchesToTwip(1), bottom:convertInchesToTwip(1),
      left:convertInchesToTwip(1.1), right:convertInchesToTwip(1.1),
    }}},
    children:[

      // ── TITULNÁ STRANA ────────────────────────────────────────────────────
      new Paragraph({
        children:[tr("ESO",{bold:true,size:80,color:C.blue})],
        alignment:AlignmentType.CENTER,spacing:{before:1000,after:60},
      }),
      new Paragraph({
        children:[tr("Integrácia s INDEXUS CRM",{bold:true,size:36,color:C.dark})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:80},
      }),
      new Paragraph({
        children:[tr("Návrh riešenia · Požiadavky na dodávateľa · Implementačný plán",{size:24,color:C.gray})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:300},
      }),
      new Paragraph({
        children:[tr("CBC AG / CBC SK  ·  Máj 2026  ·  Pripravil: INDEXUS CRM",{size:20,color:C.gray})],
        alignment:AlignmentType.CENTER,spacing:{before:0,after:600},
      }),
      alertBox("⚠️  Pred spustením",
        "Tento dokument je pracovný návrh. Pred záväzným rozhodnutím je nutné potvrdiť: (1) ktorú verziu ESO používa CBC, (2) či ESO dodávateľ poskytuje API prístup, (3) rozsah integrácie s účtovníkom.",
        C.bgOrange, C.orange),
      ...sp(2),

      // ── OBSAH ─────────────────────────────────────────────────────────────
      h1("Čo táto integrácia rieši a prečo"),
      colorBox(
        "INDEXUS CRM spravuje zákazníkov, zmluvy a kolekcie. ESO je ekonomický/účtovný systém kde sa fakturuje, " +
        "evidujú platby a vedie účtovníctvo. Bez prepojenia musí účtovník ručne prepisovať dáta z INDEXUS do ESO — " +
        "čo spôsobuje chyby, zdvojenie práce a spomalenie fakturácie.",
        C.bgBlue, C.dark),
      ...sp(1),

      h2("Problém bez integrácie"),
      mkTable(
        ["Krok","Bez integrácie (teraz)","S integráciou (cieľový stav)"],
        [
          [["Nová zmluva v INDEXUS","Účtovník ručne prepisuje zákazníka do ESO","INDEXUS automaticky pošle zákazníka do ESO"],
           [{bold:true},{color:C.red},{color:C.green}]],
          [["Fakturácia","Faktúra sa vytvára manuálne v ESO","INDEXUS odošle podklad → ESO vygeneruje faktúru"],
           [{bold:true},{color:C.red},{color:C.green}]],
          [["Platba prijatá","Účtovník ručne aktualizuje stav v INDEXUS","ESO automaticky informuje INDEXUS o zaplatení"],
           [{bold:true},{color:C.red},{color:C.green}]],
          [["Reporting","Dáta z dvoch systémov sa musia manuálne spájať","Jeden konzistentný zdroj pravdy"],
           [{bold:true},{color:C.red},{color:C.green}]],
          [["e-Fakturácia (SK 2027)","Potrebná manuálna koordinácia","Automatizovaný tok INDEXUS → ESO → Peppol"],
           [{bold:true},{color:C.red},{color:C.green}]],
        ],
        [2000,3200,3300]
      ),
      ...sp(2),

      // ── KTORÝ ESO ─────────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Ktorý ESO systém — identifikácia"),
      alertBox("❓  Treba potvrdiť",
        "Na Slovensku sa pod názvom 'ESO' skrývajú dva rôzne systémy. Treba overiť ktorý CBC používa — kontaktovanie dodávateľa a spôsob integrácie sa líši.",
        C.bgOrange, C.orange),
      ...sp(1),
      mkTable(
        ["","eso/es (HT Solution)","ESO9 (ESO9 international)"],
        [
          [["Výrobca","HT Solution s.r.o. — slovenská firma","ESO9 international a.s. — česká firma"],
           [{bold:true},{},{}]],
          [["Web","htsolution.sk","eso9.cz / eso9.sk"],
           [{bold:true},{},{}]],
          [["Technológia","Java / J2EE / IBM DB2","Microsoft cloud (.NET)"],
           [{bold:true},{},{}]],
          [["API / Rozhranie","WebServices (SOAP/XML) — nie verejné REST API","REST JSON API + e-invoice API — čiastočne verejné"],
           [{bold:true},{color:C.orange},{color:C.green}]],
          [["Integrácia","Individuálny projekt — nutná súčinnosť HT Solution","Dokumentovaná JSON API + REST volania"],
           [{bold:true},{},{}]],
          [["Cieľová skupina","Stredné a veľké slovenské firmy","Výrobné a obchodné firmy SK/CZ"],
           [{bold:true},{},{}]],
          [["e-fakturácia","Cez Doklado API (whitelabel modul)","Vlastný ESO9 e-invoice modul (Peppol)"],
           [{bold:true},{},{}]],
          [["Typický impl. čas","2–6 mesiacov (podľa rozsahu)","Závisí od modulu"],
           [{bold:true},{},{}]],
        ],
        [1800,3600,3100]
      ),
      ...sp(1),
      h3("Ako zistiť ktorý ESO máte", C.orange),
      bullet("Pozrieť login stránku ESO — URL alebo logo prezradí či je to HT Solution alebo ESO9"),
      bullet("Spýtať sa účtovníka: 'Aký ekonomický systém používame a kto je dodávateľ?'"),
      bullet("Nájsť zmluvu s dodávateľom ESO — obsahuje názov produktu a kontakt"),
      ...sp(2),

      // ── DÁTOVÉ TOKY ───────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Návrh dátových tokov — čo a kadiaľ tečie"),
      colorBox(
        "Integrácia bude obojsmerná: INDEXUS posiela podklady pre fakturáciu do ESO, " +
        "ESO posiela späť platobný stav a čísla faktúr. " +
        "V budúcnosti (SK 2027) bude ESO zároveň slúžiť ako brána pre Peppol e-fakturáciu.",
        C.bgTeal, C.dark),
      ...sp(1),

      h2("Smer A — INDEXUS → ESO (odchádzajúce dáta)"),
      mkTable(
        ["Dáta","Kedy","Formát","Popis"],
        [
          [["Zákazník (nový/aktualizovaný)","Pri podpise zmluvy","JSON/XML","Meno, adresa, IČO/DIČ, kontakt, typ zákazníka"],
           [{bold:true},{},{},{}]],
          [["Zmluva (nová)","Po vytvorení zmluvy","JSON/XML","Číslo zmluvy, dátum, produkt, cena, splatnosť"],
           [{bold:true},{},{},{}]],
          [["Fakturačný podklad","Podľa harmonogramu / manuálne","JSON/XML","Čo a komu fakturovať — základ pre faktúru v ESO"],
           [{bold:true},{},{},{}]],
          [["Inkasný príkaz","Pri splátkovom kalendári","JSON/XML","Dátum, suma, číslo účtu zákazníka"],
           [{bold:true},{},{},{}]],
          [["Dobropisy / storno","Pri reklamácii/stornu zmluvy","JSON/XML","Odkaz na pôvodnú faktúru, dôvod, suma"],
           [{bold:true},{},{},{}]],
        ],
        [2200,1700,1200,3400]
      ),
      ...sp(1),

      h2("Smer B — ESO → INDEXUS (prichádzajúce dáta)"),
      mkTable(
        ["Dáta","Kedy","Formát","Popis"],
        [
          [["Číslo faktúry","Po vytvorení faktúry v ESO","JSON/XML/webhook","ESO pridelí číslo → INDEXUS zobrazí zákazníkovi"],
           [{bold:true},{},{},{}]],
          [["Stav platby","Pri prijatí platby","JSON/XML/webhook","Zaplatené / nezaplatené / čiastočne — INDEXUS aktualizuje kontrakt"],
           [{bold:true},{},{},{}]],
          [["Dátum splatnosti / omeškanie","Priebežne","JSON/XML","Pre upomienky a workflow v INDEXUS"],
           [{bold:true},{},{},{}]],
          [["PDF faktúry (voliteľné)","Po vystavení","Base64/URL","Pre zobrazenie zákazníkovi v INDEXUS portáli"],
           [{bold:true},{},{},{}]],
          [["Zaúčtovanie potvrdenie","Po zaúčtovaní","JSON","Potvrdenie že doklad bol zaúčtovaný v ESO"],
           [{bold:true},{},{},{}]],
        ],
        [2200,1700,1400,3200]
      ),
      ...sp(1),

      h2("Smer C — ESO → Peppol / ANAF (budúcnosť)"),
      colorBox(
        "Pre e-fakturáciu SK (2027) a RO (povinné teraz): ESO by mal generovať a odosielať UBL XML faktúry " +
        "cez Peppol (SK) alebo ANAF (RO). INDEXUS poskytuje podklad — ESO generuje XML a odosiela. " +
        "Toto je druhá fáza integrácie.",
        C.bgOrange, C.dark),
      ...sp(2),

      // ── POŽIADAVKY NA DODÁVATEĽA ESO ──────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Požiadavky na dodávateľa ESO — čo treba žiadať"),
      alertBox("📋  Kľúčový bod",
        "Väčšina ESO systémov nemá verejné REST API. Integrácia je individuálny projekt. " +
        "Dodávateľ ESO musí aktívne spolupracovať — bez jeho súčinnosti integráciu nie je možné implementovať.",
        C.bgOrange, C.orange),
      ...sp(1),

      h2("Zoznam požiadaviek na dodávateľa ESO"),
      mkTable(
        ["#","Požiadavka","Popis","Priorita"],
        [
          [["1","Technická dokumentácia API",
            "Kompletná dokumentácia dostupných API volaní: endpointy, formáty requestov/responses, autentifikácia (API key / OAuth / Basic Auth)",
            "🔴 Kritická"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.red,bold:true}]],
          [["2","Sandbox / testovací environment",
            "Prístup k testovaciemu prostrediu ESO kde môžeme testovať volania bez dopadu na produkčné dáta",
            "🔴 Kritická"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.red,bold:true}]],
          [["3","API prístupové údaje (credentials)",
            "API kľúč alebo OAuth client credentials pre produkčné a testovacie prostredie",
            "🔴 Kritická"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.red,bold:true}]],
          [["4","Schéma dátového modelu",
            "Popis entít v ESO: zákazník (polia, typy), faktúra (povinné/voliteľné polia), doklad, adresa — vrátane SK-špecifických polí (IČO, DIČ, IBAN)",
            "🔴 Kritická"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.red,bold:true}]],
          [["5","Webhook / push notifikácie",
            "Možnosť nastaviť webhook callback keď sa v ESO zmení stav faktúry (zaplatená, po splatnosti, stornovaná)",
            "🟡 Dôležitá"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.orange,bold:true}]],
          [["6","Spôsob exportu dokladov",
            "API endpoint alebo scheduled export: vydané faktúry (QHDOK_FAV alebo ekvivalent), prijaté platby, dobropis",
            "🟡 Dôležitá"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.orange,bold:true}]],
          [["7","e-Faktura / Peppol podpora",
            "Informácia či ESO podporuje UBL 2.1 XML generovanie a odosielanie cez Peppol (pre SK 2027) a ANAF (pre RO)",
            "🟡 Dôležitá"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.orange,bold:true}]],
          [["8","SLA a dostupnosť API",
            "Garantovaná dostupnosť API (uptime), retenčná politika dát, rate limiting (max. volaní/min)",
            "🟡 Dôležitá"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.orange,bold:true}]],
          [["9","Integračný kontaktná osoba",
            "Technický kontakt na strane ESO dodávateľa pre integračný projekt — nie helpdesk, ale developer/integrátor",
            "🟡 Dôležitá"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.orange,bold:true}]],
          [["10","Cenová ponuka za integráciu",
            "Niektorí dodávatelia účtujú za API prístup alebo za každý prenášaný doklad (napr. 1€/1000 dokladov). Treba vedieť vopred.",
            "🟢 Plánovaná"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.green,bold:true}]],
          [["11","Multi-entity / multi-country podpora",
            "CBC má subjekty v SK, CH, RO, CZ, HU — vie ESO spravovať viac právnických osôb? Aká je architektúra?",
            "🟢 Plánovaná"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.green,bold:true}]],
          [["12","Podpora pre CHF a EUR meny",
            "CBC AG fakturuje v CHF — vie ESO spravovať cudzie meny, kurzové rozdiely?",
            "🟢 Plánovaná"],
           [{bold:true,color:C.blue},{bold:true},{},{color:C.green,bold:true}]],
        ],
        [400,2000,4400,1700]
      ),
      ...sp(2),

      // ── OTÁZKY PRE PRVÉ STRETNUTIE ─────────────────────────────────────────
      h2("Otázky pre prvé stretnutie s ESO dodávateľom"),
      bullet("Akou verziou ESO disponujeme a je táto verzia stále aktívne podporovaná?", C.dark, true),
      sub("→ Staré verzie môžu mať obmedzené API možnosti"),
      bullet("Máte REST API alebo len SOAP WebServices?", C.dark, true),
      sub("→ REST je modernejší a jednoduchší na integráciu"),
      bullet("Je API verejne dokumentované alebo si musíme požiadať o dokumentáciu?", C.dark, true),
      bullet("Aký je postup na získanie API prístupu (sandbox + produkcia)?", C.dark, true),
      bullet("Podporuje váš systém automatické notifikácie (webhook) pri zmene stavu faktúry?", C.dark, true),
      bullet("Plánujete v roku 2026–2027 podporu e-fakturácie cez Peppol pre SK?", C.dark, true),
      sub("→ Ak nie, INDEXUS musí riešiť Peppol sám cez externý AP"),
      bullet("Aká je cena za API prístup a za počet prenášaných dokladov?", C.dark, true),
      bullet("Máte referencie na podobnú integráciu s iným CRM alebo externým systémom?", C.dark, true),
      ...sp(2),

      // ── TECHNICKÁ ARCHITEKTÚRA ─────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Technická architektúra integrácie"),

      h2("Možné integračné metódy"),
      mkTable(
        ["Metóda","Popis","Vhodnosť","Náročnosť"],
        [
          [["REST API (real-time)","INDEXUS volá ESO API priamo pri každej akcii — okamžitá synchronizácia",
            "🟢 Ideálna","Stredná — závisí od kvality API"],
           [{bold:true},{},{color:C.green,bold:true},{}]],
          [["SOAP WebServices","Staršia metóda — XML správy cez HTTP. Bežné pre eso/es (HT Solution)",
            "🟡 Funkčná","Stredná–Vysoká"],
           [{bold:true},{},{color:C.orange},{}]],
          [["Dávkový export/import (CSV/XML)","INDEXUS generuje súbory v noci, ESO ich importuje ráno. Jednoduchšie ale nie real-time.",
            "🟡 Záložná","Nízka"],
           [{bold:true},{},{color:C.orange},{}]],
          [["Priamy DB prístup","Čítanie/zápis priamo do ESO databázy — NEDOPORUČUJE SA",
            "🔴 Rizikové","Vysoká + negarantovaná"],
           [{bold:true},{},{color:C.red,bold:true},{color:C.red}]],
          [["Middleware (napr. Make/Zapier)","Vizuálny integrátor medzi systémami — vhodné pre menší objem",
            "🟢 Pre menší objem","Nízka"],
           [{bold:true},{},{color:C.green},{}]],
        ],
        [1800,3500,1800,1400]
      ),
      ...sp(1),
      note("Odporúčanie: Prioritne REST API (ak ESO9) alebo SOAP WebServices (ak eso/es HT Solution). Dávkový CSV/XML export ako záloha ak API nie je dostupné."),
      ...sp(1),

      h2("Odporúčaná architektúra — integračná vrstva v INDEXUS"),
      colorBox(
        "Namiesto priameho volania ESO API z každého miesta v kóde odporúčame vytvoriť " +
        "centrálnu 'ESO Connector' službu v INDEXUS backendu. Tá spravuje autentifikáciu, " +
        "retry logiku, logovanie a formátovanie dát. Zmenenie ESO systému v budúcnosti tak " +
        "ovplyvní len jeden modul — nie celý systém.",
        C.bgBlue, C.dark),
      ...sp(1),
      mkTable(
        ["Vrstva","Komponenta","Popis"],
        [
          [["INDEXUS Backend","ESO Connector Service","Centrálna služba — API klient pre ESO, autentifikácia, retry, logging"],
           [{bold:true},{bold:true,color:C.blue},{}]],
          [["INDEXUS Backend","Data Mapper","Konverzia INDEXUS entít na ESO formát a naopak (zákazník, zmluva, faktúra)"],
           [{bold:true},{bold:true,color:C.blue},{}]],
          [["INDEXUS Backend","Sync Queue","Fronta udalostí — ak ESO nedostupné, dokument sa odošle pri ďalšom pokuse"],
           [{bold:true},{bold:true,color:C.blue},{}]],
          [["INDEXUS Backend","Webhook Handler","Príjem notifikácií z ESO (platba prijatá, faktúra stornovaná)"],
           [{bold:true},{bold:true,color:C.blue},{}]],
          [["INDEXUS Frontend","ESO Sync Status","Zobrazenie stavu synchronizácie pre každý kontrakt / faktúru"],
           [{bold:true},{bold:true,color:C.teal},{}]],
          [["ESO systém","ESO API / WebServices","Externý systém — poskytuje endpointy podľa dokumentácie dodávateľa"],
           [{bold:true},{bold:true,color:C.gray},{}]],
        ],
        [1600,2500,4400]
      ),
      ...sp(2),

      // ── DÁTOVÉ MAPOVANIE ───────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Dátové mapovanie — INDEXUS ↔ ESO"),
      colorBox(
        "Pred začatím implementácie je nutné urobiť detailné mapovanie polí. " +
        "Táto tabuľka je pracovný návrh — niektoré názvy polí ESO treba potvrdiť s dodávateľom.",
        C.bgOrange, C.dark),
      ...sp(1),

      h2("Zákazník (Customer)"),
      mkTable(
        ["Pole v INDEXUS","Pole v ESO (predpokladané)","Typ","Poznámka"],
        [
          [["id","external_id / ESO_ID","string","INDEXUS si uchová ESO ID pre budúce volania"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["firstName + lastName","NAZOV alebo MENO + PRIEZVISKO","string","Závisí od ESO schémy"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["companyName","OBCH_MENO / NAZOV_FIRMY","string","Pre firemných zákazníkov"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["ico","ICO","string(8)","IČO — povinné pre SK firmy"],
           [{bold:true,color:C.blue},{bold:true,color:C.red},{},{}]],
          [["dic","DIC","string","DIČ — povinné pre platiteľov DPH"],
           [{bold:true,color:C.blue},{bold:true,color:C.red},{},{}]],
          [["icdph","ICDPH / IC_DPH","string","IČ DPH (SK format: SK + 10 číslic)"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["address (street, city, zip, country)","ULICA, MESTO, PSC, STAT","string","Štruktúrované polia — nie jeden textový riadok"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["email","EMAIL","string","Pre zaslanie faktúry zákazníkovi"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["phone","TEL","string",""],
           [{bold:true,color:C.blue},{},{},{}]],
          [["iban","IBAN / CISLO_UCTU","string","Pre inkasné príkazy"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["countryCode","STAT_KOD","string(2)","ISO 3166-1 alfa-2: SK, CH, RO, CZ, HU"],
           [{bold:true,color:C.blue},{},{},{}]],
        ],
        [2200,2200,1000,3100]
      ),
      ...sp(1),

      h2("Fakturačný podklad / Faktúra"),
      mkTable(
        ["Pole v INDEXUS","Pole v ESO (predpokladané)","Povinné","Poznámka"],
        [
          [["contractId","VS / VAR_SYMBOL","✅","Variabilný symbol — prepojenie s platbou"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["customerId → ESO_ID","ODBERATEL_ID","✅","Odkaz na zákazníka v ESO"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["invoiceDate","DAT_VYSTAVENIA","✅","Dátum vystavenia faktúry"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["dueDate","DAT_SPLATNOSTI","✅","Dátum splatnosti"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["amount (bez DPH)","SUMA_BEZ_DPH","✅","Základ dane"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["vatRate","SADZBA_DPH","✅","% sadzba — 23% (SK štandard 2024)"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["vatAmount","SUMA_DPH","✅","Vypočítaná DPH"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["totalAmount","SUMA_CELKOM","✅","Celková suma vrátane DPH"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["currency","MENA","✅","EUR, CHF, RON, CZK, HUF"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["description","POPIS_POLOZKY","✅","Popis plnenia na faktúre"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["billingCompanyId","DODAVATEL / FIRMA_ID","✅","Ktorá CBC entita fakturuje (SK, CH, RO...)"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
          [["paymentMethod","SPOSOBPLATBY","—","Bankový prevod, inkaso, karta"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["iban (dodávateľa)","IBAN_DODAVATELA","✅","Pre platobné inštrukcie na faktúre"],
           [{bold:true,color:C.blue},{},{bold:true,color:C.green},{}]],
        ],
        [2200,2200,800,3300]
      ),
      ...sp(2),

      // ── IMPLEMENTAČNÝ PLÁN ─────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Implementačný plán — fázy a časové odhady"),

      h2("Fáza 0 — Prieskum a rozhodnutia (2 týždne)"),
      colorBox("Táto fáza musí prebehúť skôr ako sa začne akákoľvek implementácia.", C.bgGray, C.dark),
      ...sp(1),
      mkTable(
        ["Úloha","Zodpovedný","Výstup"],
        [
          [["Identifikovať verziu a dodávateľa ESO","Seman + účtovník","Meno produktu, verzia, kontakt na dodávateľa"],
           [{bold:true},{},{}]],
          [["Prvé stretnutie s dodávateľom ESO","Seman + IT","Zistenie API možností, cena, timeline"],
           [{bold:true},{},{}]],
          [["Získať technickú dokumentáciu API","IT + dodávateľ ESO","Dokumentácia endpointov, schéma dát"],
           [{bold:true},{},{}]],
          [["Rozhodnúť: REST API vs SOAP vs CSV export","Seman + IT","Architektonické rozhodnutie"],
           [{bold:true},{},{}]],
          [["Definovať presný rozsah integrácie (MVP)","Seman + IT","Zoznam entít a smerov synchronizácie"],
           [{bold:true},{},{}]],
          [["Zmapovať polia INDEXUS ↔ ESO","IT + účtovník","Kompletná mapovacia tabuľka"],
           [{bold:true},{},{}]],
        ],
        [3500,1800,3200]
      ),
      ...sp(1),

      h2("Fáza 1 — MVP integrácia (4–6 týždňov)"),
      colorBox("Minimálna funkčná integrácia — zákazníci a fakturačné podklady.", C.bgGreen, C.dark),
      ...sp(1),
      mkTable(
        ["Úloha","Odhad","Zodpovedný"],
        [
          [["Implementovať ESO Connector Service v INDEXUS backendu","3–5 dní","IT (INDEXUS dev)"],
           [{bold:true},{},{}]],
          [["Data Mapper: zákazník INDEXUS → ESO formát","2–3 dni","IT"],
           [{bold:true},{},{}]],
          [["API: odosielanie nových zákazníkov pri podpise zmluvy","2–3 dni","IT"],
           [{bold:true},{},{}]],
          [["API: odosielanie fakturačného podkladu do ESO","3–5 dní","IT"],
           [{bold:true},{},{}]],
          [["Prijatie čísla faktúry z ESO späť do INDEXUS","2–3 dni","IT"],
           [{bold:true},{},{}]],
          [["Sync Queue (fronta pre prípad nedostupnosti ESO)","2–3 dni","IT"],
           [{bold:true},{},{}]],
          [["Testovanie na sandbox prostredí ESO","1 týždeň","IT + ESO dodávateľ"],
           [{bold:true},{},{}]],
          [["UI: ESO sync status na zmluve / faktúre v INDEXUS","2 dni","IT"],
           [{bold:true},{},{}]],
        ],
        [4500,1000,3000]
      ),
      ...sp(1),

      h2("Fáza 2 — Platobný stav a notifikácie (2–3 týždne)"),
      mkTable(
        ["Úloha","Odhad","Zodpovedný"],
        [
          [["Webhook handler pre ESO → INDEXUS notifikácie","3–5 dní","IT"],
           [{bold:true},{},{}]],
          [["Aktualizácia stavu zmluvy pri prijatí platby","2–3 dni","IT"],
           [{bold:true},{},{}]],
          [["Automatické upomienky z INDEXUS pri omeškaní (trigger z ESO)","3–5 dní","IT"],
           [{bold:true},{},{}]],
          [["Testovanie end-to-end flow: zmluva → faktúra → platba → stav","1 týždeň","IT + Seman"],
           [{bold:true},{},{}]],
        ],
        [4500,1000,3000]
      ),
      ...sp(1),

      h2("Fáza 3 — e-Fakturácia (Q3–Q4 2026)"),
      colorBox("Prepojenie ESO s Peppol (SK 2027) a ANAF (RO — urgentné). Závisí od e-invoice podpory v ESO.", C.bgOrange, C.dark),
      ...sp(1),
      mkTable(
        ["Úloha","Krajina","Odhad","Poznámka"],
        [
          [["ANAF clearance flow: INDEXUS podklad → ESO → ANAF → potvrdenie","🇷🇴 RO","2–3 týž.","URGENTNÉ — povinné od júla 2024"],
           [{bold:true},{},{},{color:C.red,bold:true}]],
          [["Peppol odosielanie: INDEXUS → ESO → Peppol AP → zákazník","🇸🇰 SK","2–3 týž.","Závisí od ESO Peppol podpory"],
           [{bold:true},{},{},{}]],
          [["Corner 5 reporting (FA SK)","🇸🇰 SK","1 týž.","Keď FA spustí C5 infraštruktúru Q3 2026"],
           [{bold:true},{},{},{}]],
          [["NAV RTIR reporting z ESO (alebo INDEXUS)","🇭🇺 HU","1 týž.","Povinné od 2018"],
           [{bold:true},{},{},{}]],
        ],
        [3500,1000,1000,3000]
      ),
      ...sp(2),

      // ── CELKOVÉ ODHADY ────────────────────────────────────────────────────
      new Paragraph({children:[new PageBreak()]}),
      h1("Celkové odhady a riziká"),

      h2("Časové a nákladové odhady"),
      mkTable(
        ["Fáza","Trvanie","Závisí od","Blokujúci faktor"],
        [
          [["Fáza 0 — Prieskum","2 týždne","Dostupnosti ESO dodávateľa","Ak ESO nemá API → treba iný prístup"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Fáza 1 — MVP","4–6 týždňov","Kvality API dokumentácie","Sandbox prístup od ESO dodávateľa"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Fáza 2 — Platobný stav","2–3 týždne","Webhook podpory v ESO","ESO musí vedieť posielať notifikácie"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["Fáza 3 — e-Fakturácia","4–6 týždňov","e-Invoice podpory v ESO","ESO musí mať Peppol / ANAF modul"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["CELKOVO","3–4 mesiace","","Paralelne s e-invoicing prípravou"],
           [{bold:true,color:C.dark,bold:true},{bold:true,color:C.red},{},{color:C.orange}]],
        ],
        [1800,1500,2500,2700]
      ),
      ...sp(1),

      h2("Riziká projektu"),
      mkTable(
        ["Riziko","Pravdepodobnosť","Dopad","Mitigácia"],
        [
          [["ESO nemá verejné REST API","Vysoká (pre eso/es HT Solution)","Vysoký — predlženie o 2–4 týž.","SOAP WebServices alebo CSV export ako záloha"],
           [{bold:true,color:C.red},{color:C.red},{},{}]],
          [["ESO dodávateľ nereaguje rýchlo","Stredná","Vysoký — blokuje fázu 1","Eskalovať cez Seman, dohodnúť SLA pre integráciu"],
           [{bold:true,color:C.orange},{color:C.orange},{},{}]],
          [["Dátové mapovanie je komplikovanejšie","Stredná","Stredný — +1–2 týž.","Detailný workshop s účtovníkom pred implementáciou"],
           [{bold:true,color:C.orange},{color:C.orange},{},{}]],
          [["ESO nepodporuje Peppol/ANAF","Stredná","Vysoký — treba externý AP","INDEXUS implementuje vlastný UBL XML generátor + AP"],
           [{bold:true,color:C.orange},{color:C.orange},{},{}]],
          [["Multi-entity (SK/CH/RO...) problémy","Stredná","Stredný","Otestovať každú entitu zvlášť v sandbox ESO"],
           [{bold:true,color:C.orange},{color:C.orange},{},{}]],
          [["ESO API výpadky v produkcii","Nízka","Stredný","Sync Queue v INDEXUS — retry pri obnove ESO"],
           [{bold:true,color:C.green},{color:C.green},{},{}]],
        ],
        [2200,1600,1600,3100]
      ),
      ...sp(2),

      // ── CHECKLIST ─────────────────────────────────────────────────────────
      h1("Checklist — čo treba urobiť ako prvé"),
      alertBox("📋  Odporúčaný postup na najbližší mesiac","Tieto kroky treba urobiť pred akoukoľvek implementáciou.", C.bgBlue, C.blue),
      ...sp(1),
      mkTable(
        ["#","Úloha","Zodpovedný","Status"],
        [
          [["1","Zistiť presný názov a verziu ESO systému (spýtať sa účtovníka)","Seman","⬜ TODO"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["2","Kontaktovať ESO dodávateľa — požiadať o integračnú dokumentáciu a sandbox","Seman","⬜ TODO"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["3","Dohodnúť prvé technické stretnutie ESO dodávateľ + INDEXUS IT","Seman","⬜ TODO"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["4","Pre RO: overiť súlad s ANAF (povinné od júla 2024!) — urgentné nezávisle od ESO","Seman + RO účtovník","⬜ TODO URGENTNÉ"],
           [{bold:true,color:C.red},{},{},{color:C.red,bold:true}]],
          [["5","Pre HU: overiť stav NAV Online Számla registrácie a XML v3.0","Seman + HU účtovník","⬜ TODO"],
           [{bold:true,color:C.orange},{},{},{}]],
          [["6","Definovať MVP rozsah integrácie — aké dáta MUSIA tiecť ako prvé","Seman + IT","⬜ TODO"],
           [{bold:true,color:C.blue},{},{},{}]],
          [["7","Účtovník CBC: poskytnúť zoznam polí potrebných na faktúre per krajina","CBC účtovník","⬜ TODO"],
           [{bold:true,color:C.blue},{},{},{}]],
        ],
        [400,4200,1800,2100]
      ),
      ...sp(2),

      // ── ZDROJE ────────────────────────────────────────────────────────────
      h1("Kontakty a zdroje"),
      mkTable(
        ["Subjekt","Kontakt / URL","Poznámka"],
        [
          [["HT Solution (eso/es)","info@htsolution.sk  |  htsolution.sk","Pre prípad že CBC používa eso/es"],
           [{bold:true},{},{}]],
          [["ESO9","eso9.cz/sk-sk  |  ESO9 wiki: wiki.eso9.cz","Pre prípad že CBC používa ESO9"],
           [{bold:true},{},{}]],
          [["ESO9 JSON API dok.","wiki.eso9.cz/lib/exe/fetch.php/techdoc:eso9_json_api.pdf","REST API dokumentácia ESO9"],
           [{bold:true},{},{}]],
          [["Doklado API (eso/es)","oldweb.doklado.sk/doklado-api/","Whitelabel fakturačný modul pre eso/es"],
           [{bold:true},{},{}]],
          [["Asseco QASIDA (Peppol SK)","asseco-peppol.com/en/","Certifikovaný Peppol AP pre SK 2027"],
           [{bold:true},{},{}]],
          [["ANAF e-Factura (RO)","efactura.mfinante.gov.ro","RO clearance platforma — povinné od 2024"],
           [{bold:true},{},{}]],
          [["NAV Online Számla (HU)","onlineszamla.nav.gov.hu","RTIR reporting pre HU"],
           [{bold:true},{},{}]],
        ],
        [2000,3500,3000]
      ),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("eso_integration_analysis.docx", buffer);
console.log("✅ eso_integration_analysis.docx vygenerovaný");
