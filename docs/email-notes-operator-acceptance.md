# Záverečné overenie AI Email Notes na CORPCRM01

## Jednotné pripojenie interných AI služieb

Nové služby aj ich operátorské testy používajú **existujúce pripojenie
`email.monitoring`**, nie vlastný spôsob získavania tokenu:

- nainštalovaný loader: `/etc/indexus-ai-runtime/preload.cjs`;
- jeho existujúca spoločná konfigurácia: `/etc/indexus-ai-runtime/gateway.json`;
- serverové premenné dodané loaderom: `INDEXUS_AI_GATEWAY_TOKEN`,
  `INDEXUS_AI_GATEWAY_BASE_URL`, `INDEXUS_AI_GATEWAY_ENABLED`, `INDEXUS_AI_ROUTER_MODE`.

Test Notes sa predtým spúšťal obyčajným `node`, bez spoločného preloadu.
`/proc/PID/environ` nie je náhradou tohto loadera: nezobrazuje spoľahlivo token
načítaný neskôr v Node procese. Preto report opakovane uvádzal chýbajúci token.
To nepreukazuje chýbajúcu konfiguráciu fungujúceho monitoringu.

Inštalátor teraz spúšťa nástroj cez rovnaký `node --require` ako monitoring.
Token do Notes nevkladá do nového súboru ani ho nepreberá z `/proc`.
Pôvodný riadok `backend_token` nahrádza pravdivá kontrola konfigurácie
testovacieho runtime; nie je to dôkaz nasadenia nového backendového buildu.

Pravidlo pre ďalšiu službu: zachovať spoločný preload, konfiguráciu a spôsob
autentifikácie; doplniť iba vlastný API kontrakt, spracovanie výsledku a testy.
Asynchrónny jobs endpoint nemusí napodobňovať chat completions.
Existujúci loader, monitoring, sentiment, ich smerovanie a produkčný proces
sa touto opravou nemenia.

## Zistenie z dodaného serverového reportu

Inštalátor na CORPCRM01 úspešne overil nemenné zdroje a vytvoril skript.
Source HEAD bol nahlásený ako `0ee328b123a33014fab7380210ac7ee158b14085`.
Kontroly ancestry a statických markerov nepotvrdili začlenenie integrácie;
nejde o dôkaz presnej verzie už načítaného backendu.

Živá požiadavka na `/gateway/` vrátila **HTTP 404 cez overené HTTPS**.
Pôvodná podmienka očakávajúca 401 na tomto koreni bola chybná: koreň nie je
súčasťou kontraktu `/v1/email-notes/jobs`. Nový nástroj vykazuje ľubovoľnú
prijatú HTTP odpoveď ako úspešné spojenie, nie ako úspešnú autentifikáciu/API.
DNS/TLS/sieťové zlyhanie zostáva FAIL; presmerovania zostávajú zakázané.
Samotný klient bez zmeny vyžaduje Bearer token, POST 202 a GET 200 aj platný JSON.

Dodaný beh sa zastavil pred vyhodnotením tokenu pre samostatný runner.
Neprítomnosť tokenu v počiatočnom prostredí procesu preto **nepreukazuje**,
že token nie je dostupný v súkromnom konfiguračnom súbore alebo cez dotenv.
POST/GET, uloženie, kontrola návrhu a schválenie zostali nevykonané.
Súbory, PID procesu a vypnutý/neprítomný flag podľa reportu zostali nezmenené.

Regresia tejto opravy: **13/13** testov nástroja/inštalátora a **4/4** testov
pôvodného Gateway klienta PASS; cielená prísna TypeScript kontrola PASS.

## Opravený prenos a zostavenie nástroja

Na server nevkladať dlhý JavaScriptový blok z chatu. Použiť samostatný
`script/install-email-notes-acceptance.cjs` z presne pripnutého Git commitu.
Krátky spúšťací príkaz najprv overí SHA-256 tohto **nezmeneného CJS zdroja**
a až potom ho spustí ako súbor, nie cez `node -`.

Inštalátor:
- vyžaduje Git objekty dodané fetchom presného commitu a existujúci `esbuild` aplikácie;
  nič neinštaluje, nefetchuje, neprepína vetvu a nespúšťa CRM;
