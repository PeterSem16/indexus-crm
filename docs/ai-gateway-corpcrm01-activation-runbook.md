# INDEXUS AI Gateway – realizačný plán pre CORPCRM01

**Stav: pripravené na samostatné schválenie, nie povolenie vykonať produkčné zmeny.**

**POZASTAVENÉ po zlyhaní fázy A.** Pôvodné realizačné príkazy v tomto dokumente
teraz neopakovať. Kontrolné súčty nižšie patria pôvodnej verzii nástrojov.
Aktuálny súhrnný report a nové diagnostické nástroje sú v
`docs/ai-gateway-incident-report.md`. Oprava nástroja ešte nie je
potvrdením odstránenia pôvodnej príčiny ani povolením ďalšieho pokusu.

Táto analýza nemení produkciu, PM2, routy ani databázu. Príkazy v častiach
označených „PO SCHVÁLENÍ“ sa teraz nespúšťajú. Operátor používa konzolu
CORPCRM01; z Replitu sa na tento server nepripájame.

## 1. Overené východisko a Git

Posledný dodaný úplný produkčný preflight skončil `READY`, vrátane
`checks.unchangedAfterChecks.passed: true`. Všetkých 65 routov ostalo OpenAI,
interných bolo 0, modelových overrides 0, Gateway v INDEXUS vypnutá.
Vykonal 3 GET, 0 inferencií, 0 reštartov a nevytvoril zálohu.

GitHub bol pri tejto analýze overený cez existujúce pripojenie:

| Vetva | Overený commit | Význam |
|---|---|---|
| `main` | `52902d20b5bad42c60d543f365d33badae647f05` | Produkčná aplikačná integrácia |
| `ops/ai-production-prepare-20261111` | `1f4dbb41c7dac479b98d607834a3fe226dcbd4ec` | Staršia prípravná vetva |
| `ops/ai-production-promote-20261111` | `d142d6e54914a763c0a1fd12c83ebc9d1e604928` | Staršia promo vetva |
| `ops/ai-gateway-runtime-preparation-20261112` | `7e0c0adb5420c248457bbd109e7959f986c3746b` | Oddelené runtime/preflight nástroje |

Porovnanie Git blobov 24 vybraných integračných a vstupných súborov potvrdilo
zhodu oboch starších vetiev s `main`. Runtime vetva zachováva týchto 24 súborov
a pridáva 8 runtime/preflight súborov. Nie je potrebné prepínať produkčný
checkout na prípravnú vetvu, cherry-pickovať ju, robiť pull ani nový build.
Záver sa vzťahuje na tieto integračné súbory, nie na tvrdenie, že celé vetvy
majú identický obsah.

Lokálny workspace nie je totožný s publikovaným `main`. Preto sa neodporúča
nasadiť celú lokálnu vetvu. Pri porovnaní 32 vybraných súborov s runtime vetvou
sa lokálne líšili `package.json`, `server/index.ts` a `server/routes.ts`;
ostatných 29 sa zhodovalo. Zapojenie inicializácie a admin routov bolo osobitne
overené aj v publikovaných zdrojoch `main`.

## 2. Architektúra a presné umiestnenie

Gateway server beží samostatne na AI serveri. INDEXUS obsahuje klientský
adaptér a routovanie, nie implementáciu Gateway servera. Audio Analyzer 1.6
a jeho port 8780 sa nemenia.

| Súbor/modul | Úloha |
|---|---|
| `server/lib/ai-router.ts` | Verejné rozhranie AI klientov a inicializácia |
| `server/lib/ai/router.ts` | Výber poskytovateľa podľa služby, režim routed/legacy |
| `server/lib/ai/openai-adapter.ts` | Existujúca OpenAI prevádzka |
| `server/lib/ai/internal-adapter.ts` | Autentifikovaný HTTPS klient Gateway, discovery a Chat Completions |
| `server/lib/ai/internal-contract.ts` | Validácia požiadaviek, discovery a odpovedí |
| `server/lib/ai/service-catalog.ts` | Katalóg 65 služieb |
| `server/config/ai-routing.ts` | Prázdne statické overrides, pôvodné OpenAI routovanie |
| `server/lib/ai/admin-router.ts`, `admin-runtime.ts` | Aktuálny DB snapshot pri prijatí každého routovaného volania |
| `server/lib/ai-settings-bootstrap.ts` | Zapojenie administrácie a refresh snapshotu |
| `server/lib/ai/settings-controller.ts`, `settings-store.ts`, `settings-policy.ts`, `settings-authorization.ts` | Admin API, verzovanie, audit, oprávnenia a ochrany |
| `server/lib/ai/settings-check.ts` | Izolované connectivity a syntetické smoke testy |
| `shared/ai-settings.ts` | Verejný kontrakt nastavení bez tokenu |
| `client/src/components/configurator/AISettingsTab.tsx` | Konfigurátor → AI, `/configurator?tab=ai` |
| `ops/ai-gateway/preload.cjs` | Pripravený loader runtime konfigurácie pred štartom INDEXUS |

