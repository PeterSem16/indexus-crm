# Presné časy historických návrhov: samostatné read-only overenie

## Stav a schválenie

Tento nástroj je **pripravený, nie vykonaný proti produkcii alebo MS365**.
Záznam aplikácie, `sentVia: ms365`, predmet a `conversationId` nedokazujú
konkrétnu odoslanú správu ani jej čas. `created_at` sa nikdy nepoužíva ako
čas odoslania alebo ako vyhľadávacie časové okno.

Pred prístupom k schránke treba osobitne schváliť presné správy, používateľov,
schránky (osobné/zdieľané alebo schránku delegáta, kde zostala kópia),
identity `from` a `sender`, historickú väzbu adresátov na kliniku a účel.
Súhlas s pôvodným priradením 38 záznamov k Mission **nie je** súhlasom
na čítanie pošty ani doplnenie dátumov. Neposielajte adresy, obsah, tokeny
ani súkromné vstupné/výstupné súbory do chatu.

## Spustenie operátorom na CORPCRM01

Bez SSH z Replit, bez deployu, inštalácie balíkov, reštartu, zmeny pravidiel
či schémy. Spúšťať zo skontrolovanej, pripnutej verzie týchto dvoch súborov
a existujúcich importov. Použiť existujúci `node_modules/.bin/tsx`, nie
`npx`, ktoré by mohlo čokoľvek inštalovať.

Ak úvodná kontrola vypíše `SCOPE_CHANGED`, neznamená to automaticky zmenu
produkčných údajov. Znamená to len, že konkrétny výber nesplnil očakávanie
38 záznamov/34 kliník. Najprv získať anonymizované diagnostické počty:

```bash
node_modules/.bin/tsx script/operator/verify-mission-proposal-times.ts --scope-check
```

Diagnostika rozlišuje nepriradené kandidáty, priradenie k Mission, očakávaný
zdroj pôvodného auditu a iný zdroj auditu. Nemení schválený rozsah, nečíta
tokeny ani Graph a zhoda predmetu je v nej iba vyhľadávací kandidát.
Bez vysvetlenia rozdielu neznižovať očakávaný počet ani nevynechávať požiadavku
na identitu/účel; prípadné chýbajúce priradenie neopravovať v rámci read-only súhlasu.

### Pôvodná dávka ešte nie je priradená

Ak diagnostika ukáže 38 nepriradených kandidátov a nulový audit celej dávky,
nie je dovolené vykonať attribution `--apply` len preto, aby prešla kontrola.
Na read-only overenie môže zostať pôvodná dávka nepriradená:

```bash
node_modules/.bin/tsx script/operator/verify-mission-proposal-times.ts --snapshot-unassigned /var/lib/indexus-email-review/unassigned-fingerprints.json
```

Táto cesta použije kompletný pôvodný validátor 38 záznamov/34 kliník vrátane
krajiny, jednej clinic enrollment, jedinej Mission membership, transportu,
neznámych časov, prázdneho provider/external ID a chýbajúceho konfliktu.
Samostatne načíta obsah zdrojov v tej istej read-only transakcii.
Nevytvorí auditné priradenie a nezmení `campaign_id`.

Kontrolór následne pripraví nižšie opísaný explicitný approval manifest
pre **všetkých 38 záznamov**, doplnený o `sourceMode: "unassigned_batch"` a
`originalBatchFingerprint` zo snapshotu. Každá položka stále vyžaduje
preskúmanie príslušnosti adresátov ku klinike, odosielateľa a účelu/príloh;
neexistencia uloženého auditu nie je povolenie nahradiť tieto dôkazy predmetom.
Pri `--verify` sa znovu zachytí celá dávka a porovná jej odtlačok, nielen ID.
Výsledný plán výslovne označuje `missionAttribution: "unassigned_not_changed"`;
nájdený provider čas nie je dôkazom, že je už uložené priradenie k Mission.
Budúce priradenie a zápis času zostávajú samostatne schvaľovanými zmenami.

### Čítanie kandidátov bez ručného vypĺňania konverzácií

Po samostatnom súhlase na čítanie môže operátor spustiť:

```bash
node_modules/.bin/tsx script/operator/verify-mission-proposal-times.ts --inspect-unassigned --read-only-approved /PRIVATE_DIRECTORY/candidates.json
```

Nástroj zachytí presnú pôvodnú dávku, použije iba zaznamenanú schránku `from`
a platné pripojenie pôvodného používateľa. Prejde Sent Items podľa každej
uloženej konverzácie a presne porovná telo, To/CC/BCC, from a povolenú
identitu sender (from alebo pripojený pôvodný autor). Nehľadá v ľubovoľných
schránkach a nenahrádza `from` dnešnou krajinskou systémovou schránkou.
Načíta a zahashuje ne-inline prílohy iba ako pozorované vlastnosti kandidáta.

