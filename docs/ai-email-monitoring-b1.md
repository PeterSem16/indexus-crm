# B1 — izolovaná integrácia Email Monitoring

## Aktuálne zadanie B1.8 — párové regresné overenie

### Technická oprava izolovaného klienta

Aktuálny profil `B18-technical-120s-warmup` nastavuje **iba B1.8** na 120 s:
SDK aj vonkajší časovač jedného spracovania (discovery + inferencia).
Ostatné historické piloty aj produkčné CRM nastavenia zostávajú bez zmeny.
Pred celou sadou vykoná jednu izolovanú požiadavku s pôvodným neutrálnym
vstupom B1.2; je uložená samostatne ako `warmup`, mimo klasifikačného skóre
aj distribúcie latencií 135 správ. Maximum je **1 + 135 = 136** inferencií,
bez retry, cloud fallbacku či opráv klasifikácie. Neúspešné zahriatie blokuje sadu.
Nový profil má samostatný jednorazový marker; staré markery ani výsledky sa nemažú.
Opakovať sa musí celých 135 správ, nejde o pokračovanie od prípadu 080.

Runner ani jeho rodičovský spúšťač nemajú celkový časový limit regresie.
30 s pri `git archive` a rozbalení sa týka iba prípravy, nie živého behu.
Report priebežne ukladá celkové trvanie, rozlišuje deadline požiadavky od
SIGINT/SIGTERM a spúšťač vypíše exit status/signál. Externé limity shellu,
hostiteľa či proxy to nevylučuje; SIGKILL nemôže zapísať finálny report.
Samotných 136 požiadaviek môže pri 120 s trvať až 4 h 32 min, navyše lokálne
kontroly a ukladanie. Celkový čas nie je ohraničený 30 ani 60 minútami.
Spúšťať oddelene od životnosti terminálu (`nohup`, privátny log, žiadny shell `timeout`);
predtým overiť, že pôvodný B1.8 proces už nebeží. Žiadny proces automaticky neukončovať.

Alias v CRM požiadavke, odpovedi a Gateway discovery je kontrolovaný a
deklarovaná revision sa zaznamená. **Nie je to dôkaz mapovania na Ollama ani
obsahu serverových pravidiel.** `modelMapping` zostáva `REVIEW_REQUIRED`,
kým nie je samostatne doložené efektívne mapovanie aliasu na backend,
Ollama model/digest a hash klasifikačných pravidiel z AI servera.
Výsledky prípravy sa nesmú vydávať za živú kompletnú regresiu.

Jeden izolovaný beh opakuje **100 pôvodných správ B1.7 a 35 správ B1.6**,
v tomto poradí, bez zmeny vstupov, referencií, CRM promptu alebo parametrov.
`prepare-console.cjs <PIN> --run-b18` automaticky a read-only vyhľadá skutočné
historické reporty B1.6 a B1.7. Skontroluje identitu správ, surové odpovede,
parser, pôvodné skóre, predinferenčné schválenie B1.7 a väzbu na presný
historický B1.6 report. Chýbajúce, technicky neplatné alebo nejednoznačné
podklady blokujú inferenciu. Historický klasifikačný FAIL neblokuje porovnanie.
Žiadne staršie fázy sa automaticky neopakujú.

Výstupy vo viditeľnom `/home/seman/INDEXUS-Email-Monitoring/B18-run-*/`:
**`B18_report.md`, `B18_evidence.json`, `B18_failures.json`**.
Všetkých 1080 polí má hodnotu pred/po a stav opravené, regresia, stále chybné,
nezmenené správne, `REVIEW_REQUIRED` alebo technicky neporovnateľné.
Osobitná sekcia zachová všetkých osem polí a poznámky prípadov **024, 025,
052, 061, 071, 074, 077, 088 a 092**. Aj referencia 092 zostáva pôvodná.
Všetkých 35 null referencií zostáva nerozhodnutých; nejde o automatický úspech
ani chybu. Report rozlišuje všetky kritické chyby a nové kritické chyby oproti
historickému výsledku. Technický výpadok sa nevydáva za klasifikačnú regresiu.

Zachované sú pôvodné prahy B1.7 a prísna regresia B1.6 (280/280 a 35/35).
Každá nová preukázaná regresia je FAIL aj pri dostatočnom priemere B1.7.
Nerozhodnuté referencie a nezávisle neposúdený slovenský jazyk `note`
zabraňujú finálnemu PASS. Následné posúdenie nemení zmrazené dôkazy.

