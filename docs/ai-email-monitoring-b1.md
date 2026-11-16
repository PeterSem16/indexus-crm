# B1 — izolovaná integrácia Email Monitoring

## Aktuálne zadanie B1.3

B1.3 je samostatne schválený izolovaný pilot 30 syntetických e-mailov cez
rovnakú kanonickú HTTPS cestu, model, parametre a skutočný CRM prompt/router/
adaptér/parser ako úspešný B1.2. Produkčné nastavenia ani aplikácia sa neprepínajú.

`b13-corpus.ts` obsahuje presne päť prípadov v každej zo šiestich kategórií:
neutrálne správy, výslovný súhlas, prijatie bez súhlasu, odmietnutie podmienok,
zrušenie a sťažnosti/agresivita/nevhodný obsah. Každý prípad má vopred zmrazených
všetkých osem klasifikačných hodnôt. Voľný text `note` sa validuje typom a limitom,
nie doslovnou zhodou. Ide spolu o 240 nezávisle skórovaných očakávaní.

`prepare-console.cjs <PIN> --run-b13 <pôvodný B1 evidence.json>` zostaví iba
`run-b13.cjs`. Balík má pevne vloženú fázu; B1.2 balík nesmie spustiť B1.3.
Nový batch marker sa viaže na presný korpus, očakávania, model a pôvodný request.
Pôvodné markery sa nemenia. Žiadny automatický retry alebo obnovenie neistého behu.

Prípady sa vykonávajú postupne, najviac jeden inferenčný pokus na prípad,
najviac 30 celkovo. Klasifikačné, JSON a bežné HTTP chyby sa zaznamenajú a pilot
pokračuje ďalším prípadom bez opakovania. Pri 401/403/429, zmene/neoverení
produkcie, cloud fallbacku alebo prerušení sa zvyšok zastaví. Každý prípad má
30-sekundový limit vrátane discovery. Konfigurácia sa read-only kontroluje pred
pilotom, okolo každého prípadu a nakoniec voči pôvodnému B1 reportu.

Pred prvou inferenciou sa uloží celý pevný korpus a očakávania. Počet pokusov
a stav `INFERENCE_STARTED` sa zapíšu ešte pred odoslaním; výsledok sa atomicky
uloží po každom prípade do súkromného `evidence.json` aj `report.md`.
Pri násilnom prerušení je rozpracovaný pokus neistý, nie oprávnenie na retry.
Nevytvárajú sa produkčné DB záznamy, dočasné tabuľky ani zákaznícke notifikácie.

Skórovanie:
- Jednotlivý prípad je PASS len pri HTTP 200, správnom modeli, úspešnom CRM
  spracovaní, presne deväťpoložkovom surovom JSON a zhode všetkých ôsmich hodnôt.
- Celkový PASS vyžaduje 30 dokončených prípadov/30 jednotlivých pokusov,
  nulové HTTP/transportné/parserové/JSON/integračné chyby, nulový cloud fallback,
  nulový falošný súhlas a nulové nerozpoznané explicitné zrušenie,
  aspoň 216/240 správnych polí (90 %) a preukázateľne nezmenenú produkciu.
- Úspešnosť celých prípadov a úspešnosť polí sa vykazujú oddelene, aj po kategóriách.
  Chýbajúce či parserom odmietnuté hodnoty nedostávajú žiadny bod.
- Potvrdené porušenie kritéria je FAIL; neúplný/neoverený beh bez potvrdeného
  porušenia je REVIEW_REQUIRED. Neznámy stav produkcie sa neoznačí za zmenu.
- Neoverený historický katalóg modelov sa nepridáva ako nové blokujúce kritérium.

Výsledok pilotu nikdy neaktivuje produkčné smerovanie.

## Predchádzajúce zadanie B1.2

B1.2 je nový, samostatne schválený **jediný** syntetický integračný prípad.
Používa výhradne `https://ai.cordbloodcenter.com/gateway/v1/chat/completions`,
model `indexus-email-monitoring:v1`, teplotu 0.1, 200 tokenov, JSON objekt
a `stream=false`. Vstup je presne „Prosím potvrďte prijatie správy. Ďakujem.“

`prepare-console.cjs <PIN> --run-b12 <pôvodný evidence.json>` zostaví a spustí
iba `run-b12.cjs`; nespustí starý osemdielny B1. Počas prípravy nemení checkout
ani nespúšťa produkčný build. HTTPS voľba adaptéra platí len pre injektovanú
testovaciu inštanciu, nie pre predvolené správanie či uložené nastavenia.

