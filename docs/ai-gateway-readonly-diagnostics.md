# CORPCRM01 – vstupná diagnostika internej AI Gateway

## Schválený rozsah

Iba vstupná kontrola. Zatiaľ nie je schválená úprava konfigurácie, reštart PM2,
aktivácia Gateway ani presmerovanie produkčnej AI služby.

Operátorský nástroj: `script/diagnose-ai-gateway-readonly.cjs --read-only`.
Spúšťa ho operátor cez `sudo` na CORPCRM01, nie agent cez SSH.
Spustenie z `node - --read-only` je podporované a otestované.

## Čo kontroluje

- Jediný Node proces pod účtom `seman` s cwd `/var/www/indexus-crm`;
  PID, vlastníka, parent PID, čas vzniku, Node executable.
- Parent PM2 proces a zhodu s `/home/seman/.pm2/pm2.pid`, bez volania PM2 CLI.
  PM2 démon sa vyberie a overí pred hľadaním workerov; jeho vlastný Node
  proces sa nezapočíta ako INDEXUS, aj keď má rovnaký účet a pracovný adresár.
  Pri nejednoznačnom výbere sa vrátia nesenzitívne metadáta kandidátov.
- Prítomnosť vybraných premenných v počiatočnom prostredí procesu, `.env`
  a uloženom `/home/seman/.pm2/dump.pm2`; pri OpenAI a DB len zhodu hodnôt.
- Metadáta a statické indikátory `ecosystem.config.cjs`; súbor sa nikdy
  neimportuje ani nevykonáva. Z existujúceho obsahu sa nevypisujú tajomstvá.
- Verziu skutočného Node executable a všeobecnú podporu CommonJS `--require`
  na vstavanom module `node:fs`, v samostatnom diagnostickom procese.
- Stav `pm2-seman.service`: enabled, active, účet, PID, indikátor `resurrect`,
  PM2_HOME, prítomnosť environment files a drop-inov. Ich obsah sa nevypisuje.
- Metadáta pôvodného tokenového súboru a adresára, bez čítania obsahu tokenu.
  Základné počty ďalších účtov v primárnej skupine služby; nejde o úplný audit
  identity alebo vzdialených adresárových služieb.
- Mount `/var/www/indexus-crm/data`, zhodu `/dev/sdb1`, voľnú kapacitu a ACL
  metadáta. Žiadny záložný adresár ani záloha sa nevytvára.
- Aktuálny Git HEAD, hash buildu a zhodu s posledným schváleným vydaním.
- AI konfiguráciu v explicitnej transakcii `BEGIN READ ONLY`, s timeoutmi
  pripojenia, SQL a lockov. Žiadne migrácie ani import aplikácie. Všetky služby
  z aktuálneho katalógu sa vyhodnotia vrátane predvoleného OpenAI smerovania.
- Identitu procesu po kontrole.

## Čo nástroj nerobí

- Nečíta obsah `/etc/indexus-ai/gateway-token`.
- Nevypisuje hodnoty alebo samostatné hashe API kľúčov a tokenov.
- Nemení `.env`, ecosystem, PM2 dump, systemd, oprávnenia ani Git.
- Nespúšťa PM2 CLI, reštart, `save`, `startup`, build ani inštaláciu balíkov.
- Neposiela Gateway ani OpenAI požiadavky a netestuje používateľské dáta.
- Nemení DB routy, nastavenia Gateway, audity ani výsledky testov.
- Neoveruje prihlásenú administračnú obrazovku ani funkčný reštart servera.

## Interpretácia výsledku

Výstup je nesenzitívny JSON. `unavailable` znamená neoverenú kontrolu,
nie povolenie pokračovať. Neznáma ACL alebo chýbajúca konfigurácia je dôvod
na doplnenie vstupných údajov, nie na ich automatickú opravu.

`/proc/.../environ` zachytáva počiatočné prostredie. Neskoršie načítanie cez
dotenv alebo preload v ňom nemusí byť viditeľné. PM2 dump môže byť zastaraný.
DB pripojenie iba z `.env` sa označuje ako nepreukázaná zhoda so živým procesom.
Prítomnosť OpenAI kľúča nie je dôkaz úspešného volania poskytovateľa.

`allServicesOpenAI` je dôkaz prečítanej DB konfigurácie pre daný katalóg,
nie pozorovanie každej skutočne vykonanej požiadavky. Treba ho posúdiť spolu
s identitou buildu, režimom routera a nezmenenou identitou procesu.

Existujúci systemd/PM2 stav umožňuje posúdiť pripravenosť na boot. Bez neskôr
schváleného reštartu nemožno tvrdiť, že funkčnosť po reštarte bola vyskúšaná.
Výsledný marker tejto fázy je výhradne `INVENTORY_ONLY_NOT_GATEWAY_READY`.

## Následný postup – vyžaduje samostatné schválenie

Na základe produkčného JSON sa predloží presný zoznam menených súborov,
rozdiel spúšťacej konfigurácie, oprávnenia a test konkrétneho preload loadera,
bezpečné zálohovanie a vykonateľný rollback. Existujúci `.env` a pôvodný token
sa majú zachovať. Návrh musí riešiť rovnaké načítanie tajomstva po reštarte PM2
aj po štarte servera bez ukladania jeho hodnoty do PM2 deklarácie.

Rollback tejto diagnostiky nie je potrebný: nevykonáva produkčné zmeny.
Budúci realizačný rollback musí obnoviť iba schválené spúšťacie nastavenia,
odpojiť nové načítanie tokenu, vypnúť Gateway a potvrdiť pôvodné OpenAI routy.
Nesmie obnovovať celú DB ani mazať audit. Presné príkazy sa určia po diagnostike.

`GATEWAY_READY_OPENAI_ACTIVE` možno potvrdiť až po ďalšom schválení a úspešných
produkčných testoch cez INDEXUS vrátane administračného rozhrania.