Najviac **135 postupných inferenčných pokusov**, bez retry, warmupu,
cloud fallbacku či opráv výstupov; pokus sa uloží pred odoslaním a výstupy
sa priebežne atómovo aktualizujú. Jednorazový marker je spoločný pre obe sady.
Pri bezpečnostnom zlyhaní sa nespustí zvyšok ani druhá sada.
Verzia B1.8 je operátorom oznámená oprava servera; samotný alias modelu
nie je nezávislý dôkaz presných nasadených pravidiel.

Žiadny checkout/pull/build živej aplikácie, PM2 reštart ani zásah do AI servera.
Rovnaké kanonické HTTPS a súkromný existujúci runtime na CORPCRM01.
Read-only snapshoty overujú Gateway=false, 65/65 OpenAI a modelOverrides=0
pred, počas a po teste. Nulové produkčné zápisy a notifikácie.
**Produkčné prepnutie nie je povolené ani pri PASS.**

Príprava a offline testy nie sú vykonaný živý B1.8 test. Skutočné závery
sa dajú urobiť až zo súborov vrátených z CORPCRM01.

## Predchádzajúce zadanie B1.7 — nezávislá validácia

100 nových zmrazených syntetických e-mailov, 10 kategórií po 10 prípadoch,
slovenčina, čeština, angličtina a maďarčina. Žiadny vstup sa presne nezhoduje
s normalizovaným historickým B1.3–B1.6 korpusom; scenáre sú zámerne z rovnakej
domény. Nejde o dôkaz, že interný server nikdy nevidel podobný text zo svojho
tréningu. Runner nevykonáva tréning ani neodosiela referenčné odpovede;
z toho nevyplýva audit interných tréningových dát alebo logovania AI servera.

Samostatný **AI hodnotiteľ, nie človek**, pred inferenciou skontroloval všetkých
100 prípadov a 800 polí. Pred schválením opravil význam súhlasu v jednom
prípade: pôvodný CRM prompt definuje `wantsConsent` ako súhlas s niečím, nielen
so zmluvou. Žiadna oprava nevychádzala z odpovede testovaného modelu.
Schválenie v `b17-review.json` viaže hash korpusu, politiky aj pôvodného CRM
promptu; chýbajúca alebo nezhodná kontrola blokuje inferenciu.

Korpus SHA-256:
`2c2cd2d79198ab078492bf6e1bef9c1350f366b139ce37e1198abe1a5543915a`.
Je v ňom **35 nerozhodnutých referenčných polí v 18 prípadoch**. Hodnota `null`
neznamená ani úspech, ani chybu modelu. Vstupy a referencie zostávajú po behu
nemenné. Automatický report uvádza správne/chybné/nerozhodnuté/nespustené
polia, dolnú a hornú hranicu presnosti zo všetkých **800 polí / 100 prípadov**
a osobitne presnosť rozhodnutých polí. Hodnotenie sa nesmie „zlepšiť“
odstránením nejednoznačných prípadov z hlavného menovateľa.

Akceptácia: ≥98 % polí, ≥95 % celých prípadov, žiadna zo štyroch kritických
chýb, 100/100 technicky úspešných odpovedí a nulový cloud fallback.
Známe porušenie je FAIL. Nevyhodnotené referencie, neúplné dôkazy alebo
neschválená slovenčina poznámok vedú k REVIEW_REQUIRED, nie k PASS.
`note` sa kontroluje na prítomnosť, neprázdny reťazec a limit 100 znakov
vrátane prísnejšieho existujúceho limitu CRM v UTF-16. Slovenský jazyk musí
po behu nezávisle posúdiť hodnotiteľ; nepoužíva sa heuristické automatické
potvrdenie ani samohodnotenie testovaným modelom. Zatiaľ preto ani ideálny
automatizovaný beh nie je finálnym PASS. Následné posúdenie patrí do oddeleného
dôkazu, nikdy do prepísaného surového reportu či gold korpusu.

Spustenie `prepare-console.cjs <PIN> --run-b17` nepotrebuje cestu ako parameter.
Read-only vyhľadá skutočný dokončený report B1.6 v existujúcom viditeľnom
adresári, nezávisle prepočíta jeho skóre a overí vstupy, výstupy, konfiguráciu
a produkčné snapshoty. Historický klasifikačný FAIL je platným podkladom;
technicky neoverený/chýbajúci/nejednoznačný podklad blokuje test.
Predošlé fázy sa nikdy automaticky neopakujú.

