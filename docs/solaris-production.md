# Priamy model Solaris na CORPCRM01

## Rozsah

Vydanie vychádza iba zo serverom potvrdeného commitu
`35f585483d119e2f9a7a77e2aa13c22655a2b1d8`. Nie je zlúčením GitHub `main`
ani celej vývojovej vetvy. Produkčný základ je od GitHub `main` odlišný na
oboch stranách; nepoužívať obyčajný `git pull origin main`.

Mení sa identifikátor modelu a jeho pomenovanie v existujúcom UI
`/configurator?tab=ai`, administrátorský smoke test a súvisiace testy.
Operátor prepne iba `email.translation`, `email.reply` a `email.compose`
z `indexus-document-audio:latest` na `indexus-ai-solaris:v1`.
`email.monitoring` zostáva na `indexus-email-monitoring:v1`. Ostatné služby,
automatizácie, všetky prompty, zdroj workera, timeouty a súbežnosť zostávajú
z produkčného základu. Worker sa znovu zostaví a reštartuje kvôli importovanej
registrácii modelu; nejde o zmenu jeho logiky.

## Predpoklady a priebeh

Spúšťa sa iba rootom v konzole CORPCRM01, so schváleným presným commitom
a `--allow-restart`. Skript overí produkčný základ, fyzické zdroje, rozsah
zmeny, tri pôvodné runtime hashe, existujúce procesy PM2 4 a 5 používateľa
seman, prázdnu AI frontu a konfiguráciu verzie 11 so štyrmi známymi routami.
Pri rozdiele sa zastaví; nepovoľovať obídenie kontrol.

1. Overí `/dev/sdb1` na `/var/www/indexus-crm/data`.
2. Vytvorí root-only `0700` priečinok `INDEXUS-Solaris-private-*` na tomto
   disku. Overí, že ho neprečítajú seman ani www-data.
3. Zálohuje menené zdroje, oba runtime súbory, pôvodný HTML index, konfiguráciu
   a `.env`. Vytvorí celý súkromný PostgreSQL archív cez skutočné pripojenie
   aplikácie, skontroluje identitu native klienta, hlavičku, obsah archívu
   a SHA-256. Heslá sa nevypisujú ani neposielajú cez argumenty príkazov.
4. Z presného cieľového Gitu vybalí súkromný staging. Použije už nainštalované
   závislosti cez odkazy na jednotlivé balíky, nie na celý `node_modules`.
   Kontajner závislostí a cache sú vlastné. Testy a build bežia ako `nobody`,
   ktorý nesmie zapisovať do živých závislostí, cez dočasný súkromný bind mount
   v `/run`; dáta zostávajú na `/dev/sdb1`. Účet aplikácie musí dostať `EACCES`
   pri čítaní oboch ciest. Mount sa na konci odpojí. Build nemení živý `dist`.
   Nové závislosti ani databázová migrácia sa nepridávajú.
5. Cez nainštalovaný `/etc/indexus-ai-runtime/preload.cjs` spustí existujúci
   smoke text+JSON na priamom modeli. Sú to dve syntetické inferencie,
   nie 21 jazykových prípadov. Nezmení loader, tajný JSON ani Gateway.
6. Zastaví iba aplikáciu 4, nechá worker dokončiť prijaté úlohy (najviac
   150 sekúnd) a zastaví worker 5. Počas krátkeho výpadku neprichádzajú
   nové úlohy z aplikácie. Ak fronta nevyprázdni, smerovanie sa nemení.
7. Fast-forwardne iba úzke vydanie, doplní nové statické súbory bez mazania
   starých, atomicky nainštaluje dokončené runtime súbory a index.
8. V jednej transakcii s porovnaním pôvodného stavu zmení iba tri modely,
   zvýši verziu konfigurácie na 12 a zapíše audit. Neskorší súbežný zásah
   nie je prepísaný.
9. Reštartuje pôvodné procesy bez `--update-env`. Overí hashe, nezmenené
   prostredie, HTTP, heartbeat workera a presnú výslednú konfiguráciu.

Výsledok `APPLIED_SOLARIS_CANONICAL` dokladá nasadenie, prepnutie a smoke,
nie výsledky troch služieb v prihlásenom UI. Pred celou sadou 21 prípadov
vykonať tri dohodnuté syntetické prípady v existujúcom INDEXUS toku,
zaznamenať ich ID/časy a overiť návrat výsledkov. E-maily neposielať.

## Návrat

Manifest a všetky zálohy ostávajú v súkromnom priečinku. Rovnaký hashovo
overený runner podporuje:

```text
sudo node /cesta/k/overenemu-runneru.cjs --rollback /var/www/indexus-crm/data/INDEXUS-Solaris-private-.../manifest.json --allow-restart
```

Návrat ešte pred zastavením procesov overí konfiguráciu, runtime, zdroje a
použiteľnosť záložných súborov. Pri už existujúcom konflikte ponechá aplikáciu
aj worker v behu. Po vyprázdnení fronty zopakuje kontroly kvôli súbežným
zmenám; ak konflikt vznikne počas čakania a ešte sa nič neprepísalo, znovu
spustí iba procesy, ktoré zastavil tento pokus. Bežiaci worker nepreruší.

Návrat opäť zastaví prísun úloh a nechá aktuálne úlohy dokončiť. Vyžaduje
nezmenené vlastné vydanie a konfiguráciu, obnoví len pôvodné zdroje, tri
runtime súbory a vlastnú zmenu konfigurácie, s novou verziou a auditom.
Nové obchodné dáta ostanú nedotknuté. **Nikdy automaticky neobnovuje DB dump.**
Ak niekto medzičasom zmenil konfiguráciu alebo runtime, návrat sa zastaví
a vyžiada kontrolu operátora; nekopírovať naslepo celý starý databázový stav.

Gateway dokumentácia uvádza, že starý alias už nie je v discovery.
Návrat pôvodného INDEXUS obnoví aj pôvodný modelový identifikátor; pre jeho
funkčnosť musí správca Gateway obnoviť aj deklaráciu starého aliasu
v `/v1/models` a capabilities, alebo koordinovane vrátiť Gateway.
Samotná kompatibilita POST bez discovery nestačí. Automatický návrat
dokladá obnovu kódu a konfigurácie, nie živú inferenciu starého aliasu.

Všetky chyby vypíšu fázu a bezpečný kód. Podrobné výstupy nástrojov ostávajú
iba v súkromnom priečinku. Zálohy a staging sa automaticky nemažú.

## Interpretácia kvality

Gateway môže pri rozpoznaných zámeroch vrátiť `verified-renderer` namiesto
pôvodného textu modelu. Nasledujúce testy sú preto end-to-end testy
INDEXUS/Gateway; samotný názov Solaris nepreukazuje kvalitu surového modelu.
