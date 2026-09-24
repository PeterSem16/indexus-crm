# INDEXUS AI asistent pre Mission a Status List automatizácie

**Stav:** návrh na diskusiu a postupnú implementáciu  
**Dátum:** 24. september 2026  
**Rozsah:** tvorba a správa automatizácií Status Listu; neskôr triedenie Back Office požiadaviek z Nexus Pulse

## 1. Stručné odporúčanie

INDEXUS má využiť OpenAI ako **asistenta na porozumenie požiadavkám, zostavenie návrhu pravidla a neskôr triedenie neštruktúrovaných požiadaviek**. AI nemá priamo a bez kontroly vykonávať zmeny v CRM.

Odporúčaný model:

1. Manažér alebo agent opíše, čo potrebuje, bežným jazykom.
2. AI z toho vytvorí návrh založený iba na podporovaných spúšťačoch, podmienkach, skupinách, kanáloch a akciách.
3. INDEXUS návrh skontroluje podľa oprávnení a pravidiel konkrétnej Mission.
4. Človek návrh skontroluje a schváli.
5. Uložené pravidlo vykoná existujúci serverový kód deterministicky.
6. INDEXUS zaznamená návrh, schválenú verziu, výsledok vykonania a prípadné chyby.

Tým sa AI používa na zníženie času potrebného na návrh a údržbu, nie ako náhrada za vykonávacie jadro, bezpečnostné kontroly alebo schvaľovanie.

## 2. Východiskový stav INDEXUS

### Status List

Status List už podporuje automatizácie pripojené ku kroku a prípadne k otázke. Medzi súčasné typy akcií patria:

- vytvorenie a priradenie úlohy role alebo skupine,
- priorita, termín a text úlohy,
- email skupine alebo priamo kontaktu,
- SMS kontaktu,
- nastavenie statusu alebo callbacku,
- notifikácie a webhooky,
- podmienky, napríklad krajina, odpoveď alebo zmena poľa.

Konfigurácia je uložená v `campaign_status_list_automations`. Pri potvrdení položky Status Listu server načíta priradené pravidlá, vyhodnotí podmienky a zavolá konkrétne implementované akcie.

V kóde sú aj tri preddefinované šablóny Status Listu: **CLA (21 položiek), CLB (8) a MPN (69)**. Builder umožňuje vybrať, ktoré kroky a ktoré z ich navrhnutých automatizácií sa majú skopírovať do konkrétnej Mission. Nie sú preto dôkazom, že každá živá Mission má rovnaký Status List alebo rovnaké aktívne pravidlá.

Pri interpretácii šablón treba navyše rozlišovať medzi ich textovým opisom a vykonateľnou konfiguráciou: podmienky a časovanie sa pri vložení ukladajú aj ako popis kroku; samostatné záznamy automatizácií vzniknú len pre používateľom vybrané automatizácie. AI nesmie opis v šablóne považovať za strojovo vynucovanú podmienku bez overenia konkrétnej implementácie.

### Ďalší automatizačný systém

Projekt obsahuje aj samostatný Workflow Automation Engine s udalosťami, podmienkami, definovanými akciami, testovacím spustením a históriou behov. Zatiaľ ide o oddelenú cestu od vykonávania automatizácií Status Listu.

Jeho katalóg dnes uvádza moduly `customer`, `task`, `contract`, `hospital`, `clinic`, `invoice` a `call`; medzi všeobecné spúšťače patria vytvorenie, zmena, zmena statusu, dokončená/expirovaná úloha, plánovaný tick a udalosti prichádzajúceho hovoru. Katalóg akcií zahŕňa okrem iného úlohu, notifikáciu, email, SMS, webhook a obmedzenú zmenu povolených polí. Prítomnosť modulu v katalógu však sama osebe nedokazuje, že všetky jeho vstupné a aktualizačné cesty posielajú udalosti do enginu.

**Odporúčanie:** nezačínať vytvorením ďalšieho, tretieho automatizačného jadra. Prvá verzia AI má vytvárať návrhy, ktoré sa dajú uložiť ako existujúce automatizácie Status Listu. Neskôr možno vyhodnotiť spoločný katalóg a vykonávaciu vrstvu pre oba systémy.

### Čo dnes vyžaduje prácu v kóde

Konfigurácia už vie zložiť viacero častých postupov. Keď však Mission potrebuje nový druh akcie alebo odlišné správanie, spravidla treba upraviť rozhranie, dátový model a serverovú implementáciu. AI môže zjednodušiť skladanie a opakovanie existujúcich postupov; nemala by predstierať, že vie bezpečne vytvárať nové schopnosti systému iba promptom.

## 3. Ciele a hranice

### Ciele

- Skrátiť čas potrebný na vytvorenie a zmenu pravidiel.
- Používať znovupoužiteľné playbooky pre opakované postupy naprieč Missions.
- Zobraziť manažérovi ľudsky čitateľný návrh aj presný zoznam zmien.
- Pred uložením ukázať, kedy sa pravidlo spustí a čo vykoná.
- Zachovať oprávnenia, Mission kontext, existujúce doručovacie pravidlá a audit.
- V ďalšej etape znížiť ručné triedenie požiadaviek z Nexus Pulse do Back Office.