**Táto fáza vždy vracia `verified:0` a `sendingTimeUnknown:38`.** Pozorovaný
čas je výhradne `candidate.sentAt` v súkromnom reporte, nikdy výsledný
`sentAt`. Aj jediná úplná strojová zhoda vyžaduje miestne preskúmanie
historickej príslušnosti adresátov ku klinike, identity a účelu/príloh.
Zistený hash prílohy sa nesmie vydávať za nezávisle očakávaný hash návrhu.
Pri duplicite transmisie sa kandidátsky čas odstráni pri všetkých dotknutých
záznamoch. Chyby prístupu sa vracajú iba statickými kódmi; čiastkové
výsledky neznamenajú úplné overenie.

Konzola obsahuje iba počty, dôvody a odtlačok. Súkromný report navyše
obsahuje lokálne ID, kandidátske UTC časy a Graph ID, odosielacie identity
a hashe, ale nie telá, adresátov ani bytes príloh. Nevkladať ho do chatu.
Operátorská kópia súborov môže zostať mimo živej aplikácie; závislosti sa
načítajú z jej existujúceho pracovného adresára bez inštalácie.

Operátor pripraví **mimo aplikačného adresára a všetkých HTTP/static mountov**
vlastný adresár s právami `0700`, napríklad `/var/lib/indexus-email-review`.
Nástroj odmietne verejné práva, symlinky na vstupných súboroch, existujúci
výstup a výstup vo vnútri pracovného aplikačného adresára. Operátor musí navyše
overiť, že zvolený adresár nie je publikovaný nginxom alebo iným servisom.
Súbory majú `0600`; údaje ani prílohy sa neukladajú do Git.

1. Do súkromného `scope.json` s právami `0600` vložiť
   `{"messageIds":["EXACT_APPROVED_APP_MESSAGE_ID"]}`; maximálne 38 unikátnych ID
   z pôvodného schváleného kohortu. Získať iba odtlačky zdrojov:

   ```bash
   cd /var/www/indexus-crm
   node_modules/.bin/tsx script/operator/verify-mission-proposal-times.ts --snapshot /var/lib/indexus-email-review/scope.json /var/lib/indexus-email-review/source-fingerprints.json
   ```

   Táto fáza vykoná iba databázový SELECT v read-only transakcii s ROLLBACK,
   bez čítania tokenov a bez Graph. Pri chýbajúcej `.env`/konfigurácii
   nepoužíva automaticky inú databázu ani prostredie PM2.

2. Oprávnený kontrolór lokálne v CRM a schválenej schránke overí účel,
   kliniku, historické adresy a identitu odosielania. Pripraví `approval.json`
   s právami `0600` podľa nasledujúcej **štruktúry, nie produkčných údajov**:

   ```json
   {
     "version": 1,
     "readOnlyApproved": true,
     "approvalRef": "EXPLICIT_APPROVAL_REFERENCE",
     "expiresAt": "REPLACE_WITH_APPROVED_UTC_EXPIRY_WITHIN_SEVEN_DAYS",
     "entries": [{
       "messageId": "EXACT_APP_MESSAGE_ID",
       "clinicId": "EXACT_CLINIC_ID",
       "userId": "ORIGINAL_APP_SENDER_USER_ID",
       "mailbox": "approved-sent-copy@example.test",
       "from": "historical-from@example.test",
       "sender": "historical-delegate@example.test",
       "recipientClinicOwnershipReviewed": true,
       "purpose": "contract_proposal",
       "sourceFingerprint": "SHA256_FROM_SNAPSHOT",
       "bodySha256": "SHA256_OF_REVIEWED_EXACT_APP_BODY_OR_NULL",
       "attachmentSha256": []
     }]
   }
   ```

   Aspoň jeden účelový dôkaz je povinný: hash presného, významovo preskúmaného
   tela, alebo hashe originálnych príloh preukazujúcich návrh spolupráce.
   Hashovať skutočné bytes príloh; telo UTF-8, iba CRLF sa normalizuje na LF.
   Pri HTML sa odlišné zalomenie, podpis či zmena Graph HTML nepovažujú
   automaticky za ekvivalentné. Nesmie sa skopírovať hash ľubovoľného
   nájdeného e-mailu iba na dosiahnutie zhody.
   `attachmentSha256` je úplný multiset ne-inline príloh, nie len vybraná
   podmnožina. Prázdne pole znamená, že správa nemala takéto prílohy.
   Inline podpisové obrázky sa nepovažujú za dôkaz účelu.

