# Selektívna príprava AI nad potvrdenou produkciou

## Výsledok

- Potvrdený produkčný základ: `0ee328b123a33014fab7380210ac7ee158b14085`, čistý sledovaný checkout.
- Nový zdroj: `328527d5699f4a13a30b9e945bf1bf5f59cb9f42`,
  vetva `feat/ai-services-current-base`, priamy potomok produkčného základu.
- Rozsah: 70 AI zdrojových, testovacích a dokumentačných súborov.
- Produkčné opravy Omni, badge a mailbox-owner monitoringu zostali zachované.
- Neobnovuje sa samostatná funkcia doplnkových e-mailových poznámok zo starej vetvy.
- Žiadna zmena balíkov; závislosti sa neinštalujú.
- Produkčný proces bol identifikovaný ako `seman`, PM2 `indexus-crm`, ID `4`,
  PID `958103`, cwd `/var/www/indexus-crm`, skript `dist/index.cjs`.
- Produkčný loader `/etc/indexus-ai-runtime/preload.cjs` sa nemení.

Pôvodný balík so základom `2464decc...` sa pre tento checkout nepoužíva.
Aktuálny kandidát bol vytvorený selektívne nad potvrdeným základom, nie
prepnutím celej vývojovej vetvy. Konflikty prekladov a e-mailového zobrazenia
zachovali produkčné odstránenie Email Notes a pridali iba AI job/súhrn.
Adapter a service-scoped kontrakty sú explicitné potrebné závislosti.

## Overenie v Replite

- Kompletný produkčný frontend, backend a worker build uspel.
- 197 testov AI asynchrónneho spracovania prešlo.
- Tri prehliadačové scenáre AI nastavení, súhrnu a návrhu riešenia prešli.
- Prehliadačová regresia Omni vstupu/neprečítaných správ prešla.
- 24 regresných testov monitoringu a modelovej izolácie prešlo.
- Samostatné negatívne testy prípravného nástroja prešli.
- Všetkých 70 publikovaných Git blobov bolo porovnaných s overeným kandidátom.

Testy používajú syntetické vstupy; DB integračné testy používajú izolované
testovacie schémy vývojovej databázy. Nejde o produkčné DB ani živú modelovú
akceptáciu. Súkromná produkčná záloha ešte nebola overená.

## Jeden prípravný beh na CORPCRM01

Operátor pod `seman` načíta publikovanú prípravnú vetvu a z nemenného tooling
commitu vyberie prípravný nástroj a manifest do existujúceho root-private
priečinka. Po overení oboch SHA-256 sa nástroj spustí cez sudo.
Samostatné interaktívne root prihlásenie ani root GitHub prístup nie sú potrebné.

Nástroj automaticky:

1. Znovu skontroluje presný základ, fyzické vstupné hashe vrátane kolízií nových
   súborov, runtime, loader, proces a výhradné použitie `/dev/sdb1`.
2. Vytvorí nový root-private staging pod `/var/www/indexus-crm/data`.
3. Vyberie pripnuté zdroje, skontroluje všetky zdrojové hashe a presný rozsah
   commit-u oproti produkcii.
4. Pripraví samostatný `node_modules` s odkazmi na jednotlivé existujúce balíky.
5. Zostaví frontend, backend aj worker mimo živého `dist`.
6. Znovu overí, že živý základ a runtime sa počas zostavenia nezmenili, a uloží
   výsledok `prepared.json` s hashmi pripravených výstupov.

Pri chybe sa zachová súkromný log a oznámi konkrétna fáza. Živé súbory sa
nemenia, preto nie je potrebné automatické vracanie zmien.

## Hranica povolenia

Prípravný nástroj nemá režim nasadenia. Nepripája sa k databáze, nečíta
produkčné prihlasovacie údaje, nespúšťa PM2 ani workera, nezapína poskytovateľov
a nevykonáva AI inferenciu. Nerobí `pull`, `reset`, `checkout`, `db:push`,
inštaláciu balíkov, mazanie dát alebo obnovu DB.

Produkčná propagácia vyžaduje osobitné schválenie, overenú súkromnú zálohu,
aktuálny runtime a samostatný pripnutý postup návratu. Nikdy automaticky
neobnovovať starú DB. Živá akceptácia dedikovaných modelových aliasov zostáva
samostatná: viditeľnosť aliasu v nastaveniach nie je úspešný smoke test.