### Čo AI v prvej verzii robiť nebude

- Sama aktivovať alebo meniť produkčné automatizácie.
- Vymýšľať a spúšťať ľubovoľný SQL, JavaScript, webhook alebo API volanie.
- Sama vyberať neobmedzených príjemcov emailov či SMS.
- Sama meniť roly, oprávnenia, nastavenia SMS brány alebo viditeľnosť kontaktov.
- Učiť sa nové pravidlá z každej akcie zamestnanca bez schválenia.
- Nahrádzať existujúci Status List ani Workflow Automation Engine.

## 4. Zamýšľané používateľské toky

### Tok A — manažér vytvorí automatizáciu pomocou asistenta

1. Manažér otvorí konkrétnu Mission a jej Status List.
2. Vyberie krok, otázku alebo opakovateľný playbook a otvorí asistenta.
3. Opíše požadované správanie. Môže písať po slovensky alebo v inom podporovanom jazyku.
4. Asistent pracuje iba s kontextom tejto Mission: jej krokmi, otázkami, aktívnymi skupinami, rolami, šablónami a povolenými kanálmi.
5. AI vráti štruktúrovaný návrh. Ak chýba podstatná informácia, položí doplňujúcu otázku namiesto hádania.
6. Server overí každý identifikátor a hodnotu. Neznámy krok, skupina, šablóna, rola alebo kanál sa nesmie potichu ignorovať.
7. Rozhranie zobrazí zhrnutie, podmienky, príjemcov, termín, prioritu, kanály a označenie citlivých akcií.
8. Manažér použije náhľad/test na reprezentatívnych údajoch a skontroluje, či sa pravidlo spustí v očakávaných prípadoch.
9. Manažér návrh schváli. Až potom ho INDEXUS zapíše ako aktívnu konfiguráciu, ktorú vykonáva existujúci serverový kód.

Návrh AI sa nesmie zapísať do aktívnej tabuľky automatizácií pred schválením. Ak bude treba návrhy uchovávať aj po zatvorení obrazovky, majú mať oddelený koncept návrhu/verzie, ktorý vykonávací proces nikdy nepovažuje za aktívne pravidlo.

### Tok B — Status List vykoná schválené pravidlo

1. Agent potvrdí položku alebo odpoveď v Status Liste.
2. Server určí skutočnú Mission, kontakt, agenta a potvrdený krok.
3. Existujúci serverový kód vyhodnotí uložené podmienky.
4. Vykonajú sa iba explicitne schválené akcie z podporovaného katalógu.
5. INDEXUS uloží výsledok, aby manažér vedel zistiť, ktoré pravidlo sa spustilo a čo vytvorilo alebo odoslalo.

Bežné deterministické pravidlá nemajú pri každom potvrdení volať AI. Model sa má použiť tam, kde treba interpretovať voľný text alebo vytvoriť návrh; jednoduché pravidlá majú zostať rýchle a predvídateľné.

### Tok C — agent pošle požiadavku Back Office z Nexus Pulse

Toto je neskoršia etapa, nie podmienka pre prvé nasadenie asistenta.

1. Agent napíše požiadavku voľným textom.
2. AI navrhne štruktúru úlohy: typ požiadavky, skupinu, prioritu, termín a krátke interné zhrnutie.
3. Agentovi sa zobrazí návrh na kontrolu ešte pred odoslaním.
4. Ak text nie je jednoznačný alebo cieľová skupina nie je známa, systém požiada o doplnenie alebo nechá úlohu na bežnom Back Office triage.
5. Po odoslaní vytvorí úlohu existujúci Back Office tok. AI sama neobchádza oprávnenia ani nemení príjemcov mimo dostupných skupín.

## 5. Štruktúrovaný výstup AI

Model má vrátiť dáta v pevnej schéme, nie voľný text určený na vykonanie. Ilustračný návrh:

```json
{
  "summary": "Pri záujme kliniky vytvoriť internú úlohu pre zmluvnú skupinu.",
  "trigger": {
    "statusListItemId": "vybrané-id-kroku"
  },
  "conditions": [],
  "actions": [
    {
      "type": "assign_task",
      "taskGroupId": "overené-id-skupiny",
      "priority": "high",
      "deadline": "+2d",
      "description": "Kontaktovať kliniku a pripraviť ďalší krok."
    },
    {
      "type": "notify_group",
      "channels": ["in_app"]
    }
  ],
  "needsClarification": false,
  "warnings": []
}
```

Ide o návrhový kontrakt, nie o prísľub konkrétnych názvov polí. Pred implementáciou ho treba zosúladiť s reálnym dátovým modelom a podporovanými akciami.

Server musí:

- validovať výstup schémou a katalógom podporovaných akcií,
- overiť, že všetky referencie patria do danej Mission alebo sú pre ňu viditeľné,
- vyradiť alebo odmietnuť neznáme polia a akcie,
- odvodiť krajinu, SMS provider, používateľa a prístup ku kontaktu zo serverového kontextu,
- pred vykonaním zabrániť duplicitnému spracovaniu tej istej udalosti,
- odmietnuť požiadavku pri nedostupnom modeli alebo neplatnom výstupe; nič nevykonávať „odhadom“.