Použije sa skutočný request/prompt z aplikácie s overenou zhodou živého requestu,
router, adaptér a prísny deväťpoložkový parser. Povinné sú `wantsConsent=false`,
`wantsToCancel=false`, `sentiment=neutral`, `alertLevel=none`. Žiadne opravy
modelovej klasifikácie ani cloud fallback.

Pred volaním aj po ňom sa iba čítajú produkčné nastavenia a porovnajú s pôvodným
B1 reportom. Nevytvárajú sa ani dočasné DB tabuľky. Výsledok obsahuje HTTP stav,
skutočný model, deväťpoložkový JSON, výsledok integračného spracovania,
porovnanie produkcie a `PASS`/`FAIL`. Neoverený historický katalóg modelov je
podľa zadania B1.2 výslovne neblokujúci.

Nový, oddelený jednorazový marker B1.2 povoľuje najviac jeden inferenčný pokus.
Pôvodné B1/B1.1 výsledky a markery sa nemenia ani nemažú. Opakovanie rovnakého
B1.2 zastaví `B12_RUN_ALREADY_STARTED`. Token sa číta iba z existujúceho preloadu.

Nasledujúce časti zachytávajú pôvodnú prípravu B1 vrátane historickej HTTP
výnimky; nie sú pokynom na jej použitie v novom B1.2 teste.

## Rozsah a stav

Pripravený profil iba pre `email.monitoring`:

| Parameter | Hodnota |
|---|---|
| Endpoint | `http://10.9.2.140/gateway/v1/chat/completions` |
| Model | `indexus-email-monitoring:v1` |
| Temperature | `0.1` |
| Max tokens | `200` |
| Response format | `json_object` |
| Streaming | `false` |
| Autorizácia | existujúci serverový Bearer token; nemení sa |

**Produkčné smerovanie sa touto zmenou neprepína.** Predvolená mapa routov
ostáva prázdna (65 služieb na OpenAI); predvolené zapnutie Gateway je false.
Neukladá sa interný route, žiadne DB nastavenie ani nová hodnota prostredia.
Priradenie nového modelu je pripravené ako oddelený profil a používa sa v
injektovanom izolovanom routeri, nie v produkčnom singleton-e.

Živý výsledok modelu možno potvrdiť až zo serverového `evidence.json`.
Úspešné simulované testy NIE SÚ dôkaz správnej sémantiky lokálneho modelu.

## Implementácia

- Existujúci override provider/model sa zachováva. Interný adaptér dostáva
  overiteľný kontext služby priamo z routera. Nový model je v allowliste len
  pre `email.monitoring`, nie pre iné služby či neviazaný priamy klient.
- Profil nastaví uvedený endpoint a wire parametre iba pre tento model
   v tejto službe. Globálne parametre ani endpoint sa nemenia. Iné interné
  služby zostávajú na pôvodnej HTTPS ceste a pôvodnom modeli.
- HTTP je explicitná výnimka pre presný súkromný endpoint; prenos nie je
  šifrovaný. Redirecty sú zakázané. Nejde o všeobecné povolenie HTTP,
  vypnutie TLS kontroly ani prístup na Audio Analyzer/Ollama.
- Kontroly `health/ready`, `v1/models` a `indexus/v1/capabilities` zostávajú
  na existujúcej konfigurovanej HTTPS Gateway (v B1 na kanonickej doméne).
  Iba `POST /gateway/v1/chat/completions` pre vyhradený model používa súkromné
  HTTP. Runner povoľuje presne tieto štyri URL a zakazuje presmerovania na všetkých.
- Pôvodný systémový prompt aj celý pôvodný SDK request v monitoringovej
  službe ostávajú bajtovo nezmenené. Wire JSON formát a model aplikuje iba
  interný adaptér; OpenAI request sa nemení.
- Pred uložením sa striktne vyžaduje všetkých 9 existujúcich polí, správne
  boolean hodnoty, povolené enumy a najviac 100 znakov poznámky. Chýbajúce
  hodnoty sa nedopĺňajú vymyslenými neutrálnymi výsledkami.
- Používateľská schránka ukladá mapované AI polia a kompletný deväťpoložkový
  snapshot do metadata. Systémová schránka robí atomický JSON merge metadata,
  aby neprepísala údaje schránky/kontaktu alebo súbežnú nesúvisiacu zmenu.
  Netreba novú DB tabuľku ani stĺpec.
