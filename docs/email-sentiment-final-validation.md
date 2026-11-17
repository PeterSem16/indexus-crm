# email.sentiment – záverečné overenie a rozhodnutie

Dátum: 17. 11. 2026. Pokračovanie existujúcej integrácie, nie nová implementácia.

## Rozhodnutie

**REVIEW_REQUIRED – zatiaľ nie READY_FOR_PILOT.**

Používateľ prijal **80 PASS / 0 FAIL / 0 SKIP** nezávislých kontrol.
Aktuálne sa odovzdáva iba technický návrh HTTPS prístupu a plán
sekvenčnej regresie. Pripojenie, preflight ani živé inferencie sa
nevykonali. Fáza B a produkčné zapnutie nie sú schválené.

Podklad AI tímu dokladá podľa jeho vyjadrenia tri úspešné lokálne scenáre
NORMAL, ANGRY a INJECTION cez testovaciu Gateway. Nedokladá kompletný beh
z CRM, pôvodných 18 prípadov cez CRM ani kapacitu pri súbežnej záťaži.
Tieto výsledky sa nesmú zlúčiť so syntetickými CRM testmi do jedného
údajne živého end-to-end výsledku.

## Čo je na základe nového podkladu doplnené

1. **Dôvod manuálneho posúdenia.** Známa odpoveď o manipulácii súhlasom
   sa zachováva od Gateway adaptéra cez SDK až po CRM výsledok ako
   `reason: possible_prompt_injection_affected_consent_classification`.
   Surový vendor text sa nekopíruje. Nepodporovaný dôvod je výslovne
   `unspecified`, nie vymyslené vysvetlenie.
2. **Súbežné požiadavky.** Natívny lokálny HTTP test posiela tri skutočne
   sa prekrývajúce požiadavky s rôznymi výsledkami. Kontroluje, že výsledok
   so súhlasom nezamení manuálne posúdenie alebo neutrálny výsledok.
3. **Výpadkové odpovede.** Osobitné syntetické odpovede pre nedostupný
   adaptér a Ollama preverujú pôvodnú obchodnú vetvu bez obchodných účinkov,
   retries alebo externého fallbacku. Skutočné služby sa nevypínajú.
4. **Kontrakt poznámky.** Pôvodný email.sentiment nemá limit 100 znakov:
   Gateway sa musí zosúladiť s pôvodným kontraktom, nie orezávať poznámky.
   Historické testy 100, 101, 1000 a odmietnutia 1001 opisujú aktuálny
   CRM validátor, nie schválenie nového limitu na Gateway. Existujúca
   ochrana CRM 1000 sa v tejto dokumentačnej úlohe nemení a nevydáva
   sa automaticky za pôvodnú obchodnú požiadavku.

Historický výsledok 131 PASS patrí predchádzajúcemu izolovanému vydaniu.
Aktuálny výsledok rozšírenej sady a merania sú odovzdané samostatne;
žiadny fixture test nie je považovaný za výsledok reálneho modelu.

## Nové výsledky CRM

- **136 PASS / 0 FAIL / 0 SKIP** v rozšírenej izolovanej sade:
  37 testov `email.sentiment` a 99 regresných kontrol.
- Striktná TypeScript kontrola zmeneného jadra prešla.
- Backendový produkčný bundle selektívnej zostavy prešiel; existujúce
  upozornenia na import.meta a duplicitné mapovacie kľúče zostali.
- Skutočný lokálny HTTP test meral zdieľaný 30-sekundový deadline.
  Nejde o meranie výkonu živého modelu; konkrétne merania sú v odovzdanom
  reporte a uchovanom TAP výstupe.
- Žiadny test nenahrádza pôvodných 18 prípadov. Nevznikol nový referenčný
  korpus vydávaný za pôvodné prípady AI tímu.

### Doplnenie po dodaní pôvodného korpusu

Pôvodných 18 správ a čiastkové referencie už boli dodané a sú v
`script/ai-email-sentiment/regression-corpus.ts`. Korpus preto už nie je
blokátorom. Nová sada má **80 PASS / 0 FAIL / 0 SKIP**; zahŕňa pôvodných
37 sentimentových kontrol a 43 nových kontrol. Nie je to ďalších
80 testov pripočítateľných k historickým 136.