3. Až po samostatnom schválení prístupu k pošte:

   ```bash
   cd /var/www/indexus-crm
   node_modules/.bin/tsx script/operator/verify-mission-proposal-times.ts --verify /var/lib/indexus-email-review/approval.json /var/lib/indexus-email-review/time-proposal.json
   ```

   Vyžaduje už pripojenú pôvodnú používateľskú MS365 schránku alebo jej
   aktívne povolenú zdieľanú schránku. Používa len existujúci platný access
   token, dešifrovaný existujúcou funkciou. Neobnovuje tokeny ani ich
   nezapisuje. Pri expirácii sa preruší; obnovenie cez existujúce pripojenie
   aplikácie je osobitný krok operátora. Chýbajúci dešifrovací kľúč nemožno
   nahradiť novým náhodným kľúčom.

## Čo sa považuje za dôkaz

- Presný nemenný odtlačok databázového zdroja a pôvodný autor.
- Výslovné skoršie priradenie `contract_proposal` z pôvodného kontrolovaného
  batchu, alebo presne schválená nepriradená dávka s odtlačkom a individuálne
  preskúmaným účelom. Jedna clinic enrollment v Mission a povolená krajina.
- Schválená schránka overená aj cez Graph identitu, skutočný priečinok Sent
  Items, `isDraft=false`, nemenné Graph ID a `internetMessageId`.
- Celá konverzácia v Sent Items bez odvodeného časového okna; všetky stránky
  sa musia načítať. Limit 20 strán, chyba Graph alebo neúplnosť rušia celý
  pokus, nie iba poslednú stránku. Výsledok nepredstiera úplnosť archívov,
  vymazaných položiek, presunutých správ alebo iných schránok.
- Presná zhoda konverzácie, predmetu, `from`, `sender`, kompletných To/CC,
  nulové BCC (aplikácia ich v týchto záznamoch nezachovala), účelu a príloh.
  Samotná adresa nepreukazuje kliniku; preto sa historická príslušnosť musí
  explicitne preskúmať. Rovnaké adresy viacerých kliník nie sú automatický dôkaz.
- Práve jedna úplná zhoda. Dve odoslané položky zostanú nejednoznačné aj pri
  rovnakom čase. Jedna transmisia použitá viacerými vybranými záznamami
  (vrátane kópie v inej schránke) ostane neznáma pri všetkých.
- Až potom možno navrhnúť Graph `sentDateTime`; nepreukazuje doručenie.

## Výsledok a navrhnutý cielený backfill

Konzola vypíše iba počty, stav, odtlačok a `updates:0`; chyby sú statické
kódy bez SQL parametrov, adries, obsahu, tokenov či raw Graph odpovedí.
Súkromný plán obsahuje ID zdroja/kliniky/enrollmentu, overený UTC čas,
Graph/internet ID, hash identity schránky, odtlačok zdroja a schválenia.
Neznáme položky majú `sentAt:null` a dôvod. **Nástroj nemá `--apply`.**

Ak existujú `verified` výsledky, predložiť nový konkrétny návrh s počtom,
odtlačkom tohto plánu a samostatným súhlasom na zápis. Budúci backfill musí:

1. Znova read-only overiť správu a nemenné ID, schránku a úplnosť párovania;
   neaplikovať starý plán naslepo. Skontrolovať aj ostatné historické záznamy
   mimo vybranej podmnožiny, aby jedna transmisia nezískala dve priradenia.
2. V jednej transakcii zamknúť len schválené riadky, porovnať úplný zdrojový
   fingerprint, vyžadovať stále nulové `sent_at`, provider a externé ID;
   zastaviť sa pri konflikte alebo zmene kliniky/Mission.
3. Nastaviť len preukázané `sent_at`, provider `ms365` a nemenné externé ID;
   zachovať `created_at`, pôvodného autora, obsah, adresátov a Mission.
4. Atómovo pridať samostatnú auditnú udalosť ku konkrétnemu enrollmentu
   s predchádzajúcimi/novými hodnotami, identitou kontrolóra, časom kontroly,
   referenciou oboch súhlasov a fingerprintom dôkazu. Idempotentné opakovanie
   musí porovnať aj audit a skutočné hodnoty, nielen prítomnosť eventu.
5. Nezmeniť pôvodný audit `mission_email_attribution` ani potvrdenia Status
   Listu, neposielať poštu, nespúšťať automations; neznáme položky vynechať.
   Pripraviť cielený rollback len ak sa nové hodnoty medzitým nezmenili.
6. Overiť funnel aj export: existujúci loader už číta `m.sent_at` priamo,
   nikdy nie `COALESCE` s `created_at`. Neznáme záznamy musia zostať označené
   ako neznámy čas vo všetkých siedmich jazykoch.

V tejto príprave nebol preukázaný žiadny produkčný čas ani vykonaný backfill.