## 6. Príklady

### Príklad 1 — záujem kliniky

**Požiadavka manažéra:**

> Keď klinika v kroku „Záujem“ potvrdí, že chce pokračovať, vytvor úlohu pre skupinu Contracts. Nastav vysokú prioritu, termín do dvoch dní a upozorni skupinu v aplikácii. Klinike nič neposielaj.

**Čo má asistent navrhnúť:**

- spúšťací krok „Záujem“ v aktuálnej Mission,
- podmienku pre konkrétnu odpoveď „chce pokračovať“,
- internú úlohu pre overenú skupinu Contracts,
- vysokú prioritu a termín podľa pravidiel Mission,
- notifikáciu iba v aplikácii,
- žiadny email ani SMS kontaktu.

Manažér pred uložením vidí presný názov vybratej skupiny a testovací príklad, pri ktorom sa pravidlo spustí.

### Príklad 2 — podpísaná zmluva, chýbajúci dokument

**Požiadavka manažéra:**

> Keď sa označí „Zmluva podpísaná“, vytvor Back Office úlohu pre skupinu Documentation. Termín jeden pracovný deň. Do poznámky uveď, že treba skontrolovať chýbajúci sken. Informuj iba skupinu v Pulse.

**Správanie:**

- úloha sa vytvorí iba pri potvrdení príslušného kroku,
- príjemcom je overená skupina Documentation v danej Mission,
- termín interpretuje INDEXUS podľa zadefinovanej pracovnej/zónovej logiky; ak ju systém zatiaľ nemá, asistent nesmie zameniť pracovný deň za 24 hodín bez upozornenia,
- notifikácia ide do aplikácie, nie externým emailom alebo SMS.

### Príklad 3 — nejednoznačná požiadavka agenta

**Text agenta z Nexus Pulse:**

> Prosím vybaviť kliniku čo najskôr a dať vedieť vedúcemu.

**Správanie:**

- AI nenastaví svojvoľne termín, prioritu ani konkrétneho vedúceho,
- opýta sa, ktorú Back Office skupinu alebo rolu treba zapojiť, prípadne použije schválené pravidlo Mission, ak také existuje,
- pred odoslaním ukáže agentovi vytváranú úlohu a cieľovú skupinu,
- ak sa príjemca nedá bezpečne určiť, ponúkne bežné manuálne zaradenie do Back Office fronty.

### Príklad 4 — riziková akcia

**Požiadavka:**

> Keď kontakt odmietne spoluprácu, pošli mu automaticky SMS s vysvetlením a uzavri kontakt.

Asistent môže navrhnúť postup, ale musí označiť externú SMS aj zmenu statusu ako akcie vyžadujúce výslovné schválenie manažéra. Musí použiť schválenú SMS šablónu a Mission nastavenia pre SMS; AI nesmie sama generovať a odosielať text bez kontroly.

## 7. Playbooky a „učenie“ asistenta

Na začiatok netreba trénovať vlastný model. Udržateľnejší prvý variant je:

- krátka, spravovaná báza pravidiel INDEXUS,
- vysvetlenie podporovaných krokov a akcií,
- schválené playbooky, napríklad zmluva, záujem kliniky, callback alebo doplnenie dokumentov,
- kontext a rozdiely konkrétnej Mission,
- pár schválených príkladov formulácií a ich výsledných konfigurácií.

Playbook má mať vlastníka, stav (návrh/schválený/neaktívny) a verziu. Úprava všeobecného playbooku nemá automaticky meniť už schválené pravidlá v každej Mission. Manažér má vidieť, ktoré Mission používajú staršiu verziu, a rozhodnúť, či zmenu prevezmú.

Opravy od používateľov možno ukladať ako **návrhy na zlepšenie**. Do spoločnej znalostnej bázy sa dostanú až po kontrole a schválení. Tým predídeme tomu, aby jeden chybný alebo výnimočný postup začal model opakovať ako všeobecné pravidlo.

## 8. Bezpečnosť, súkromie a spoľahlivosť

### Oprávnenia a izolácia Missions

- Každá požiadavka AI musí mať explicitný serverom overený kontext Mission.
- Model dostane iba minimálne údaje potrebné na danú úlohu, nie celý záznam kontaktu ani celú históriu kampane.
- Oprávnenia sa kontrolujú na serveri aj po návrate odpovede modelu.
- AI nesmie určiť inú Mission, krajinu, rolu alebo cieľového používateľa mimo povoleného výberu.
- Viditeľnosť kontaktov pre agentov sa nesmie rozšíriť tým, že AI vytvorí alebo obohatí úlohu.

### Email, SMS a externé systémy

- Externé odosielanie je vyššie riziko ako interná úloha alebo Pulse notifikácia.
- Používajú sa existujúce schválené šablóny a serverové pravidlá pre country mailbox/SMS provider.
- Obsah emailu alebo SMS sa nesmie dopĺňať citlivými detailmi kontaktu len preto, že sa objavili v prompt-e.
- Webhooky môžu smerovať iba na administrátorom schválené ciele; AI nesmie definovať ľubovoľný URL ani hlavičky.
- AI návrhy a auditné logy nesmú obsahovať heslá, tokeny ani nepotrebné osobné údaje.

