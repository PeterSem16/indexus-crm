import type { ExampleChapters } from "./types";

export const cs: ExampleChapters = {
  healthcareExamples: {
    title: "Příklady: přechody dosažitelnosti",
    paragraphs: [
      "Stavy lze použít jako podmínky i spouštěče akcí. Rozlišujte změnu dosažitelnosti, například úspěšný hovor změní Unreachable na Reachable, a reakci automatizace: oznámení, úkol nebo potvrzení další otázky.",
      "Pravidlo nyní nemůže pomocí POTOM libovolně přepsat systémový stav na Reachable. Ten musí vycházet z výsledku hovoru. Jde o návody, nikoli zapnutá pravidla; čtení nápovědy nic nevytváří ani neodesílá.",
      "Mission → Nastavení → Status List → Pravidla a akce → Dosažitelnost poskytovatele. Rozbalte společnou konfiguraci a u odpovědi vyberte Nastavit akce. V pravidle pro jinou otázku vyberte odpověď jako zdroj v KDYŽ a doplňte POKUD. Potřebné stavy musí mít zapnuté Použít.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable po úspěšném hovoru", paragraphs: [
        "Situace: Pět pokusů selhalo. Při dalším pokusu odpoví lékař nebo personál. Spojený hovor splní nastavené minimum — výchozí jsou 3 sekundy. Systém nastaví Reachable a vynuluje neúspěšné pokusy.",
        "KDYŽ: aktivuje se Reachable\nPOTOM: odešli interní oznámení\n„Kontakt je opět dosažitelný.“",
        "Oznámení nastavte přes Reachable → Nastavit akce. Nebo odpověď použijte jako zdroj pravidla potvrzujícího běžnou otázku „Telefonický kontakt ověřen“.",
        "Pozor: Akce reaguje na přechod do Reachable obecně, nejen z Unreachable.",
      ] },
      { title: "2. Wrong number → úkol → ověřený hovor", paragraphs: [
        "Situace: Na čísle odpovídá nesprávná osoba.",
        "POSTUP:\nOtevři Nový úkol a vyber Nesprávné telefonní číslo\n↓ vyber důvod a existující telefonní pole nabídnuté pro kliniku nebo nemocnici\n↓ úkol zaznamená důvod a nahlášené číslo; nevyžaduje zadání nového čísla\n↓ případnou opravu ulož do zdravotnického záznamu a zavolej na opravené číslo\n↓ při ukončení hovoru potvrď pouze tehdy, když se dovoláš správnému poskytovateli nebo personálu",
        "Požádat o ověření je pouze žádost; samo o sobě nemění zdravotnický stav dosažitelnosti. Ovládací prvek ověření se zobrazí až po přiřazení hovoru a čísla k hlášení nebo opravě. Hovor musí splnit nastavenou minimální dobu. Technické přijetí hovoru samo o sobě není potvrzením.",
        "Žádost o ověření je svázána s aktuální Mission, relací, zdravotnickým subjektem, problémem a číslem. Po přepnutí kontaktu nepotvrzuj starou úlohu.",
        "Samotná oprava čísla nedokazuje úspěšné spojení. Před označením čísla za ověřené je nutný odpovídající hovor s dostatečnou délkou a výslovné potvrzení agenta.",
      ] },
      { title: "3. Pět neúspěšných pokusů → e-mail", paragraphs: [
        "Ponechte limit 5 a přidejte e-mail přes Unreachable → Nastavit akce.",
        "KDYŽ: aktivuje se Unreachable\nPOKUD: Dosažitelnost poskytovatele = Unreachable\nA: Neúspěšné pokusy ≥ 5\nPOTOM: odešli e-mail určenému příjemci",
        "Nastavte příjemce, předmět, obsah a automatické provedení nebo kontrolu. E-mail spouští změna stavu, ne každé otevření karty ani každý další neúspěšný pokus.",
      ] },
      { title: "4. Not working → nahlášení vybraného čísla", paragraphs: [
        "Otevři Nový úkol, vyber Nesprávné telefonní číslo, důvod „Číslo nefunguje“ a existující telefonní pole, které je třeba prověřit.",
        "Úkol zaznamená vybrané číslo a důvod. Potichu nemění dosažitelnost ani nepřidává náhradní číslo; zdravotnický záznam oprav obvyklým postupem.",
        "Po opravě lze při ukončení hovoru zkontrolovat odpovídající hovor, který splňuje minimální dobu. Agent musí výslovně potvrdit správného poskytovatele nebo personál; technické přijetí hovoru nestačí.",
      ] },
      { title: "5. Dosažitelnost jako podmínka běžné otázky", paragraphs: [
        "Spouštěčem nemusí být přímo jeden ze sedmi stavů.",
        "KDYŽ: agent potvrdí „Pokračovat v telefonickém oslovení“\nPOKUD: Dosažitelnost poskytovatele = Reachable\nPOTOM: potvrď krok „Telefonický kontakt ověřen“",
        "Nebo omezte konkrétní akci:\nProvést pouze pokud stav = Unreachable\nA neúspěšné pokusy ≥ 5.",
        "Potvrzení jiné otázky nemusí spustit její akce. Podle potřeby výslovně zapněte automatizace cílové otázky a zkontrolujte smyčky a duplicity.",
      ] },
      { title: "Aktuální omezení", paragraphs: [
        "Lze nastavit „přejde do Reachable“ a „aktuální stav je Reachable“. Přesný filtr „předchozí stav byl Wrong number a nový je Reachable“ editor zatím nemá.",
        "Reachable zůstává i po pozdějším neúspěšném pokusu, který se eviduje zvlášť. Běžný neúspěch proto neznamená návrat do Unreachable.",
        "Stav a počítadlo patří jedné konfiguraci příslušné Mission a kontaktu. Chybějící nebo nejednoznačný zdroj, pozastavení či nepovolený výsledek nelze považovat za splněnou podmínku.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Příklady: další automatizace",
    paragraphs: [
      "Rozpracování dříve připravených možností. Název, popis ani SYS samy nic neprovádějí; ověřte skutečnou akci a parametry.",
      "U každé akce zvolte automatické provedení nebo kontrolu a potvrzení. Skrytí zdroje nevypíná vyhodnocování. První zjištění existujícího stavu je výchozí stav, nikoli zpětné spuštění akcí. V Batch respektujte uložení Status Listu.",
    ],
    examples: [
      { title: "1. Unreached → callback za šest pracovních dní", paragraphs: [
        "Situace: Neúspěšný pokus pod limitem pro Unreachable, bez zachovaného Reachable.",
        "KDYŽ: nový neúspěšný pokus aktivuje Unreached\nPOTOM: naplánuj callback za 6 pracovních dní v 09:00",
        "Přes Unreached → Nastavit akce ověřte posun 6 dní, pracovní dny, 09:00 a politiku existujícího callbacku. Výchozí vytvořená akce existující termín zachovává, nikoli automaticky přesouvá.",
        "Koordinátor může termín změnit v Queue. Otevření karty nevytváří další callback.",
      ] },
      { title: "2. Spojený záznamník → oprava na Unreached", paragraphs: [
        "Situace: Technicky spojený hovor zvedl záznamník, nikoli lékař či personál.",
        "POSTUP: otevři Zkontrolovat stav\nOZNAČ: poslední spojený hovor jako záznamník\nULOŽ: kontrolu",
        "Tento hovor není důkaz Reachable. Bez jiného úspěšného hovoru je pod limitem výsledkem Unreached; po dosažení limitu může být Unreachable. Akce vycházejí ze skutečného výsledku.",
        "Označení patří konkrétnímu poslednímu hovoru. Nejde o pravidlo, že každý krátký hovor je záznamník.",
      ] },
      { title: "3. Long-term absent → interní oznámení", paragraphs: [
        "Koordinátor ověří dlouhodobou nepřítomnost a uloží Long-term absent přes Zkontrolovat stav.",
        "KDYŽ: aktivuje se Long-term absent\nPOTOM: upozorni určeného uživatele nebo skupinu\n„Ověřit další postup během dlouhodobé nepřítomnosti.“",
        "Nastavte příjemce a text. Stav nemění počítadlo a nemá automatický časový limit. Text „ozvat se za měsíc“ nevytvoří callback; nastavte jej jako samostatnou podporovanou akci.",
      ] },
      { title: "4. Historie komunikace → podmínka další akce", paragraphs: [
        "Při potvrzení běžné otázky zohledněte, zda je v této Mission evidován odeslaný e-mail.",
        "KDYŽ: agent potvrdí příslušnou otázku\nPOKUD: historie komunikace — odeslaný e-mail = ano\nPOTOM: potvrď krok „E-mail již odeslán“",
        "Vyberte pole historie, nikoli poznámku nebo telefon. Případnou další akci nastavte na cílovém kroku a výslovně povolte její spuštění pravidlem.",
        "Odeslání neznamená doručení ani odpověď. Podmínka není časovač „X dní bez odpovědi“ ani sama nerozlišuje konkrétní šablonu či obsah.",
      ] },
    ],
  },
};