Serverové runtime premenné:

```text
INDEXUS_AI_GATEWAY_ENABLED=true
INDEXUS_AI_GATEWAY_BASE_URL=https://ai.cordbloodcenter.com/gateway/
INDEXUS_AI_GATEWAY_TOKEN=<iba server, nikdy konzola alebo Git>
INDEXUS_AI_ROUTER_MODE=routed
NODE_ENV=production
```

Loader nastavuje prvé štyri premenné, nie `NODE_ENV`. Zachováva ostatné
prostredie vrátane `OPENAI_API_KEY` a `DATABASE_URL`. Interný adaptér odmieta
Replit a neprodukčné prostredie. DB `gateway.enabled` aj serverové povolenie
musia umožňovať použitie Gateway. Nastavenia URL, timeoutu, retry a voliteľných
parametrov sú v administrácii; token tam nikdy nie je.

API INDEXUS:

```text
GET  /api/configurator/ai
PUT  /api/configurator/ai/gateway
POST /api/configurator/ai/test
PUT  /api/configurator/ai/route        ← v tomto postupe ZAKÁZANÉ
```

Prístup vyžaduje prihláseného, aktuálne oprávneného administrátora.
Zmeny používajú `expectedVersion`. Kontroly a zmeny majú audit v existujúcich
AI tabuľkách. Žiadna nová schéma ani migrácia nie je na tento krok potrebná.

**Povolenie Gateway nie je prepnutie služieb.** Test endpoint používa interný
adaptér priamo so syntetickými vstupmi. Nevytvorí route override a nepresmeruje
žiadnu z 65 služieb. Interné zlyhanie nesmie potichu prejsť na OpenAI.

## 3. Čo bolo neinvazívne otestované teraz

V pracovnom prostredí boli vykonané tieto príkazy, bez živých AI požiadaviek:

```bash
node --test \
  script/ai-gateway-production.test.cjs \
  script/ai-gateway-preflight.test.cjs \
  script/diagnose-ai-gateway-readonly.test.cjs

npx --no-install tsx --test \
  server/lib/ai/internal-adapter.test.ts \
  server/lib/ai/settings.test.ts \
  server/lib/ai-router.test.ts \
  server/lib/ai-router-coverage.test.ts \
  client/src/i18n/ai-settings-translations.test.ts
```

Výsledok: **96/96 + 97/97 prešlo, 0 zlyhaní, 0 preskočených testov**.
Integračné moduly testov sa zhodujú s overenými publikovanými súbormi;
nejde však o test spustený proti živému produkčnému backendu.

Pokrytie zahŕňa autentifikované cesty, odmietnutie presmerovaní, kontrakt,
text/JSON, chyby HTTP 401/403/404/422/429/503/504, sanitizáciu chýb,
timeout/abort, malformed/oversized odpovede, nesprávny model, nepovolené
operácie, routovanie, legacy režim a absenciu automatického fallbacku.

DB integračné testy ani browser UI testy sa v tejto analýze nespúšťali.
`npm run test:ai-settings` zahŕňa DB testy, preto ho nespúšťať proti produkcii.
Do produkcie neprenášať testovacie auth hlavičky ani prihlasovací bypass.

## 4. Brány schválenia

1. **Teraz:** analýza, syntetické testy, read-only preflight; bez zmien.
2. **Schválenie A:** súkromná záloha, runtime súbory, ecosystem/PM2,
   jeden cielený reštart INDEXUS a nová boot registrácia.
   Ide o krátke možné prerušenie aplikácie, nie bezvýpadkový zásah.