### Ochrana pred duplicitami a chybami

- Každé potvrdenie/požiadavka potrebuje identifikátor na idempotentné spracovanie.
- Opakovaný pokus po chybe nesmie odoslať druhú SMS alebo vytvoriť druhú úlohu.
- Model timeout, nedostupnosť, neúplný JSON alebo konflikt s pravidlami znamená „nevykonať“ a zobraziť zrozumiteľnú chybu alebo manuálnu cestu.
- Náhľad pravidla musí oddeliť „čo by sa spustilo“ od skutočného vykonania.
- Každá produkčná zmena musí mať autora, schvaľovateľa, verziu konfigurácie a záznam o výsledku.

## 9. Navrhované etapy realizácie

### Etapa 0 — potvrdiť proces a hranice

**Výstup:** odsúhlasený katalóg prvých akcií, skupín a pravidiel.

- Vybrať jednu pilotnú Mission a niekoľko častých automatizácií.
- Zistiť, ktoré kroky dnes manažéri opakujú pri nastavovaní.
- Určiť, čo môže manažér schváliť, čo musí potvrdiť agent a čo zostane vždy ručné.
- Dohodnúť pravidlá pre termíny, pracovné dni, notifikácie, šablóny a nejednoznačné požiadavky.

### Etapa 1 — spoločný katalóg povolených akcií

**Výstup:** serverom definovaný zoznam akcií, ich parametrov, rizika a validačných pravidiel.

- Zdokumentovať vstupy a výstupy existujúcich Status List akcií.
- Každú akciu opísať validovateľnou schémou.
- Označiť akcie ako interné, menia stav, posielajú externú komunikáciu alebo volajú externý systém.
- Zabezpečiť, aby neplatný alebo nepodporovaný návrh nebol možné uložiť ako aktívne pravidlo.

### Etapa 2 — AI asistent na vytvorenie návrhu

**Výstup:** manažér opíše pravidlo a dostane kontrolovateľný návrh.

- Pridať asistenta do Status List buildera pre jednu Mission.
- Posielať modelu zoznam existujúcich krokov, otázok, skupín, rolí a šablón, nie neobmedzený prístup k databáze.
- Vyžadovať štruktúrovaný výstup a validovať ho na serveri.
- Pri chýbajúcich údajoch klásť otázky; nevymýšľať identifikátory ani recipientov.
- Zatiaľ neaktivovať nič priamo z odpovede modelu.

### Etapa 3 — vysvetlenie, náhľad a test

**Výstup:** manažér rozumie podmienkam a možným následkom ešte pred uložením.

- Zobraziť čitateľné zhrnutie aj presnú konfiguráciu.
- Ukázať rizikové akcie a externých príjemcov výrazne.
- Pridať testovací náhľad: reprezentatívny kontakt/odpoveď, či pravidlo zodpovedá, aké akcie by vykonalo.
- Náhľad nesmie posielať email/SMS, meniť kontakt ani vytvárať reálne úlohy.
- Pridať zrozumiteľné chyby validácie a vysvetlenie, prečo návrh nemožno uložiť.

### Etapa 4 — schvaľovanie, verzie a pilot

**Výstup:** prvý kontrolovaný produkčný pilot.

- Ukladať návrhy oddelene od aktívnych automatizácií, kým nie sú schválené.
- Po schválení zapísať pravidlo do existujúceho vykonávacieho toku.
- Zachovať históriu zmien a umožniť vrátiť sa k predchádzajúcej verzii.
- Aktivovať len pre jednu pilotnú Mission a malú skupinu manažérov.
- Prvé pravidlá obmedziť na interné úlohy a interné notifikácie; externý email/SMS pridať po samostatnom overení.

### Etapa 5 — Back Office požiadavky z Nexus Pulse

**Výstup:** agent môže vytvoriť lepšie štruktúrovanú úlohu z voľného textu.

- Najprv iba navrhnúť kategóriu, skupinu, prioritu a termín.
- Agent pred odoslaním skontroluje a potvrdí výsledok.
- Neisté prípady ponechať na manuálne triedenie.
- Merať nesprávne zaradenia a najčastejšie opravy; opravy sa nestávajú pravidlom automaticky.

### Etapa 6 — obmedzené automatické vykonávanie

**Výstup:** automatické spracovanie iba presne definovaných, nízkorizikových prípadov.

- Povoliť len schválené playbooky s jasnými podmienkami a cieľmi.
- Nastaviť bezpečný fallback na človeka pri nízkej istote, chýbajúcom príjemcovi alebo rozpore pravidiel.
- Externé správy a zmeny s významným dopadom ponechať pod manažérskym schválením, kým pilot nepreukáže spoľahlivosť.
- Rozšíriť na ďalšie Missions až po vyhodnotení pilotu.

## 10. Meranie úspechu pilotu

Pilot má ukázať, či AI skutočne šetrí čas a pritom nezvyšuje prevádzkové riziko. Odporúčané metriky:

