# Doplnkové AI poznámky z e-mailov

## Stav a hranice

Implementácia je pripravená v pracovnom projekte. Predvolený stav:

```text
INDEXUS_AI_EMAIL_NOTES_ENABLED=false
```

Neprítomný prepínač tiež znamená vypnutie. Táto implementácia nebola týmto
zapnutá ani nasadená na CORPCRM01. Neboli odoslané skutočné zákaznícke e-maily.
Živé generovanie modelom `qwen3:8b` cez nové job API zatiaľ nebolo overené
z tohto pracovného prostredia. Syntetické testy používajú kontrolované odpovede
Gateway, reálny PostgreSQL v izolovanej schéme a reálny komponent v prehliadači.

Generovanie je doplnková, **používateľom vyžiadaná** akcia pri existujúcom
e-maile. Nepridáva nový inbox, nový sentiment ani nový automatický import.
`email.sentiment`, `email.monitoring`, pôvodný 100-znakový limit poznámky,
modely a konfigurácia ostatných 65 AI služieb sa nemenia.

## Použitie a UI

Cesta: **Nexus Omni → E-mail → detail e-mailu → Poznámka z e-mailu vytvorená AI**.
Rovnaký komponent je v hlavnom detaile aj v modálnom detaile.
Pri vypnutej funkcii sa nezobrazuje.

1. Oprávnený vlastník pripojenia zvolí **Vytvoriť poznámku**.
2. Zobrazí sa **Čaká na spracovanie**, prípadne **Spracováva sa**, ak to vráti API.
3. Dokončené generovanie sa uloží ako **Vyžaduje kontrolu**, nikdy ako schválenie.
4. Používateľ návrh prečíta, môže ho upraviť/kopírovať a zvolí **Schváliť poznámku**.
5. Zobrazí sa schválený text, identita schvaľovateľa a čas.
6. Neúspešné spracovanie zobrazí **Chyba spracovania** a bezpečný technický kód.

Úprava pred schválením sa ukladá spolu so schválením. Originálny AI návrh zostáva
zachovaný. Schválenie nemení kontakt, zmluvu, príležitosť ani monitoring.
Preklady zahŕňajú EN, SK, CS, HU, RO, IT a DE.

## API a bezpečnosť

CRM endpointy (vyžadujú prihlásenie):

```text
GET   /api/users/:userId/ms365-email/:emailId/ai-note?mailbox=...
POST  /api/users/:userId/ms365-email/:emailId/ai-note?mailbox=...
PATCH /api/users/:userId/ms365-email/:emailId/ai-note?mailbox=...
```

POST prijíma `{}`. Frontend neposiela e-mailový text ani Gateway token.
PATCH prijíma `{ "note": "upravený text", "version": 3 }`.
GET pri vypnutí vracia `{ "enabled": false, "record": null }`.

Každá povolená operácia overí aktuálneho používateľa, jeho aktívne schránky a
prístup k presnému e-mailu cez Microsoft Graph. Text sa načítava zo servera
s `Prefer: outlook.body-content-type="text"`; neposiela sa HTML ani prílohy.
Návrhy sú súkromné pre kombináciu používateľ + schránka + e-mail.
Iný používateľ, aj s prístupom do tej istej fyzickej schránky, ich nepreberá.
Schváliť môže tento oprávnený vlastník; nejde o nové globálne administrátorské právo.

Odpovede majú `Cache-Control: no-store`. Nové endpointy sú vylúčené z logovania
JSON odpovedí. Služba neloguje vstupné e-maily, poznámky, tokeny ani surové chyby
poskytovateľa. Serverový token používa existujúci názov
`INDEXUS_AI_GATEWAY_TOKEN`, nikdy sa nevracia klientovi.

Backend volá iba:

```text
POST https://ai.cordbloodcenter.com/gateway/v1/email-notes/jobs
GET  https://ai.cordbloodcenter.com/gateway/v1/email-notes/jobs/{job_id}
```

