# Schválené produkčné nasadenie pripraveného AI buildu

Používateľ schválil zálohu a nasadenie aplikácie. Neschválil spustenie
AI workera ani aktiváciu alebo zmenu poskytovateľov.

## Pripnutý stav

- Produkčný základ: `0ee328b123a33014fab7380210ac7ee158b14085`.
- Zdroj vydania: `328527d5699f4a13a30b9e945bf1bf5f59cb9f42`.
- Overený serverový staging:
  `/var/www/indexus-crm/data/ai-services-stage-aBwcWg`.
- Produkčný PM2: používateľ `seman`, existujúci daemon PID `22545`,
  aplikácia `indexus-crm`, ID `4`, pôvodný proces `958103`.
- Živý backend: `/var/www/indexus-crm/dist/index.cjs`.

Nástroj používa presne tie tri runtime SHA-256, ktoré vrátil úspešný
serverový prípravný beh. Znovu nezostavuje aplikáciu a nepoužíva lokálne
Replit buildy ako náhradu serverového výsledku.

## Postup jedným behom

1. Overí mount `/dev/sdb1`, súkromie stagingu, Git základ a presný 70-súborový
   rozsah, fyzické zdroje, loader, živý build a proces vrátane PM2 identity.
2. Overí HTTP vstup aj ochranu autentifikovaných API bez prihlasovania.
3. Len na čítanie načíta aktuálnu konfiguráciu AI a overí kapacitu zálohy.
   Ak by nasadenie bez workera odstavilo aktívne interné AI služby, zastaví
   sa bez zmeny produkcie s kódom
   `active_internal_routes_require_worker_approval` a identifikátormi služieb.
   Nikdy ich sám nevypne ani nepresmeruje na cloud.
4. Vytvorí nový root-private priečinok na dátovom disku mimo PG clustra.
   Overí neprístupnosť pre aplikačný účet a zálohuje celý runtime, dotknuté
   zdroje aj konfiguráciu.
5. Vytvorí kompletný custom-format dump cez pôvodnú aplikačnú DB konfiguráciu.
   Native nástroje dostanú explicitnú identitu a TLS parametre cez súkromné
   prostredie, nie cez argumenty. Záloha sa overí zoznamom aj úplným dekódovaním
   do `/dev/null`; nemení ani neobnovuje databázu.
6. Znovu overí, že sa živý stav počas zálohy nezmenil.
7. Pod `seman` urobí iba fast-forward na pripnuté vydanie. Publikuje immutable
   assety bez kolízií a zachová staré assety pre otvorené prehliadače.
   Backend, worker bundle a vstupné HTML nahradí atómovo.
8. Reštartuje iba PM2 ID `4`, bez `--update-env`, bez zmeny loadera a bez
   spustenia worker procesu. Bežná startup migrácia vytvorí aditívnu schému.
9. Overí stabilný nový proces, HTTP, nové hashe, ochranu API, pripravenosť
   schémy a nezmenenú uloženú AI konfiguráciu. Uloží a vypíše
   `deployed_worker_off` s umiestnením zálohy.

## Návrat pri chybe

Po zásahu do zdrojov/buildu sa nástroj pokúsi vrátiť iba pripnuté zdroje
a pôvodný runtime. Git návrat používa `reset --keep` až po kontrole presných
zdrojových hashov a pôvodného rozsahu; nepoužíva `reset --hard` ani `clean`.
Ak zdroje súčasne zmenil iný proces, konflikt sa neprepisuje.

Pôvodný backend a HTML sa obnovia atómovo, nový nepoužívaný worker bundle sa
odstráni iba pri zhode s presným novým hashom. Statické assety oboch generácií
zostávajú zachované. Reštartuje a overí sa iba pôvodná aplikácia pod `seman`.
Pri konflikte návratu výsledok výslovne hlási `rollbackFailed`.

**Databáza sa nikdy automaticky neobnovuje.** Nové obchodné údaje zostanú
zachované; po neúspešnom štarte môžu zostať aditívne schémové objekty.
Pred prípadným opakovaním treba vyhodnotiť konkrétnu chybu a znovu zálohovať
aktuálny stav. Predošlé ani čiastočné zálohy sa automaticky nemažú.

## Overenie nástroja

- 17 jednotkových a bezpečnostných testov.
- 6 scenárov skutočnej operačnej implementácie nad dočasným súborovým systémom:
  úspech, neúspešná záloha, nesúkromné úložisko, aktívna interná služba,
  neúspešný HTTP štart a neúplná schéma; návrat zachováva údaje a oba asset sety.
- Skutočný schema-only native PostgreSQL dump vo vývojovom prostredí,
  `pg_restore --list` aj úplné dekódovanie prešli. Nejde o produkčnú zálohu.

Nasadzovací nástroj nie je živá AI akceptácia. Konfiguračné stránky za
prihlásením sa týmto neoverujú ako prihlásený používateľ. Worker a živé
modelové testy zostávajú oddelene schvaľovaným krokom.
