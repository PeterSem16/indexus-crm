# AI Email Notes — CRM akceptácia a pripravenosť na nasadenie

## Výsledok 18. 11. 2026

| Oblasť | Výsledok |
|---|---|
| Izolovaná PostgreSQL databáza | PASS — samostatný cluster a DB, iba súkromný Unix socket, TCP vypnuté |
| Uloženie k testovaciemu e-mailu | PASS — presná trojica vlastník/schránka/ID správy overená v SQL |
| `review_required` | PASS — aj upstream `completed` s `review_required:false` vytvorí iba návrh na kontrolu |
| Manuálny schvaľovací tok | PASS — testovací používateľ upravil text a explicitne klikol na Schváliť v skutočnej obrazovke |
| Audit | PASS — pôvodný AI text zachovaný; schválený text, používateľ, čas a jeden auditný záznam uložené |
| Oprávnenia a konflikty | PASS — 401/403 pre čítanie/vytvorenie/schválenie; 400 pre neplatný vstup; 409 pre starú verziu; žiadny dodatočný audit |
| Nexus Omni → E-mail | PASS — aktuálna celá aplikácia, detail správy, vytvorenie/úprava/kopírovanie/schválenie, reload a prepnutie správy |
| Desktop a mobilný tmavý detail | PASS — skutočný desktopový detail a existujúce modálne okno e-mailu pri šírke 390 px |
| Predvolený vypnutý flag | PASS — žiadny panel ani job; ostatné AI služby nezmenené |
| Pripravenosť | Pripravené na samostatne schválené selektívne nasadenie s vypnutým flagom |

Databázová sada: **9/9 PASS**; prehliadačová akceptácia: **8 scenárov PASS**;
klientsky kontrakt: **4/4 PASS bez sieťových volaní**. Cielený prísny TypeScript,
frontendový production build a serverový compile check prešli.

**Gateway/HTTPS/tokeny/Ollama sa znovu netestovali.** Tento beh nevykonal žiadne
AI ani Graph volanie. Ich už overený externý výsledok nahrádza kontrolovaný
syntetický vstup do existujúcej CRM služby. Plná aktuálna frontendová aplikácia,
note API handlery, služba a PostgreSQL sú skutočné; prihlásenie a Microsoft 365
sú testovacie hranice izolovaného servera. Produkčné OAuth prihlásenie sa netvrdí.
Kliknutie používateľa vykonal Playwright; nejde o schválenie skutočnej zákazníckej
poznámky človekom ani o povolenie produkčnej aktivácie.

## Reprodukcia

```bash
bash script/test-email-notes-crm-isolated.sh
node script/prepare-email-notes-release.cjs
```

Potrebné sú existujúce `initdb`, `pg_ctl`, `createdb`, Node, závislosti projektu
a Chromium na `/repl/tools/bin/chromium`. Nič sa neinštaluje. Runner odmietne
CORPCRM01, prepíše DB pripojenie iba vo vlastnom procese na nový lokálny cluster
a nikdy nečíta produkčný `DATABASE_URL`. Overí aj skutočný názov DB a dátový
adresár PostgreSQL. Po teste sa cluster zastaví a odstránia sa iba jeho vlastné
dáta; logy, JSON report a snímky ostanú v ignorovanom `generated-artifacts/`.
Frontend sa zostavuje mimo `dist`, aby nepoškodil bežiacu aplikáciu.

Výstupy UI: `generated-artifacts/email-notes-crm-ui/report.json`,
`review-required-desktop.jpg`, `approved-desktop.jpg`, `approved-mobile-dark.jpg`.

Ak pracovné Git objekty neobsahujú historickú implementáciu, prípravný nástroj
prijíma iba export piatich hook patchov z autorizovaného GitHub API pre presný
commit uvedený nižšie, s pripnutým SHA-256. Chýbajúci alebo zmenený patch
prípravu zastaví. Pri dostupných objektoch ho odvodí priamo z Git.
Ak objekty chýbajú, možno ich do pracovnej/staging kópie doplniť existujúcim
Git prístupom cez `git fetch --no-tags origin 1e80ffa816ece4465c39b42a31ab7a7515dad59f`;
nejde o checkout, nasadenie, zmenu produkčných súborov ani AI požiadavku.

## Selektívne pripravené nasadenie — ZATIAĽ NEVYKONANÉ

Existujúca implementácia: `1e80ffa816ece4465c39b42a31ab7a7515dad59f`.
Sedem feature-owned súborov sa bajtovo zhoduje s už pushnutou implementáciou;
zhoda bola overená aj proti GitHub main pri príprave. Nová práca nemení
produkčný funkčný kód, iba pridáva izolované testy a prípravu vydania.

Pripravený adresár `generated-artifacts/email-notes-release/` obsahuje:
- sedem overených samostatných modulov služby/UI/prekladov;
- `shared-hooks.patch`: iba hooky v `server/index.ts`, `server/routes.ts`,
  `shared/schema.ts`, `client/src/pages/email-client.tsx`,
  `client/src/i18n/translations.ts`;
- `manifest.json`: presné identity zdrojov, hash dôkazu a požadovaný vypnutý flag.

**Neprenášať celú pracovnú vetvu ani testovací frontend build.** Balík neobsahuje
rozpracované automatizácie. Zdieľané veľké súbory sa nesmú nahradiť ich lokálnymi
kópiami; aplikovať sa smú iba skontrolované Email Notes hunks. Ak už hook existuje,
neaplikovať ho druhýkrát. Pri konflikte zastaviť, nie prepísať súbor.

Po výslovnom schválení nasadenia operátor:
1. Zistí a pripne aktuálny produkčný HEAD a predchádzajúci schválený build.
2. V samostatnom staging adresári založenom na tomto HEAD overí whitelist,
   hash modulov a aplikovateľnosť/chýbajúce hooky. Nevykoná checkout ani pull
   celej pracovnej vetvy do živej aplikácie.
3. Zachová `INDEXUS_AI_EMAIL_NOTES_ENABLED=false` alebo neprítomný. Nemeniť
   Gateway token, spoločný preload, routing, sentiment ani `email.monitoring`.
4. Zostaví kandidáta mimo živého `dist`, vykoná existujúce kontroly a až po
   schválení ho atomicky povýši schváleným postupom CORPCRM01.
5. Startup additive SQL a reštart sú produkčné zásahy: vykonať ich až v rámci
   schváleného nasadenia. Tento akceptačný beh nevykonal ani jedno.
6. Overí bežný štart a vypnutý panel/worker. Zapnutie feature flagu nie je
   súčasťou tohto nasadenia a vyžaduje ďalší výslovný súhlas.

## Bezpečný rollback — pripravený, nevykonaný

- Ponechať flag vypnutý. Neposielať ďalšie AI požiadavky.
- Obnoviť predchádzajúci pripnutý schválený build schváleným postupom,
  bez nahrádzania celej zdrojovej vetvy.
- **Nemažte tabuľky poznámok ani auditu.** Additive schéma môže zostať;
  rollback kódu nevyžaduje deštruktívnu spätnú migráciu.
- Reštart produkčného procesu iba po schválení; následne overiť bežný chod
  a vypnutý panel. Už prijaté upstream úlohy nemajú garantované cancel API.
- Ak sa zmenil produkčný HEAD alebo kandidát nezodpovedá schválenému manifestu,
  nasadenie/rollback zastaviť a znovu skontrolovať rozdiely.

**Produkčné CRM, jeho SQL dáta, proces, prepínače ani ostatné AI služby
neboli pri tejto práci menené.**