3. **Schválenie B:** cez existujúce admin API povoliť iba Gateway a vykonať
   connectivity + dva syntetické inferenčné testy. Zapíšu sa diagnostické
   výsledky a audit; route endpoint sa nepoužije.
4. Akékoľvek neskoršie prepnutie konkrétnej služby na internú AI vyžaduje
   ďalšie samostatné schválenie. Tento plán to neobsahuje.

Schválenia A a B možno udeliť spoločne, iba ak výslovne pokrývajú celý uvedený
rozsah. Samotný `READY` alebo schválenie dokumentu nie je ich udelenie.

## 5. CORPCRM01 – kontrola integrity a čerstvý preflight

Konzola CORPCRM01, používateľ `seman`. Tento blok iba číta. Nástroje sú
v root stagingu z úspešného preflightu. Ak chýba, STOP; nedosadzovať iný
adresár a neobchádzať kontrolu hashov.

```bash
sudo env -i \
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  HOME=/root /bin/bash <<'VERIFY_INDEXUS_GATEWAY'
set -euo pipefail
cd /tmp/indexus-gateway-tools.OKDOMg
sha256sum --check --status <<'VERIFIED_SOURCES'
478316c73553f6568047a2b011a3ef13eb4ab30be9364e454e94d18cb5905ec9  script/ai-gateway-production.cjs
e50082290ed3ba74ba128c8469c10cbf83390260de39f41e96da9ae078b04711  script/lib/ai-gateway-policy.cjs
2991ba3a3e655a7772154b724ca59a771b77f71a72e1dc9b60f1767538f3327e  script/lib/ai-gateway-host.cjs
a23dfb16a85b9e52ec336930f65f571100b33c510c5c4cd31bb111cd6ee5a41f  script/ai-gateway-production.test.cjs
33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac  ops/ai-gateway/preload.cjs
8d4742c58ce035282d3d813b72038e0cf1b7ab7c2382ff60b92d1126b703c688  script/lib/ai-gateway-preflight.cjs
44d0f16556d89e72ce3a09465ae800ba89b13b7150934e25f94eeacfa0de8b40  script/ai-gateway-preflight.test.cjs
VERIFIED_SOURCES
exec /usr/bin/node script/ai-gateway-production.cjs --preflight
VERIFY_INDEXUS_GATEWAY
```

Požadovaný výsledok: `READY`, všetkých päť skupín `checks` má `passed:true`,
`openai:65`, `internal:0`, `modelOverrides:0`, `productionChanges:false`,
`restarts:0`, `inferenceRequests:0`, `targetAchieved:false`.
Gateway GET: health/ready, v1/models, indexus/v1/capabilities.
Kontrakt vyžaduje apiVersion `"1"` a pole `models`, požadovaný model s pravými
metadátami a text/json_object. Tento report nevypisuje presný počet modelov;
z jeho úspechu netvrdiť `modelCount:1`.

Helper je zámerne pripnutý aj na PID, identitu PM2 démona, Node verziu,
Git HEAD, hash backendu a ecosystemu. Zmena východiska znamená STOP a nový
review, nie ručnú úpravu pinov. Po nasadení sa tento predzmenový preflight
už nepoužíva ako post-aktivačný test, lebo očakáva pôvodný stav.

## 6. PO SCHVÁLENÍ A – jediný runtime realizačný príkaz

Predpoklad: bezprostredne úspešná časť 5 a nezmenený staging aj produkcia.
Helper znovu preverí východisko. V konzole CORPCRM01 ako `seman`:

```bash
sudo env -i \
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  HOME=/root \
  /usr/bin/node /tmp/indexus-gateway-tools.OKDOMg/script/ai-gateway-production.cjs \
  --apply --approve CORPCRM01_GATEWAY_RUNTIME_CHANGE_APPROVED
```

Presný rozsah prenášaných runtime súborov a zmien:

| Cesta | Zmena |
|---|---|
| `/etc/indexus-ai-runtime/` | Nový root:seman adresár 0750 |
| `/etc/indexus-ai-runtime/gateway.json` | Nový root:seman 0640; schválená URL, mode, enabled a kópia existujúceho tokenu |
| `/etc/indexus-ai-runtime/preload.cjs` | Nový root:root 0644 loader |
| `/var/www/indexus-crm/ecosystem.config.cjs` | Iba preload `node_args` |
| Živý `indexus-crm` v PM2 používateľa seman | Preload a jeden cielený reštart, zachovanie pôvodných premenných |
| `/home/seman/.pm2/dump.pm2`, `dump.pm2.bak` | Overený uložený stav bez Gateway tokenu |
| `/etc/systemd/system/pm2-seman.service` + enable symlink | Nová boot registrácia, bez start jednotky, bez rebootu |
| `/var/www/indexus-crm/data/.ai-gateway-private/attempt-…/` | Root-only záloha, manifest, stav a vykonateľný rollback |

