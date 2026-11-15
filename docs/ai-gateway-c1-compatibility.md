# INDEXUS AI Gateway — fáza C1

## C1.1 — iba offline opravy a príprava cielenej validácie

C1.1 nevytvára AI klienta, nepripája DB, nečíta prihlasovacie údaje a neposiela
discovery ani inferenčné požiadavky. Produkčné prompty, max_tokens, adaptér,
nastavenia a smerovanie nemení. Pri tejto etape nie je povolené opakovať hromadný
živý beh. Gateway má zostať vypnutá a všetkých 65 služieb na OpenAI.

### Offline príkaz

Použiť pôvodný doručený plan.json a koreň zdrojov, ktoré mu hashovo zodpovedajú
(napríklad už vytvorený izolovaný C1 adresár). Cieľový adresár nesmie existovať:

```bash
node --import tsx script/ai-gateway-c1/offline-c11.cjs \
  /ABSOLUTNA/CESTA/plan.json \
  /ABSOLUTNY/KOREN/POVODNYCH/ZDROJOV \
  /ABSOLUTNY/NOVY/CIEL \
  /ABSOLUTNA/CESTA/textove-evidence.json \
  /ABSOLUTNA/CESTA/sms-evidence.json
```

Nástroj overuje všetky zdrojové odtlačky plánu, zhodu pôvodných requestov,
identitu každého pokusu a zhodu modelOutput s raw odpoveďou. Nepreberá potichu
nové prompty. Uložené pokusy sa nemenia: ich úplný originál a SHA-256 zostávajú
vedľa nových výsledkov.

Výstupy: `evidence-c11.json`, `evidence-c11.html`,
`offline-parser-replay.csv`, `ai-server-issues.json`, `ai-server-issues.md`,
`targeted-validation-plan.json`. Plán cielenej validácie má explicitne vypnuté
oprávnenie živého vykonania; nič automaticky nespúšťa.
JSON a HTML majú všetkých 65 služieb; CSV obsahuje každý dostupný pokus.
Modelový obsah, pôvodný a znovu validovaný adaptér a pôvodný aj nový aplikačný
parser sú samostatné polia. Žiadny stav COMPATIBLE sa neprideľuje.

### Parserové a bezpečnostné hranice

- Legitímny `undefined` sa zaznamená ako `returnKind: "undefined", value: null`,
  nie ako neplatný modelový JSON. Chyba serializácie wrappera je oddelená od
  syntaktickej chyby pôvodného parsera.
- Pôvodné pure funkcie alebo explicitne zvolené AST prefixy sa extrahujú zo
  zdroja. Nový ručne napísaný parser modelového obsahu ich nenahrádza.
- Vybrané prefixy končia pred DB, obohatením, mapovaním na úložisko alebo
  odosielaním. `omittedDownstream` a pomenovaná `boundary` priznávajú túto hranicu.
  Pri voicemail sa samostatne prehráva pôvodná JSON extrakcia bez nadväzujúceho
  persistence guardu závislého od callLogId; nejde o test autorizácie zápisu.
- Pri lokálnych pomocných premenných pre čisté priradenia sa neoverujú
  pôvodné vonkajšie fallback hodnoty. Tento rozsah je označený
  `ORIGINAL_ASSIGNMENTS_ONLY`, nie plná aplikačná integrácia.
- DB, pool, storage, sieť a explicitné odosielacie/eventové funkcie nie sú
  skutočné služby: ich prípadné volanie vyvolá blokujúcu chybu a zapíše názov
  zablokovaného efektu. Ani zachytenie chyby pôvodným kódom z toho neurobí úspech.
  Import CRM modulov sa nevykonáva. Modelový text sa nikdy nevkladá do kódu.
- `ACCEPTED` znamená prijatie iba na uvedenej hranici; neoveruje význam,
  downstream zápisy, preklady všetkých jazykov ani pokrytie všetkých vetiev.

### Diagnostika pre neskorší samostatne povolený test

