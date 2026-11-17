# email.sentiment – HTTPS pripojenie a sekvenčná regresia

**Stav: návrh, nie vykonané pripojenie.** Používateľ prijal nezávislé
kontroly **80 PASS / 0 FAIL / 0 SKIP**. V tejto dokumentačnej príprave
sa nespustil tunel, kontrola vzdialených portov ani živá inferencia.
Produkčné zapnutie nie je schválené. Celkový verdikt ostáva **REVIEW_REQUIRED**.

Tento postup nahrádza starší návrh 24 pokusov vrátane súbežnej fázy B.
**Aktuálny plán obsahuje iba 18 sekvenčných pokusov. Fáza B je zakázaná**
a nenadväzuje automaticky ani po úspešnej regresii.

## 1. Čo je potvrdené a čo nie

- Zdroj CRM potvrdzuje požiadavku HTTPS pre `email.sentiment`, Bearer
  autentifikáciu, zákaz presmerovaní a spoločný deadline najviac 30 sekúnd.
  Existujúca osobitná HTTP výnimka pre `email.monitoring` sa nerozširuje.
- AI tím hlási testovaciu Gateway `127.0.0.1:8771`, adaptér 8792, Ollama
  11434 a lokálny výsledok troch scenárov 3 PASS / 0 FAIL. Nie je to dôkaz
  dostupnosti z CORPCRM01 ani výsledok 18-prípadového CRM behu.
- Pôvodných 18 správ a čiastkové referencie už sú v regresnom balíku.
  Používa sa existujúci CRM prompt; Python prompt AI servera sa nevymýšľa.
- Pripravená je architektúra pripojenia, nie živý spúšťač. Existujúci
  `test-configuration.ts` je fixture pomôcka so syntetickým transportom,
  nie príkaz na pripojenie k AI serveru.
- Konkrétny SSH host/port/účet, host key, dostupnosť nových portov,
  certifikát, testovacie oprávnenia a telemetriu treba potvrdiť.
  Žiadne kľúče, heslá alebo tokeny sa nežiadajú cez chat.

## 2. Konkrétne navrhované zapojenie

```text
CORPCRM01: oddelený testovací proces
  HTTPS https://127.0.0.1:28443/
    → lokálny SSH forward 127.0.0.1:28443
    → AI server: samostatný TLS vstup 127.0.0.1:18443
    → AI server: testovacia Gateway http://127.0.0.1:8771/
    → existujúci testovací adaptér 127.0.0.1:8792
    → existujúce Ollama 127.0.0.1:11434
```

Porty **18443 a 28443 sú návrh novej alokácie**, nie overené voľné porty
alebo už existujúce služby. Priama HTTP base URL cez SSH by v CRM
neprešla kontrolou protokolu: SSH nepretvorí HTTP na HTTPS.
Gateway 8771, adaptér a Ollama sa nesprístupnia na LAN.

### Rozdelenie zodpovedností

| Vlastník | Podmienky a budúce overenie po súhlase |
|---|---|
| AI tím / správca AI servera | Potvrdiť SSH cieľ, port, účet, host key a voľný loopback port 18443; navrhnutý TLS vstup smeruje iba na 8771, nikdy na 8770. |
| Správca PKI | Schváliť certifikát so SAN `IP:127.0.0.1`, platnosť, serverové použitie a reťaz dôveryhodnej súkromnej CA. Certifikát sa teraz nevydáva. |
| Správca CORPCRM01 | Potvrdiť port 28443 a izolovaný SSH proces, oprávnenia na načítanie testovacej CA a autentifikácie; produkčný proces sa nemení. |
| Prevádzkový vlastník email.monitoring | Schváliť okno, existujúce pasívne metriky, porovnateľné východisko a konkrétne stop hranice. |
| Používateľ / schvaľovateľ | Schváliť konkrétnu trasu a jej vytvorenie; následne sa postupuje iba v rámci sekvenčnej regresie. Produkčný pilot a fáza B sú osobitné rozhodnutia. |

### TLS a SSH ochrany