- pred kompiláciou kontroluje presné Git blob identity všetkých štyroch vstupov;
- zostavuje iba v súkromnom adresári mimo aplikácie a overí syntax aj `--help`;
- výsledok uloží atomicky s oprávneniami 0600 a spustí existujúci akceptačný
  nástroj s interaktívnym terminálom;
- nevypisuje tokeny; pri spustení testu použije existujúci spoločný Gateway preload;
- umožňuje `--install-only`, ak administrátor chce iba prípravu bez živého POST.

SHA-256 inštalátora:
`33a41b580a7a0d23b3f9484dfd441b9aac3290f8c79509d2cb540d0fe28723d7`.

**Výstup lokálnej kompilácie sa už neporovnáva s hashom buildu z iného
prostredia.** Ten môže závisieť od verzie kompilátora. Integrita nie je vypnutá:
overuje sa inštalátor pred spustením a presné nemenné vstupy pred kompiláciou.
Nameraný hash výsledku slúži na identifikáciu konkrétneho serverového buildu.
Pôvodný hash nižšie platí iba pre priamy prenos už zostaveného pôvodného súboru.

Testy inštalátora pred zjednotením: **6/6 PASS**, vrátane rozdielneho formátovania výstupu pri
rovnakých vstupoch, odmietnutia poškodeného zdroja pred kompiláciou a zachovania
už existujúceho súboru pri chybe. Živý integračný test na CORPCRM01 zostáva
nevykonaný, kým administrátor nespustí nástroj.

Po zjednotení runtime prešlo spolu **102/102** testov nástroja, inštalátora
a existujúceho Gateway preloadu, navyše **4/4** testov jobs klienta a cielená
prísna TypeScript kontrola. Nová regresia kontroluje rovnaký `--require` ako
pri monitoringu, zachovanie vypnutého Notes flagu a nezmenené prostredie rodiča.
Nanovo prešlo aj **81/81** regresií pôvodného sentimentu a monitoringu.

## Skutočný stav odovzdania

Z Replitu nie je oprávnený SSH prístup na CORPCRM01. Vyhodnotenie produkčného
HEAD a HTTPS teraz vychádza z administrátorom dodaného výstupu nástroja vyššie,
nie z priameho spojenia z Replitu. Neopakujeme neúspešné pripojenia z nesprávneho
prostredia a nepotvrdzujeme zatiaľ nevykonané živé generovanie.

Bol pripravený jeden samostatný súbor
`generated-artifacts/email-notes-acceptance.cjs`. Obsahuje pôvodný Gateway klient,
službu a DDL integrácie, pribalené bez spustenia aplikácie. Nevyžaduje na serveri
TypeScript, tsx, npm install ani nasadenie integračného commitu.
Voliteľná testovacia PostgreSQL vetva používa iba existujúci balík `pg` aplikácie.

**Produkcia nebola nasadená, reštartovaná, prekonfigurovaná ani dátovo zmenená.**

Historické overenie pri pôvodnom odovzdaní (aktuálne serverové zistenia sú vyššie):
- Bezpečnostné testy operátorského nástroja: **5/5 PASS**.
- Cielená prísna TypeScript kontrola a kontrola syntaxe výsledného CJS: **PASS**.
- Nanovo spustené regresie pôvodného sentimentu/monitoringu: **81/81 PASS**.
- Tri pribalené backendové moduly boli porovnané s obsahom commitu `1e80ffa8`
  cez autorizované GitHub API: **bajtová zhoda PASS**.
- Pred prvým spustením administrátorom boli produkčný HEAD, živý POST/GET
  a schválenie **BLOCKED**. Aktuálny report už identifikoval HEAD, nie však
  živé generovanie. Lokálne testy nenahrádzajú tieto kontroly.

Historický SHA-256 pôvodného priamo prenášaného CJS súboru (nie nového serverového buildu):

```text
4f3dc34b083db4b69359dd9c686ae3f0611e1ede1b2251d2f52c88394a6133ef
```

Skript vyžaduje Node.js 20 alebo novší. Neaktualizuje runtime produkcie.