Zdrojom loadera a helperov je výhradne overený staging runtime vetvy.
Žiadna nová závislosť, npm install, build, zmena `.env`, Git HEAD alebo
pôvodného `/etc/indexus-ai/gateway-token`. Ostatné PM2 aplikácie sa nemenia.
Token nesmie byť v argumentoch, deklarácii PM2, jeho dumpoch ani reporte.

Záloha musí byť výhradne na `/dev/sdb1`, mount
`/var/www/indexus-crm/data`, súkromná root:root 0700, súbory 0600,
bez prístupu účtu služby a webservera. Helper overí ACL, integritu a rollback
balík pred reštartom. Zálohu PostgreSQL ani obnovu starej DB tento krok nerobí.

Očakávaný koniec:

```text
RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS
openaiRoutes: 65
routesChanged: false
```

Uložiť presnú hodnotu `backup` z výsledku súkromne na serveri. Pri chybe
neopakovať naslepo `--apply`: postup môže mať čiastočné zmeny a evidence
rollbacku. Vyhodnotiť bezpečný chybový kód a konkrétny stav zálohy.

## 7. PO SCHVÁLENÍ B – aktivácia a testy cez skutočný INDEXUS

Prihlásiť sa ako administrátor do produkčného INDEXUS:
**Konfigurátor → AI**, cesta **`/configurator?tab=ai`**.
Overiť obrazovku a jej dostupnosť. Nepoužiť Replit preview ani AI server.

Nasledujúci blok patrí do konzoly prehliadača na tejto produkčnej stránke.
Používa existujúcu same-origin session, nevyžaduje kopírovanie cookies ani
Gateway tokenu. Spúšťať ho iba po schválení B, raz, počas dohodnutého okna
bez súbežných úprav AI konfigurácie.

Predbežná podmienka je pôvodná Gateway konfigurácia: timeout 30000,
maxRetries 0, temperature/maxTokens null a Gateway vypnutá. Ak sa líši,
blok skončí pred zmenou; odchýlku najprv vyhodnotiť. Neopravuje ju automaticky.