- čas od opisu požiadavky po schválený návrh,
- podiel návrhov schválených bez úprav a s menšími/väčšími úpravami,
- počet odmietnutých návrhov a dôvod odmietnutia,
- správnosť cieľovej skupiny a kanála podľa kontroly manažéra,
- duplicitné alebo nesprávne vykonané akcie,
- čas potrebný na opravu alebo deaktiváciu pravidla,
- počet prípadov, keď bolo potrebné prejsť na manuálny proces.

Pokračovanie do automatického vykonávania má zmysel až po tom, čo pilot potvrdí správne návrhy, spoľahlivé kontroly oprávnení, audit a bezpečné správanie pri zlyhaní.

## 11. Otvorené rozhodnutia pred implementáciou

1. Ktorá Mission bude pilotná a ktoré 3–5 automatizácií ju reprezentujú?
2. Ktoré interné akcie majú byť v prvej verzii podporované — iba Back Office úlohy a Pulse notifikácie, alebo aj callback/status?
3. Majú mať AI návrhy trvalý stav „draft“, alebo stačí, aby sa najprv vytvorili v builderi a uložili až po schválení?
4. Kto môže navrhovať, schvaľovať, aktivovať a deaktivovať automatizácie?
5. Aký fallback sa má použiť pri nejednoznačnej Back Office požiadavke?
6. Ktoré typy textu/údajov sa smú posielať do OpenAI a aké retenčné pravidlá budú platiť?
7. Kedy má byť externé email/SMS schválenie povinné a kto ho môže udeliť?

## 12. Rozhodnutie

Odporúčaný smer je **AI asistent nad existujúcim automatizačným systémom**:

- AI rozumie prirodzenému jazyku a pripravuje návrhy.
- Manažér schvaľuje konfiguráciu.
- Server overuje oprávnenia, Mission kontext a akcie.
- Existujúci vykonávací kód vykonáva pravidlá a zapisuje výsledky.
- Schválené playbooky znižujú opakovanú prácu naprieč Missions.

Prvý implementačný cieľ má byť **asistent na návrh a bezpečný náhľad Status List automatizácie pre jednu pilotnú Mission**. Triedenie požiadaviek z Nexus Pulse a automatické vykonávanie majú nasledovať až po overení tohto základu.

## Technické miesta v projekte, ktoré návrh rešpektuje

- `client/src/components/campaign-status-list-builder.tsx` — konfigurácia Status List automatizácií.
- `shared/schema.ts` — `campaign_status_list_automations` a existujúce polia pravidiel.
- `server/routes.ts` — podmienky a vykonávanie akcií pri potvrdení Status Listu.
- `server/lib/automation-engine.ts` a `server/lib/automation-routes.ts` — samostatný generický Workflow Automation Engine a jeho správa/testovanie.

## 13. Inventár šablón a uskutočniteľná automatizácia ďalších modulov

Táto časť dopĺňa pôvodný návrh o stav zistený v zdrojovom kóde. „Existuje v šablóne“ znamená predvolený záznam v klientskom kóde, nie potvrdenie, že záznam už je v produkčnej Mission alebo že jeho textový opis vykonáva pravidlo.

### 13.1 Ako čítať predvolené Status List šablóny

Status List builder vytvára vybrané položky cez API konkrétnej kampane a vytvára aj vybrané záznamy automatizácií. Podmienka `conditionIf`, text akcie `actionThen` a časovanie `callbackTiming` sa pritom skladajú do textového popisu kroku. Sú to užitočné procesné poznámky, ale samy osebe nie sú podmienkou vykonávania v automate.

Šablóna MPN navyše obsahuje dve automatizácie s typom `create_bo_task`. Tento typ sa nenašiel medzi aktuálnymi akciami editora a vetvami vykonávača Status Listu. Kým sa nepodporí a neotestuje, treba ho označiť ako **predvolený návrh v šablóne, nie ako overenú vykonateľnú akciu**.

Skratky rolí v tabuľkách: **KO** = koordinátor, **BO** = Back Office, **SYS** = systémový/informačný krok, **DB Admin** = správca databázy, **HP** = Healthcare Provider. Označenia rolí **KO+OR** sú ponechané tak, ako sú uložené v šablóne; zdroj im nepriraďuje slovné vysvetlenie. V MPN sú názvy uložené v angličtine; slovenská verzia ich v tejto šablóne neprekladá.

### 13.2 CLA — 21 predvolených krokov

