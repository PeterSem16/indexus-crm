# CORPCRM01 – návrh dokončenia Gateway na samostatné schválenie

Stav: **návrh, nie vykonaná zmena ani povolenie realizácie**.
Schválená a vykonaná bola iba vstupná diagnostika.

## Potvrdené vstupy

- Nasadený zdroj a backend zodpovedajú schválenému vydaniu.
- Všetkých 65 služieb má OpenAI, bez modelových overrides; Gateway je vypnutá.
- Existujúci OpenAI kľúč sa zhoduje medzi počiatočným prostredím procesu,
  `.env` a uloženým PM2 stavom. Hodnoty sa nevypisovali.
- Node v20.20.0 podporuje CommonJS preload; konkrétny nový loader ešte neexistuje
  a musí sa otestovať pred použitím.
- Pôvodný token je root:root 0600, jeho adresár root:root 0700.
- Na kontrolovaných cestách nie je POSIX access/default ACL.
- `/dev/sdb1` je pripojený do `/var/www/indexus-crm/data`, zapisovateľný,
  s približne 420 GB voľného priestoru v čase diagnostiky.

## Zistenie automatického štartu

PM2 používateľa seman beží v prihlasovacej session cgroup. Linger je vypnutý.
V preverených systémových/používateľských jednotkách a cron cestách sa nenašlo
nastavenie PM2 alebo INDEXUS. Náhodne zachytené `systemd-tpm2-*` jednotky patria
TPM2, nie procesovému manažéru PM2.

Automatický návrat po reštarte servera preto nie je preukázaný. Tento návrh
výslovne zahŕňa nové nastavenie automatického štartu; nejde len o Gateway token.
Nezahŕňa skutočný reštart celého servera.

## Presný plánovaný rozsah súborov a nastavení

| Cesta | Plánovaná operácia |
|---|---|
| `/etc/indexus-ai-runtime/` | Nový root:seman adresár 0750 |
| `/etc/indexus-ai-runtime/gateway.json` | Nový root:seman súbor 0640 s kópiou existujúceho tokenu a tromi nesenzitívnymi Gateway nastaveniami |
| `/etc/indexus-ai-runtime/preload.cjs` | Nový root:root CommonJS loader 0644 |
| `/var/www/indexus-crm/ecosystem.config.cjs` | Doplniť iba `node_args: ['--require', '/etc/indexus-ai-runtime/preload.cjs']` do existujúcej aplikácie |
| Živá PM2 konfigurácia aplikácie `indexus-crm` | Doplniť preload, zachovať všetky existujúce environment values a ostatné parametre; jeden cielený reštart |
| `/home/seman/.pm2/dump.pm2` | Uložiť overený stav s preload argumentmi, nie s Gateway tokenom |
| `/home/seman/.pm2/dump.pm2.bak` | Počítať s vytvorením/úpravou záložného súboru pri uložení PM2; zahrnúť pôvodný stav do zálohy |
| `/etc/systemd/system/pm2-seman.service` | Nová systémová jednotka s User=seman, PM2_HOME=/home/seman/.pm2, Type=forking a príslušným PIDFile |
| `/etc/systemd/system/multi-user.target.wants/pm2-seman.service` | Enable symlink pre budúci boot; jednotku teraz nespúšťať ani cez ňu nepreberať živý daemon |
| `/var/www/indexus-crm/data/.ai-gateway-private/<unikátny-pokus>/` | Nová súkromná root:root 0700 záloha a evidencia; súbory 0600, nikdy webové zverejnenie |

Pred vytvorením čohokoľvek sa znovu overí stav a neprítomnosť kolízií či
symlinkov. Existujúce nové cieľové súbory sa neprepíšu. Presná absolútna cesta
k už nainštalovanému PM2 CLI zatiaľ nie je z diagnostiky známa: realizačný
helper ju musí bezpečne zistiť a overiť ešte pred generovaním jednotky.
Neúspech alebo nekompatibilná verzia znamená STOP, nie inštaláciu náhrady.

Databázový rozsah:

- cez existujúce admin API zmeniť iba `gateway.enabled` na true pri nezmenenej
  schválenej URL a ostatných existujúcich Gateway parametroch;
- cez existujúci test endpoint uložiť výsledky connectivity/smoke a príslušný
  audit do existujúcich AI tabuliek;
- nepoužiť route endpoint, nemení sa žiadny provider, model ani enabled služby;
- žiadna schéma, migrácia, seed, historické spracovanie alebo obnova DB.

Výslovne nezmenené: pôvodný `/etc/indexus-ai/gateway-token`, jeho rodič,
produkčný `.env`, `OPENAI_API_KEY`, všetky ostatné existujúce premenné, build,
Git HEAD, root PM2 a konfigurácie ostatných aplikácií.

## Loader a tajomstvo

Root načíta existujúci token bez výpisu a vytvorí nový runtime JSON.
Pôvodné oprávnenia a vlastníctvo sa nemenia. JSON obsahuje iba schválenú URL,
`routed`, povolenie Gateway a token; neobsahuje OpenAI ani databázové tajomstvá.
Jeho presná dátová schéma sa overí ešte pred reštartom.

Loader používa iba vstavané Node moduly, pevne určenú cestu a synchronizované
načítanie pred spustením aplikácie. Mení iba štyri `INDEXUS_AI_*` premenné.
Nenahrádza ani nemerguje celé prostredie, neimportuje `.env` a neprenáša token
do PM2 deklarácie, argumentov príkazu alebo administračnej odpovede.
Nový súbor sprístupňuje token účtu služby; nechráni ho pred rootom alebo
kompromitovaným účtom služby. Iné skupinové prístupy sa nesmú pridať.