Nové súbory vo viditeľnom `/home/seman/INDEXUS-Email-Monitoring/B17-run-*/`:
`B17_report.md`, `B17_evidence.json`, `B17_failures.json`. Všetky sa atómovo
aktualizujú priebežne; pokus sa uloží pred odoslaním. Najviac 100 jednotlivých
postupných inferencií bez retry, warmupu, fallbacku či úpravy modelovej odpovede.
Každý prípad zachová surový JSON, výsledok skutočného parsera, osem kontrol,
stav poznámky, HTTP/discovery/inferenčné dôkazy, pokusy, cloud volania a čas.
Čas je end-to-end cez CRM vrátane discovery a read-only snapshotov, nie GPU-only.
Súhrn uvádza priemer, medián, p95, minimum a maximum skutočne meraných prípadov.
Porovnanie s B1.6 rozlišuje známy regresný a nový validačný korpus; netvrdí
párové opravy/regresie na rozdielnych vstupoch.

Rovnaký CRM prompt/router/adaptér/parser, kanonické HTTPS, model `v1`,
temperature 0.1, max_tokens 200, json_object, stream=false.
Gateway=false, 65 OpenAI služieb, modelOverrides=0, nulové produkčné zápisy,
notifikácie aj zmeny AI servera. Žiadne prepnutie ani pri PASS.

## Predchádzajúce zadanie B1.6 — prísny regresný test

B1.6 používa identickú zmrazenú sadu B1.5/B1.4: 35 vstupov a 280
očakávaní, rovnaký systémový prompt, kanonické HTTPS, model a parametre.
PASS už nesmie vychádzať z priemernej 90 % hranice: vyžaduje presne
35/35 úspešných prípadov a 280/280 správnych klasifikačných polí.
Aj jediná nekritická odchýlka (napríklad sentiment) je FAIL.
Neúplný beh bez známeho porušenia je REVIEW_REQUIRED.
Zostávajú zachované všetky technické, bezpečnostné a kritické brány.

Porovnáva sa so skutočným dokončeným reportom B1.5, ktorý sa read-only
vyhľadá v `/home/seman/INDEXUS-Email-Monitoring/B15-run-*/evidence.json`.
Pred inferenciou sa overí zdrojový fingerprint, identický korpus/prompt/
parametre, surový JSON, pôvodné skóre, nulové vedľajšie účinky, vlastníctvo,
súkromné oprávnenia a nezmenená produkcia. Historický B1.5 sa prepočítava
jeho vtedajšími pravidlami, nie spätne novou 100 % bránou. Klasifikačný
FAIL B1.5 môže byť platný podklad; chýbajúci, technicky neoverený alebo
nejednoznačný podklad zablokuje spustenie. B1.3/B1.4 sa nečítajú ani neopakujú.

Spustenie: `prepare-console.cjs <PIN> --run-b16` bez ďalších argumentov.
Príkaz vypíše `B16_B15_BASELINE` a potom `B16_PROGRESS`.
Nový marker B1.6 nemení staré markery ani reporty. Najviac 35 postupných
inferenčných pokusov bez retry/fallbacku; priebežné atómové ukladanie pred
odoslaním a po každom výsledku.

Kompletné `report.md` a `evidence.json` sa ukladajú do viditeľného
`/home/seman/INDEXUS-Email-Monitoring/B16-run-*/`. Obsahujú všetkých 35
porovnaní B1.5/B1.6, všetkých osem kontrol polí na prípad, opravy, nové
regresie, pretrvávajúce odchýlky, kritické chyby, technické výsledky a
produkčné snapshoty/hash porovnanie. Samostatne sa zvýraznia SYN-B13-28,
SYN-B13-29, SYN-B14-31 a SYN-B14-32.
Produkcia zostáva Gateway=false, 65 služieb OpenAI, modelOverrides=0
a bez zápisov či notifikácií. Ani 100 % PASS neaktivuje produkčné smerovanie.

## Predchádzajúce zadanie B1.5 — finálny regresný test

Opakuje celú nemennú sadu B1.4: 35 identických objektov, 280 rovnakých
klasifikačných očakávaní. Žiadne nové prípady, prepisy očakávaní, CRM promptu
alebo opravy výstupu. Zachováva kanonické HTTPS, model ID a parametre.
Samostatne porovnáva SYN-B13-18, 20, 26, 28, 29, 30 a SYN-B14-32, 34.

Pred prvou inferenciou potrebuje oba skutočné podklady. B1.3 sa načíta
z argumentu `evidence.json`. Dokončený B1.4 sa read-only vyhľadá iba v
`/home/seman/INDEXUS-Email-Monitoring/B14-run-*/evidence.json`. Overí sa
vlastník, súkromné oprávnenia, neprítomnosť symlinkov, korpus, prompt,
surové JSON odpovede, presnosť, bezpečnostné počítadlá a nadväznosť
na pôvodný B1.3 hash aj produkčné snapshoty.
Klasifikačný FAIL B1.4 je prípustný historický podklad; neúplný,
technicky neoveriteľný, pozmenený alebo chýbajúci podklad nie.
Viac odlišných dokončených B1.4 reportov znamená zastavenie, nie odhad
podľa najnovšieho času. Zhodné kópie sa deduplikujú podľa obsahu.

