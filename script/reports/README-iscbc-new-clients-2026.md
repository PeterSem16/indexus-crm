# Jednorazový report nových klientov CBC za rok 2026

Samostatný operátorský nástroj, nie migrácia ani súčasť bežiacej aplikácie.
Vyžaduje existujúce moduly `mssql` a `xlsx` v `/var/www/indexus-crm`.
Nič neinštaluje, nespúšťa migrácie, nemení dáta ani konfiguráciu databázy.

## Spustenie

Spúšťať z `/var/www/indexus-crm` na CORPCRM01 s operátorovým prístupom do CBC.
Pri prenose cez Git použiť presný overený commit a kontrolné súčty, nie
spustenie pohyblivej vetvy. Nekontrolovať produkciu cez SSH z Replit.

```bash
nice -n 10 node --max-old-space-size=512 /sukromny/prenos/iscbc-new-clients-2026.cjs --inspect
nice -n 10 node --max-old-space-size=512 /sukromny/prenos/iscbc-new-clients-2026.cjs --export
```

Vedľa hlavného súboru musia byť súbory s príponami `-source.cjs`,
`-workbook.cjs`, `-client-sheet.cjs` a `-export.cjs`. Existujúce konfiguračné súbory sa iba čítajú;
ich telá sa nespúšťajú. Náhradné heslo sa použije len pri presnej zhode
identity pripojenia. Pripojenie používa jednu session, časové limity a
read-only intent; samotné dotazy sú výlučne SELECT, nie overenie práv role.

## Presný výber a význam

- `Clients.cli_inserted >= '20260101' AND < '20270101'`.
- Žiadny filter krajiny, zmluvy, odberu ani stavu klienta.
- Soft-deleted klienti zostávajú osobitne označení. Poznámky označené ako
  odstránené v zdroji (vrátane priamych textov odstráneného rodiča) sa
  nevyberajú, iba sa nezávisle spočítajú.
- Klient bez zmluvy, zmluva bez služby aj klient bez odberu zostávajú viditeľní.
- Dátumy sa neposúvajú podľa serverovej/browserovej zóny: SQL datetime nemá
  časové pásmo. Metadáta extrakcie osobitne uvádzajú UTC a Bratislavu.
- Založenie zmluvy/odberu neznamená objednanie. Očakávaný termín pochádza
  zo zmluvy a nie je predstieraný ako plán každého jednotlivého odberu.
- Zrušenie zmluvy neprepisuje výsledok či dátum skutočného odberu.
- Native pohľady `StorageCampaingSelectionSK` a `StorageCampaingSelectionRO`
  označujú `sii_invoicing_period > 1` pri skladovacích službách ako
  `ma_viacrocne`. Report používa túto fakturačnú periodicitu oddelene od
  splátok; neodvodzuje ju iba z názvu alebo dĺžky uskladnenia.
- Referencie služby a platobného typu sú aktuálne číselníky, nie historická
  snímka. História cien, uložené plány, definície splátok a predpisy majú
  samostatné typy riadkov a pôvodné identifikátory.
- Plán ani predpis nie sú dôkazom úhrady. Skutočné bankové platby sa
  neexportujú. Meny predpisov sa nepreberajú odhadom z inej spoločnosti.
- Neoverená implicitná väzba `CollectionAnnouncements.can_client_id` bez
  preukázanej väzby cez odber sa iba spočíta a transparentne uvedie.

## Výstup a kontrola

Jeden list **Klienti 2026**, bez iniciál. Jeden hlavný riadok na klienta obsahuje
identitu a dátum založenia, prehľad počtov a fakturácie, všetky zmluvy a odbery,
všetky platobné podmienky a úplné poznámky v samostatných stĺpcoch.
Detailné texty zachovávajú identifikátory zmlúv, služieb, plánov a odberov,
zdroje, dátumy a autorov. Nejde o násobiaci join odberov, plánov a poznámok.
Pri prekročení limitu bunky sú očíslované pokračovania priamo pod tým istým
klientom; počty sú iba v hlavnom riadku. Žiadny ďalší list nevzniká.
Metadáta, filtre a zdrojové kontrolné počty sú priamo v zošite.
Zdrojové kontroly sú na konci toho istého listu. Priradenie poznámok používa
rovnaké overené priame aj nepriame väzby ako výber zo zdroja; nepriraditeľná
poznámka export zastaví. Zdieľaná poznámka je pri každom preukázane prepojenom
klientovi, raz na klienta; zdrojový počet a počet klientskych väzieb sú oddelené.
Poznámky sa vyberajú bez násobiacich joinov; prekrývajúce sa väzby Remarks
nevytvárajú kópie. Dlhé texty sa rozdelia bez straty na číslované pokračovania.
Všetky texty sa ukladajú ako textové bunky, nikdy nie ako vzorce.

Dve úplné čítania musia mať zhodné odtlačky každého zdroja. Nezávislé
súčty klientov, väzieb a každého poznámkového poľa sa musia zhodovať.
Nástroj nemení vypnutú databázovú snapshot izoláciu; sekvenčný charakter
čítania je výslovne uvedený v zošite. Pri zmene zdroja sa export zastaví.

Hotový zošit sa spätne načíta a overí po bunkách ešte pred uložením.
Výstup vzniká v novom náhodnom adresári v domovskom priečinku operátora,
s právami `0700`, súbor s právami `0600`. Čiastočný výstup sa pri chybe
odstráni. `CBC_REPORT_OK` znamená úspech; bez neho report nie je odovzdaný.

Operátor môže súbor stiahnuť svojím už existujúcim súkromným prístupom.
Nevkladať ho do `data`, `uploads`, Git ani verejných statických adresárov.
Do chatu vracať iba súhrnný výstup nástroja, nie klientské riadky či poznámky.

## Lokálne testy bez databázy a osobných údajov

```bash
node --test script/reports/iscbc-new-clients-2026.test.cjs \
  script/reports/iscbc-new-clients-2026-workbook.test.cjs
```
