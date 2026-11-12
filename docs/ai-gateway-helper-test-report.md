# AI Gateway – technický report prípravy realizačného helpera

**Stav: `HELPER_PREPARED_TESTED_NOT_EXECUTED`.**

Schválená bola príprava a lokálne testovanie nástroja. Produkčný zásah,
reštart INDEXUS, aktivácia Gateway a zápisy do produkčnej konfigurácie
naďalej vyžadujú samostatné schválenie. Tento report nie je potvrdením
`GATEWAY_READY_OPENAI_ACTIVE`.

## Pripravené súbory

- `script/ai-gateway-production.cjs` – finálny preflight, súkromná záloha,
  inštalácia, cielený reštart, statické nastavenie bootu, obnova a bezpečné reporty.
- `script/lib/ai-gateway-policy.cjs` – explicitné povolenia, baseline,
  kontrola OpenAI routov a PM2 prostredia, render jednotky a poradie krokov.
- `script/lib/ai-gateway-host.cjs` – chránené čítanie a atómové zápisy,
  read-only DB kontrola, existujúci PM2 RPC a detekcia kompatibility PM2.
- `ops/ai-gateway/preload.cjs` – samostatný CommonJS loader bez npm závislostí.
- `script/ai-gateway-production.test.cjs` – syntetické testy vrátane obnovy stavu.

Žiadny z týchto súborov sa nepripája do súčasného štartu CRM. Aplikačný backend,
frontend, jeho build, `.env` ani existujúce AI routy neboli zmenené.

## Poistky realizácie

Bez parametrov alebo pri neúplnom/nesprávnom povolení nástroj odmietne operáciu
ešte pred produkčnou diagnostikou. Samostatné režimy:

- `--self-test`: syntetické overenie loadera, bez produkčných údajov;
- `--preflight`: iba čítanie; žiadny tokenový obsah, konfigurácia alebo reštart;
- realizačný režim: vyžaduje samostatný explicitný schvaľovací argument;
- rollback režim: vlastný explicitný argument a presná súkromná záloha.

Spúšťací blok pre produkčný zásah v tejto fáze nebol vydaný.

Preflight je viazaný na overený CORPCRM01, účet, PID/čas vzniku aplikácie
a PM2 démona, schválený Git HEAD, hash backendu a ecosystemu, Node v20.20.0,
práva a ACL, skupinu služby, správny `/dev/sdb1`, voľné miesto, aktuálny PM2 dump,
65 katalógových služieb a pôvodnú OpenAI-only DB konfiguráciu.
Zmena týchto predpokladov znamená STOP, nie automatické prispôsobenie.

Konkrétna cesta a verzia PM2 sa zistia až v produkčnom preflighte. Nástroj
na syntetických údajoch overí merge funkcie už nainštalovanej PM2 implementácie,
aby doplnenie/odstránenie Node argumentov neprepísalo existujúce prostredie.
Nepodporovaná implementácia sa odmietne. Nový PM2 sa neinštaluje.

RPC klient sa pripája iba k overenému existujúcemu démonovi `seman`, bez volania
PM2 connect/start alebo CLI, ktoré by mohli založiť nový démon. Reštart cieli
iba na overenú aplikáciu. Root PM2 sa nespravuje.

## Loader a zachovanie dostupnosti

- Povolené sú iba štyri Gateway premenné; OpenAI a ostatné nastavenia sa nemenia.
- Kontroluje sa presná schéma, URL, režim, tokenový formát, vlastník, skupina,
  práva, symlinky a veľkosť runtime súboru.
- Pri chybe sa odstráni Gateway token z prostredia a Gateway sa zablokuje;
  CRM ďalej pokračuje s existujúcim OpenAI prostredím.
- Jediný výstup pri chybe je statický `INDEXUS_GATEWAY_PRELOAD_BLOCKED`.
- Vývojové a Replit procesy sa odmietnu pred otvorením credential súboru.
- Token sa nevkladá do príkazov, PM2 deklarácie alebo dumpov.
- Všetky testy prípravy použili iba falošné tokeny a kľúče.

Pri budúcej realizácii sa okrem predchádzajúcich testov spustí loader aj
ako `seman` v samostatnom Node procese, ešte pred reštartom CRM. Výstupom
bude iba úspešný marker; žiadna hodnota tokenu alebo OpenAI kľúča.

## Záloha a vykonateľný rollback

Pred prvou zmenou runtime súborov musí existovať overená súkromná záloha
na `/dev/sdb1`, adresár root:root 0700, súbory 0600. Obsahuje pôvodné konfiguračné
súbory, živý PM2 stav, AI nastavenia, manifest s kontrolami integrity
a samostatnú kópiu celého rollback nástroja.

