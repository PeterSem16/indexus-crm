# Selektívna príprava AI nasadenia na CORPCRM01

## Schválený rozsah tejto prípravy

Používateľ schválil **pripraviť** selektívne nasadenie, nie vykonať produkčnú
zmenu ani spustiť workera. Táto príprava preto nemá režim `--apply`.

- Zdroj aplikácie: `5c7c1f9e065f255d5b300cd503417766f0f81b29`.
- Overený publikovaný základ: `2464decc180187d1edc9742a4d07f04f918c4660`.
- 56 presne určených AI súborov s Git blob aj SHA-256 kontrolnými súčtami.
- Žiadna nová B1 aplikácia, zmena business pravidiel automatizácií ani balíkov.
- Main sa neprepína. Nie je povolené nasadiť celú pracovnú vetvu Replitu.
- Aktuálny stav produkcie zatiaľ **nie je potvrdený**.

Archív obsahuje iba tieto zdroje, manifest, kontrolný skript a tento postup.
Nie je to úplný checkout ani príkaz na prepísanie živej aplikácie. Neobsahuje
produkčné tajomstvá, databázu, uploady ani node_modules.

## Prvý krok: iba kontrola existujúcej produkcie

Kontrolu vykonáva používateľ cez konzolu CORPCRM01, nie cez SSH z Replitu.
Samotný Node skript iba číta lokálny Git, kontrolné súčty zdrojov a buildu,
manifest závislostí, prítomnosť nástrojov, mount a voľné miesto a nainštalovaný
netajný Gateway loader. Nečíta obsah `.env`, PM2 prostredia, tajného Gateway JSON,
e-mailov ani databázy. Nespúšťa inferenciu, HTTP požiadavku, PM2 ani build.

Kontrola musí odmietnuť nesprávny server, iný Git základ, upravený sledovaný
checkout, odlišné AI súbory, neoverené závislosti, chýbajúci loader a nesprávny
mount. Pre zálohy a staging sa vyžaduje `/dev/sdb1` na
`/var/www/indexus-crm/data`, bez náhrady systémovým diskom.

Najmenej 2 GiB voľného miesta je iba počiatočná kontrola prípravy. **Neznamená**
to, že je dostatok miesta na plnú databázovú zálohu a celý build. Ich veľkosť
sa musí samostatne overiť pred nasadením.

Úspešná kontrola vracia `preparationChecksPassed: true`, ale vždy zachováva
`deploymentAuthorized: false`, `backupValidated: false` a
`liveInferenceTested: false`. Výstup nie je povolenie ani dôkaz nasadenia.
Pri zlyhaní nič automaticky neopravuje, nemaže ani nesynchronizuje.

## Kroky, ktoré sa pripravia až podľa čerstvého produkčného výstupu

1. Potvrdiť aktuálny Git základ, runtime hashe, vlastníka a presný PM2 proces.
   Root PM2 a aplikačný PM2 sa nesmú zameniť. Odlišný stav je dôvod zastaviť,
   nie vykonať `reset`, `clean`, slepý `pull` alebo prepísať zmeny.
2. Overiť súkromnú úplnú databázovú zálohu a zálohu runtime na určenom disku.
   Root priečinok 0700 musí byť neprístupný aplikačnému aj webovému účtu.
   Nemeniť práva dátového mountu ani živého PostgreSQL clustra.
3. Sestaviť pripnutý celý zdroj v samostatnom súkromnom stagingu na dátovom
   disku. Vite nesmie zapisovať do živého node_modules: použiť súkromný
   kontajner s odkazmi na jednotlivé nainštalované balíky. Žiadne npm install.
   Git archív ide priamo do súkromného súboru, nie cez buffer Node procesu.
4. Overiť oba hotové bundly a frontend pred propagáciou. Nespúšťať normálny
   build v živej aplikácii, pretože maže dist. Zachovať staré statické assety
   pre otvorené karty a starý backend pre bezpečný návrat.
5. Po samostatnom schválení nasadiť len pripravený build a potrebné zdroje.
   Aditívne štartovacie migrácie pridajú tabuľky fronty; nasadenie nepoužíva
   db:push, nemaže dáta a nesmie meniť uložený výber poskytovateľov.
6. Overiť health, prístup k Configuration a pripravenosť schémy. Potom až po
   osobitnom schválení spustiť jeden worker pod správnym prevádzkovým účtom,
   s existujúcim loaderom `/etc/indexus-ai-runtime/preload.cjs`.
   Nekopírovať tajomstvá do príkazov alebo PM2 argumentov.
7. Potvrdiť heartbeat a vykonať explicitne schválené živé syntetické kontroly.
   Testovací výsledok zo syntetického transportu nie je živá modelová akceptácia.
   Žiadna služba sa automaticky neprepne z OpenAI na internú AI.

Pri návrate sa zastaví nový worker a obnoví overený predchádzajúci runtime,
nie stará databáza. Zachovať nové údaje aj záznamy fronty; nespúšťať automatické
opakovanie nejasných inferencií. Pred návratom na starší backend treba overiť,
že nezmení autoritu už aktivovaných callbackov. Konkrétne príkazy na propagáciu
a návrat musia používať čerstvo overený runtime, nie starý odhad.

## Lokálne overenie balíka a kontrolného skriptu

```
node --test script/operator/ai-services-preflight.test.cjs
node ai-services-preflight.cjs --verify-bundle /cesta/k/rozbalenemu/baliku
```

Tieto testy nepoužívajú produkčné pripojenie ani skutočný PM2 proces.
Príkaz pre produkčnú konzolu sa odovzdáva samostatne s nemenným pinom nástroja
a kontrolnými súčtami oboch spúšťaných vstupov; nikdy cez `curl | bash`.
