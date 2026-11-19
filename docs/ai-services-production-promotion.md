# Schválené produkčné nasadenie pripraveného AI buildu

Používateľ schválil zálohu a nasadenie aplikácie a následne osobitne schválil
spustenie jedného AI workera so súbežnosťou 1 pre zachovanie aktívneho interného
e-mailového monitoringu. Aktiváciu ďalších služieb ani zmenu poskytovateľov
neschválil.

Aktuálny schválený režim je `--apply-with-worker`. Pôvodný `--apply` zostáva
režimom bez workera a naďalej bezpečne odmietne aktívny interný monitoring.

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
   V schválenom worker režime musí zostať jedinou aktívnou internou službou
   `email.monitoring`. Iný stav odmietne bez vypínania alebo presmerovania služieb.
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
8. Reštartuje iba existujúcu aplikáciu PM2 ID `4`, bez `--update-env` a bez
   zmeny loadera. Po aditívnej startup migrácii overí worker cez `--check`
   vrátane skutočného načítania pôvodného Gateway loadera, bez inferencie.
   Pod `seman` spustí presne jeden proces `indexus-ai-worker`, fork/instances=1,
   s 120-sekundovým rozpočtom a 160-sekundovým priestorom na ukončenie.
   Existujúca konfigurácia prejde súkromnou stdin rúrou do PM2 API; žiadne
   prihlasovacie údaje nie sú v argumentoch alebo dočasnom čitateľnom JSON.
9. Overí stabilný nový proces, HTTP, nové hashe, ochranu API, pripravenosť
   schémy a nezmenenú uloženú AI konfiguráciu. Overí jeden stabilný worker PID,
   správneho používateľa a čerstvý jediný DB heartbeat. PM2 konfiguráciu uloží
   s režimom súborov 0600; pôvodná konfigurácia je v súkromnej zálohe.
   Uloží a vypíše `deployed_worker_ready` s umiestnením zálohy.

## Návrat pri chybe

Po pokuse spustiť worker ho pri chybe najprv overene odstráni z PM2 s priestorom
na dokončenie už bežiaceho volania. Nikdy neodstraňuje cudzí preexistujúci worker.
Ak sa ho nepodarí zastaviť, nepredstiera úspešný návrat.

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

- 19 jednotkových a bezpečnostných testov.
- 11 scenárov skutočnej operačnej implementácie nad dočasným súborovým systémom:
  úspech, neúspešná záloha, nesúkromné úložisko, aktívna interná služba,
  neúspešný HTTP štart a neúplná schéma; navyše schválený worker, odmietnutý
  worker check, čiastočný štart, chýbajúci heartbeat a návrat s odstránením workera.
  Návrat zachováva údaje a oba asset sety.
- Skutočný schema-only native PostgreSQL dump vo vývojovom prostredí,
  `pg_restore --list` aj úplné dekódovanie prešli. Nejde o produkčnú zálohu.

Nasadzovací nástroj neposiela syntetickú AI požiadavku a nie je živá akceptácia
všetkých modelov. Worker začne spracúvať reálne požiadavky už aktívneho monitoringu.
Konfiguračné stránky za prihlásením sa týmto neoverujú ako prihlásený používateľ.
Aktivácia ďalších služieb a ich živé modelové testy nie sú súčasťou nasadenia.