Pri chýbajúcom, nečitateľnom alebo neplatnom runtime súbore loader vypne iba
Gateway, odstráni jej prípadný token z prostredia a oznámi statický nesenzitívny
diagnostický kód. Nesmie zastaviť celý CRM ani poškodiť OpenAI prostredie.
Interné volania zostanú zablokované, bez automatického cloud fallbacku.
Realizačný preflight musí takúto chybu odhaliť ešte pred reštartom; nejde o
tiché prijatie nefunkčnej Gateway ako úspešného nasadenia.

Pred nasadením treba s falošným tokenom otestovať konkrétny `.cjs` loader
na produkčnej verzii Node: pozitívny prípad, poškodený/chýbajúci súbor,
odmietnutie neznámych kľúčov a zachovanie ostatných premenných.
V žiadnom teste sa nevypíše skutočný token.

## Poradie realizácie po schválení

1. Čerstvý preflight procesu, démona, buildu, environment identity, routov,
   voľného miesta, mountu, ACL a kolízií. Zastaviť pri zmene východiskového stavu.
2. Súkromne zálohovať `.env`, ecosystem, existujúci PM2 dump/backup a aktuálnu
   živú konfiguráciu správneho PM2 démona. Uložiť pôvodné AI nastavenia a metadáta
   štartu. Overiť, že aplikácia ani webserver nemôžu zálohu čítať.
3. Pripraviť a otestovať loader, jeho runtime súbor a navrhovanú systemd jednotku.
   Overiť konkrétnu PM2 verziu a spôsob zachovania živého prostredia pred zásahom.
4. Nainštalovať nové súbory a minimálnu zmenu ecosystemu. Cielene reštartovať iba
   INDEXUS v existujúcom PM2 démone používateľa seman. Očakáva sa krátke prerušenie
   aplikácie; nie je to bezvýpadkové nasadenie.
5. Overiť dostupnosť aplikácie, zachovanie OpenAI kľúča a všetkých pôvodných
   premenných (s výnimkou presne schválených štyroch Gateway premenných),
   65 nezmenených OpenAI routov a neprítomnosť tokenu v PM2 deklarácii.
6. Uložiť overený PM2 stav; skontrolovať, že ani dump/backup neobsahujú Gateway
   token. Overiť, že ostatné PM2 aplikácie/moduly sa nezmenili.
7. Validovať systemd jednotku, vykonať daemon-reload a enable iba novej jednotky,
   bez start/restart/stop živého PM2 démona. ExecStart použije overené absolútne
   cesty k Node a existujúcemu PM2 CLI s `resurrect`.
8. V prihlásenom Konfigurátor → AI, `/configurator?tab=ai`, povoliť iba Gateway.
   Spustiť connectivity a po cooldown syntetický text/JSON smoke cez INDEXUS.
   Skontrolovať výsledky, audit, neautorizovaný prístup a skutočnú admin obrazovku.
9. Znovu potvrdiť nezmenené OpenAI routy, modely a dostupnosť aplikácie.
   Odovzdať report s dôkazmi a zostávajúcimi neoverenými bodmi.

Automatický boot sa v tejto fáze posúdi staticky: jednotka, enable symlink,
saved PM2 stav, trvalé cesty a oprávnenia. Funkčný test po reštarte celého
servera vyžaduje samostatne schválené servisné okno; bez neho sa nebude tvrdiť,
že reboot test prešiel.

## Presný rozsah a poradie rollbacku

Rollback bude mať vlastný overený helper a nebude potrebovať vypísať tajomstvá.

1. Ak bol Gateway flag v DB zapnutý, cez admin API ho vypnúť. Ak API nie je
   dostupné, najprv obnoviť pôvodný runtime bez loadera; ten nemá Gateway env
   povolenie, a po obnovení API dokončiť vypnutie DB flagu.
2. Odpojiť iba nový preload zo živej konfigurácie INDEXUS a obnoviť pôvodné
   environment values/parametre z chránenej predzmenovej konfigurácie.
   Cielene reštartovať iba INDEXUS pod používateľom seman; neobnovovať celý daemon.
3. Overiť aplikáciu, pôvodný OpenAI kľúč a zhodu všetkých 65 routov. Pri neúspechu
   zastaviť automatický postup a ponechať súkromné dôkazy operátorovi.
4. Obnoviť pôvodný ecosystem a presné súbory PM2 dump/backup vrátane ich
   vlastníctva a práv; pôvodne neprítomný backup súbor po overení odstrániť,
   ak vznikol výhradne týmto postupom. Nespúšťať následné save, ktoré by prepísalo
   práve obnovenú zálohu.
5. Disable iba novovytvorenú `pm2-seman.service` **bez `--now`**. Odstrániť iba
   jednotku/symlink vytvorené týmto pokusom a vykonať daemon-reload.
   Živý PM2 daemon sa nezastavuje.
6. Po overenom behu bez loadera odstrániť iba nové runtime súbory a ich nový
   adresár. Pôvodný token, `.env` a súkromné zálohy zostávajú nedotknuté.
7. Audit a výsledky testov sa nemažú; DB ani Git sa nevracajú späť.

Rollback obnoví pôvodný stav vrátane pôvodnej nepreukázanej boot registrácie.
Nevyriešený automatický štart sa preto v rollback reporte výslovne uvedie.

## Podmienky cieľového stavu

`GATEWAY_READY_OPENAI_ACTIVE` možno uviesť iba po úspešných testoch cez INDEXUS,
overení administrácie, bezpečného načítania tokenu a nezmenených OpenAI routov.
Report musí osobitne uviesť, či prešiel skutočný reboot test; samotná enabled
jednotka nie je dôkaz funkčného bootu. Aktuálny stav je stále OpenAI-only,
Gateway v INDEXUS nepripravená a tento návrh čaká na samostatné schválenie.