Spustenie: `prepare-console.cjs <PIN> --run-b15 <B1.3 evidence.json>`.
Samostatný balík a nový marker B1.5 zachovajú všetky staré behy.
Výstup je vo viditeľnom `/home/seman/INDEXUS-Email-Monitoring/B15-run-*/`.
Príkaz nevykonáva opätovný B1.3/B1.4 test ani žiadnu doplnkovú inferenciu.

Report obsahuje výsledky všetkých 35 prípadov, osem zvýraznených prípadov,
celkovú aj oddelenú presnosť 240/40 polí, všetky zostávajúce odchýlky,
opravy a regresie proti B1.3 (iba pôvodných 30) aj proti B1.4 (všetkých 35).
Pre päť hraničných prípadov sa nevymýšľajú historické B1.3 odpovede.
Kritické chyby sa porovnajú samostatne vo všetkých troch fázach.
Nulové falošné súhlasy/zrušenia, rozpoznanie každého zrušenia, `critical`
pri explicitných zrušeniach/sťažnostiach, 35 HTTP 200 a platných JSON
odpovedí, nulový fallback a nezmenená produkcia zostávajú tvrdé podmienky.
Pôvodná 90 % hranica sa naďalej kontroluje osobitne na 240 pôvodných poliach.
Bez overiteľného dokončeného živého behu výsledok nie je PASS.
Ani PASS neaktivuje produkčné smerovanie.

## Predchádzajúce zadanie B1.4 — regresný test

B1.4 opakuje presne pôvodných 30 vstupov a všetkých 240 očakávaní B1.3.
Pridáva päť vopred definovaných hraničných prípadov (40 ďalších očakávaní);
nemení prompt CRM, Gateway endpoint, model ID ani parametre B1.3.
Nové pravidlá na AI serveri sa overujú cez skutočný CRM router/adaptér/parser,
nie priamym volaním Ollama alebo obídením Gateway.

Pôvodná sada sa porovnáva osobitne na menovateli 240, nové prípady na 40
a celý beh na 280. Pôvodná hranica aspoň 216/240 zostáva zachovaná a nové
prípady ju nemôžu zriediť. Nové tvrdé kritériá navyše vyžadujú nulové
falošné súhlasy, nulové falošné zrušenia, rozpoznanie každého zrušenia
a `critical` pre každé explicitné zrušenie alebo sťažnosť.
Všetkých 35 odpovedí musí byť HTTP 200, mať presne deväť správne typovaných
JSON polí a prejsť pôvodným parserom; žiadna programová oprava klasifikácie.

Porovnávací podklad je pôvodný kompletný B1.3 `evidence.json` (225/240,
22/30). Pred začiatkom sa nezávisle prepočíta, overí sa pevný korpus,
surový modelový obsah, fingerprint promptu a nezmenená produkcia. B1.4
odmietne zamenený podklad alebo očakávania. Report uvádza hash podkladu,
opravené odchýlky, nové regresie, pretrvávajúce odchýlky a samostatné
porovnanie prípadov 12, 17, 21–26 vrátane predikcií pred/po.

Spustenie: `prepare-console.cjs <PIN> --run-b14 <B1.3 evidence.json>`.
Použiť viditeľnú kópiu `/home/seman/B13-report-RCrLCU/evidence.json`.
Nové súkromné adresáre nezačínajú bodkou:
- nástroje: `/home/seman/INDEXUS-Email-Monitoring-Tools/`;
- výsledky: `/home/seman/INDEXUS-Email-Monitoring/B14-run-*/`.

Nový marker B1.4 nemení markery ani výsledky B1.3. Najviac 35 postupných
inferenčných pokusov, bez retry/fallbacku; počet pokusov sa uloží pred
odoslaním a výsledky atomicky po každom prípade. Prerušený beh sa automaticky
neobnovuje. Bezpečnostné kontroly, zastavenie pri 401/403/429 a read-only
porovnanie produkcie zostávajú rovnaké. Produkcia musí naďalej mať
Gateway=false, 65 OpenAI služieb a žiadne model overrides.

Výsledok je FAIL pri porušení tvrdého kritéria, REVIEW_REQUIRED pri
neúplnom/neoverenom behu a PASS iba pri splnených kritériách s dokončeným
overením. Aj pri PASS sa podrobne vypíšu ostatné klasifikačné odchýlky;
PASS nikdy neaktivuje produkciu.

## Predchádzajúce zadanie B1.3

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