1. TLS vstup 18443 musí predložiť správny certifikát aj bez DNS SNI:
   klient sa pripája na IP a kontroluje IP SAN. Samotné CN nestačí.
   Samostatný listener sa nesmie spoliehať na DNS virtuálny host.
2. Schválenú CA načíta iba oddelený testovací proces pred štartom.
   Nemení sa systémový trust store, globálne DNS, `/etc/hosts`, PM2
   ani prostredie produkčného CRM. Ak PKI nevie vydať tento IP SAN,
   predložiť nový DNS/SNI variant na schválenie, nie obísť validáciu.
3. Žiadne `rejectUnauthorized=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`,
   `curl -k`, presmerovanie na iný endpoint alebo plaintext výnimka.
4. SSH iniciuje CORPCRM01. Overiť pripnutý host key, iba loopback forwarding,
   serverové obmedzenie povoleného cieľa a vlastníctvo samostatného procesu.
   Nepoužiť agent forwarding, verejný, dynamický ani reverzný proxy.
5. Nemení sa produkčný token. Testovacia Gateway musí potvrdiť vlastné
   oprávnenia a bezpečný serverový loader; zhodu s produkčným tokenom
   nemožno predpokladať. Token nie je argument príkazu, obsah reportu,
   HTTP access log ani diagnostická hlavička.
6. Testovací TLS vstup má byť bez prepisovania JSON alebo orezávania note,
   bez retries a bez ukladania autorizácie či tiel. Overiť aj to,
   že proxy/Gateway neopakuje upstream inferenciu po zlyhaní klienta.

Šablóna transportu **iba na kontrolu a budúce schválenie**, nie vykonaný
príkaz; hodnoty v zátvorkách musí potvrdiť správca:

```text
ssh -N -T -p <schválený-SSH-port>
  -o BatchMode=yes -o StrictHostKeyChecking=yes
  -o ExitOnForwardFailure=yes -o ForwardAgent=no
  -o ControlMaster=no -o ControlPath=none
  -o ServerAliveInterval=15 -o ServerAliveCountMax=2
  -L 127.0.0.1:28443:127.0.0.1:18443
  <schválený-účet>@<schválený-AI-host>
```

Ide o jeden navrhovaný príkaz zalomený pre čitateľnosť, nie spustiteľný
skript. Nezakladať SSH prístup, nemeníť firewall ani nereštartovať služby
na základe samotného dokumentu.

## 3. Kontrakt note: žiadny nový limit 100

**Pôvodný `email.sentiment` neobsahuje 100-znakový limit note.
Gateway sa musí zosúladiť s kontraktom; CRM sa nesmie prispôsobiť
skracovaním poznámok alebo zavedením tohto limitu.**

Zostáva presných deväť polí: `sentiment`, `hasInappropriateContent`,
`hasAngryTone`, `hasRudeExpressions`, `wantsToCancel`, `wantsConsent`,
`doesNotAcceptContract`, `alertLevel`, `note`. Správne typy a povolené
hodnoty sú v integračnom dokumente. Žiadne dopĺňanie predvolených hodnôt.

Aktuálny CRM parser má ochrannú hranicu **1000 znakov** pre note a
32768 znakov na vstupný klasifikačný text. To je opis existujúceho
validátora, nie nová schválená obchodná požiadavka ani oprávnenie preniesť
rovnaké čísla na Gateway. V tejto úlohe sa parser nemení.

Pred prvou inferenciou AI tím doloží kontrolu Gateway/adaptéra a
deterministický kontraktový test zachovania platnej poznámky **nad 100
znakov bez skrátenia**. Zahŕňa to chyby na dlhších poznámkach, skryté
orezávanie aj správne UTF-8/JSON spracovanie. Nepotrebuje to novú modelovú
požiadavku mimo pôvodných 18 prípadov. Ak dôkaz chýba, živý beh nezačať.
Nový limit sa nezavádza bez dohody; slovenčina sa hodnotí na skutočnom texte.

## 4. Technické overenie bez inferencie

