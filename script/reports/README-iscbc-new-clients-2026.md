# Dva jednorazové klientské reporty CBC za rok 2026

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
nice -n 10 node --max-old-space-size=512 /sukromny/prenos/iscbc-new-clients-2026.cjs --export-both
```

Vedľa hlavného súboru musia byť súbory s príponami `-source.cjs`,
`-workbook.cjs`, `-client-sheet.cjs`, `-scope.cjs` a `-export.cjs`. Existujúce konfiguračné súbory sa iba čítajú;
ich telá sa nespúšťajú. Náhradné heslo sa použije len pri presnej zhode
identity pripojenia. Pripojenie používa jednu session, časové limity a
read-only intent; samotné dotazy sú výlučne SELECT, nie overenie práv role.

## Presný výber a význam

- **Noví klienti:** `Clients.cli_inserted >= '20260101' AND < '20270101'`.
  Súbor `novi-klienti-2026.xlsx`; samostatné `--export` vytvorí len tento.
- **Klienti s odberom:** klient má cez vlastnú zmluvu a službu aspoň jeden
  `ServiceCollections.sco_collection_made >= '20260101' AND < '20270101'`.
  Súbor `klienti-s-odberom-2026.xlsx`; zahŕňa nových aj starších klientov.
  Nejde o všetkých historických klientov ani výber podľa založenia zmluvy.
  `EXISTS` zachová jedinečný výber aj pri viacerých službách jedného odberu.
- `--export-both` vytvorí oba súbory postupne s jedným databázovým spojením,
  s vlastnými extrakčnými oknami a nezávislými kontrolami pre každý report.
- Žiadny filter krajiny ani stavu klienta. Výber odberom patrí len do druhého reportu.
- Soft-deleted klienti zostávajú osobitne označení. Poznámky označené ako
  odstránené v zdroji (vrátane priamych textov odstráneného rodiča) sa
  nevyberajú, iba sa nezávisle spočítajú.
- Klient bez zmluvy, zmluva bez služby aj klient bez odberu zostávajú viditeľní.
  Druhý report prirodzene vyžaduje aspoň jeden skutočný odber v roku 2026.
- Oba reporty zachovávajú všetky naviazané zmluvy, odbery, platobné histórie
  a neodstránené poznámky vybraných klientov. Odbery mimo roku 2026 sú v
  hlavnom prehľade výslovne označené a spočítané oddelene. Dátum založenia
  a príznak založenia v roku 2026 odlišujú nových a starších klientov.
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

V každom súbore sú tri listy **Klienti a odbery**, **Platobné podmienky**
a **Poznámky**, bez iniciál. Hlavný prehľad zachováva samostatné stĺpce
zmluvy a odberu, skutočné dátumy ako excelové dátumové hodnoty a dopĺňa
požadované súhrny: odstránený klient, časť/počet častí klienta, počet zmlúv
a odberov, ročné/viacročné nastavenie, roky fakturačného obdobia a periodicitu
splátok. Časť klienta znamená poradový detailný riadok klienta; jeho počet
nezávisí od poznámok ani splátkových plánov. Súhrny sú opakované pri každom
detailnom riadku klienta pre filtrovanie, nejde o súčtové stĺpce cez celý list.
Metadáta, filtre a zdrojové kontrolné počty sú priamo v zošite.
Zdrojové kontroly sú na konci listu Poznámky. Priradenie poznámok používa
rovnaké overené priame aj nepriame väzby ako výber zo zdroja; nepriraditeľná
poznámka export zastaví. Zdieľaná poznámka je pri každom preukázane prepojenom
klientovi, raz na klienta; zdrojový počet a počet klientskych väzieb sú oddelené.
Poznámky sa vyberajú bez násobiacich joinov; prekrývajúce sa väzby Remarks
nevytvárajú kópie. Dlhé texty sa rozdelia bez straty na číslované pokračovania.
Všetky texty sa ukladajú ako textové bunky, nikdy nie ako vzorce.

Dve úplné čítania musia mať zhodné odtlačky každého zdroja. Nezávislé
súčty klientov, väzieb, nových/starších klientov, odberov v roku 2026
a každého poznámkového poľa sa musia zhodovať. Druhé čítanie uchováva iba
odtlačky, nie druhú úplnú kópiu osobných údajov a poznámok.
Nástroj nemení vypnutú databázovú snapshot izoláciu; sekvenčný charakter
čítania je výslovne uvedený v zošite. Pri zmene zdroja sa export zastaví.

Hotový zošit sa spätne načíta a overí po bunkách ešte pred uložením.
Výstup vzniká v novom náhodnom adresári v domovskom priečinku operátora,
s právami `0700`, súbor s právami `0600`. Čiastočný výstup sa pri chybe
odstráni. `CBC_REPORT_OK` znamená úspech jedného súboru. `CBC_REPORTS_OK`
sa vypíše len po úspešnom vytvorení oboch. Ak zlyhá druhý, prvý overený
súbor zostáva dostupný, ale nástroj netvrdí, že sú hotové oba reporty.

Operátor môže súbor stiahnuť svojím už existujúcim súkromným prístupom.
Nevkladať ho do `data`, `uploads`, Git ani verejných statických adresárov.
Do chatu vracať iba súhrnný výstup nástroja, nie klientské riadky či poznámky.

## Lokálne testy bez databázy a osobných údajov

```bash
node --test script/reports/iscbc-new-clients-2026.test.cjs \
  script/reports/iscbc-new-clients-2026-workbook.test.cjs
```