| ID | Rola | Krok v šablóne | Predvolená automatizácia v šablóne |
|---|---|---|---|
| CLA-01 | DB Admin | Healthcare Provider pridelenie koordinátorovi | AT-SYS-01a: notifikácia role koordinátora, +24 h, stredná priorita |
| CLA-02 | KO | Call č. 1 — nadviazanie kontaktu | AT-08: úloha pre admina po 10× „Unreachable“, +24 h, vysoká |
| CLA-03 | KO | Call č. 2 — kvalifikácia a záujem o spoluprácu | AT-01: Email-01 ihneď; AT-02: Email-02 s opisom „+3 pracovné dni“ |
| CLA-03b | KO | Skratka — HP ihneď potvrdí záujem o podpis pri CLA-03 | AT-01-03b: Email-01; AT-03-03b: BO úloha na odoslanie Listu č. 2, +24 h, vysoká |
| CLA-04 | SYS | Auto-odoslanie Email-01 | — |
| CLA-05 | SYS | Auto-odoslanie Email-02 — informačné materiály | — |
| CLA-06 | KO | Call č. 3 — potvrdenie záujmu o zmluvu | — |
| CLA-07 | KO | Koordinátor označí „Odoslať zmluvu“ (F10) | AT-03: BO úloha na odoslanie Listu č. 2, +24 h, vysoká |
| CLA-08 | BO | Back Office odosiela List č. 2 (fyzický list so zmluvou) | AT-06: callback koordinátora po 7 dňoch, stredná |
| CLA-09 | KO | Call č. 4.0 — základná kontrola doručenia zmluvy | — |
| CLA-09a | KO | Call 4.1 — zmluva doručená, ešte nezaslaná späť | AT-09a-cb: callback po týždni; AT-17: eskalácia manažérovi po 4 opakovaniach, urgentná úloha |
| CLA-09b | KO | Call 4.2 — HP zmluvu odoslal späť, je v tranzite | AT-16: notifikácia koordinátora pri F14 → Yes |
| CLA-09c | KO | Call 4.3 — zmluva nebola doručená | AT-09: eskalácia manažérovi po 3 nedoručeniach, urgentná úloha |
| CLA-09d | KO | Call 4.a — zmluva sa stratila pri spätnom odoslaní | AT-09d-bo: BO úloha na náhradný originál Listu č. 3a |
| CLA-09e | KO | Doplnenie chýbajúcich údajov po neúspešnej validácii | AT-09e-bo: BO úloha na doplnenie údajov do zmluvy |
| CLA-10 | BO | Back Office validácia podpísanej zmluvy (BO5) | AT-07: zmena F06/F10 a callback koordinátora podľa textu šablóny |
| CLA-10b | KO | Call č. 4.b — informovanie HP o nových kópiách nepodpísanej zmluvy | AT-10b-bo: BO úloha na List č. 3b |
| CLA-11 | KO | Call č. 5 — potvrdenie zmluvy a materiály do čakárne | AT-04: BO úloha na odoslanie prvého balíka (BAL-1) |
| CLA-12 | BO | Back Office odosiela prvý balík gynekológovi | AT-15: callback koordinátora po týždni |
| CLA-13 | KO | Call č. 6 — overenie doručenia materiálov | AT-13: opis hovorí o rutinnom callbacku po 3 mesiacoch |
| CLA-DEC | KO | Healthcare Provider odmietol spoluprácu | AT-DEC-cb: opis callbacku po 6 mesiacoch, prípadne po 3 mesiacoch pri referral |

### 13.3 CLB — 8 predvolených krokov

| ID | Rola | Krok v šablóne | Predvolená automatizácia v šablóne |
|---|---|---|---|
| CLB-01 | KO | Rutinný callback (každé 3 mesiace) | AT-13-clb: callback koordinátora |
| CLB-02 | KO | Healthcare Provider ukončil spoluprácu | AT-14: notifikácia manažéra koordinátorov |
| CLB-03 | SYS | Priority Outreach — systémový trigger | AT-10: urgentná úloha koordinátorovi |
| CLB-04 | KO | Priority Outreach — koordinátor kontaktuje HP | AT-11: urgentná úloha koordinátorovi pri odmietnutí HP |
| CLB-05 | SYS | Invoice Follow-up — systémový trigger | V šablóne bez pripojenej automatizácie |
| CLB-06 | KO | Invoice Follow-up — koordinátor kontaktuje HP | V šablóne bez pripojenej automatizácie |
| CLB-07 | KO | Koordinátor oznámi potrebu doplnenia materiálov | AT-05: BO úloha na odoslanie štandardného balíka |
| CLB-08 | BO | Back Office odosiela štandardný balík (Replenishment) | — |

CLB-05 opisuje kontrolu 30 dní po zaslaní výsledkov a odkazuje na „AT-12“, ale daný krok nemá v zozname pripojenú automatizáciu. Nemožno ho teda prezentovať ako už fungujúce vynucované sledovanie faktúr.

### 13.4 MPN — 69 položiek (16 hlavných krokov a ich voliteľné odpovede)

Každý hlavný krok a jeho odpovede sú vypísané spolu; počet položiek v tejto šablóne je 69 vrátane 16 hlavných krokov.