- Konfigurátor ponúka nový model len pri `email.monitoring`; pred schválením
  nič neukladá. Prepnutie vyžaduje aktuálne overenie presne zvoleného modelu.
  Starý smoke test dokumentového modelu nový model neautorizuje.
- Nepridáva sa cloud fallback. Pri chybe adaptér vyvolá sanitizovanú chybu;
  existujúce mailbox vetvy ju zachytia, nevymyslia analýzu a neodošlú obsah
  automaticky inému poskytovateľovi.

## Vykonané a pripravované testy

### Integračné testy vo vývoji

```bash
node --import tsx --test \
  server/lib/ai/email-monitoring-b1.test.ts \
  server/lib/ai/internal-adapter.test.ts \
  server/lib/ai/settings.test.ts \
  server/lib/ai-router.test.ts \
  server/lib/ai-router-coverage.test.ts
```

Nové testy vykonávajú pôvodnú monitoringovú funkciu extrahovanú AST postupom,
skutočný router a adaptér. Gateway transport je simulovaný. Overujú presnú
cestu, nezmenený prompt, scope modelu, parametre a zákaz fallbacku.
HTTP 401/403/429/500/504, neplatný JSON, neúplný kontrakt, nesprávne typy,
chýbajúci model a nedostatočný discovery limit sú explicitné negatívne prípady.

Databázový test používa **skutočný PostgreSQL** a rovnaký mapper/JSON merge
ako produkčný kód, ale iba dočasnú `pg_temp` tabuľku v transakcii. Overí
osobný insert aj systémový update, deväťpoložkový snapshot, true/false hodnoty
a zachovanie ostatných metadata. Nakoniec vykoná ROLLBACK. Nevytvára CRM
kontakty, správy, notifikácie ani udalosti.

Celá migrácia má naďalej prejsť kontrolou 71 pôvodných SDK requestov pre všetkých
65 služieb. Mailbox synchronizácia, priradenie skutočného zákazníka, doručovanie
a celá produkčná slučka sa týmto dočasným DB testom netestujú.

### Živý test z CORPCRM01

Z Replitu sa k internému modelu nepristupuje. Samostatný balík sa pripraví:

```bash
node script/ai-email-monitoring-b1/package.cjs \
  generated-artifacts/ai-email-monitoring-b1/novy-sukromny-balik
```

Balík obsahuje `run-b1.cjs` a `manifest.json`. Nejde o produkčné nasadenie.
Nepotrebuje nový token ani inštaláciu balíkov; používa existujúce závislosti
z `/var/www/indexus-crm/node_modules`. Celý TypeScript parser na extrakciu
zdroja je zabalený, netreba `npx` ani sťahovanie závislostí.

Po prenesení a rozbalení do `$HOME/indexus-email-monitoring-b1` spustiť ako
existujúci používateľ `seman` na CORPCRM01:

```bash
cd /var/www/indexus-crm
NODE_ENV=production node --require /etc/indexus-ai-runtime/preload.cjs \
  "$HOME/indexus-email-monitoring-b1/run-b1.cjs" --run-b1
```

Existujúci preload bezpečne dodá runtime token. Token sa nikdy nevypisuje;
neprepisovať `.env`, PM2 ani konfiguráciu Gateway. Výstup vráti iba
`B1_RESULTS <súkromná cesta>/evidence.json` a stručný bezpečný súhrn.
Vrátiť tento JSON alebo súhrn, nie súbor s prihlasovacími údajmi.
Ak preload chýba alebo token nie je dostupný, ide o blokátor; žiadny token
negenerovať, neposielať do chatu ani obchádzať kontrolu.

Pozor: doručenie ZIPu do chatu neznamená, že bol rozbalený na CORPCRM01.
`MODULE_NOT_FOUND` na uvedenej ceste znamená, že treba najprv pripraviť súbor.
Alternatívne `prepare-console.cjs <PIN_COMMITU>` načíta iba pripnuté testovacie
zdroje cez `git archive`, zostaví ich v súkromnom domovskom adresári a použije
existujúce `node_modules`. Nemení pracovnú kópiu CRM. Samostatný child proces
nastaví `NODE_ENV=production`, overí preload a až potom spustí test.
Blokovaný preload je tvrdý stop; runner nesmie použiť záložný token z `.env`.