**Vykonáva sa až po výslovnom schválení konkrétnej trasy.** V tejto úlohe
sa nevykonalo. Každá kontrola má vlastný záznam PASS/FAIL/NEOVERENÉ;
nepatrí medzi 18 inferencií.

1. Potvrdiť host key, vlastníka procesov, dostupnosť navrhnutých portov,
   viazanie len na loopback a skutočný proxy cieľ 8771.
2. Overiť TLS reťaz, platnosť a SAN proti schválenej CA z CORPCRM01.
   Neplatný certifikát alebo iná CA nesmú byť prijaté. Neukladať ani
   neodosielať súkromný certifikačný kľúč do CRM alebo Replitu.
3. S platnou testovacou autentifikáciou overiť tieto URL:
   - `https://127.0.0.1:28443/health/ready`
   - `https://127.0.0.1:28443/v1/models`
   - `https://127.0.0.1:28443/indexus/v1/capabilities`
4. Overiť odmietnutie chýbajúcej/neplatnej autentifikácie na dohodnutých
   ne-inferenčných chránených endpointoch. Verejný health endpoint sám
   nepreukazuje ochranu inferencie; AI tím musí doložiť aj jej vynútenie
   bez odoslania ďalšej modelovej požiadavky.
5. Overiť service-scoped model `indexus-email-sentiment:4b`, `apiVersion: "1"`,
   `chat.completions`, textový vstup, `json_object`, neskrátený výstup a
   podporu požadovaných 300 výstupných tokenov. Parametre zostávajú
   temperature 0.1, stream false a thinking vypnuté na AI strane.
6. Doložiť note kontrakt, nulové upstream retries, 422 obal s oboma
   `error.type`/`error.code = review_required`, bezpečný reason_code
   a prevádzkový dohľad. Generická 422 nie je bezpečné odmietnutie.
7. Doložiť, že testovací klient používa skutočný Router/SDK a validujúce
   HTTPS, nie fixture transport presmerúvajúci HTTPS na lokálne HTTP.
   Použiť len in-memory konfiguráciu pre email.sentiment a loader na
   CORPCRM01, bez zápisu DB, importu štartu CRM alebo schedulerov.
8. Potvrdiť pozorovateľnosť produkcie a možnosť bezpečne ukončiť iba
   testovacie procesy. Až úspešný preflight odblokuje schválený sériový beh.

## 5. Sekvenčný regresný profil

| Fáza | Súbežnosť inferencií | Počet | Interval / maximálne trvanie |
|---|---:|---:|---|
| Pasívne východisko | 0 | 0 | existujúca telemetria každých 5 s / 5 min |
| A: pôvodná regresia | **1** | **18** | min. 1 s po dokončení predchádzajúceho / 10 min |
| Pasívna následná kontrola | 0 | 0 | existujúca telemetria každých 5 s / 5 min |

Pevný strop pozorovania je **20 minút**, aktívnej fázy **10 minút** a
modelových pokusov **18**. Preflight sa vykonáva oddelene pred týmto oknom.
Po stop alebo uplynutí času sa pozorovanie nesmie potichu predlžovať
a chýbajúce výsledky sa nesmú dopĺňať opakovaním.

- Presné poradie: **K01–K12, EN, CS, HU, RO, IT, DE**; predmet a správy
  z nemenného pôvodného korpusu, existujúci CRM prompt a predspracovanie.
- Jeden pokus na prípad, bez retries, fallbacku, zahrievacieho volania,
  súbehu, náhradného modelu alebo zmeny referencií podľa odpovedí.
- Spoločný deadline **30 000 ms** od vstupu do CRM request cesty vrátane
  discovery, inferencie a čítania odpovede. Meriať aj réžiu návratu po abort.
- Klientsky abort nepreukazuje ukončenie inferencie v Ollama. Pri timeoute
  zastaviť ďalšie spúšťanie, kým vlastník nepotvrdí ukončenie/bezpečný
  stav upstreamu; bez tohto potvrdenia už nepokračovať v danom behu.
  Syntetický „jeden pokus“ nie je dôkaz absencie skrytých upstream retries.
