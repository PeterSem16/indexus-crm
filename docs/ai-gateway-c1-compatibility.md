# INDEXUS AI Gateway — fáza C1

## Stav a nemenné hranice

Toto je **príprava a predbežná evidencia**, nie dokončený živý akceptačný test.
Z Replitu sa interný server nevolá. Živé testy vykoná samostatný proces na
CORPCRM01 s výhradne syntetickými vstupmi. Aplikačná Gateway zostáva vypnutá
a všetkých 65 služieb na OpenAI. Runner nezapisuje konfiguráciu, nespúšťa
aplikačné routy ani nadväzujúce akcie, nemení PM2 a nemá cloud fallback.
Audio Analyzer 1.6 sa nemení.

### Čo je pripravené

- Presný zoznam 65 služieb a 72 miest volania z dodaného katalógu.
- Kontrola SHA-256 pôvodných zdrojov a kontraktu pred prípravou aj pred behom.
- Materializované syntetické požiadavky pre všetky chatové miesta volania,
  vrátane strict schémy, obrazovej požiadavky a viacerých SDK volaní jednej služby.
  Nepodporované požiadavky sa neposielajú ako zjednodušený textový ekvivalent.
- Pôvodné TypeScript výrazy a ich odtlačky sa zachovávajú vedľa konkrétneho
  syntetického requestu. Pri izolovanej inferencii sa mení iba cieľový model na
  `indexus-document-audio:latest`. Neoptimalizuje sa prompt, tokenový limit,
  teplota ani formát odpovede.
- Evidencia HTML, CSV a JSON obsahuje každý service ID vrátane nevykonaných služieb.
- Pri podpore aktuálnym adaptérom: tri samostatné opakovania každého SDK miesta,
  sekvenčne, bez SDK retries. Nejde o test súbežnosti ani všetkých jazykov.

### Čo zatiaľ nie je preukázané

- Žiadna služba nebola v rámci tejto prípravy volaná na internom modeli.
- Aktuálne produkčné nastavenia neboli z Replitu čítané. Ich read-only kontrolu
  pred behom a po ňom vykonáva serverový runner.
- Syntetické referenčné príklady z katalógu nie sú namerané modelové odpovede,
  gold štandard nových fixtures ani dôkaz vecnej správnosti.
- Jeden scenár na call-site nepokrýva všetky dynamické vetvy, jazyky,
  multimodálne prílohy, prázdne vstupy, dlhé vstupy, repair slučky ani oprávnenia.
- Syntetické rečové WAV fixtures a skutočný kontrakt Audio API ešte chýbajú.
  Obrazový request obsahuje jasne označený nevykonateľný placeholder namiesto
  reálneho PNG; aktuálny adaptér ho odmieta ako multimodálny. Nie je to OCR test.
- Štyri čisté aplikačné hranice majú vyhradené source-extracted replay:
  email.sentiment, sms.sentiment, task.checklist, task.resolution.
  Ostatné služby sa pokúsia izolovane prehrať pôvodné príkazy za inferenciou.
  Chýbajúca závislosť alebo nadväzujúci zápis sa blokuje a reportuje, nenahrádza
  sa vlastným parserom. Úspešný replay ešte nie je overenie významu výsledku.

## Význam stavov

| Stav | Podmienka a hranica |
|---|---|
| COMPATIBLE | Vyžaduje živý beh, skutočný aplikačný kontrakt, vecnú kontrolu a dohodnuté pokrytie scenárov. Tento runner ho automaticky neudeľuje. |
| REQUIRES_FIX | Konkrétny kontraktný problém **alebo chýbajúci dôkaz**. Rozlišuje ich reason a execution; NOT_EXECUTED nie je zlyhanie modelu. |
| UNSUPPORTED | Požiadavka neprechádza aktuálnym INDEXUS adaptérom. Neznamená to, že ju hardvér alebo interný model nedokáže vykonať. |

Predbežná tabuľka obsahuje 50 REQUIRES_FIX a 15 UNSUPPORTED; nula COMPATIBLE.
Pri bežných textových službách REQUIRES_FIX znamená chýbajúci živý test, nie
potvrdenú chybu. `lead_sources.suggestion` má navyše preukázaný rozpor:
request vyžaduje JSON objekt, prompt žiada pole. Originál sa neopravoval.

## Záznam jednej inferencie

Každé opakovanie uchováva samostatne:

