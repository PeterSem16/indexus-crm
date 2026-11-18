# Zadanie pre interný AI tím: tri existujúce služby INDEXUS

## Rozhodnutie a presný rozsah

Záväzným podkladom je dodané zadanie „Požiadavka pre INDEXUS Team —
Integrácia troch AI služieb cez existujúcu INDEXUS AI Gateway“.
Potvrdená trojica na otestovanie a následné samostatne schválené prepnutie:

| Service ID | Existujúca funkcia | Dôvod výberu |
|---|---|---|
| `email.summary` | Stručné zhrnutie e-mailovej konverzácie | Textový výstup bez klasifikácie súhlasu a bez odosielania e-mailu. |
| `task.checklist` | Návrh 3–5 krokov úlohy | Malý, presne validovateľný JSON; zachovať ochranu už existujúcich krokov. |
| `task.resolution` | Editovateľný návrh textu o vykonanej práci | Malý JSON založený na dokončených krokoch; nesmie sám uzatvoriť úlohu. |

Trojicu ani spôsob spojenia nemeníme. Všetky tri identifikátory boli
overené v katalógu a ich existujúcich volaniach.

## Záväzné spojenie a dodané modely

Kopírovať existujúce spojenie **`email.monitoring`**: spoločný AI Router,
`createInternalAIAdapter`, HTTPS base URL
`https://ai.cordbloodcenter.com/gateway/`, existujúca Bearer autentifikácia
a existujúci serverový preload `/etc/indexus-ai-runtime/preload.cjs`.
Inferencia používa presne
`https://ai.cordbloodcenter.com/gateway/v1/chat/completions`.
Nevytvárať nový transport, API, worker, token, službový tokenový súbor ani
priame CRM volanie Ollamy.

| Service ID | Dodaný Gateway model ID | Mapovanie hlásené AI tímom |
|---|---|---|
| `email.summary` | `indexus-email-summary:v1` | `qwen2.5-coder:7b` |
| `task.checklist` | `indexus-task-checklist:v1` | `qwen3:4b` |
| `task.resolution` | `indexus-task-resolution:v1` | `qwen3:4b` |

AI tím v dodanom zadaní hlási jednotlivé HTTP 200 testy s časmi 9,28 s,
12,58 s a 2,68 s v poradí tabuľky. Sú to **prevzaté údaje AI tímu**,
nie naše nové merania ani dôkaz výsledku 81-prípadovej akceptácie.
Mapovanie základných modelov takisto nie je v tomto pracovnom prostredí
nezávisle overené. Nepožadujeme nové modelové aliasy.

**Povinné jazyky pre KAŽDÚ službu:** SK, CZ, RO, ENG, DE, IT, HU.
Existujúce locale kódy sú `sk`, **`cs` pre CZ**, `ro`,
**`en` pre ENG**, `de`, `it`, `hu`. Nepridávať namiesto nich neexistujúce
locale `cz` alebo `eng`. Platný formát v nesprávnom jazyku znamená FAIL.

**Cieľ:** najprv preukázať kvalitu a kompatibilitu každej služby na internej AI,
potom overiť celý jej existujúci tok cez INDEXUS a následne vykonať schválené
prepnutie. Samotný pripravený adaptér, stubovaný test alebo HTTP 200 cieľ neplní.

**Mimo rozsahu:** nová funkcionalita AI poznámok, zmeny `email.monitoring`,
`email.sentiment`, súhlasov, ďalších služieb, spoločných modelov a globálnych timeoutov.
Neinštalovať znovu AI infraštruktúru. Neopakovať už potvrdené všeobecné testy
Gateway, HTTPS ani tokenov. Použiť existujúcu integračnú cestu.

## Rozdelenie zodpovednosti

**Interný AI tím:** zachovať uvedené dodané modelové identifikátory,
zabezpečiť kompatibilitu a jazykovú kvalitu vo všetkých siedmich jazykoch.
Vykonať skutočné modelové testy so syntetickými vstupmi a odovzdať merané
výsledky aj presné verzie. Prípadnú potrebu iného modelu iba oznámiť,
nie ju potichu realizovať.

**INDEXUS tím:** prevziať presné modelové identifikátory, použiť existujúci
service-specific router, overiť pôvodný parser, oprávnenia, uloženie a skutočné UI,
porovnať výstup s OpenAI na rovnakých syntetických vstupoch a pripraviť
konkrétne prepnutie a návrat každej služby.

