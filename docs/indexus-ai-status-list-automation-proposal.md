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

### Ďalší automatizačný systém

Projekt obsahuje aj samostatný Workflow Automation Engine s udalosťami, podmienkami, definovanými akciami, testovacím spustením a históriou behov. Zatiaľ ide o oddelenú cestu od vykonávania automatizácií Status Listu.

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