## Presné premenné

| Premenná | Význam |
|---|---|
| `INDEXUS_AI_GATEWAY_TOKEN` | Existujúci serverový Bearer token. Povinný pre živý POST/GET. |
| `INDEXUS_AI_EMAIL_NOTES_ENABLED` | Existujúci prepínač CRM; pre produkciu ponechať `false` alebo neprítomný. |
| `EMAIL_NOTES_TEST_DATABASE_URL` | Iba operátorský skript; voliteľná samostatná už pripravená testovacia databáza. Nikdy produkčný `DATABASE_URL`. |
| `EMAIL_NOTES_APP_ROOT` | Iba operátorský skript; štandardne `/var/www/indexus-crm`. |

Gateway URL je v pôvodnom klientovi pevná:
`https://ai.cordbloodcenter.com/gateway/`. Nie je na ňu ďalšia env premenná.
`INDEXUS_AI_GATEWAY_ENABLED` sa kvôli tejto funkcii **nemení**.

## Bezpečné použitie existujúceho tokenu

Používa sa iba `INDEXUS_AI_GATEWAY_TOKEN` dodaný spoločným runtime ako pri
monitoringu. **Nevytvárať nový token ani `email-notes.env` pre Gateway.**
Konfiguráciu `/etc/indexus-ai-runtime/gateway.json` nástroj nemení. Existujúci
preload zachováva svoje kontroly prostredia, vlastníctva, oprávnení a obsahu.

Prípadné `--config` slúži iba na nastavenia izolovanej testovacej databázy,
nie ako zdroj Gateway tokenu; tokenové kľúče parser ignoruje.
Bez schválenia sa PM2 nereštartuje ani nemení prostredie bežiaceho backendu.

## Jedno spustenie administrátorom

Už nainštalovaný samostatný `.cjs` súbor spustiť ako `seman` v interaktívnom
termináli, **rovnakým spôsobom ako `email.monitoring`**:

```bash
NODE_ENV=production node --require /etc/indexus-ai-runtime/preload.cjs \
  /home/seman/indexus-private/email-notes-acceptance.cjs
```

Žiadne `pm2 env`, `pm2 jlist`, `set -x`, export tokenu do príkazu ani výpis `.env`.
Skript nevolá ani samotný príkaz PM2, aby nespustil nesprávny/root daemon.

### Čo sa vykoná

1. Prečíta lokálny source HEAD a prítomnosť integračného commitu. Stopy v
   `dist/index.cjs` označí iba ako statické stopy, nie ako dôkaz verzie už
   načítaného procesu. Sám nenahradí build ani nič nefetchuje.
2. Z PID súboru `seman` overí jediný CRM proces, jeho pracovný adresár a príkaz.
   Skontroluje počiatočné prostredie aj `.env`: `/proc` samo osebe nepreukazuje
   hodnoty neskôr načítané cez dotenv. Pri náleze zapnutého prepínača zastaví test.
3. Overí HTTPS bez tokenu: prijatá HTTP odpoveď potvrdí spojenie cez platné TLS,
   bez presmerovania. Stav koreňa je informatívny, nie test autentifikácie jobs API.
4. Vytvorí **práve jednu** úlohu so zabudovaným vymysleným slovenským textom.
   Nikdy nečíta Graph ani skutočné e-maily. Token ide len v Authorization hlavičke
   na pevnú HTTPS adresu. Nejednoznačný POST sa neopakuje.
5. Polluje pôvodným klientom/službou; kontrakt kontroluje UUID, stav a poznámku.
   Dokončenie sa očakáva približne do 9 minút, HTTP timeout je 15 sekúnd.
6. Ak existuje osobitná testovacia databáza, overí uloženie a identitu syntetickej
   správy, stav `review_required` a absenciu schválenia. Následne zobrazí
   syntetický návrh na ľudskú jazykovú/vecnú kontrolu.
7. Až po zadaní `SCHVALUJEM` pôvodnou backendovou službou schváli návrh
   **v testovacej DB** a skontroluje audit. Bez terminálu alebo bez súhlasu
   označí schválenie BLOCKED. Nejde o automatické schválenie.