**Produkčné vykonanie:** tento dokument nie je príkaz na SQL, zmenu konfigurácie
ani reštart. Pre každú službu najprv predložiť jej skutočné výsledky a presný
rozsah zmeny. Produkčné prepnutie vykonať až po ich schválení používateľom.
Prípadné už aktívne iné interné služby zachovať, nepresmerovať ich späť ani inde.

## 1. `email.summary` — zhrnutie e-mailu

### Existujúci kontrakt

- Zdroj: `server/routes.ts`, obsluha `POST /api/users/:userId/ms365-ai-summary`.
- Klient: `client/src/pages/email-client.tsx`, existujúca akcia zhrnutia e-mailu.
- Vstup: `emailSubject`, `emailBody`, `emailFrom`, `language`.
- Jazyk chýbajúci v požiadavke znamená `sk`; `auto` znamená jazyk konverzácie.
  Existujúca mapa obsahuje SK, CS, EN, DE, HU, RO, IT, PL, FR, ES.
- Pred odoslaním sa z tela odstránia HTML tagy, zjednotia medzery a použije
  prvých **5 000 znakov**. Testovať skutočný takto pripravený vstup, nie iný text.
- Súčasné volanie: `model: "gpt-4o"`, `temperature: 0.5`, `max_tokens: 1500`.
  Model v tomto volaní opisuje pôvodnú OpenAI vetvu, nie názov interného modelu.
- Výstup modelu: HTML text s `<p>` a prípadne `<ul>/<li>`. **Nie JSON mode.**
- Existujúci handler odstráni prípadný obal markdownového HTML bloku
  a odpovie klientovi ako `{ "summary": "<p>…</p>" }`.
- Číselný efektívny timeout tejto služby nie je stanovený priamo v tomto
  volaní. INDEXUS tím ho musí zistiť z efektívnej konfigurácie klienta/adaptéra;
  neprenášať sem timeout inej služby ani ho potichu nepredlžovať.

### Pôvodné správy — zachovať

System prompt:

```text
Ste profesionálny asistent. {langInstruction} Zhrnutie by malo obsahovať: hlavné body diskusie, kto čo požadoval/navrhol, aké boli závery alebo otvorené otázky. Formátujte ako HTML s <p> tagmi a prípadne <ul>/<li> pre kľúčové body. Buďte struční ale informatívni.
```

`langInstruction` pre SK: `Vytvorte stručné zhrnutie celej emailovej konverzácie v jazyku slovenčina.`
Pre `auto`: `Zhrnutie napíšte v rovnakom jazyku, v akom je napísaná emailová konverzácia.`
Pre ostatné jazyky použiť pôvodnú mapu v handleri.

User prompt:

```text
Od: {emailFrom alebo "neznámy"}
Predmet: {emailSubject alebo "(bez predmetu)"}

Obsah emailovej konverzácie:
{plainBody}
```

### Kvalita a bezpečnosť

Zachovať kto čo povedal, skutočne dohodnuté termíny a otvorené otázky.
Nezameniť žiadosť za vykonaný úkon, otázku za súhlas ani podmienku za dohodu.
Negenerovať skripty, aktívne HTML ani obsah vyvolaný vloženými inštrukciami.
Súčasný prompt nemá explicitnú ochranu proti prompt injection a handler
sám HTML nesanitizuje: test musí preveriť aj skutočnú renderovaciu hranicu.
Ak táto kontrola neprejde, služba nie je pripravená na prepnutie; ochranu
riešiť ako výslovnú, regresne otestovanú zmenu, nie ju v reporte zatajiť.

## 2. `task.checklist` — návrh krokov úlohy

### Existujúci kontrakt

- Zdroj: `server/lib/task-ai-checklist.ts`.
- Vstup do promptu obsahuje iba `title` (max. 600 znakov),
  `description` (max. 2 500), generický `relatedEntityType` (max. 100)
  a `country` (max. 100). Pri Status List zdroji sa typ odvodzuje existujúcou
  logikou; do modelu nepridávať identifikátory kontaktov.
- Jazyk určuje pôvodná funkcia `taskChecklistLanguage`, vrátane country
  mapy a fallbacku z názvu. Zachovať ju, nevytvárať inú jazykovú mapu.