Bez presmerovaní, OpenAI fallbacku, priameho Ollama prístupu alebo úprav AI routera.
Výber `qwen3:8b` vlastní existujúca Gateway; CRM neposiela modelové nastavenia.
Požiadavka má časový limit 15 sekúnd, odpoveď maximálne 128 kB.
Text e-mailu má limit 100 000 znakov, poznámka 12–20 000 znakov.
Tieto doplnkové limity nemenia pôvodný monitoring.

## Trvalé spracovanie, duplicity a výpadky

Idempotentná migrácia `server/lib/email-note-jobs-schema.ts` sa vykoná zo
startup migrácií v `server/index.ts`; CORPCRM01 nemusí spúšťať `db:push`.
Drizzle deklarácie sú aj v `shared/schema.ts`.

- `email_note_jobs`: identita e-mailu/vlastníka, upstream `job_id`, stav,
  originálny návrh, bezpečná chyba, schválený text a verzia.
- `email_note_job_audit`: schvaľovateľ, akcia, predchádzajúci a schválený text, čas.
- Existujúce tabuľky e-mailov a výsledky monitoringu sa neprepisujú.

Unikátna rezervácia sa uloží **pred jediným upstream POST**. Súbežné/opakované
kliknutia vrátia tú istú CRM úlohu. Platí to aj po reštarte.
Ak POST skončí timeoutom alebo proces zanikne pred uložením `job_id`, úlohu
automaticky nevytvárame znova: Gateway mohla prvú požiadavku už prijať.
Nejednoznačná úloha zostane chybová na manuálne dohľadanie, nie na slepý retry.

Worker sa plánuje iba pri zapnutom prepínači, každých 5 sekúnd.
Spracúva jednu čakajúcu kontrolu naraz, s trvalou 30-sekundovou lease a
`FOR UPDATE SKIP LOCKED`, takže viac procesov neposiela rovnakú kontrolu naraz.
Úspešný pending/processing výsledok sa kontroluje najskôr o 5 sekúnd.
Dočasný výpadok GET sa opakuje najskôr o 15 sekúnd. Limit je 60 pokusov alebo
10 minút od vytvorenia úlohy. Po expirácii sa úloha označí chybou.
Po reštarte worker pokračuje podľa uloženého `job_id`; nevytvára novú úlohu.

Aj pri `completed` a upstream `review_required:false` CRM vždy vynúti
`review_required`. Schválenie a audit sú jeden SQL príkaz s kontrolou verzie;
súbežné schválenie nemôže potichu prepísať novšiu zmenu.
Jazykovú a vecnú správnosť AI výstupu musí overiť človek — dĺžka a JSON schéma
nie sú dôkazom správnej slovenčiny.

## Overenie

```bash
npx tsx --test server/lib/email-note-jobs-client.test.ts
NODE_ENV=test EMAIL_NOTES_TEMP_DB_TEST=1 \
  npx tsx --test server/lib/email-note-jobs.db.test.ts
node script/test-email-note-jobs-ui.cjs
npx tsx --test server/lib/ai/email-sentiment.test.ts \
  server/lib/ai/email-monitoring-b112.test.ts \
  server/lib/email-monitoring-detail-route.test.ts
```

Databázový test odmietne CORPCRM01, vyžaduje výslovný testovací prepínač a
vytvorí/odstráni vlastnú syntetickú schému. Browser test zostaví aktuálne
natívne CSS a vytvorí ignorované výstupy
v `generated-artifacts/email-note-jobs-ui`.

Overené: jednorazové vytvorenie, JSON kontrakt, pending/processing/completed/
review_required/failed, chyby siete a timeouty, obnova po reštarte, súbeh,
izolácia identít, manuálne schválenie/audit, konflikt verzií a odmietnutie
neprihláseného/cudzieho/odvolaného prístupu. V prehliadači navyše úprava,
kopírovanie, zmena e-mailu, sedem jazykov a mobilný tmavý režim.