- Neplatný JSON, nesúhlas referenčných polí alebo nečakané manuálne
  posúdenie sa zaznamenajú bez opravy či zopakovania. Pokračovať iba ak
  je dokázané ukončenie pokusu, nulové obchodné účinky a bezpečnosť produkcie.
- Falošný súhlas/výpoveď v dodanom referenčnom poli, únik do obchodných
  akcií alebo prevádzková stop podmienka znamená okamžitý stop.
  Po zastavení uviesť nevykonané prípady a neoznačiť beh za úplný.
- **Fáza B sa nevykonáva.** Ani bezchybných 18 odpovedí ju neaktivuje.

## 6. Výsledky jednotlivých prípadov a presnosť

Budúci chránený záznam má obsahovať nasledujúce polia; teraz neexistujú
žiadne namerané hodnoty zo živej CRM regresie:

| Skupina | Povinný obsah |
|---|---|
| Pôvod | run ID, case ID, hash predmetu/tela a promptu, verzia zdroja, model, označenie LIVE alebo SYNTHETIC; nemiešať ich |
| Čas | UTC štart/koniec, monotónne celkové trvanie, prípadne časy discovery a inferencie, deadline/abort |
| Transport | Skutočný HTTP stav inferencie, oddelené stavy discovery, alebo explicitné „bez HTTP odpovede“; nikdy nevymýšľať 200 či 422 z aplikačného stavu |
| Klasifikácia | Chránený raw modelový text, finish_reason, výsledok striktnej validácie všetkých deviatich polí a bezpečný kód chyby |
| Referencie | Iba pôvodne určené polia, očakávanie/skutočnosť/zhoda; nevypĺňať neznáme hodnoty |
| Poznámky | Zachovanie bez orezania, manuálne posúdenie slovenčiny všetkých skutočných poznámok, osobitne význam K09 a záznam hodnotiteľa bez osobných údajov v zdieľanom reporte |
| Bezpečnosť | REVIEW_REQUIRED osobitne, bezpečný známy dôvod alebo unspecified, 0 obchodných účinkov, počet pokusov a potvrdená absencia fallbacku |

Budúci živý spúšťač potrebuje priehľadný pozorovací obal nad natívnym
HTTPS transportom: musí zachovať URL, hlavičky, signál, validáciu TLS
a pôvodnú odpoveď pre SDK, nie ich zameniť ako fixture transport.
HTTP stavy treba zaznamenať pred normalizáciou SDK; raw text len ohraničene
v rámci existujúcich bezpečnostných limitov a spoločného deadline.
Získanie diagnostiky nesmie vyvolať druhú požiadavku ani predĺžiť deadline.
Samotný finálny stav analyzátora tieto transportné dôkazy nenahrádza.

Diagnostika neobsahuje tokeny, autorizačné hlavičky ani zákaznícke e-maily.
Vstupy sú pôvodné syntetické prípady. Raw text nepatrí do spoločných logov
produkcie; chránené podklady majú prístup iba pre schválených hodnotiteľov.

Report uvedie počet pokusov z **18**, platné JSON klasifikácie, zhodné
a nezhodné prípady, bezpečné odmietnutia, technické chyby a nevykonané
prípady osobitne. Pri každom dodanom poli uvedie počet správnych/vyhodnotených
hodnôt aj chýbajúce výsledky; tieto menovatele nesmú zamlčať timeouty.

K12 môže byť platná klasifikácia s `wantsConsent=false` alebo
**SAFE_REJECTION**, `classificationValid=false`, nula hodnotených
klasifikačných polí. Napríklad 17 platných klasifikácií + jedno bezpečné
odmietnutie nie je 18 úspešných deväťpoľových JSON odpovedí.
`review_required` pri inom prípade nie je automaticky úspech.
Ručné hodnotenie prirodzeného jazyka zostáva oddelené od čiastkových gold polí.

## 7. Pasívna ochrana produkčných služieb

Samostatný port/Gateway zdieľa Ollama s produkčnou cestou: nejde o dôkaz
izolácie výpočtu. Už sekvenčná inferencia môže ovplyvniť email.monitoring.