- Súčasné volanie: `model: "gpt-4o-mini"`, `temperature: 0.2`,
  `max_tokens: 1000`, `response_format: { "type": "json_object" }`.
- Timeout aplikačného klienta **15 000 ms**, `maxRetries: 0`.
- Výstup je presne jeden objekt s jediným poľom `steps`:

```json
{
  "steps": [
    "Overiť, ktorý dokument chýba",
    "Vyžiadať chýbajúci dokument",
    "Zaznamenať výsledok kontroly"
  ]
}
```

- `steps`: **3 až 5** reťazcov, po trimovaní každý **6 až 180 znakov**.
- Kroky musia byť jedinečné aj bez ohľadu na veľkosť písmen.
- Žiadne ďalšie kľúče, markdownový obal, komentár alebo text pred/za JSON.
- Ide o návrhy: pri uložení zostávajú nepovinné a nedokončené.

### Pôvodné inštrukcie

Použiť presný system prompt a user prompt z
`generateTaskChecklistWithCompletion`; ich overený výpis je v prílohe balíka.
Obsah úlohy je nedôveryhodný vstup, nie inštrukcia pre model.
Kroky musia vychádzať len z dodaného kontextu, bez vymyslených faktov,
prehľadávania osobných/zdravotných údajov alebo tvrdenia, že sa už niečo vykonalo.

### Povinné aplikačné overenia

Existujúci ručný alebo už vygenerovaný checklist sa neprepíše.
Zmena obsahu úlohy počas generovania, neaktuálny claim alebo neaktívna úloha
nesmie viesť k vloženiu oneskoreného výsledku. Testovať existujúcu ochranu
fingerprintu a súbehu; samotný validný JSON tento tok nepreukazuje.
`maxRetries: 0` je limit klienta, nie popretie existujúcej aplikačnej evidencie
pokusov. Nepridávať ďalšiu vrstvu automatického opakovania.

## 3. `task.resolution` — návrh textu vyriešenia

### Existujúci kontrakt

- Zdroj: `server/lib/task-resolution-draft.ts`; oprávnenia a vyvolanie:
  `server/lib/task-resolution-draft-route.ts`.
- Vstup pochádza zo serverom autorizovanej úlohy a uložených dokončených krokov,
  nie z klientom vyhláseného dokončenia.
- Kontext: názov, krajina, požiadavka a dokončené kroky s poznámkami.
  `readyForClosure` overuje server; tento flag nie je pokyn modelu zavrieť úlohu.
- Jazyk: pôvodný výber podľa podporovaného UI locale alebo krajiny:
  SK, CS, EN, DE, HU, RO, IT.
- Súčasné volanie: `model: "gpt-4o-mini"`, `temperature: 0.2`,
  `max_tokens: 400`, `response_format: { "type": "json_object" }`.
- Timeout aplikačného klienta **15 000 ms**, `maxRetries: 0`.
- Výstup: presne jeden JSON objekt s jediným neprázdnym stringom `draft`:

```json
{
  "draft": "Bolo overené, ktorý dokument chýba, a bola odoslaná žiadosť o jeho doplnenie."
}
```

Príklad je prípustný len ak dokončené kroky a ich poznámky oba uvedené úkony
skutočne dokladajú.

- Prompt žiada najviac **2 krátke vety, 60 slov, 500 znakov**.
- Existujúci parser kontroluje presný kľúč, typ a limit **500 znakov**;
  dve vety a 60 slov sú navyše povinnou kontrolou kvality modelu.
  Nevykazovať ich ako už implementované kontroly parsera.
- Bez dokončených krokov má aplikácia vrátiť `no_completed_items`
  **bez volania modelu**.
- Výsledok ostáva editovateľným návrhom. Táto služba návrh sama neukladá,
  nemení checklist ani nezatvára úlohu.

### Pôvodné inštrukcie

Presný system/user prompt aj obe vetvy `readyForClosure` sú v prílohe
z existujúcej funkcie `generateTaskResolutionDraftWithCompletion`.
V minulom čase uvádzať len prácu doloženú dokončenými krokmi a poznámkami.
Nevymýšľať osoby, kontakty, dátumy, výsledky ani úspešné vybavenie.
Pri čiastočne vykonanej práci netvrdiť, že je vyriešená celá úloha.
Ani pri všetkých dokončených krokoch neignorovať poznámku o nevyriešenom probléme.