1. pôvodný model a pôvodnú konkrétnu syntetickú požiadavku;
2. požiadavku s testovacím interným modelom;
3. raw HTTP odpoveď Gateway pred validačným zásahom adaptéra;
4. modelový text, aj keď adaptér odmietne jeho JSON alebo obálku;
5. odpoveď, ktorú skutočne prijal existujúci adaptér;
6. pomocné JSON.parse, označené výslovne ako **nie aplikačný parser**;
7. výsledok pôvodného aplikačného parsera, jeho stav alebo dôvod neprehratia;
8. bezpečný chybový kód, pôvod chyby a mieru istoty zodpovednosti;
9. trvanie HTTP volania inferencie a celkový čas vrátane discovery a parsera.

Chýbajúce meranie je `null`, nikdy vymyslená nula. Trvanie HTTP nie je čistý
čas lokálneho generovania. Na rozdelenie load/prompt/eval treba telemetriu
interného servera s korelačným ID, ktorú aktuálny kontrakt neposkytuje.
Reporty sa ukladajú po každom dokončenom pokuse a znova po záverečnej kontrole.

### Zodpovednosť

- `INDEXUS_ADAPTER`: lokálne odmietnutie podporovaných tvarov requestu je
  preukázateľne na strane adaptéra; model nebol volaný.
- `INDEXUS_SERVICE_CONTRACT`: rozpor pôvodného promptu a request formátu.
- `TRANSPORT_OR_GATEWAY`: sieť/HTTP/autentifikácia; bez automatického obvinenia modelu.
- `GATEWAY_CONTRACT`: neplatná obálka, neúplné dokončenie alebo neplatný JSON.
  Bez upstream telemetrie je pôvod medzi Gateway a modelom **neurčený**.
- `MODEL_OUTPUT_OR_APPLICATION_CONTRACT`: skutočný aplikačný parser odmietol
  modelový obsah; rozdiel medzi chybným modelom a príliš úzkym kontraktom
  musí potvrdiť spoločná kontrola.
- `INDEXUS_TEST_HARNESS`: nesúlad requestu pri replay alebo chyba replay nástroja.
- `LOCAL_MODEL`: možno priradiť až po vecnom overení raw odpovede proti
  schválenému vstupu a po vylúčení zmeny v Gateway. Runner to neháda.

## Bezpečná príprava a spustenie

Runner patrí do existujúceho CRM checkoutu. Nie je to návod na nasadenie celej
rozpracovanej vetvy. Prenášajú sa len skontrolované súbory C1 a plán.
Potrebuje existujúce `tsx`, `typescript`, `zod`, `pg`, `dotenv`, OpenAI SDK
a existujúce moduly adaptéra. Nič automaticky neinštaluje.

### Offline príprava

V koreni checkoutu:

```sh
node script/ai-gateway-c1/prepare.cjs \
  generated-artifacts/ai-service-inventory/INDEXUS-65-AI-sluzieb.json \
  generated-artifacts/ai-gateway-c1/plan.json

npx --no-install tsx script/ai-gateway-c1/run.ts --offline \
  generated-artifacts/ai-gateway-c1/plan.json \
  generated-artifacts/ai-gateway-c1/offline-evidence
```

Nový výstup sa vytvára do ešte neexistujúceho cieľa. Doručený plán už prípravu
obsahuje. Pri zmene pôvodného zdroja runner skončí, nepreberie potichu nový prompt.

Doručený plán je naviazaný na overený publikovaný GitHub commit. Oproti
pôvodnému katalógu sa líšil iba celý súbor routes.ts, pričom všetkých 43
referenčných blokov služieb zostalo bajtovo zhodných. Offline reconciliácia
prepočítala pozície volaní a zdrojový odtlačok, nie prompty, modelové požiadavky
alebo parsery. Ostatných 28 závislostí bolo porovnaných s publikovaným stromom.
Pôvod a rozsah kontroly sú v `sourceReconciliation` plánu aj reportu.
Na kontrolu takého podkladu možno offline použiť posledný nepovinný argument
`run.ts --offline PLAN VYSTUP REFERENCNY_KOREN`; živý režim taký override neprijíma.

### Živý izolovaný beh — iba CORPCRM01

Spustiť ako existujúci prevádzkový používateľ `seman`, z koreňa schváleného
checkoutu, s existujúcim bezpečným runtime loaderom:

```sh
NODE_ENV=production node \
  --require /etc/indexus-ai-runtime/preload.cjs \
  --import tsx script/ai-gateway-c1/run.ts \
  --run-c1 /ABSOLUTNA/CESTA/plan.json
```

Tento príkaz sa v Replite nespúšťa. Nezapína sa aplikačná Gateway ani
environment prepínač. `production:true` v dependency injection adaptéra
identifikuje povolený serverový hostiteľský proces; nie produkčné smerovanie
ani požiadavku živého CRM používateľa. Inštancia klienta je výlučne testovacia.

