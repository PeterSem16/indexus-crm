# INDEXUS – AI v Konfigurátore: príprava vydania

## Rozsah

Administrátor: **Konfigurátor → AI**, priama cesta `/configurator?tab=ai`.
Oprávnenie sa kontroluje na serveri z aktuálneho aktívneho používateľa a jeho
administrátorskej roly, nie iba podľa hodnoty uloženej v session.

- 65 samostatných AI služieb: povolenie, poskytovateľ a model.
- OpenAI s prázdnym modelom zachová pôvodný model, prompt aj parametre.
- Interný model zatiaľ len `indexus-document-audio:latest`, text/JSON object.
  Audio, Responses, HTTP probe, obrazový OCR a strict-schema služby sa interne
  zvoliť nedajú. Ďalšie nepodporované parametre adaptér odmietne pred prenosom.
- Gateway: URL, povolenie, timeout 5–120 s, 0–2 retry, voliteľná teplota a
  maximálny počet výstupných tokenov 1–8192. Tieto parametre menia iba interné
  požiadavky; pred uložením meniacej sa aktívnej konfigurácie vrátiť interné
  služby na OpenAI alebo ich vypnúť. Núdzové vypnutie Gateway je vždy možné.
- Manuálna kontrola spojenia bez inferencie; samostatný syntetický text/JSON
  test; samostatný malý spoplatnený test OpenAI na `gpt-4o-mini`.
- Stav sa zobrazuje s časom, trvaním, modelom a jeho deklarovanými limitmi.
  Nastavený token nie je dôkaz spojenia. Výsledok starší ako 15 minút je zastaraný.
  Čítanie záložky/polling nikdy neposiela požiadavky na Gateway.
- Zmeny majú kontrolu verzie a audit. Rozpracované úpravy formulára sa
  neprepisujú periodickým načítaním. Testy majú spoločný zámok medzi PM2 workermi,
  cooldown a odmietnutie výsledku zo starej verzie konfigurácie.
- Každá AI požiadavka načíta autoritatívnu konfiguráciu z DB; starý globálny SDK
  klient ani iný PM2 worker nesmie potichu použiť starý cloudový route.
  Zachované sú SDK `asResponse`, `withResponse`, await a streaming OpenAI.

## Čo sa pri nasadení zmení v databáze

Idempotentná startup migrácia pridá iba:

1. `ai_router_configuration` – nesenzitívne nastavenia a diagnostické výsledky;
2. `ai_router_configuration_audit` – audit administrátorských zmien/testov.

Predvolené nastavenie: **Gateway vypnutá, overrides prázdne, všetky služby na
OpenAI**. Existujúce riadky sa nikdy neresetujú. Token nie je v DB ani v UI.
Nepoužívať `db:push`, reset, seed ani obnovu databázy.

## Overená sieť a rozdelenie zodpovedností

AI tím potvrdil pre HEAD s HTTP 200 z `2026-11-11 17:03:09 UTC` zdroj
**10.1.2.111 bez NAT**, finálny allowlist **10.1.2.111/32**.
AI server je `10.9.2.140`, verejný prefix
`https://ai.cordbloodcenter.com/gateway/`, upstream iba `127.0.0.1:8770`.

`ops/nginx/indexus-ai-gateway.location.conf` je návrh sekcie do existujúceho TLS
server bloku pre AI tím. Nie je to nasadený Nginx ani implementácia Gateway.
Pred reloadom skontrolovať skutočný vhost, obsadenosť portu, prístupové logy,
Bearer validáciu všetkých endpointov a `nginx -t`. Audio API 8765/8766,
Analyzer 8780, Ollama 11434 a Voice Studio sa nemenia.

## Bezpečné nasadenie INDEXUS – až po samostatnom schválení

1. Z konzoly CORPCRM01 zistiť aktuálny HEAD, čistotu vybraných zdrojov, hash
   živého backendu/frontendu, účet a počet PM2 workerov. Porovnať celý rozsah
   dokončených zmien medzi týmto HEAD a schváleným GitHub pinom, nie iba poslednú
   záložku AI. Nevykonávať SSH z Replitu.
2. Overiť `/dev/sdb1` a kapacitu v `/var/www/indexus-crm/data`. Vytvoriť súkromnú
   zálohu zdrojov a živého buildu a custom-format DB dump overený `pg_restore
   --list`. Použiť konfiguráciu existujúcej služby bez výpisu hesiel.
3. Build presného schváleného Git stromu pripraviť v súkromnom stagingu na
   schválenom dátovom disku mimo HTTP prístupu aj účtu bežiaceho Node procesu.
   Overiť byte parity, importy a build. **Nespúšťať build nad živým `dist`.**
   Nové závislosti sa nepridávajú; zachovať existujúce inštalované balíky.