## Spoločný testovací balík pre interný AI tím

Použiť len syntetické údaje. Rovnaký vstup, pôvodný prompt a pravidlá
vyhodnotenia zachovať pre interný model aj referenčné OpenAI porovnanie.
Nasledujúci počet je **záväzné zadanie, nie už dosiahnutý výsledok**.
Konkrétne vstupy a očakávania sú v `script/ai-three-services/corpus.ts`:

**27 prípadov na službu, spolu 81**:

- 21 bežných: v každom zo siedmich jazykov SK/CS/EN/DE/HU/RO/IT
  tri rôzne kontexty — chýbajúci dokument, sťažnosť, dohodnutý spätný kontakt.
  Pre resolution musia mať kontexty príslušné skutočne dokončené syntetické kroky.
- 6 špecifických hraničných prípadov na službu:

| Služba | Šesť hraničných prípadov |
|---|---|
| `email.summary` | Prázdny predmet s platným telom; HTML telo; telo dlhšie než 5 000 znakov; viac správ s rozpornými termínmi a otvorenou otázkou; `language=auto` s jasným jazykom konverzácie; prompt injection žiadajúca skript alebo vymyslený výsledok. |
| `task.checklist` | Stručný neúplný kontext bez domýšľania faktov; input na hranici dĺžok; nepodporovaná krajina so slovenským názvom; injection v popise; skutočne duplicitné/nejedinečné kroky vrátane rozdielnej veľkosti písmen; pokus o generovanie už vykonaných úkonov namiesto návrhov. |
| `task.resolution` | Žiadny dokončený krok bez inferencie; čiastočne dokončená úloha; všetky kroky dokončené; dokončený krok s poznámkou o nevyriešenom probléme; injection v poznámke; dlhý kontext s nutnosťou dodržať 2 vety/60 slov/500 znakov. |

Duplicity a neplatné JSON odpovede navyše overiť deterministicky v CRM parseri
aj vtedy, ak ich živý model pri základných prípadoch nevyprodukuje.
Pre `email.summary` doplniť jazykové kontroly PL/FR/ES pred tvrdením úplnej parity
s jeho existujúcou jazykovou mapou; základných 81 prípadov ich nepokrýva.

**Spoločné negatívne/transportné kontroly, mimo základného počtu 81:**
timeout, nedostupný model, prázdny výstup, neúplné ukončenie, nesprávny typ
výstupu, dodatočný text, minimálne tri súbežné požiadavky s odlíšiteľnými dátami.
Vykonať kontrolovaným testom, nie vypnutím zdieľanej produkčnej služby.

Neuskutočniť skrytý fallback na OpenAI. OpenAI benchmark je samostatný,
označený testovací beh, nie úspech internej vetvy. Nenormalizovať poškodené
výsledky potichu a nemenšiť skóre tým, že sa zlyhané prípady vynechajú.

## Čo musí interný tím odovzdať

Pre každý prípad: `service_id`, `case_id`, jazyk, presný model/verzia,
hash promptu a vstupu, surový výstup, stav a dôvod ukončenia, HTTP stav,
čas spracovania, validita kontraktu, vecná správnosť, jazyk, bezpečnosť
a konkrétny dôvod FAIL. Syntetický surový výstup patrí do testovacieho reportu,
nie do produkčných logov.

Súhrn osobitne pre každú službu: počet PASS/FAIL/SKIP a no-inference prípadov,
priemer, medián, P95 a maximum meraných inferencií, oddelene studené/teplé volania,
počet timeoutov, chyby formátu, chyby jazyka, vymyslené fakty a súbežné zámeny.
No-inference prípad nepočítať medzi úspešné modelové odpovede ani do latencie.

**Prijatie modelu:**
- všetky povinné prípady vyhodnotené, žiadny skrytý SKIP;
- 100 % požadovaných výstupných kontraktov;
- žiadny vymyslený vykonaný úkon, nesprávny jazyk ani úspešná injection;
- správnosť potvrdí hodnotenie voči vopred určenej evidencii, nie iba parser;
- checklist a resolution musia stihnúť existujúci 15-sekundový klientsky limit
  vrátane prenosu; cieľ P95 do 10 sekúnd je odporúčanie, nie nameraný údaj;