Nové kontroly zahŕňajú všetkých 18 vstupov cez pôvodný CRM analyzátor,
Router, SDK a lokálny HTTP fixture server, aj samostatnú bezpečnú vetvu K12.
Sú to výsledky testovania kódu so syntetickými odpoveďami, nie výsledok
18 živých modelových inferencií. Podrobnosti sú v
`docs/email-sentiment-regression-results.md`; aktuálny technický návrh
trasy a plán iba sekvenčných 18 prípadov je v
`docs/email-sentiment-test-proposals.md`. Nejde o vykonané živé testy.

## Akceptačná tabuľka

| Kritérium | Stav | Dôkaz / chýbajúci podklad |
|---|---|---|
| Kompletná cesta CRM → testovacia Gateway → adaptér → Ollama | NEOVERENÉ | Chýba schválená dosiahnuteľná testovacia trasa z CORPCRM01. |
| Pôvodných 18 prípadov a referencií | DODANÉ | Zachované pôvodné čiastkové referencie; živé modelové odpovede ešte nie sú namerané. |
| Service-scoped model, pôvodný prompt, striktný parser | OVERENÉ IZOLOVANE | Existujúca integrácia a prijaté fixture testy. |
| Zachovanie REVIEW_REQUIRED aj známeho dôvodu | OVERENÉ IZOLOVANE | Skutočný CRM analyzátor, Router, SDK a natívny lokálny HTTP transport. |
| Zákaz obchodných akcií a cloud fallbacku pri chybe | OVERENÉ IZOLOVANE | Pôvodná obchodná vetva zo zdrojového kódu a zákaz externého adaptéra. |
| Celkový CRM deadline 30 sekúnd | OVERENÉ IZOLOVANE | Spoločný SDK deadline zahŕňajúci discovery, inferenciu a čítanie odpovede. |
| Návrh testovacej HTTPS trasy | PRIPRAVENÝ NÁVRH | Loopback SSH 28443 → samostatný TLS vstup 18443 → testovacia Gateway 8771; porty/certifikát/autentifikácia ešte nepotvrdené. |
| Kontrakt note bez nového limitu 100 | POTVRDENÁ POŽIADAVKA | Gateway musí doložiť zachovanie poznámok nad 100 bez orezania pred živým behom. |
| Dopad sekvenčnej regresie na produkčné služby | NEOVERENÉ | Plán 5 min východisko + najviac 10 min/18 pokusov + 5 min následné pozorovanie; chýbajú živé dôkazy a konkrétna telemetria. |
| Fáza B / súbežná záťaž | NEPOVOLENÁ | Nevykonáva sa ani automaticky po úspešnom sekvenčnom behu. |
| Sémantika hnevu, hrubosti a otázky verzus výpoveď | REFERENCIE DODANÉ | K04–K11 majú dodané čiastkové referencie; nesmú sa dopĺňať podľa výstupov. Živá zhoda je neoverená. |
| Slovenský jazyk skutočných poznámok | NEOVERENÉ | Vyžaduje kontrolu živých modelových výstupov. |
| Spravovaný adaptér, interná autentifikácia, dohľad a rollback | NEOVERENÉ | Podklad stále uvádza adaptér ako testovací proces. |
| Produkčné smerovanie email.sentiment | NEAKTIVOVANÉ | Nebol vykonaný žiadny produkčný zásah. |

## Blokátory živého testu

- Adresa `127.0.0.1:8771` patrí AI serveru; z CORPCRM01 ani Replitu neznamená
  prístup na túto Gateway. Podklad výslovne uvádza, že vzdialená trasa
  zatiaľ nie je pripravená.
- Nie je dodaná schválená HTTPS testovacia URL alebo presný schválený
  bezpečný tunel. Nevymýšľať verejný prefix, neotvárať port 8771
  a nepoužiť produkčný port 8770 namiesto testovacieho.
- Existujúci adaptér vyžaduje HTTPS. Ak navrhovaný tunel končí lokálnym
  HTTP, bez osobitne schváleného riešenia ho nemožno iba vložiť do
  konfigurácie alebo kvôli nemu rozvoľniť spoločné bezpečnostné pravidlá.