Zmeny sú iba v testovacom runneri, nie v produkčnom adaptéri. Transport uchováva
oddelené bezpečné stopy discovery/inferencie, deklarované vstupné/výstupné limity,
požadované max_tokens, HTTP stav a obmedzené meno/kód chyby, nikdy hlavičky či
raw výnimky. Rozlišuje lokálny abort, lokálny deadline, pomenovaný SDK timeout,
HTTP 408/504, HTTP chybu servera/Gateway a sieťovú chybu.

Každý pokus má vlastný AbortController a odpojí listener nadradeného signálu
v `finally`; nezvyšuje sa limit listenerov na skrytie varovania. Produkčný
adaptér ani pôvodný 120-sekundový rozpočet sa nemení.

Pôvodné C1 dáta discovery limity ani presnú identitu abortu neuložili. Číselný
deklarovaný limit je preto `null` s `NOT_CAPTURED_IN_ORIGINAL_C1`; nečíta sa
aktuálny server, aby sa vydával za historický dôkaz. Z pôvodného
`ai_internal_token_limit_exceeded` a hashovaného adaptéra vieme iba, že
deklarované maximum bolo menšie než požadovaných 16000/12000.
Štyri zlyhania približne pri 120 s sú `SUSPECTED_120S_TIMEOUT`, nie spätne
vymyslený HTTP timeout alebo potvrdená chyba modelu.

### Odovzdanie tímu AI servera

Samostatný zoznam oddeľuje:

1. preukázané chyby/porušenia kontraktu v obsahu pozorovanom za Gateway;
2. konfliktné pôvodné kontrakty INDEXUS (nie automaticky chyba AI servera);
3. nesúlad požadovaných tokenov s discovery kontraktom;
4. neoverené právne/medicínske či prevádzkové riziká na odborné posúdenie.

Každá položka obsahuje konkrétne varianty/opakovania, request, modelový obsah,
nový parser a odtlačok pôvodného pokusu. Bez upstream telemetrie sa výlučná
zodpovednosť lokálneho modelu nepotvrdzuje. Cielená živá validácia a akékoľvek
prepnutie zostávajú samostatne schvaľované.

Testy:

```bash
node --import tsx --test script/ai-gateway-c1/c11.test.ts
```

Test celých 162 pokusov používa lokálne súkromné fixtures a overené referenčné
zdroje; bez nich je explicitne SKIP. Ostatné testy sú samostatné a nikdy
nevolajú skutočné AI.

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
  syntetického requestu. Pri izolovanej textovej inferencii sa mení iba cieľový model na
  `indexus-document-audio:latest`. Neoptimalizuje sa prompt, tokenový limit,
  teplota ani formát odpovede.
- Evidencia HTML, CSV a JSON obsahuje každý service ID vrátane nevykonaných služieb.
- Pri podpore aktuálnym adaptérom: tri samostatné opakovania každého SDK miesta,
  sekvenčne, bez SDK retries. Nejde o test súbežnosti ani všetkých jazykov.
- Sedem prepisových služieb / osem miest volania má osobitné testovacie mapovanie
  na existujúce Audio API 1.6.1, `10.9.2.140:8765`, `POST /v1/audio/transcriptions`.
  Zachováva pôvodný `whisper-1`, jazyk a `response_format`, nie textový cieľový model.
  Nepridáva sa nový Whisper, Audio API, produkčný adaptér ani TTS riešenie.

### Čo zatiaľ nie je preukázané

- Žiadna služba nebola v rámci tejto prípravy volaná na internom modeli.
- Aktuálne produkčné nastavenia neboli z Replitu čítané. Ich read-only kontrolu
  pred behom a po ňom vykonáva serverový runner.
- Syntetické referenčné príklady z katalógu nie sú namerané modelové odpovede,
  gold štandard nových fixtures ani dôkaz vecnej správnosti.
- Jeden scenár na call-site nepokrýva všetky dynamické vetvy, jazyky,
  multimodálne prílohy, prázdne vstupy, dlhé vstupy, repair slučky ani oprávnenia.