Pred reštartom sa znovu overia kontrolné súčty zálohy, syntax rollback vstupu,
neprístupnosť pre aplikáciu/webserver a syntetická testovacia sada skopírovaná
do zálohy. Rollback preto nebude závisieť od ďalšej dostupnosti GitHubu
alebo pôvodného staging adresára.

Chyba po začatí zmien vyvolá pokus o riadenú obnovu. Ak sa obnova neoverí,
report výslovne vyžiada zásah operátora; nesmie deklarovať úspech.
Neznáme/externe zmenené súbory sa neprepisujú ani nemažú.

Rollback obnovuje pôvodné Node argumenty, ecosystem a presné PM2 dump/backup
súbory s právami; odstraňuje iba nové vlastné runtime súbory a boot jednotku.
Boot disable nepoužíva `--now`, živý PM2 démon sa nezastavuje.
Pôvodný token a `.env` sa nemenia. DB ani audit sa neobnovujú/nevymazávajú.

**Administrátorský krok rollbacku:** Ak už bola Gateway po realizácii zapnutá
cez Konfigurátor, treba ju cez rovnakú administráciu vypnúť. Runtime rollback
neobchádza prihlásenie a nevykonáva neautorizované DB zápisy. Pokiaľ DB flag
zostane zapnutý, bezpečne obnoví pôvodný runtime bez Gateway env povolenia,
ale výsledok označí ako `ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED`.
Plný návrat sa nesmie vykázať pred dokončením tohto admin kroku.

## Výsledky lokálnych testov

Overovanie prebehlo na Node v20.20.0, bez produkčného pripojenia:

`node --test script/ai-gateway-production.test.cjs`

Výsledok: **63 nových testov prešlo**. Spolu s **13 regresnými testami
read-only diagnostiky prešlo 76/76 testov**, bez zlyhaní alebo vynechania.
Samostatný syntetický `--self-test` takisto prešiel.

Testy pokrývajú:

- validný loader, chýbajúci/nečitateľný/poškodený súbor, neplatnú schému,
  nesprávne práva/vlastníka/skupinu, symlinky a nepodporované prostredia;
- skutočný Node štart cez `--require`, pri ktorom aplikačný kód pokračuje
  napriek zablokovanej Gateway a OpenAI marker zostane zachovaný;
- presnú minimálnu zmenu ecosystemu a generovanú boot jednotku;
- odmietnutie akéhokoľvek odklonu od pôvodných OpenAI routov;
- zachovanie vnorených aj priamych PM2 environment hodnôt a ostatných procesov;
- kompatibilitu PM2 merge logiky a serializácie dumpu;
- poradie záloha → overenie rollbacku → loader test → reštart → verifikácia;
- chybu na každom kroku, úspešnú obnovu aj zlyhanie obnovy;
- obnovu konkrétnych simulovaných súborov, práv a PM2 argumentov, vrátane
  errored workera, stavu pred reštartom a zapnutej Gateway v DB;
- odmietnutie poškodeného rollback balíka a externe zmeneného súboru;
- skutočné atómové zápisy, no-clobber a symlink poistky na dočasných fixture súboroch;
- RPC klienta s falošným modulom, explicitné CLI povolenia a potlačenie surových chýb.

**Tieto testy nie sú živé overenie PM2 na CORPCRM01, Gateway ani produkčného UI.**

## Produkčné potvrdenia a otvorené kontroly

Posledná dodaná read-only diagnostika potvrdila 65/65 OpenAI routov,
bez modelových overrides, s Gateway vypnutou. Tento prípravný krok
na produkcii nič nevykonával, preto ich nemenil. Nejde o nové živé meranie.

Automatický štart zostáva v produkcii nepreukázaný. Jednotka je iba pripravená
ako generovaný návrh a otestovaná synteticky; **nie je nainštalovaná ani enabled**.
V lokálnom prostredí nebol dostupný `systemd-analyze`, preto sa tu nevykazuje
skutočná validácia jednotky týmto nástrojom.
Pri schválenej realizácii sa má validovať na skutočnom systemd a povoliť
bez spustenia existujúceho démona cez novú jednotku.
Skutočný reboot test zostáva na samostatné servisné okno.

Helper sám neposiela Gateway inferencie, neaktivuje DB Gateway flag ani nevytvára
admin session. Po schválenej realizácii zámerne končí stavom
`RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS`.
Connectivity a text/JSON smoke sa potom vykonajú cez existujúci prihlásený
Konfigurátor → AI, `/configurator?tab=ai`, bez zmeny routov.

Do potvrdenia `GATEWAY_READY_OPENAI_ACTIVE` preto zostáva:

1. samostatné schválenie produkčného vykonania;
2. úspešný finálny preflight, záloha, runtime a boot konfigurácia;
3. prihlásené administračné overenie, connectivity a syntetický smoke;
4. opakované produkčné potvrdenie nezmenených 65 OpenAI routov;
5. technický report skutočnej realizácie s osobitným stavom reboot testu.