```javascript
await (async () => {
  const root = "/api/configurator/ai";
  const assert = (ok, code) => { if (!ok) throw new Error(code); };
  const call = async (path = "", method = "GET", body) => {
    const res = await fetch(root + path, {
      method, credentials: "same-origin", cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    assert(res.ok, "INDEXUS_HTTP_" + res.status);
    return res.json();
  };
  const routes = v => JSON.stringify(v.services
    .map(s => [s.id, s.route.provider, s.route.model, s.route.enabled])
    .sort((a, b) => a[0].localeCompare(b[0])));
  const openaiOnly = v => assert(v.services.length === 65 &&
    new Set(v.services.map(s => s.id)).size === 65 &&
    v.services.every(s => s.route.provider === "openai" &&
      s.route.model === null && s.route.enabled === true), "ROUTES_NOT_OPENAI_ONLY");
  const baseline = await call();
  openaiOnly(baseline);
  assert(baseline.runtime.production && !baseline.runtime.replit &&
    baseline.runtime.serverAllowed && baseline.runtime.tokenConfigured &&
    baseline.runtime.openaiConfigured && baseline.runtime.mode === "routed",
    "RUNTIME_NOT_READY");
  const g = baseline.gateway;
  assert(!g.enabled &&
    g.baseURL === "https://ai.cordbloodcenter.com/gateway/" &&
    g.timeoutMs === 30000 && g.maxRetries === 0 &&
    g.temperature === null && g.maxTokens === null, "GATEWAY_BASELINE_CHANGED");
  const originalRoutes = routes(baseline);
  let view = await call("/gateway", "PUT", {
    expectedVersion: baseline.version, gateway: { ...g, enabled: true }
  });
  const sameRoutes = v => {
    openaiOnly(v);
    assert(routes(v) === originalRoutes, "ROUTES_CHANGED");
    assert(v.gateway.enabled === true, "GATEWAY_NOT_ENABLED");
    assert(JSON.stringify(v.gateway) === JSON.stringify({ ...g, enabled: true }),
      "GATEWAY_PARAMETERS_CHANGED");
  };
  sameRoutes(view);
  const test = async kind => {
    // Account for any previous check without changing its timestamps in DB.
    const times = [view.gatewayCheck, view.openaiCheck].filter(Boolean)
      .map(c => Date.parse(c.checkedAt));
    const wait = Math.max(0, ...times.map(t => 31000 - (Date.now() - t)));
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    view = await call();
    sameRoutes(view);
    assert(view.version === baseline.version + 1, "CONCURRENT_SETTINGS_CHANGE");
    view = await call("/test", "POST", {
      expectedVersion: view.version, kind
    });
    sameRoutes(view);
    assert(view.gatewayCheck?.state === "ready" &&
      view.gatewayCheck.kind === kind &&
      view.gatewayCheck.settingsVersion === view.version, "TEST_NOT_READY_" + kind);
  };
  await test("connectivity");
  await test("smoke");
  const final = await call();
  sameRoutes(final);
  assert(final.version === baseline.version + 1, "CONCURRENT_SETTINGS_CHANGE");
  const check = final.gatewayCheck;
  const age = Date.now() - Date.parse(check?.checkedAt);
  assert(check?.kind === "smoke" && check.state === "ready" &&
    check.settingsVersion === final.version && check.textVerified &&
    check.jsonVerified && age >= 0 && age < 15 * 60000 &&
    check.models.some(m => m.id === "indexus-document-audio:latest" &&
      m.revision && m.outputFormats.includes("text") &&
      m.outputFormats.includes("json_object")), "FINAL_SMOKE_INVALID");
  assert(final.runtime.production && !final.runtime.replit &&
    final.runtime.serverAllowed && final.runtime.tokenConfigured &&
    final.runtime.openaiConfigured && final.runtime.mode === "routed",
    "FINAL_RUNTIME_INVALID");
  console.log(JSON.stringify({
    assessment: "GATEWAY_READY_OPENAI_ACTIVE",
    version: final.version, openai: 65, internal: 0, modelOverrides: 0,
    routeParityVerified: true, textVerified: true, jsonVerified: true,
    checkedAt: check.checkedAt, durationMs: check.durationMs,
    models: check.models, strictJSONSchemaVerified: false,
    rebootTested: false
  }, null, 2));
})();
```

`assessment` je vyhodnotenie tohto bloku, nie existujúci automatický stav
vracaný admin API. Pri chybe HTTP alebo `TEST_NOT_READY…` nepovažovať HTTP 200
z test endpointu za úspech: rozhoduje uložený `gatewayCheck.state`.
Blok pri chybe automaticky nevypína Gateway; použiť kontrolovaný rollback.

Connectivity robí iba discovery. Smoke vykonáva dva POST na
`/gateway/v1/chat/completions`:

- text: presná odpoveď `INDEXUS_TEST_OK`, temperature 0, max_tokens 64;
- `response_format: {type:"json_object"}`: presný objekt
  `{"marker":"indexus-test","sum":5}`, max_tokens 128.

Každé completion volanie najprv znovu overuje discovery. Pri úspechu teda
connectivity + smoke predstavujú 12 Gateway GET a 2 inferenčné POST.
Nie sú použité kontakty, dokumenty, nahrávky, fronty ani produkčné úlohy.
Existujúce OpenAI volania pokračujú; malá záťaž dvoch testov na server/Gateway
však nie je tvrdenie o absolútne nulovom výkonnostnom dopade.

Timeout: discovery 15 s, interný SDK podľa nastavenia 30 s,
celkový testový abort 90 s, retry 0. Tests sa serializujú cez advisory lock
a medzi kontrolami platí cooldown 30 s. HTTP 429 sa neobchádza.

## 8. Chybové a bezpečnostné testy

Živé úmyselné výpadky, zmena tokenu, URL alebo timeoutu v produkčnom INDEXUS
sa na tento cieľ nepoužívajú.