- Minimálny request kontrakt prepisu potvrdil používateľ. Z implementácie ešte treba
  prevziať protokol, autentifikáciu, akceptované kodeky a overiť správanie odpovedí.
  Syntetické rečové WAV fixtures so známym prepisom ešte neboli dodané.
  Obrazový request obsahuje jasne označený nevykonateľný placeholder namiesto
  reálneho PNG; aktuálny adaptér ho odmieta ako multimodálny. Nie je to OCR test.
- Štyri čisté aplikačné hranice majú vyhradené source-extracted replay:
  email.sentiment, sms.sentiment, task.checklist, task.resolution.
  Ostatné služby sa pokúsia izolovane prehrať pôvodné príkazy za inferenciou.
  Chýbajúca závislosť alebo nadväzujúci zápis sa blokuje a reportuje, nenahrádza
  sa vlastným parserom. Úspešný replay ešte nie je overenie významu výsledku.
- Pri prepise sa zo zdroja extrahuje pôvodné prevzatie textu, training filter
  Whisper halucinácií a virtual-agent trim/minimálna dĺžka. DB zápisy, odstraňovanie
  súborov, preklady a nadväzujúca analýza sa neprehrávajú. Nie je to integračný test
  celej aplikačnej routy.

## Význam stavov

| Stav | Podmienka a hranica |
|---|---|
| COMPATIBLE | Vyžaduje živý beh, skutočný aplikačný kontrakt, vecnú kontrolu a dohodnuté pokrytie scenárov. Tento runner ho automaticky neudeľuje. |
| REQUIRES_FIX | Konkrétny kontraktný problém **alebo chýbajúci dôkaz**. Rozlišuje ich reason a execution; NOT_EXECUTED nie je zlyhanie modelu. |
| UNSUPPORTED | Aktuálna testovacia cesta nepodporuje operáciu alebo jej podpora nebola potvrdená (vrátane TTS). Neznamená to, že ju hardvér alebo interný model nedokáže vykonať. |

Po doplnení testovacieho mapovania prepisov obsahuje predbežná tabuľka
57 REQUIRES_FIX a 8 UNSUPPORTED; nula COMPATIBLE. Sedem prepisov sa presunulo
medzi čakajúce na dôkazy, nie medzi úspešne overené služby. Zvyšných osem je
štyri TTS služby, OCR, strict JSON Schema, Responses a chatProbe.
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

Pri prepise je `rawAudioResponse` oddelené od `rawGatewayResponse` (to je null).
`adapterOutput` označuje testovaciu OpenAI-kompatibilnú audio hranicu, nie nový
produkčný adaptér. `modelOutput` je neupravený prepis; výsledok pôvodnej
aplikačnej extrakcie/guardov je v `applicationParser`. Referenčný prepis a presné
porovnanie sú v `semanticCheck`; nevykonáva sa normalizácia ani automatické schválenie.
HTTP 200 musí mať pôvodný formát: `text/plain` pre explicitné `text`, JSON
objekt s textovým poľom `text` pre pôvodný predvolený `json` (training).
Žiadna tichá konverzia JSON obálky na text alebo naopak.

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

Runner používa schválené existujúce CRM zdroje. Môže bežať z privátnej izolovanej
kópie podľa návodu nižšie; živý checkout sa neupravuje. Nie je to návod na
nasadenie celej rozpracovanej vetvy. Prenášajú sa len skontrolované súbory C1 a plán.
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

#### Prvé skutočné výsledky bez nasadenia aplikácie