4. Až hotový overený build riadene povýšiť, zachovať staré hashované frontend
   assets pre už otvorené karty a reštartovať iba INDEXUS so správnym prostredím.
   Startup vytvorí nové tabuľky; nezačne analýzy ani historické spracovanie.
5. Overiť beh, prihlasovanie a autorizáciu nových API (neprihlásený 401,
   neadministrátor 403), potom prihlásenú záložku AI. Pred prvou aktiváciou
   potvrdiť, že každý route ostal na OpenAI a Gateway je vypnutá.
6. Najprv samostatne schváliť a nasadiť Gateway na AI serveri. Potom bezpečne
   nastaviť token výhradne v existujúcom produkčnom secret store a povoliť
   `INDEXUS_AI_GATEWAY_ENABLED=true` v prostredí skutočného procesu služby.
   Voliteľná env base URL pre samostatné CLI je schválený `/gateway/` prefix;
   administračná DB konfigurácia používa výhradne schválenú URL.
   Interaktívna konzola nepreukazuje, čo zdedil PM2. Nepísať token do chatu,
   príkazového riadka, Git, prehliadača alebo logov; nepoužívať `pm2 env`/`set -x`.
7. V Konfigurátore povoliť a uložiť Gateway, spustiť kontrolu spojenia a
   syntetický text/JSON test. Z CORPCRM01 osobitne overiť aj chýbajúci/neplatný
   token, timeout a ďalšie negatívne prípady podľa hlavného reportu.
8. Po porovnaní kvality a samostatnom schválení vybrať jednu pilotnú textovú
   službu, zvoliť model a potvrdiť prepnutie. Server vyžaduje kompletný smoke
   test mladší ako 15 minút pre nezmenenú Gateway konfiguráciu. Zmena iba
   routov zachová jeho použiteľnosť a pôvodný čas testu.

Aktuálny produkčný HEAD, účty, PM2 a Gateway nasadenie neboli v tomto kroku
overené. Preto sa tu neuvádza neoverený vykonateľný príkaz na povýšenie produkcie.
Tento dokument je príprava, nie súhlas ani vykonané nasadenie.

## Rollback

Pre jednotlivú službu zvoliť OpenAI a vymazať model na pôvodnú hodnotu, alebo
službu vypnúť. Núdzové vypnutie Gateway zastaví interné požiadavky a **nesmie**
ich presmerovať do cloudu.

Celkový rollback routera: `INDEXUS_AI_ROUTER_MODE=legacy` v bezpečnej konfigurácii
procesu a riadený reštart INDEXUS. Legacy ignoruje DB routy, model overrides a
novú DB admission kontrolu pri AI volaniach. Auditované nastavenia sa nemažú;
po neskoršom návrate na routed ich preto treba znovu skontrolovať.
Návrat buildu obnoví overený predchádzajúci runtime, nie starú databázu.

## Opakovateľné testy

- `bash script/test-ai-router.sh` – pôvodných 105 syntetických/provider-stub
  regresií vrátane fingerprintov všetkých 71 pôvodných SDK volaní.
- `npm run test:ai-settings` – politika, live zmeny routov, SDK response helpers,
  bezpečné syntetické diagnostiky, sedem reálnych runtime prekladov a izolovaný
  dev DB/HTTP CRUD, konflikty, audit, revokácia a zámok testov.
  **DB integračná časť je len Replit dev; nikdy nie produkčná databáza.**
- `npx tsc --noEmit -p script/tsconfig.ai-settings.json` – úzka typová kontrola.
- `npm run test:ai-settings-ui` – skutočný React komponent v izolovanom
  prehliadači so stubovanými API, nie prihlásená produkčná aplikácia.

Tieto kontroly nie sú živé overenie Gateway. Interné sieťové/API/inferenčné
testy sa z Replitu nespúšťajú a žiadne zákaznícke dáta sa na Gateway neposlali.

### Výsledok prípravy

Na selektívnom kandidátovi odvodenom z publikovaného zdroja prešlo **105
pôvodných + 49 nových kontrol**, úzka typová kontrola a produkčný frontend/backend
build. Izolovaný prehliadač overil natívny fetch, nulové automatické testy,
oddelenie discovery/inferencie, potvrdenie/Escape, návrat modelu na pôvodný
OpenAI, zachovanie rozpracovaných úprav a 390 px rozloženie aj tmavý režim.
Použité boli skutočné React komponenty a CSS z kandidátskeho buildu,
syntetické API namiesto reálnych poskytovateľov. Prihlásená produkčná obrazovka
a živá Gateway tým ešte nie sú overené.
