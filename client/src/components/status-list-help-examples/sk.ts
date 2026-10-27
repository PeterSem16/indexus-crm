import type { ExampleChapters } from "./types";

export const sk: ExampleChapters = {
  healthcareExamples: {
    title: "Príklady: prechody dosiahnuteľnosti",
    paragraphs: [
      "Tieto stavy môžeš používať ako podmienky aj ako spúšťače akcií. Dôležité je však rozlíšiť zmenu dosiahnuteľnosti — napríklad úspešný hovor zmení Unreachable na Reachable — a reakciu automatizácie: po tejto zmene odošleš oznámenie, vytvoríš úlohu alebo potvrdíš inú otázku.",
      "Aktuálne nie je možné v pravidle cez POTOM ľubovoľne prepísať systémový stav na Reachable. Ten musí vychádzať z výsledku hovoru. Nižšie sú konkrétne príklady nastavenia. Ide o návody, nie o už zapnuté pravidlá; čítanie helpu nič nevytvára ani neodosiela.",
      "Kde nastavovať: Mission → Nastavenia → Status List → Pravidlá a akcie → Dosiahnuteľnosť poskytovateľa. Rozbaľ spoločnú konfiguráciu. Pri príslušnej odpovedi vyber Nastaviť akcie. Pre pravidlo ovplyvňujúce inú otázku vyber túto odpoveď ako zdroj v KEĎ a podmienky doplň v AK. Potrebné stavy musia mať zapnuté Použiť.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable po úspešnom hovore", paragraphs: [
        "Situácia: Päťkrát sa nepodarilo dovolať. Pri ďalšom pokuse zdvihne lekár alebo personál.",
        "Zmena stavu: Hovor je spojený a trvá aspoň nastavené minimum — predvolene 3 sekundy. Systém nastaví Reachable a vynuluje počítadlo neúspešných pokusov.",
        "Príklad nadväzujúcej automatizácie:\nKEĎ: aktivuje sa odpoveď Reachable\nPOTOM: odošli interné oznámenie\n„Kontakt je opäť dosiahnuteľný.“",
        "Pri odpovedi Reachable → Nastaviť akcie nastavíš oznámenie. Alebo ju použiješ ako zdroj pravidla, ktoré potvrdí inú bežnú otázku, napríklad „Telefonický kontakt overený“.",
        "Pozor: Takto nastavená akcia reaguje na prechod do Reachable všeobecne, nielen z Unreachable.",
      ] },
      { title: "2. Wrong number → úloha → overený hovor", paragraphs: [
        "Situácia: Na čísle sa ozýva nesprávna osoba.",
        "POSTUP:\nOtvor Novú úlohu a vyber Nesprávne telefónne číslo\n↓ vyber dôvod a existujúce telefónne pole ponúknuté pre kliniku alebo nemocnicu\n↓ úloha zaznamená vybraný dôvod a nahlásené číslo; nežiada zadanie nového čísla\n↓ prípadnú opravu ulož do zdravotníckeho záznamu a zavolaj na opravené číslo\n↓ pri ukončení hovoru potvrď iba vtedy, keď sa dovoláš správnemu poskytovateľovi alebo personálu",
        "Požiadať o overenie je len požiadavka; samo osebe nemení zdravotnícky stav dosiahnuteľnosti. Ovládací prvok overenia sa zobrazí až po priradení hovoru a čísla k hláseniu alebo oprave. Hovor musí spĺňať nastavené minimálne trvanie. Technické prijatie hovoru samo osebe nie je potvrdením.",
        "Požiadavka na overenie je naviazaná na aktuálnu Mission, reláciu, zdravotnícky subjekt, problém a číslo. Po prepnutí kontaktu nepotvrdzuj starú úlohu.",
        "Samotná oprava čísla nedokazuje úspešné spojenie. Pred označením čísla za overené je potrebný zodpovedajúci hovor s dostatočným trvaním a výslovné potvrdenie agenta.",
      ] },
      { title: "3. Päť neúspešných pokusov → e-mail", paragraphs: [
        "V nastavení dosiahnuteľnosti ponecháš limit 5. Pri Unreachable → Nastaviť akcie pridáš e-mailovú akciu.",
        "KEĎ: aktivuje sa Unreachable\nAK: Dosiahnuteľnosť poskytovateľa = Unreachable\nA: Neúspešné pokusy ≥ 5\nPOTOM: odošli e-mail určenému príjemcovi",
        "Vyberieš príjemcu, predmet, obsah a automatické vykonanie alebo kontrolu pred vykonaním.",
        "E-mail sa neodosiela pri každom otvorení karty. Spúšťa ho príslušná zmena stavu. Pravidlo neznamená pravidelné opakovanie e-mailu pri každom ďalšom neúspešnom pokuse.",
      ] },
      { title: "4. Not working → nahlásenie vybraného čísla", paragraphs: [
        "Otvor Novú úlohu, vyber Nesprávne telefónne číslo, dôvod „Číslo nefunguje“ a existujúce telefónne pole, ktoré treba preveriť.",
        "Úloha zaznamená vybrané číslo a dôvod. Potichu nemení dosiahnuteľnosť ani nepridáva náhradné číslo; zdravotnícky záznam oprav obvyklým postupom.",
        "Po oprave možno pri ukončení hovoru preveriť zodpovedajúci hovor, ktorý spĺňa minimálne trvanie. Agent musí výslovne potvrdiť správneho poskytovateľa alebo personál; technické prijatie hovoru nestačí.",
      ] },
      { title: "5. Dosiahnuteľnosť ako podmienka bežnej otázky", paragraphs: [
        "Nemusíš spúšťať pravidlo priamo zo siedmich stavov. Napríklad:",
        "KEĎ: agent potvrdí otázku „Pokračovať v telefonickom oslovení“\nAK: Dosiahnuteľnosť poskytovateľa = Reachable\nPOTOM: potvrď nadväzujúci krok „Telefonický kontakt overený“",
        "Alebo v podmienkach konkrétnej akcie:\nVykonaj akciu iba vtedy, keď stav = Unreachable\nA počet neúspešných pokusov ≥ 5.",
        "Ak pravidlo potvrdzuje inú otázku, samotné potvrdenie ešte nemusí spustiť jej akcie. Ak to potrebuješ, zapni aj spúšťanie automatizácií cieľovej otázky a skontroluj, že nevzniká slučka ani zdvojenie.",
      ] },
      { title: "Čo zatiaľ treba odlíšiť", paragraphs: [
        "Dnes vieš nastaviť „keď prejde do Reachable“ a podmienku „aktuálny stav je Reachable“. Presný filter „predchádzajúci stav bol Wrong number a nový je Reachable“ zatiaľ editor nemá.",
        "Reachable zostáva zachovaný aj po neskoršom neúspešnom pokuse; neúspešný pokus sa eviduje osobitne. Bežný neúspech preto automaticky neznamená návrat z Reachable do Unreachable.",
        "Stav a počítadlo sa čítajú z jednej konfigurácie príslušnej Mission a kontaktu. Pri chýbajúcom alebo nejednoznačnom zdroji, pozastavení či nepovolenom výsledku sa na tieto podmienky nemožno spoľahnúť ako na splnené.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Príklady: ďalšie automatizácie",
    paragraphs: [
      "Nasledujúce príklady rozpisujú aj skôr pripravené možnosti. Názov otázky, popis ani označenie SYS samy osebe nič nevykonajú; vždy skontroluj skutočnú akciu a jej parametre.",
      "Pri každej akcii zvoľ automatické vykonanie alebo kontrolu a potvrdenie. Skrytie zdrojovej otázky nie je vypnutie vyhodnocovania. Prvé zistenie existujúceho systémového stavu je východiskový stav, nie pokyn spätne vykonať všetky akcie. V režime Batch rešpektuj uloženie Status Listu.",
    ],
    examples: [
      { title: "1. Unreached → callback o šesť pracovných dní", paragraphs: [
        "Situácia: Pokus bol neúspešný, limit pre Unreachable ešte nebol dosiahnutý a kontakt zatiaľ nemá zachovaný Reachable.",
        "KEĎ: nový neúspešný pokus aktivuje Unreached\nPOTOM: naplánuj callback o 6 pracovných dní o 09:00",
        "Pri Unreached → Nastaviť akcie otvor akciu callbacku. Skontroluj posun 6 dní, pracovné dni, čas 09:00 a politiku existujúceho callbacku. Predvolená vytvorená akcia existujúci callback zachováva; nemení automaticky každý už dohodnutý termín.",
        "Koordinátor môže termín zmeniť v Queue. Samotné znovuotvorenie karty nesmie vytvoriť ďalší callback.",
      ] },
      { title: "2. Spojený odkazovač → oprava na Unreached", paragraphs: [
        "Situácia: Hovor bol technicky spojený, ale namiesto lekára či personálu sa ozval odkazovač.",
        "POSTUP: otvor Skontrolovať stav\nOZNAČ: posledný spojený hovor ako odkazovač\nULOŽ: kontrolu",
        "Takto označený hovor nie je dôkaz Reachable. Ak neexistuje iný úspešný hovor a nebol dosiahnutý limit, výsledkom je Unreached; po dosiahnutí limitu môže byť Unreachable. Nadväzujúce akcie sa riadia skutočným výsledným stavom.",
        "Označenie sa viaže na konkrétny posledný hovor. Nie je to pravidlo „každý krátky hovor je odkazovač“.",
      ] },
      { title: "3. Long-term absent → interné oznámenie", paragraphs: [
        "Situácia: Koordinátor overí dlhodobú neprítomnosť a uloží Long-term absent cez Skontrolovať stav.",
        "KEĎ: aktivuje sa Long-term absent\nPOTOM: odošli oznámenie určenému používateľovi alebo skupine\n„Overiť ďalší postup počas dlhodobej neprítomnosti.“",
        "Pri tejto odpovedi nastav príjemcu a text akcie. Dlhodobá neprítomnosť nemení počítadlo neúspešných pokusov.",
        "Tento stav nemá automatický časový limit. Samotná veta „ozvať sa o mesiac“ nevytvorí callback; ten musíš nastaviť ako samostatnú podporovanú akciu.",
      ] },
      { title: "4. História komunikácie → podmienka pred ďalšou akciou", paragraphs: [
        "Situácia: Pri potvrdení bežnej otázky chceš zohľadniť, či už bol v tejto Mission zaznamenaný odoslaný e-mail.",
        "KEĎ: agent potvrdí príslušnú otázku\nAK: história komunikácie — odoslaný e-mail = áno\nPOTOM: potvrď bežný krok „E-mail už odoslaný“",
        "V AK vyber príslušné pole histórie komunikácie, nie textovú poznámku alebo číslo telefónu. Ak potrebuješ naviazať ďalšiu akciu, nastav ju na cieľovom kroku a výslovne povoľ jej spustenie pravidlom.",
        "Odoslaný e-mail neznamená potvrdené doručenie ani odpoveď. Takáto podmienka tiež sama nie je časovačom „X dní bez odpovede“ a nezaručuje rozlíšenie konkrétnej šablóny alebo obsahu.",
      ] },
    ],
  },
};