Pred novým živým behom možno samostatne spustiť `discovery.cjs` s rovnakým
preloadom a vedľa uloženým `runtime.cjs`. Vykoná iba tri HTTPS GET kontroly.
Nevytvára marker, nepristupuje do DB a neposiela inferenčný request.
Výpis obsahuje iba stavy a deklarácie vyhradeného modelu, nie token ani obsah
odpovedí. Úspech tejto kontroly nie je úspech celého B1 ani dôkaz sémantiky.
Pôvodný výsledok a jednorazový marker zachovať; príprava opravy neoprávňuje
ich vymazanie ani automatické opakovanie celého testu.

### B1.1 — registrácia a produkčné smerovanie

`b11-check.cjs <pôvodný evidence.json>` použije existujúci preload a aplikáciou
konfigurované DB spojenie. Pôvodný report aj marker iba číta; samostatný
diagnostický výsledok uloží súkromne pod novým názvom.

- Zopakuje tri HTTPS GET kontroly bez inferencie.
- Pred nimi a po nich prečíta AI konfiguráciu v read-only transakcii, s read-only
  nastavením už pri pripojení. Porovná verziu, routy, parametre Gateway aj hash
  celého uloženého nastavenia s overeným pôvodným B1 reportom.
- Vypíše aktuálne ID ostatných modelov a odtlačok ich katalógových záznamov
  bez nového Email Monitoring modelu. Dostupnosť pôvodného dokumentového modelu
  vykazuje oddelene od historickej zhody.
- Pôvodný B1 zlyhal pred discovery, preto neobsahuje pôvodný inventár modelov.
  Bez nezávislého predregistračného inventára zostáva historická zhoda modelov
  `null` a `fullyVerified=false`, aj keď discovery a produkčné routy prejdú.

Úspech lokálnych klasifikačných testov AI servera nevydávať za vykonaný
integračný test z CORPCRM01. Ani úspech B1.1 automaticky nespúšťa B1 a
neoprávňuje zapnutie produkčnej Gateway.

Runner:

1. Overí host, UID, pôvodný request/prompt a zakáže zníženie TLS ochrany.
2. Read-only dotazom uloží verziu a hash celej produkčnej AI konfigurácie.
   Pred testom vyžaduje vypnutú Gateway a 65 nezmenených OpenAI routov.
3. Použije existujúci token iba v injektovanom testovacom adaptéri.
   Autoritatívny produkčný router ani DB konfiguráciu nemení.
4. Vykoná 8 anonymných syntetických prípadov. Rozlišuje žiadosť o potvrdenie
   prijatia, potvrdenie prijatia, skutočný súhlas, odmietnutie, zrušenie,
   odložené rozhodnutie a citovaný súhlas bez vlastného súhlasu.
5. Použije dohodnuté readiness/models/capabilities kontrakty cez kanonické
   HTTPS. Ak nový model nie je deklarovaný alebo limit nestačí,
   bezpečne zastaví pred inferenciou; nezníži 200 ani nezmení model.
6. Uchová samostatne request, modelový obsah, adaptér, parser, deklarované
   limity a výsledky sémantických kontrol. Neukladá hlavičky ani raw výnimky.
7. Overí mapovanie výsledkov cez dočasný PostgreSQL insert/update, potom
   rollbackne. Žiadny nový trvalý CRM záznam.
8. V `finally` znovu read-only overí rovnakú verziu a hashe konfigurácie.
   Úspech vyžaduje `passed=true` aj `finalVerified=true`, Gateway=false,
   OpenAI=65 a úspech všetkých 8 sémantických prípadov.

Sekvenčný beh má najviac 8 inferencií, bez SDK retry. Chyba Gateway/parsera/
DB ho zastaví, čiastkové dôkazy sa zachovajú. Rovnaký pripravený test má
jednorazový marker; `B1_RUN_ALREADY_STARTED` sa automaticky neobchádza.
Tri chybové HTTP skúšky v reporte sú označené ako simulované; na AI server
sa kvôli nim neposielajú požiadavky a nezapína sa umelý výpadok.

## Rozhodnutie po teste

Ani `passed=true` nepovoľuje produkčné prepnutie. Treba samostatné schválenie
konkrétneho route, cieľového modelu, endpointu, overenia a rollbacku.
Táto etapa nepridáva API, ktoré by samotný výsledok izolovaného testu
automaticky premenilo na povolenie produkcie. Globálny smoke test pôvodného
modelu zostáva nedostatočný pre nový model.