8. Zmaže iba vlastnú náhodnú schému testovacej DB a vypíše redigovaný JSON report.
   Zlyhanie upratania sa vypíše osobitne. Pri SIGINT/SIGTERM sa pokúsi upratať;
   SIGKILL alebo výpadok stroja to zaručiť nemôžu.

### Databázová bezpečnosť a hranice dôkazu

Bez testovacej DB sa vykoná živý POST/GET, ale perzistencia a schválenie zostanú
BLOCKED. Skript nikdy nepoužije produkčný `DATABASE_URL`, nevytvára databázu
a vôbec sa nepripája k produkčnej databáze.

Ak sa testovacia DB poskytne, jej názov v URL aj `current_database()` musí
zodpovedať `indexus_email_notes_test_[a-z0-9_]+`. Vyžaduje sa už existujúca
samostatná DB a účet oprávnený vytvoriť/odstrániť vlastnú schému. Search path
obsahuje len náhodnú testovaciu schému a `pg_catalog`, nikdy produkčné `public`.
Všetky identity sú syntetické; po teste sa schéma odstráni.

**Prihlásené UI CRM a reálna Graph väzba sa týmto neoverujú.** Plný test v
existujúcom produkčnom UI je nezlučiteľný s vypnutým flagom a zákazom produkčných
DB zápisov. Pre túto časť je potrebné samostatné schválené testovacie nasadenie,
testovací účet a testovacia schránka. Skript to vždy uvedie ako BLOCKED,
nie ako úspešné end-to-end overenie.

Výstupný kód: `0` všetko vykonané PASS, `1` chyba, `2` blokujúci predpoklad.
Celkový výsledok zostáva BLOCKED aj pri úspešnej Gateway, kým nie je overené UI.
Hodnoty tokenov, DB URL ani surové odpovede poskytovateľa nie sú v reporte.
Zobrazená syntetická poznámka slúži len na interaktívnu ľudskú kontrolu.

## Nasadenie a rollback — iba po schválení

1. Získať report z uvedeného testu. Neoznačovať blokované časti ako hotové.
2. Overiť aktuálny produkčný HEAD a vybrať schválený commit/artefakt. Nepoužiť
   automaticky celú lokálnu vývojovú vetvu a nepredpokladať, že `1e80ffa8`
   možno bezpečne checkoutnúť namiesto novšieho produkčného vydania.
3. Podľa existujúceho schváleného postupu pripraviť samostatný build mimo živého
   `dist`, overiť zálohu a startup migrácie; nemení sa databázový engine.
4. Overiť použitie existujúceho spoločného Gateway preloadu; nezavádzať nový
   zdroj tokenu. Ponechať `INDEXUS_AI_EMAIL_NOTES_ENABLED=false`. Až po samostatnom schválení
   povoliť výmenu artefaktu a reštart správneho PM2 procesu ako `seman`.
5. Nové tabuľky vytvorí idempotentná startup migrácia. Nespúšťať náhodné
   `db:push`, nepridávať verejný tokenový endpoint.
6. Prihlásené UI, autorizáciu e-mailu a celý tok najprv dokončiť v samostatnom
   testovacom nasadení; až po ďalšom výslovnom súhlase zvážiť produkčný flag.

Rollback: ponechať/vrátiť flag na `false`; ak je nutný návrat artefaktu,
po schválení použiť posledný overený predchádzajúci build a riadený PM2 reštart.
Zachovať tabuľky poznámok aj audit, nič nemazať. Vypnutie neanuluje už prijatý
Gateway job. Pôvodný sentiment, monitoring a ich konfigurácia sa nemenia.

## Zostavenie a test nástroja vo vývoji

```bash
node_modules/.bin/esbuild script/email-notes-acceptance.ts --bundle \
  --platform=node --format=cjs --target=node20 \
  --outfile=generated-artifacts/email-notes-acceptance.cjs
node --test script/email-notes-acceptance.test.cjs
```

Táto sada overuje bezpečnostné zábrany operátorského nástroja; nie je náhradou
živého testu na CORPCRM01 ani regresnej sady pôvodných AI služieb.