| ID hlavného kroku / rola | Krok a odpovede predvolené v šablóne |
|---|---|
| MPN-01 — DB Admin | **Assigned Healthcare Provider**; MPN-01a: Unassigned to a medical representative; MPN-01b: Assigned to a medical representative |
| MPN-02 — DB Admin | **HP Assignment — To Whom**; MPN-02a: None (0 — not assigned); MPN-02b: Assigned to coordinator of collections |
| MPN-03 — DB Admin | **Healthcare Provider Reachability Status**; MPN-03a: Not defined yet; MPN-03b: Unreachable; MPN-03c: Reachable. Predvolená akcia: MPN-03-AT1 `create_bo_task`, DB Admin, +72 h, vysoká priorita (vykonateľnosť treba najprv potvrdiť). |
| MPN-04 — KO+OR | **Qualified or Unqualified Medical Partner**; MPN-04a: Unknown yet; MPN-04b: Qualified — provides healthcare to pregnant women; MPN-04c: Unqualified — does not provide healthcare to pregnant women |
| MPN-05 — KO+OR | **Willingness to Provide Ordered Services**; MPN-05a: Cooperation not offered yet; MPN-05b: Cooperation offered — considering; MPN-05c: Cooperation offered — agreed; MPN-05d: Cooperation offered — disagreed |
| MPN-06 — KO+OR | **Contract Proposal with HP**; MPN-06a: Contract is not necessary; MPN-06b: Contract proposal not offered yet; MPN-06c: Contract proposal offered — considering; MPN-06d: Contract proposal offered — accepted; MPN-06e: Contract proposal offered — unaccepted |
| MPN-07 — DB Admin | **Contract Proposal Sent via Email**; MPN-07a: Contract proposal not sent; MPN-07b: Contract proposal sent |
| MPN-08 — KO+BO | **Contract for Signing — Sent**; MPN-08a: Contract for signing not sent; MPN-08b: Contract for signing sent. Predvolená akcia: MPN-08-AT1 `create_bo_task`, Back Office, +48 h, vysoká priorita (vykonateľnosť treba najprv potvrdiť). |
| MPN-09 — BO | **Contract Sending Count** (informačný krok) |
| MPN-10 — KO+OR | **Contract Received by Partner**; MPN-10a: Unknown whether received; MPN-10b: Contract not received by partner; MPN-10c: Contract received by partner |
| MPN-11 — BO | **Signed Contract Received by CBC**; MPN-11a: Yes — signed contract received; MPN-11b: No — signed contract not yet received |
| MPN-12 — BO | **Signed Contract Validated**; MPN-12a: Not validated yet — signed contract returned, awaiting validation; MPN-12b: Contract did not pass validation; MPN-12c: Contract not resent; MPN-12d: Contract resent by HP; MPN-12e: Contract validated ✓ |
| MPN-13 — KO+OR | **Information Materials — Cord Blood Banking**; MPN-13a: Not offered yet; MPN-13b: Offered — offer accepted; MPN-13c: → Accepted: Not sent yet; MPN-13d: → Accepted: Sent — resend when new version released; MPN-13e: Offered — offer not accepted |
| MPN-14 — KO+OR | **Waiting Room Leaflets**; MPN-14a: Not offered yet; MPN-14b: Offered — offer accepted; MPN-14c: → Accepted: Not sent yet; MPN-14d: → Accepted: Sent — check at routine callback; MPN-14e: Offered — offer not accepted |
| MPN-15 — KO+OR | **Pregnancy Booklets**; MPN-15a: Not offered yet; MPN-15b: Offered — offer accepted; MPN-15c: → Accepted: Not sent yet; MPN-15d: → Accepted: Sent — check at routine callback; MPN-15e: Offered — offer not accepted |
| MPN-16 — KO+OR | **A3 Waiting Room Poster**; MPN-16a: Not offered yet; MPN-16b: Offered — offer accepted; MPN-16c: → Accepted: Not sent yet; MPN-16d: → Accepted: Sent — resend when new version released; MPN-16e: Offered — offer not accepted |

### 13.5 Zistené rozpory, ktoré musí AI odhaliť

- CLA-03 opisuje Email-02 po **3 pracovných dňoch**, no štruktúrovaný offset v predvoľbe je `+3d`. To nie je dôkaz pracovného kalendára ani bezpečne naplánovaného odoslania.
- CLA-13, CLA-DEC a CLB-01 hovoria o callbacku o **3 až 6 mesiacov**, ale uložený `taskDeadlineOffset` je pri týchto položkách `+14d`. Pole sa volá termín úlohy; nesmie sa bez overenia vydávať za plánovaný čas budúceho spustenia.
- Podmienky ako „po 10× Unreachable“, „po 4 opakovaniach“ či „po 3 nedoručeniach“ sú v textoch predvolieb. Treba overiť, či pre ne existuje samostatná počítacia a podmieňovacia logika, skôr než ich AI označí za automaticky vynucované.
- CLB-05/06, MPN `create_bo_task` a rozdiel medzi popísaným a štruktúrovaným časovaním majú byť validačné upozornenia asistenta; nesúlad sa nesmie potichu „opraviť“ odhadom.

### 13.6 Pripravenosť ďalších modulov a bezpečné úrovne automatizácie

Navrhované úrovne:

1. **Úroveň 0 — vysvetliť a navrhnúť:** AI sumarizuje stav alebo navrhne pravidlo; nič nezapisuje ani neodosiela.
2. **Úroveň 1 — človekom schválená interná akcia:** po schválení vytvoriť úlohu alebo interné upozornenie cez existujúci engine.
3. **Úroveň 2 — deterministické spúšťanie:** povoliť automatické interné pravidlá len pre moduly s overenými udalosťami, oprávneniami, idempotenciou a auditom.
4. **Úroveň 3 — externá komunikácia alebo závažný dôsledok:** pridať až po samostatnom pilote, s povolenými šablónami, príjemcami a ľudským schválením. Platba, podpis, klinické rozhodnutie či právna zmena nesmú byť rozhodnutím modelu.