| Scenár | Dôkaz / postup | Očakávanie |
|---|---|---|
| Správny token/TLS | Produkčný preflight a budúci connectivity | Tri HTTP 200, správny kontrakt |
| Nesprávny token, 401/403 | Syntetické adapter testy | Sanitizovaná explicitná chyba, žiadny OpenAI fallback |
| Timeout/abort | Syntetické adapter testy | Ukončenie, nie úspešná odpoveď alebo fallback |
| 429/503/504, malformed/oversized odpoveď | Syntetické adapter testy | Riadená chyba bez tokenu a obsahu |
| Neprihlásený používateľ | Bezpečný GET nižšie, bez session | 401 |
| Neadministrátor | Samostatná bežná prihlásená session, iba GET na admin API | 403 |
| Zastaraná verzia, cooldown, súbeh | Existujúce DB integračné testy v izolovanej testovacej DB; v tomto behu nespustené | 409/429 bez neželanej zmeny |
| Strict JSON Schema, streaming, audio/image | Kontraktové testy | Nepodporované; neoznačovať za otestovanú schopnosť |

Voliteľný živý bezpečnostný GET: v samostatnom anonymnom okne otvoriť
produkčnú prihlasovaciu stránku a v konzole na rovnakej origin spustiť:

```javascript
await (async () => {
  const r = await fetch("/api/configurator/ai", {
    credentials: "omit", redirect: "error", cache: "no-store"
  });
  if (r.status !== 401) throw new Error("EXPECTED_401_GOT_" + r.status);
  console.log("UNAUTHENTICATED_AI_ADMIN_ACCESS_REJECTED");
})();
```

Ak AI tím potrebuje aj živý negatívny Gateway auth/timeout test, pripraviť ho
ako samostatný rozsah. Zelené stubované testy nie sú dôkaz živého odmietnutia
zlého tokenu serverom. Produkčnú konfiguráciu na to neprepisovať.

## 9. Akceptačné kritériá

`GATEWAY_READY_OPENAI_ACTIVE` možno vyhlásiť až po splnení všetkých:

1. Čerstvý predzmenový preflight bol READY a východisko sa nezmenilo.
2. Schválený runtime zásah má overenú súkromnú zálohu a konkrétny rollback.
3. INDEXUS po cielenom reštarte odpovedá, pôvodné prostredie/OpenAI kľúč sú
   zachované; Git HEAD, backend, `.env` a pôvodný token nezmenené.
4. Admin runtime: production true, replit false, serverAllowed true,
   tokenConfigured true, openaiConfigured true, mode routed.
5. Gateway enabled true, schválená URL, žiadne nechcené zmeny jej parametrov.
6. Connectivity aj smoke prešli cez skutočný INDEXUS. Smoke je current-version,
   mladší ako 15 minút, textVerified a jsonVerified true, má skutočnú revíziu
   požadovaného modelu. Výsledok strict JSON Schema sa netvrdí.
7. Pred/po je presná zhoda všetkých 65 service ID a routov: OpenAI, model null,
   enabled true; interné 0 a overrides 0. Nepoužil sa route endpoint.
8. Existuje audit gateway/test_connectivity/test_smoke a správna admin obrazovka.
   Osobné údaje z auditu neposielať do verejného reportu.
9. PM2 dump aj backup sú bez Gateway tokenu, ostatné PM2 procesy nezmenené,
   health check prešiel, boot unit staticky validná a enabled.
10. Report výslovne odlíši neotestovaný reboot a živé negatívne testy od
    toho, čo bolo skutočne preukázané.

Dôkaz, že všetkých 65 služieb ostalo OpenAI, je autoritatívna konfigurácia
a regresné testy routovania. Nie je to 65 platených produkčných inferencií.
Pre skutočnú prevádzkovú požiadavku má log `[AI Router]` uvádzať jej vlastný
service/provider/model; nevyvolávať reálne zákaznícke úlohy iba pre test.

Statická kontrola boot jednotky po realizácii (konzola CORPCRM01):

```bash
sudo systemd-analyze verify /etc/systemd/system/pm2-seman.service
sudo systemctl is-enabled pm2-seman.service
sudo systemctl show pm2-seman.service --property=MainPID --value
```

Očakávanie: verify bez chyby, `enabled`, MainPID `0`, pretože nová jednotka
neprebrala živý PM2 daemon. Živý INDEXUS overuje runtime helper samostatne.
Nepridávať `systemctl start/restart`, `pm2 startup`, všeobecné `pm2 save`,
`pm2 restart all`, `--update-env` alebo reboot.