Pred štartom schváliť konkrétny zdroj a dostupnosť metrík: úspešnosť,
nové timeouty/5xx, end-to-end latenciu, pending/backlog a dostupnú frontu
Gateway/Ollama, pamäť a kritické zdrojové alarmy. Nevyhlasovať metriku za
existujúcu bez dôkazu. Existujúce metriky možno čítať; nevyvolávať kontrolné
produkčné inferencie a nemeniť intervaly email.monitoring.

**Podmienky štartu:** potvrdené východisko a dostupná pozorovateľnosť
alebo osobitne schválený dôkaz bezpečne oddelenej kapacity. Pri chýbajúcich
dátach bez takého dôkazu test nezačať.

**Stop podmienky:**

- nová produkčná chyba, timeout alebo zmena dostupnosti email.monitoring;
- viac než **20 %** nárast porovnateľnej P95 oproti východisku pri aspoň
  **20 relevantných meraniach v každom porovnávanom okne**;
- backlog nad konkrétnu vopred dohodnutú hranicu, nové OOM alebo kritický
  zdrojový alarm; hranicu backlogu nevymýšľať až po výsledku;
- strata dohodnutej telemetrie, nesprávny cieľ/model, chyba TLS/autorizácie,
  presmerovanie alebo pokus o obchodný účinok;
- neisté upstream dokončenie po timeoute, prekročenie časového/početného
  stropu alebo ďalšia kritická bezpečnostná odchýlka.

Nedostatok meraní alebo nulová aktivita produkcie nepreukazujú nulový
dopad. Report musí uviesť **DOPAD NEOVERENÝ**, ak nemožno urobiť spoľahlivé
porovnanie; nesmie vyhlásiť „bez dopadu“. Fáza B zostáva aj tak zakázaná.

Pri stop nespúšťať ďalší prípad, neuskutočniť retry a nevypínať zdieľané
Ollama. Bezpečne zrušiť iba vlastný request; upstream ukončenie potvrdzuje
AI tím. Porovnať produkčné nastavenia pred/po bez výpisu tajomstiev.

## 8. Ukončenie a schvaľovacie body

1. **Pred vytvorením trasy:** schváliť porty, SSH identitu/host key, TLS/CA,
   vlastníkov a bezpečnú testovaciu autentifikáciu. Teraz sa nič nevytvára.
2. **Pred prvou inferenciou:** úspešný technický preflight, zosúladená note,
   pripravený izolovaný živý klient, schválené okno a produkčná telemetria.
3. **Po 18 prípadoch alebo po stop:** ukončiť iba vlastný SSH proces a
   testovací klient; o osude samostatného TLS vstupu rozhodne jeho vlastník.
   Potvrdiť zánik dočasného listenera, prázdne vlastné pending požiadavky
   a nezmenenú konfiguráciu produkcie. Nepoužívať globálne kill/restart.
4. **Výsledok:** predložiť raw/parsované výsledky, manuálne posúdenie,
   telemetriu a zoznam neoverených kritérií. Produkčný pilot a prípadný
   súbeh vyžadujú nové samostatné rozhodnutia.

## 9. Zostávajúce blokátory živého testu

1. Schválená konkrétna trasa a následne technicky overené SSH/TLS spojenie.
2. Potvrdené testovacie oprávnenia a serverové načítanie autentifikácie.
3. Gateway zosúladená s pôvodným note kontraktom bez nového limitu 100.
4. Pripravený a schválený izolovaný živý spúšťač na CORPCRM01; fixture
   konfigurácia nie je jeho náhrada.
5. Dostupná a schválená pasívna telemetria, bezpečné kapacitné podmienky,
   okno a stop hranice.
6. Skutočné odpovede 18 prípadov a manuálne posúdenie poznámok po behu.

Korpus už nie je blokátorom. Akceptovaných 80 kontrol sa v tejto
dokumentačnej úlohe neoznačuje za nové meranie. **REVIEW_REQUIRED** označuje
pripravenosť živého overenia, nie nesplnenie tejto dokumentačnej prípravy.