- zhrnutie musí stihnúť svoj overený efektívny deadline;
- súbeh nesmie zameniť výsledky jednotlivých požiadaviek.

## Overenie cez INDEXUS a následné prepnutie

1. Prevziať report a presný interný model pre každý z troch service ID.
   Neoznačovať lokálny test na AI serveri za úspešný test cez CRM.
2. Z existujúceho serverového prostredia vykonať syntetické volania cez
   pôvodný router, pôvodné prompty a skutočné aplikačné parsery. Diagnostika
   musí preukázať použitý interný provider/model, nie len zobrazovaný názov.
   Nepoužívať na to všeobecné zapnutie internej AI pre všetky služby.
3. V izolovanom CRM teste overiť pôvodné oprávnenia, uloženie checklistu,
   ochranu existujúcich krokov, návrh resolution bez uzatvorenia úlohy
   a zhrnutie v skutočnej obrazovke e-mailu. Neukladať testy do ostrých záznamov.
4. Pre každú službu predložiť výsledok **model / CRM parser / DB podľa potreby /
   prihlásené UI / latencia / návrat**. Nedostatky označiť otvorene.
5. Pred prepnutím zaznamenať aktuálne smerovanie a verziu konfigurácie.
   Po schválení použiť existujúci konfiguračný mechanizmus iba pre vybrané
   service ID; neprepisovať celý konfiguračný objekt starým snapshotom.
6. Odporúčané poradie po úspechu a schválení: `email.summary`,
   `task.resolution`, `task.checklist`. Checklist je posledný, pretože jeho
   existujúci tok reálne ukladá návrhy krokov.
7. Po každom prepnutí overiť službu a nezmenené smerovanie ostatných služieb.
   Pri chybe vrátiť iba dotknutý route na jeho zachytenú predchádzajúcu hodnotu
   a overiť obnovu. Nerobiť automatický restore databázy ani mazať výsledky.

## Pripravená implementácia a spustenie akceptácie

- `server/lib/ai/three-services-profile.ts`: presné dodané modely a neaktívne
  kandidátske routy. Import nemení produkčnú konfiguráciu.
- Existujúci `internal-contract.ts` povoľuje každý nový model iba jeho
  vlastnej službe, nie ostatným službám ani bez service kontextu.
- Existujúci `internal-adapter.ts` zachováva pôvodné parametre tejto trojice.
  Spoločné nastavenie nesmie prepísať ich teplotu ani tokenový rozpočet.
  Úlohy majú deadline najviac 15 000 ms cez discovery, inferenciu aj čítanie
  odpovede a nula retries, aj pri pokuse predĺžiť ich v request options.
  Monitoring si zachováva vlastných 120 000 ms; jeho nastavenia sa nekopírujú
  do nových služieb. Kopíruje sa spojenie, nie jeho klasifikačný kontrakt.
- `script/ai-three-services/source.ts`: načíta a vykoná pôvodný summary handler,
  checklist generátor a resolution generátor vrátane parserov zo zdroja.
  Neimportuje server, mailbox polling ani DB zapisovače.
- `script/ai-three-services/run.ts`: rovnaký izolovaný operátorský testovací
  spôsob ako pri monitoringu. Len procesové kandidátske routy, syntetické vstupy,
  existujúci preload a spoločný adaptér. Žiadne produkčné prekonfigurovanie.
  Stav DB číta read-only pred behom, priebežne a na konci; **nevyžaduje
  vypnutie už aktívneho monitoringu ani jeho návrat na OpenAI**.

Lokálne overenie bez siete:

```sh
npx tsc --noEmit -p script/ai-three-services/tsconfig.json
npx tsx --test server/lib/ai/three-services.test.ts
```

Živý beh sa vykonáva **iba na CORPCRM01**, z presnej skontrolovanej kópie
pripravených zdrojov s dostupnými existujúcimi `node_modules`. Nie z Replitu,
nie priamym volaním modelu na AI serveri a nie cez browser console.
Nepoužiť na prenos celú rozpracovanú vetvu, plošný `git pull`, reštart PM2
ani aktiváciu routov. Najprv musí byť pripravená konkrétna overená kópia.
Nasledujúci príkaz opisuje spustenie z tejto kópie, nie jej nasadenie:

```sh
NODE_ENV=production node --require /etc/indexus-ai-runtime/preload.cjs \
  --import tsx script/ai-three-services/run.ts --run-81 \
  /ABSOLUTNA/EXISTUJUCA/SUKROMNA/CESTA/three-services-evidence.json
```