## 10. PO SCHVÁLENÍ – rollback

Spúšťací dôvod: neúspešná dostupnosť, zmenené OpenAI routy/prostredie,
neúspešné načítanie tokenu, bezpečnostná odchýlka alebo zlyhanie smoke.
Pri incidente najprv zastaviť ďalšie testy a zmeny, ponechať súkromné dôkazy.

### 10.1 Vypnúť iba DB Gateway flag

V prihlásenej admin session produkčného INDEXUS:

```javascript
await (async () => {
  const root = "/api/configurator/ai";
  const read = await fetch(root, { credentials: "same-origin", cache: "no-store" });
  if (!read.ok) throw new Error("ROLLBACK_READ_HTTP_" + read.status);
  const before = await read.json();
  const fingerprint = v => JSON.stringify(v.services.map(s =>
    [s.id, s.route.provider, s.route.model, s.route.enabled])
    .sort((a, b) => a[0].localeCompare(b[0])));
  const expected = fingerprint(before);
  if (before.services.length !== 65 ||
    !before.services.every(s => s.route.provider === "openai" &&
      s.route.model === null && s.route.enabled)) throw new Error("ROUTE_DRIFT_REQUIRES_REVIEW");
  const res = await fetch(root + "/gateway", {
    method: "PUT", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedVersion: before.version,
      gateway: { ...before.gateway, enabled: false }
    })
  });
  if (!res.ok) throw new Error("ROLLBACK_HTTP_" + res.status);
  const after = await res.json();
  if (after.gateway.enabled || fingerprint(after) !== expected)
    throw new Error("ROLLBACK_VERIFICATION_FAILED");
  console.log("GATEWAY_DISABLED_ROUTES_UNCHANGED");
})();
```

Ak API nie je dostupné, najprv obnoviť runtime podľa 10.2 a potom dokončiť
vypnutie DB flagu po návrate aplikácie. Neobchádzať admin prihlásenie.

### 10.2 Obnoviť runtime z konkrétnej overenej zálohy

Presná backup cesta vznikne až po realizácii; dnes ju nemožno pravdivo
predvyplniť. Nasledujúci blok ju načíta z konzoly a obmedzí na schválený
backup root. Dosadiť výhradne `backup` z konkrétneho výsledku helpera,
nikdy automaticky „najnovšiu“ zálohu:

```bash
(
  set -eu
  printf 'Vložte presnú hodnotu backup z výsledku realizácie: '
  IFS= read -r BACKUP
  case "$BACKUP" in
    /var/www/indexus-crm/data/.ai-gateway-private/attempt-*) ;;
    *) printf 'STOP: neplatná backup cesta\n' >&2; exit 1 ;;
  esac
  sudo env -i \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/root /usr/bin/node "$BACKUP/rollback.cjs" \
    --approve CORPCRM01_GATEWAY_ROLLBACK_APPROVED
)
```

Helper kontroluje presnú cestu, práva a manifest aj integritu uloženého
rollback balíka. Obnoví pôvodné argumenty/prostredie procesu, ecosystem
a PM2 dump/backup, cielene reštartuje len INDEXUS, odstráni iba nové vlastné
runtime a boot súbory. Nezastavuje celý PM2 daemon a nevracia Git alebo DB.
Pôvodný token, `.env`, audity a zálohy zachová.

Očakávaný úspech: `ROLLBACK_VERIFIED_OPENAI_ONLY`. Ak v DB zostal Gateway flag,
vráti `ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED`; dokončiť 10.1.
Po rollbacku potvrdiť dostupnosť INDEXUS, 65 OpenAI routov a Gateway off.
Nevykonávať opätovné všeobecné PM2 save, ktoré by prepísalo obnovený dump.

Rollback vracia aj pôvodnú nepreukázanú boot registráciu. Funkčný reboot test
nie je súčasťou tohto schválenia a vyžaduje vlastné servisné okno.

## Záver

Pripravená je integračná implementácia v produkčnom `main`, overený preflight,
oddelený runtime helper a vykonateľný rollback s ochranami. Nie je však ešte
vykonaná runtime inštalácia, skutočná záloha, živý smoke cez INDEXUS alebo
post-restart/UI akceptácia. Preto sa dnes nevyhlasuje cieľový stav.
Ďalším rozhodnutím je schválenie presného rozsahu A/B; nie prepnutie AI routov.
