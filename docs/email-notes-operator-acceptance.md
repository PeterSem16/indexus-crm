# Záverečné overenie AI Email Notes na CORPCRM01

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
- nevypisuje ani nenačítava tokeny; konfiguráciu rieši až samotný akceptačný nástroj;
- umožňuje `--install-only`, ak administrátor chce iba prípravu bez živého POST.

SHA-256 inštalátora:
`7e8cddbd2d29f381091fd53d9f062b8d1502044daef043633fe4fc95507beca3`.

**Výstup lokálnej kompilácie sa už neporovnáva s hashom buildu z iného
prostredia.** Ten môže závisieť od verzie kompilátora. Integrita nie je vypnutá:
overuje sa inštalátor pred spustením a presné nemenné vstupy pred kompiláciou.
Nameraný hash výsledku slúži na identifikáciu konkrétneho serverového buildu.
Pôvodný hash nižšie platí iba pre priamy prenos už zostaveného pôvodného súboru.

Testy inštalátora: **6/6 PASS**, vrátane rozdielneho formátovania výstupu pri
rovnakých vstupoch, odmietnutia poškodeného zdroja pred kompiláciou a zachovania
už existujúceho súboru pri chybe. Živý integračný test na CORPCRM01 zostáva
nevykonaný, kým administrátor nespustí nástroj.

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

## Bezpečná príprava tokenu

Skript nemení prostredie bežiaceho backendu. Ak token už existuje v overenom
PM2 procese, použije ho bez vypísania. Alternatívou je súkromný súbor
`/home/seman/indexus-private/email-notes.env` vlastnený používateľom `seman`,
s oprávneniami **0600**, v súkromnom adresári **0700** mimo aplikácie.
Skript odmietne verejne čitateľný súbor, symlink a cudzie vlastníctvo.

Administrátor súbor vytvorí súkromným editorom alebo z existujúceho správcu
tajomstiev; token nevkladá do príkazového riadka, histórie, chatu ani Git repozitára.
Formát je jednoduchý `KEY=value`, bez shell expanzie. Súbor môže obsahovať iba
potrebný token a voliteľné pripojenie testovacej DB.

**Dôležité:** súbor odovzdaný pomocou `--config` načítava iba tento skript.
Existujúce CRM ho samo nenačítava. Na prípadné neskoršie nastavenie backendu treba
po schválení doplniť token do existujúceho bezpečného zdroja prostredia procesu
`seman`/`indexus-crm`. Bez schválenia sa PM2 nereštartuje a backendová konfigurácia
sa nemení. Nástroj oddelene vykazuje `backend_token` a `gateway_token`.

## Jedno spustenie administrátorom

Preniesť samostatný `.cjs` súbor do `/home/seman/indexus-private/`, nie do
verejného adresára aplikácie. Porovnať SHA-256 s hodnotou odovzdanou v reporte.
Spustiť ako používateľ `seman` v interaktívnom termináli:

```bash
cd /var/www/indexus-crm
sha256sum /home/seman/indexus-private/email-notes-acceptance.cjs
node /home/seman/indexus-private/email-notes-acceptance.cjs \
  --config /home/seman/indexus-private/email-notes.env
```

Ak token už patrí prostrediu overeného procesu, `--config` možno vynechať.
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
4. Token pridať iba do existujúceho serverového tajného prostredia CRM.
   Ponechať `INDEXUS_AI_EMAIL_NOTES_ENABLED=false`. Až po samostatnom schválení
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