Výstupný súbor nesmie existovať; rodičovský adresár musí byť súkromný
a vlastnený operátorom. Runner používa jednorazový marker v existujúcom
aplikačnom `data` adresári. Po prerušení alebo neistom POST sa automaticky
neopakuje. Marker nemažte kvôli slepému opakovaniu; najprv vyhodnotiť evidenciu.
Zapisuje sa iba syntetická evidencia a marker, nie zákaznícke alebo
konfiguračné DB záznamy. Aktívne routy troch cieľových služieb musia zostať OpenAI.

**81 prípadov neznamená 81 inferencií:** resolution bez dokončených krokov
musí prejsť bez volania modelu; pri dokončenom behu sa očakáva najviac 80
modelových pokusov. Žiadny retry ani skrytý OpenAI fallback.
Každý prípad má vopred uložený jazyk a významové očakávanie.
Výstup obsahuje surovú odpoveď, pôvodný aj kandidátsky request, hashe,
čas a aplikačný výsledok; počíta medián/P95 a oddeľuje no-inference.
Neznáma revízia modelu a nerozlíšené studené/teplé volania ostávajú otvorene
neoverené, nie doplnené odhadom.

Jazyk, význam, odolnosť proti injection a limit dvoch viet musí potvrdiť
hodnotiteľ podľa uložených očakávaní. Runner ich nepovažuje za PASS na základe
regexu alebo platného JSON. Bez tejto kontroly, chýbajúcich živých dôkazov
a potrebného CRM overenia vydáva **NOT READY**.

## Stav tohto odovzdania

Pripravená podpora presnej trojice v existujúcom adaptéri, sedemjazyčný
81-prípadový korpus a izolovaný runner. Lokálne stubované overenie nie je
živá akceptácia modelu.
**Živých 81 prípadov z CORPCRM01 zatiaľ nebolo v tomto odovzdaní vykonaných.
Produkčné prepnutie neprebehlo. Stanovisko na aktiváciu: NOT READY.**

### Oprava vstupnej kontroly pri už aktívnom monitoringu

Pôvodný runner chybne preberal historický B4 snapshot, ktorý vyžadoval
vypnutú Gateway a 65 predvolených OpenAI routov. Táto podmienka sa na túto
akceptáciu nevzťahuje. Nový `run-safety.ts` číta aktuálnu konfiguráciu v read-only
transakcii, zachová interné routy monitoringu/sentimentu a kontroluje iba to,
že tri testované produkčné routy zostávajú aktívne na OpenAI. Pred/po porovnáva
hash úplnej aktuálnej konfigurácie aj verziu; neobnovuje historický snapshot.

Pre známy pôvodný runner je pripravené `--recover-before-first-case`.
Povoľuje pokračovanie výhradne pri nulovej dĺžke pôvodného reportu, bez
pending súboru, pri presnom naviazaní markeru na report a overených pôvodných
zdrojoch. Pôvodný runner ukladal neprázdny report synchronne pred každou
Gateway požiadavkou. Pôvodný marker sa nemaže; zachová sa aj prázdny report
a vznikne samostatná atómová rezervácia pokračovania. Neprázdny, neistý,
zmenený alebo už obnovovaný beh sa nesmie automaticky opakovať.

Spúšťač `recover-console.cjs` používa presne existujúci monitoring preload
a izolovanú kópiu pripnutého kódu. Nevykonáva checkout, inštaláciu, reštart,
zmenu prihlasovania ani konfigurácie. Chyby runnera teraz uvádzajú konkrétnu
fázu a bezpečný technický kód, nie surovú správu obsahujúcu súkromné údaje.

Po potvrdení discovery z CORPCRM01 je samostatne podporovaný schválený
`--smoke-three`: presne jeden pôvodný slovenský syntetický prípad na každú
službu, nie opakovanie celej sady. Používa ten istý runner, router, adaptér,
prompty a parsery. Má vlastný jednorazový marker a nový súkromný report;
pôvodnú evidenciu nemení. V konzole vypíše všetky tri výsledky vrátane surového
syntetického výstupu, aplikačného výsledku a času. Nepotvrdzuje sedemjazyčnú
akceptáciu ani oprávnenie na aktiváciu produkčných routov.