Nový ZIP balík obsahuje `launch.cjs` a hashovaný zoznam runtime zdrojov.
Spúšťač overí celý manifest a zhodu potrebných zdrojov so živým checkoutom,
potom vytvorí súkromný adresár v `/var/www/indexus-crm/data`. Tam skopíruje len
overené zdroje a testovací runner, pripojí existujúce závislosti a konfiguráciu
symlinkom a použije už existujúci runtime loader. Žiadny `git pull`, inštalácia,
reštart PM2 ani zmena súborov živého checkoutu. Pri nezhode zdrojov skončí.
Jediná výnimka pôvodu runtime závislostí je samostatný testovací pomocník
`script/ai-gateway-b4-pilot.cjs`: preberá sa z balíka s kontrolou oboch hashov,
nemusí byť v živej aplikácii. Pôvodné CRM prompty, parsery a adaptéry sa naďalej
overujú výhradne proti živému checkoutu; táto výnimka ich nenahrádza.

Ako `seman` na CORPCRM01, po nahratí doručeného ZIP do privátneho umiestnenia:

```bash
(
  set -eu
  test "$(hostname -s | tr '[:lower:]' '[:upper:]')" = CORPCRM01
  test "$(id -u)" = 1001
  read -r -p 'Úplná cesta k novému ZIP balíku C1: ' C1_ZIP
  test -f "$C1_ZIP"
  C1_ZIP="$(realpath "$C1_ZIP")"
  umask 077
  C1_BUNDLE="$(mktemp -d /var/www/indexus-crm/data/c1-bundle-XXXXXX)"
  python3 -m zipfile -e "$C1_ZIP" "$C1_BUNDLE"
  node "$C1_BUNDLE/script/ai-gateway-c1/launch.cjs" --services sms.sentiment
)
```

Tento príkaz vykoná tri izolované syntetické inferencie jednej služby, pôvodný
aplikačný parser a read-only kontrolu nastavení pred/po. Nevytvára SMS ani CRM
záznam. Vypíše výsledkový adresár a súhrn, nie token alebo hlavičky.
Výstup môže skončiť exit 2 — znamená zaznamenaný beh čakajúci na vecné schválenie.
Absencia živého výsledku alebo exit 2 sa nesmie interpretovať ako COMPATIBLE.
Reporty so syntetickým obsahom možno odovzdať na ďalšie vyhodnotenie; neposielať `.env`.

Pre celý pripravený textový súbor sa vo **vedome spustenom ďalšom behu**
vynechá `--services sms.sentiment`. Textové testy nečakajú na audio podklady.
Marker je oddelený pre vybranú podmnožinu služieb a celý súbor.

#### Priamy beh v existujúcom schválenom checkoute

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

Pri autentifikačnej/sieťovej chybe alebo 429 sa ďalšie volania dotknutého
transportu zastavia a zostanú NOT_EXECUTED. Audio a text majú oddelený circuit
breaker; chyba audio autentifikácie neblokuje text. Prerušenie alebo únik tokenu
zastaví celý beh. Tokeny ani hlavička Authorization sa neukladajú.
Detekovaný token vo výstupe sa neuloží; taký pokus sa zahodí a beh zastaví.

Výstup: `~/.indexus-c1/run-.../evidence.{json,csv,html}`, súkromné súbory 0600.
Marker podľa plánu, výberu služieb a verejného audio profilu/odtlačku manifestu
bráni náhodnému opakovaniu rovnakého behu.
Nemažte ho automaticky. Ďalší beh vyžaduje vedomé prevádzkové rozhodnutie.

Exit 1: chyba alebo neoverený finálny stav. Exit 2: beh bol zaznamenaný,
ale kompatibilita stále čaká na spoločnú vecnú kontrolu. Exit 2 nie je
automatické schválenie ani signál pre prepnutie.

### Existujúce Audio API — presné testovacie mapovanie

| Služba | Miesta | Zachované parametre |
|---|---:|---|
| mobile.voice_note | 1 | whisper-1, sk, text |
| mobile.call_transcription | 1 | whisper-1, text, bez jazykového hintu |
| call_recording.transcription | 2 | whisper-1, pôvodný jazykový výraz, text |
| beratung.transcription | 1 | whisper-1, text |
| voicemail.transcription | 1 | whisper-1, text |
| training.transcription | 1 | whisper-1, pôvodný jazyk vrátane at→de, predvolený JSON |
| virtual_agent.transcription | 1 | whisper-1, pôvodná jazyková vetva, text |

