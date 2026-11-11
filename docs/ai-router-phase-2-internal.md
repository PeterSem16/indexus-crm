# INDEXUS – pripravený interný textový adaptér

## Čo je pripravené, čo nie

Interný adaptér používa [schválený Gateway kontrakt](ai-gateway-contract-v1-proposal.md).
Je registrovaný v routeri, ale **žiadna služba naň nie je prepnutá**.
`AI_ROUTING_OVERRIDES` zostáva prázdne. Existujúce OpenAI modely, požiadavky,
prompty, kľúč, response handling a timeout/retry nastavenia sa nemenia.

Gateway server sa pripravuje samostatne. Tento kód ho neinštaluje, nepripája
Ollama priamo, nemení sieť, HTTPS, Audio API, Audio Analyzer 1.6 ani Voice Studio.
Na CORPCRM01 sa nič nenasadilo a sieťové spojenie s Gateway sa neoverilo.

## Prevádzkové hranice

- Predvolený adaptér odmietne všetky požiadavky v Replite aj mimo production
  runtime. Aj produkcia musí explicitne povoliť transport. Inicializácia a
  kontrola konfigurácie neposielajú žiadne sieťové požiadavky.
- Potrebné sú tri serverové nastavenia: `INDEXUS_AI_GATEWAY_ENABLED=true`,
  `INDEXUS_AI_GATEWAY_BASE_URL` a secret `INDEXUS_AI_GATEWAY_TOKEN`.
  V tejto etape sa nevytvorili ani nenastavili.
- Base URL musí byť explicitné HTTPS bez hesla, query alebo fragmentu. Žiadne
  predvolené IP, HTTP/80 alebo 8770 sa nedosadzuje. Porty existujúceho Audio API,
  Audio Analyzeru a Ollama (8765/8766/8780/11434) sa ako cieľ odmietnu.
- Povolený model je zatiaľ iba `indexus-document-audio:latest`. Názov
  nepreukazuje jeho reálnu dostupnosť. Pred inferenciou sa overia readiness,
  zoznam modelov aj schopnosti modelu; žiadne staré discovery sa nepoužije ako
  fallback pri chybe.
- `isAvailable()` znamená iba úplnú povolenú konfiguráciu, nie živú pripravenosť.
- Povolené sú textové Chat Completions a `text`/`json_object`, iba ak ich Gateway
  pre vybraný model inzeruje. Strict schema, stream, multimodalita, tool calls,
  Responses, prepis a TTS sa cez tento adaptér odmietajú.
- Smerovanie na interný provider vyžaduje explicitný model a chat službu.
  Nepovolené pole/schopnosť sa neodstraňuje potichu.

## Transport, výsledky a bezpečnosť

Adaptér používa OpenAI SDK iba na dohodnutý kompatibilný textový kontrakt.
Vlastný transport zabezpečuje allowlist cesty/modelu, produkčný gate,
Bearer autentifikáciu, readiness/capability kontrolu a validáciu odpovede.
Zachováva SDK APIPromise (`asResponse`, `withResponse`) pre existujúcich klientov.

TLS overovanie sa nevypína. Redirecty sú zakázané, aby token neodišiel na iný
cieľ. Chyby neobsahujú surovú odpoveď, token, URL ani prompt. Chyba nikdy
nevolá OpenAI ako náhradného poskytovateľa. Vstup má ochranný limit 512 KiB,
metadata 256 KiB a odpoveď 2 MiB; väčšie dáta sa odmietnu, nie skrátia.

Timeout klienta platí aj pre readiness, discovery a načítanie odpovede.
Abort sa zachováva. Interný klient má predvolený timeout 30 sekúnd a nula
opakovaní; výslovne zadané pôvodné client options sa rešpektujú.
Samostatná discovery kontrola má limit 15 sekúnd.

Dokončenie musí mať správny model, jednu textovú assistant voľbu a
`finish_reason: stop`. JSON object sa skutočne parsuje a nesmie byť pole.
Skrátená, prázdna alebo chybná odpoveď sa nevydáva za úspech. Neznáme debug
polia sa nepreposielajú. Tokenové počty sa nevymýšľajú.

Router zaznamenáva skutočne vybraného poskytovateľa bez citlivých payloadov.
Legacy režim ignoruje interné smerovanie a vracia pôvodný OpenAI klient.

## Testy v Replite

```bash
bash script/test-ai-router.sh
```

Interné scenáre používajú iba syntetické fetch stuby. Skutočná Gateway sa
z Replitu nevolá; výsledok týchto testov nie je dôkaz produkčnej dostupnosti.
Živé OpenAI overenie z predchádzajúcej etapy je samostatný historický protokol.

## Neskoršia kontrola na CORPCRM01

Nasledujúce príkazy sú určené **až po samostatnom schválení a nasadení kódu**
a sprevádzkovaní Gateway. Nie sú pokynom teraz nasadiť alebo povoliť službu.
Operátor ich spustí priamo v konzole CORPCRM01, nie cez SSH z Replitu.

Konzola musí mať bezpečne poskytnuté testovacie URL/token; nepreberá automaticky
poverenia z PM2. `INDEXUS_AI_GATEWAY_ENABLED=true` v jedinom príkaze povoľuje
iba tento diagnostický proces, nemení prostredie bežiaceho INDEXUS-u ani routes.
Hodnoty tokenov nikdy nevkladať do chatu alebo Git histórie.

```bash
cd /var/www/indexus-crm
NODE_ENV=production INDEXUS_AI_GATEWAY_ENABLED=true \
  npx --no-install tsx script/check-internal-ai-gateway.ts --check
```

Po úspešnej discovery kontrole možno manuálne spustiť dve syntetické inferencie:

```bash
cd /var/www/indexus-crm
NODE_ENV=production INDEXUS_AI_GATEWAY_ENABLED=true \
  npx --no-install tsx script/check-internal-ai-gateway.ts --smoke
```

`--check` overuje autentifikované readiness/models/capabilities; `--smoke`
navyše plain text a JSON object. Výstup neobsahuje odpovede modelu ani kľúč.
Ani úspešný smoke test nezapína služby a nedokazuje strict JSON Schema.

## Podmienky prvého prepnutia

1. Gateway tím potvrdí port, voľnosť portu, HTTPS base URL a certifikát.
2. Operátor potvrdí spojenie a autentifikáciu z CORPCRM01.
3. Model sa nachádza v oboch zoznamoch a reálne prejde plain text/JSON testom.
4. Samostatne sa overia chyby a nedostupnosť bez cloud fallbacku.
5. Vyberie sa jedna pilotná textová služba a skontrolujú sa jej konkrétne
   request polia, aplikačné validácie aj všetky existujúce aplikačné fallbacky.
6. Až po schválení sa urobí explicitná zmena serverového route pre túto službu
   na provider `internal` a model `indexus-document-audio:latest`.

Ostatné služby zostávajú na OpenAI. Rollback: `INDEXUS_AI_ROUTER_MODE=legacy`
a reštart procesu INDEXUS-u, bez obnovy databázy a bez reštartu Audio Analyzeru.