| Modul | Čo je dnes doložené v kóde | Bezpečné rozšírenie | Chýbajúce alebo rizikové časti |
|---|---|---|---|
| **Faktúry** | Modul `invoice` a jeho polia sú v katalógu Workflow Engine. Bežné vytvorenie a aktualizácia faktúry odosielajú udalosti `created`/`updated`; aktualizácia môže vyvolať aj `status_changed`. Faktúry majú status, sumu, zaplatenú sumu, dátum splatnosti a platby. | Najprv úloha alebo interné upozornenie pri nezaplatenej/splatnej faktúre; následne návrh upomienky z odsúhlasenej šablóny a kontrola človekom. | Treba zjednotiť pokrytie všetkých ciest vrátane platieb, hromadného vytvárania a integrácií. Schéma faktúry používa `generated`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled`, kým katalóg pravidiel ponúka aj odlišnú hodnotu `pending` a neuvádza `generated`/`partially_paid`. Pred AI návrhmi na zmenu statusu treba zosúladiť enumy. AI nesmie meniť sumy, párovať platby ani označiť faktúru za zaplatenú. |
| **Zmluvy** | Modul `contract` je v katalógu. Štandardné create/update cesty a samostatné dokončenie/zrušenie posielajú udalosti. Zmluvy majú statusy a dátumy podpisu, dokončenia a platnosti. | Po overenom podpise vytvoriť internú úlohu; pri blížiacej sa platnosti navrhnúť obnovu alebo upozorniť zodpovednú osobu. | Treba osobitne overiť, či e-podpis a všetky importované/automatizované prechody statusu emitujú udalosť. Schéma má `draft`, `sent`, `pending_signature`, `signed`, `completed`, `cancelled`, `expired`; katalóg obsahuje navyše `active` a vynecháva `sent`. AI nesmie označovať podpis, meniť právne podmienky ani upravovať podpísaný obsah. |
| **Laboratóriá a výsledky** | Existujú konfigurovateľné laboratóriá podľa krajiny, API pre zápis/výber laboratórnych výsledkov, API oprávnenia a idempotencia cez `clientResultId`. Import výsledku môže zmeniť stav odberu. Existuje aj AI analýza laboratórnych výsledkov; tá sama osebe nie je napojením na Workflow Engine. | Pridať explicitné, auditované udalosti pre výsledok prijatý/opravený a deterministické interné úlohy pri chýbajúcich údajoch alebo vopred definovaných prevádzkových výnimkách. AI môže pripraviť zrozumiteľné zhrnutie pre odbornú kontrolu. | `laboratory`/`lab_result` nie sú v katalógu modulov ani polí Workflow Engine. Najprv treba určiť zdroj pravdy pre stav, validáciu, opravy a duplicity. AI nesmie diagnózovať, schvaľovať klinický výsledok, rozhodovať o použiteľnosti vzorky ani sama informovať klienta o zdravotnom náleze; odborné rozhodnutie zostáva človeku. |
| **Kliniky a nemocnice** | Obe sú v katalógu a ich bežné vytvorenie/aktualizácia posielajú udalosti. Existujú polia pre status, zodpovednú osobu/reprezentanta a ďalší kontakt. | Vytvárať interné úlohy pri zmenách stavu, chýbajúcom priradení alebo termíne kontaktu; AI môže pripraviť pravidlo v kontexte konkrétnej Mission. | Odlišovať globálnu udalosť záznamu od workflow konkrétnej Mission. AI nesmie sama rozšíriť viditeľnosť kontaktu, zmeniť vlastníctvo ani obísť country/Mission oprávnenia. |
| **Úlohy a prichádzajúce hovory** | Katalóg obsahuje `task.completed`, `task.overdue` a udalosti hovoru (priradenie, prijatie, dokončenie, opustenie, timeout). | Použiť ich na interné notifikácie, nadväzujúce úlohy a zrozumiteľné vysvetlenie, prečo sa pravidlo spustilo. | Pravidlá musia byť idempotentné, viazané na správnu Mission a nesmú meniť call/recording oprávnenia ani odosielať osobné údaje cez externé kanály. |

**Poradie rozšírenia:** po Status List pilote najprv overiť eventy a enumy faktúr a zmlúv; až potom aktivovať interné workflow. Laboratórne výsledky zaradiť po definovaní autorizovaných stavových prechodov a odborného schvaľovania. Bez týchto predpokladov môže AI len vysvetľovať a pripravovať návrh pre človeka.

### 13.7 Zdrojové miesta overenia

- `client/src/data/cla-template.ts` — predvolené CLA/CLB/MPN kroky, roly a navrhnuté automatizácie.
- `client/src/components/campaign-status-list-builder.tsx` — výber a vloženie šablón do konkrétnej kampane.
- `server/lib/automation-routes.ts` — katalóg modulov, udalostí, akcií a polí Workflow Engine.
- `server/lib/event-bus.ts` — generické udalosti vytvorenia, aktualizácie a zmeny statusu.
- `server/routes.ts` — event emitters pre faktúry a zmluvy a API laboratórnych výsledkov.
- `shared/schema.ts` — statusy faktúr, zmlúv, laboratórií a súvisiacich záznamov.