Skutočné výsledky vykonané 17. 11. 2026:
- Gateway klient: **4/4 PASS** (syntetický transport).
- PostgreSQL/služba/API: **9/9 PASS**, vrátane nadradeného testu.
- Regresie pôvodných služieb: **81/81 PASS**.
- Reálny UI komponent v Chromium: **PASS**, vrátane aktuálneho CSS a tmavého režimu.
- Cielená prísna TypeScript kontrola nového klienta/služby/API/UI/prekladov: **PASS**.
- Zostavenie serverového runtime modulu: **PASS**.
- Reštart aplikácie: **PASS**; tabuľky existujú, vytvorených CRM úloh **0**.
- Neprihlásený prístup na bežiacu novú API cestu: **HTTP 401**.

Prihlásená plná obrazovka Omni nebola overená; prehliadačový test overuje skutočný
komponent izolovane, nie používateľskú session v CRM. Celoprojektový TypeScript
má aj existujúce nesúvisiace chyby; neoznačujeme ho ako čistý.
V pracovnom prostredí nie je nastavený `INDEXUS_AI_GATEWAY_TOKEN`; funkcia zostala
vypnutá. Preto neuvádzame živý výsledok nového Gateway job API ako vykonaný test.

## Aktivácia — až po samostatnom súhlase

1. Skontrolovať a selektívne preniesť iba súbory tejto integrácie, nie celú
   rozpracovanú vetvu. Použiť existujúci schválený postup nasadenia CORPCRM01.
2. Prvý štart vykonať s `INDEXUS_AI_EMAIL_NOTES_ENABLED=false` (alebo bez
   premennej). Startup zabezpečí tabuľky bez kontaktovania AI servera.
3. Overiť, že **samotný proces CRM** má bezpečne načítaný existujúci
   `INDEXUS_AI_GATEWAY_TOKEN`. Token dostupný iba standalone preload runneru
   neznamená, že ho zdedí PM2 proces CRM. Nikde token nevypisovať.
4. Po výslovnom schválení syntetického integračného testu zapnúť prepínač
   iba v kontrolovanom testovacom nasadení a reštartovať existujúci proces CRM
   s obnoveným prostredím. Nie je implementovaný globálny whitelist testovacích
   používateľov: nezapínať ho v zdieľanej produkcii len kvôli syntetickému testu.
5. V prihlásenom Omni detaile syntetického e-mailu vykonať vytvorenie,
   dokončenie, jazykovú kontrolu, úpravu a schválenie; overiť oba DB záznamy.
6. Až po tomto overení a samostatnom schválení produkčných používateľov možno
   zapnúť `INDEXUS_AI_EMAIL_NOTES_ENABLED=true` v produkčnom procese CRM.
   Nemeniť `INDEXUS_AI_GATEWAY_ENABLED`, smerovanie 65 služieb ani monitoring.

## Rollback

1. Nastaviť `INDEXUS_AI_EMAIL_NOTES_ENABLED=false` v existujúcom bezpečnom
   prostredí procesu CRM a reštartovať ho s obnovenými premennými.
2. UI sa skryje; backend odmietne vytváranie aj schvaľovanie a worker sa nespustí.
3. Tabuľky a audit **nemažte**. Dokončené/schválené návrhy zostanú zachované.
4. Už odoslanú upstream úlohu vypnutie nezruší (poskytnuté API nemá cancel).
   Rozbehnutá HTTP požiadavka môže ešte dobehnúť; nové sa po reštarte nevytvoria.
5. Ak treba vrátiť aj kód, použiť predchádzajúci schválený artefakt iba pre
   súbory tejto integrácie. Pôvodné AI služby nevyžadujú spätnú migráciu.

## Súbory

- Backend: `server/lib/email-note-jobs-{client,schema,service,routes,runtime}.ts`.
- Migrácia/registrácia/logovanie: `server/index.ts`, `server/routes.ts`, `shared/schema.ts`.
- UI: `client/src/components/nexus/EmailNoteDraft.tsx`, `client/src/pages/email-client.tsx`.
- Preklady: `client/src/i18n/email-note-draft-copy.ts`, `client/src/i18n/translations.ts`.
- Testy: `server/lib/email-note-jobs-client.test.ts`, `server/lib/email-note-jobs.db.test.ts`,
  `script/test-email-note-jobs-ui.cjs`.