- Pôvodný 18-prípadový korpus a referencie už boli dodané. Chýbajú jeho
  živé výsledky z CRM a následná kontrola poznámok. K12 povoľuje samostatné
  bezpečné odmietnutie; nejde o platnú deväťpoľovú modelovú odpoveď.
- Samostatná testovacia Gateway zdieľa s produkčnou cestou Ollama.
  Oddelenie portov samo osebe neznamená oddelenie výpočtovej kapacity.
  Aj sekvenčný profil potrebuje bezpečné okno a meranie vplyvu.
  Fáza B nie je súčasťou aktuálneho postupu.
- Gateway musí doložiť zhodu s pôvodným note kontraktom bez nového
  100-znakového limitu. Bez tohto dôkazu sekvenčný beh nezačať.
- Nové odovzdanie neznamená povolenie vypnúť adaptér/Ollama používané
  produkciou kvôli fault testu. Ostré výpadkové scenáre vyžadujú izolovaný
  upstream alebo osobitne schválený postup bez zásahu do iných služieb.

## Úpravy a dohody požadované od AI tímu

1. Sprístupniť iba schválenú testovaciu trasu s autentifikáciou a rovnakým
   discovery/Chat Completions kontraktom ako existujúci interný adaptér.
   Zmeny produkčného tokenu, procesu 8770 ani jeho súboru nie sú povolené.
2. Potvrdiť pevný slovník `reason_code`. Súčasný dokumentovaný dôvod je
   podporený aj spätne kompatibilným presným mapovaním správy; nové dôvody
   sa nesmú preberať ako ľubovoľný zákaznícky text.
3. Zosúladiť Gateway s pôvodným kontraktom bez nového limitu 100 znakov
   a doložiť zachovanie dlhšej poznámky deterministickým kontraktovým
   testom. Žiadne tiché skrátenie, domyslená referencia ani nový limit
   bez dohody; slovenský jazyk zostáva požiadavkou.
4. Pri vyhodnocovaní použiť dodané K10/K11 a nezamieňať ich čiastkové
   referencie. K10 predpisuje hnev, nie hodnotu hrubosti; K11 predpisuje
   hrubosť a nevhodný obsah. Existujúci CRM prompt tieto príznaky oddeľuje.
   Chýbajúce referencie sa nesmú dopĺňať podľa modelových odpovedí.
5. Pred pilotom pripraviť spravovanú službu adaptéra, chránenú internú
   komunikáciu, readiness, bezpečné logovanie, alerty, obmedzenie súbežnosti
   a test obnovy/rollbacku. Nemerané hodnoty kapacity zostávajú neznáme.

## Ďalší postup: iba sekvenčná regresia po schválení trasy

1. Schváliť konkrétny loopback SSH/TLS návrh a až potom vykonať technické
   overenie bez inferencie. Potvrdiť Gateway kontrakt note a autentifikáciu.
2. Pred prvou inferenciou mať pripravený izolovaný živý klient, schválené
   okno a dôkaz pozorovateľnosti/bezpečnej kapacity produkcie. Nemeniť
   uložené routy alebo administratívne nastavenia.
3. Vykonať presne pôvodných 18 prípadov sekvenčne, jeden pokus na prípad.
   Žiadny dodatočný warmup, retry, fallback alebo modelový preflight.
   Bezpečnostná alebo prevádzková stop podmienka má prednosť pred dokončením;
   nevykonané prípady sa explicitne uvedú.
4. Vyhodnotiť HTTP, JSON, čiastkové referencie, K12 oddelene, časy,
   slovenčinu poznámok a produkčnú telemetriu. Bez meraní netvrdiť nulový
   dopad; timeout klienta nepreukazuje dokončenie upstream inferencie.
5. Po sekvenčnom behu nenadväzuje súbeh. Fáza B aj produkčný pilot sú
   samostatné budúce rozhodnutia, nie súčasť tejto dokumentačnej úlohy.

Podrobný preflight, profil, záznam výsledkov a stop podmienky:
`docs/email-sentiment-test-proposals.md`.

**Nezmenené hranice:** žiadna zmena produkčného `main.py`, reštart 8770,
úprava tokenu, modelu `email.monitoring`, smerovania iných služieb alebo
automatická aktivácia `email.sentiment`.