Pred inferenciou aj po ukončení sa v DB transakcii READ ONLY overí konfigurácia:
Gateway off, 65 OpenAI služieb, bez interných rout a bez model overrides.
Prísnejšia požiadavka bez overrides je prevzatá z existujúcich B4 pilotov:
ak sa nájdu, runner skončí bez zmeny nastavení.
Porovnávajú sa aj verzia a odtlačky úplnej konfigurácie.
Kontrola na začiatku a konci nevylučuje cudziu dočasnú zmenu medzi kontrolami.

Pri autentifikačnej/sieťovej chybe, 429 alebo prerušení sa ďalšie volania
zastavia a zostanú NOT_EXECUTED. Tokeny ani hlavička Authorization sa neukladajú.
Detekovaný token vo výstupe sa neuloží; taký pokus sa zahodí a beh zastaví.

Výstup: `~/.indexus-c1/run-.../evidence.{json,csv,html}`, súkromné súbory 0600.
Marker podľa odtlačku plánu bráni náhodnému opakovaniu celého behu.
Nemažte ho automaticky. Ďalší beh vyžaduje vedomé prevádzkové rozhodnutie.

Exit 1: chyba alebo neoverený finálny stav. Exit 2: beh bol zaznamenaný,
ale kompatibilita stále čaká na spoločnú vecnú kontrolu. Exit 2 nie je
automatické schválenie ani signál pre prepnutie.

### Offline testy nástrojov

```sh
npx --no-install tsx --test \
  script/ai-gateway-c1/c1.test.ts \
  server/lib/ai/internal-adapter.test.ts \
  server/lib/ai-router-coverage.test.ts
```

Všetky transporty v testoch sú stubované. Zelené testy nástroja nie sú
výsledkami interného AI modelu. Testy nad plným katalógom vyžadujú jeho lokálnu
prítomnosť; ak chýba, node:test ich označí SKIP.

## Odovzdanie tímu interného AI servera

Nenasadzovať nový server z CRM projektu a nemeníť existujúce Audio API
na základe domnienok. Doplniť iba tieto katalógom preukázané potreby:

| Oblasť | Služby | Potrebný dôkaz / spolupráca |
|---|---|---|
| Text a json_object | 50 textových služieb | Presné pôvodné requesty v pláne, kompletné odpovede, skutočná vecná kvalita. |
| Strict JSON Schema | geography.priority | Dynamické povinné ID, null alebo integer, rozsahy, unique/contiguous ranking. Aktuálny adaptér schému odmieta pred sieťou. Nestačí json_object. |
| Obrazové OCR | collection.document | Skutočný syntetický PNG, zhodné polia a polohy; nie textová náhrada obrázka. |
| Responses a prílohy | automation.analysis | Text, obrázky/PDF a doslovné OCR vrátane úplnosti podľa vetvy. Bez tichého sploštenia na Chat. |
| Prepis | 7 služieb, 8 call-sites | Potvrdený existujúci Audio API OpenAPI, transport súborov, jazyky, skutočné syntetické rečové fixtures a očakávané prepisy. |
| Syntéza reči | 4 služby, 6 call-sites | OpenAPI existujúceho Audio API; hlasy, modely, speed, výstupné WAV/MP3/PCM a parametre PCM. Nepripisovať TTS schopnosť dokumentovému modelu. |
| Diagnostický probe | beratung.health | Existujúci adaptér chatProbe odmieta; samostatne rozhodnúť presné testovacie mapovanie bez zmeny aplikačnej diagnostiky. |

Pre Audio API poskytnúť špecifikáciu endpointov a formátov bez tajných údajov,
nie token alebo heslo. Presné URL/porty sa nehádajú.
Aktuálne `internalEligible` nie je dôkaz kompatibility.

### Dokončenie a spoločná kontrola C1

1. Vykonať pripravený textový beh na CORPCRM01 a prevziať privátne výsledky.
2. Každý modelový výstup posúdiť oddelene od doplnení a opráv parsera.
3. Doplniť chýbajúce bezpečné replay hranice a schválené scenáre/známe odpovede,
   aby boli pokryté reálne kontrakty, dynamické vetvy a dohodnuté jazyky.
4. Na strane AI servera dodať chýbajúce schopnosti a Audio API kontrakt; na
   strane INDEXUS iba potrebné testovacie mapovania. Potom vykonať príslušné testy.
5. Ku každej službe uzavrieť COMPATIBLE / REQUIRES_FIX / UNSUPPORTED s dôkazom,
   vlastníkom opravy a meraním. Nevydávať statickú tabuľku za tento finálny výsledok.
6. Produkčné prepnutie zostáva predmetom samostatného schválenia, nie C1 runnera.