Polia multipart sú len pôvodné `file`, `model`, prípadne `language` a
`response_format`. Vynechané polia zostávajú vynechané. Súbory sa nemenia na text.
Port 8780 ani `/v1/audio/correct`, `/v1/audio/analyze`, `/v1/audio/analyze-text`,
`/v1/audio/analyze-text-verified` sa automaticky nevolajú: nie sú náhradou za
pôvodnú textovú analýzu ani dôkazom TTS.

ZIP obsahuje dva **nevyplnené, netajné** podklady:

- `audio-profile.template.json`: protokol/base URL, názov existujúcej runtime
  premennej s autentifikáciou, názov hlavičky/prefix, potvrdený kodek a referencia
  implementácie. Žiadne hodnoty tokenov. Gateway token sa na Audio API nepreberá.
  Existujúci loader musí dodávať už nakonfigurovanú audio autentifikáciu; táto
  verzia runnera podporuje existujúcu environment/header väzbu, nie odhad iného
  credential úložiska. Bez potvrdenej väzby sa audio nevolá.
- `audio-fixtures.template.json`: vedome vytvorená syntetická reč, jej jazyk,
  SHA-256 skutočného WAV a doslovný očakávaný prepis. Tichý WAV z unit testov nie
  je rečový fixture. Žiadna nová inštalácia Whisper/TTS; možno použiť existujúcu
  testovaciu nahrávku alebo nahovoriť uvedenú testovaciu vetu.

Prvá podpora runnera overuje PCM s16le, 16 kHz, mono WAV. To **nie je tvrdenie**
o podporovaných kodekoch servera; tento kodek sa musí potvrdiť z jeho existujúcej
implementácie. Chýbajúce potvrdenie, nezhoda hashu/jazyka alebo neplatný WAV
zablokujú odoslanie. Profil nie je súčasť produkčnej konfigurácie.

Po doplnení oboch privátnych súborov a WAV, z koreňa rozbaleného balíka:

```bash
node script/ai-gateway-c1/launch.cjs \
  --services mobile.voice_note,mobile.call_transcription,call_recording.transcription,beratung.transcription,voicemail.transcription,training.transcription,virtual_agent.transcription \
  --audio-profile ./audio-profile.json \
  --audio-fixtures ./audio-fixtures.json
```

Ide o 24 samostatných inferencií (8 miest × 3), bez TTS, fallbacku v runneri a
bez odoslania k OpenAI. Skutočnú identitu upstream modelu a prípadné interné
správanie existujúceho Audio API treba doložiť zo servera; nie je odhadované
z názvu `whisper-1`. Pri audio-only behu sa nevyžaduje Gateway token a existujúci
textový adaptér sa nevytvorí. Pred/po zostáva povinná rovnaká DB read-only kontrola.

### Offline testy nástrojov

```sh
npx --no-install tsx --test \
  script/ai-gateway-c1/c1.test.ts \
  script/ai-gateway-c1/audio.test.ts \
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
| Prepis | 7 služieb, 8 call-sites | Mapovanie potvrdeného multipart endpointu je pripravené. Doložiť existujúcu autentifikáciu/kodek, skutočné rečové fixtures a odpovede; nič nereinštalovať. |
| Syntéza reči | 4 služby, 6 call-sites | OpenAPI existujúceho Audio API; hlasy, modely, speed, výstupné WAV/MP3/PCM a parametre PCM. Nepripisovať TTS schopnosť dokumentovému modelu. |
| Diagnostický probe | beratung.health | Existujúci adaptér chatProbe odmieta; samostatne rozhodnúť presné testovacie mapovanie bez zmeny aplikačnej diagnostiky. |

Pre Audio API doplniť chýbajúce časti existujúceho kontraktu bez tajných údajov,
nie token alebo heslo. Potvrdený prepisový endpoint sa používa, ostatné kontrakty sa nehádajú.
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
