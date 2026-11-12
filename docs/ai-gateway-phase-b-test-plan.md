# INDEXUS AI Gateway – plán prípravy fázy B

**Stav: pripravená a lokálne otestovaná príprava. Produkčná fáza B sa
NEVYKONALA a vyžaduje samostatné výslovné schválenie.**

Tento plán nadväzuje na úspešnú fázu A:
`RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS`. Reboot, prihlásené
produkčné AI rozhranie, Gateway UI konektivita ani inferencia nie sú
výsledkom fázy A.

## Cieľ a hranice

- Overiť administrátorské rozhranie a integračné kontroly Gateway na CORPCRM01.
- Ponechať všetkých 65 routov na ich pôvodnom poskytovateľovi OpenAI.
- Neprepínať žiadnu službu na `internal`, nemeniť jej model ani enabled stav.
- Nepovoliť Gateway automaticky a nespoliehať sa na fallback do OpenAI.
- Použiť výlučne syntetické, nefiremné vstupy.
- Bez nasadenia kódu, reštartu INDEXUS/PM2, zmeny procesu ani rebootu.
- Žiadny test ani diagnostiku z Replitu proti produkčnej Gateway.
- Po testovacom okne Gateway v administrátorskej konfigurácii opäť vypnúť.

## Overená cesta a rozhranie

- Administrátor: **Konfigurátor → AI**, priama cesta
  `/configurator?tab=ai`.
- Načítanie: `GET /api/configurator/ai`.
- Uloženie Gateway nastavení:
  `PUT /api/configurator/ai/gateway`.
- Ručne spustený test:
  `POST /api/configurator/ai/test`, s `kind=connectivity` alebo `kind=smoke`.
- Služby v tom istom formulári sa ukladajú samostatne cez
  `PUT /api/configurator/ai/route`. V tejto fáze tento endpoint nepoužívať.
- Server vyžaduje prihlásenie a pri každom volaní znovu kontroluje aktívneho
  administrátora. Očakávané odmietnutia sú 401 pre neprihláseného a 403 pre
  neadministrátora.

Pri otvorení záložky a automatickom 10-sekundovom obnovení sa načítava iba
konfigurácia, výsledky a audit; neodosielajú sa požiadavky na Gateway.
Token sa v API/UI neposkytuje, viditeľný je iba príznak `tokenConfigured`.
Audit obsahuje interné ID aktéra; do reportu ani obrázkov ho nekopírovať.

## Testovacie fázy a vedľajšie účinky

| Krok | Test | Produkčné účinky | Očakávaný výsledok |
|---|---|---|---|
| B0 | Prihlásený administrátor otvorí záložku AI; prečíta Gateway, runtime, režim a všetkých 65 služieb | GET, no-store, opakovaný GET približne každých 10 s; bez Gateway/AI volaní a bez zmien | Gateway DB nastavenie `enabled:false`; všetkých 65 routov na OpenAI; 0 interných a 0 modelových overrides; produkčný runtime, server gate a nakonfigurovaný token; žiadne otvorené neuložené zmeny |
| B1 | Administrátor uloží iba Gateway `enabled:true`, ponechá ostatné hodnoty nezmenené | DB zápis: nová verzia, auditná udalosť; invaliduje starý Gateway check; bez inferencie a bez zmeny routov | Gateway diagnostic gate je otvorený len počas testovacieho okna; služby zostávajú na OpenAI |
| B2 | Ručne spustí `connectivity` | 3 Gateway GET: `health/ready`, `v1/models`, `indexus/v1/capabilities`; uloží kontrolu a audit, bez inferencie | HTTP 200 s platným TLS bez redirectov; presný model `indexus-document-audio:latest`; text a `json_object`; výsledok `ready` |
| B3 | Zastavenie a kontrola výsledku B2 | Žiadne ďalšie volanie ani zápis | Zaznamenať iba bezpečné metadáta. Pred inferenciou vyžiadať osobitné výslovné schválenie syntetického smoke testu. |
| B4 | Po schválení spustiť `smoke` | Dve skutočné syntetické inferencie: jedna plain text a jedna `json_object`. Súkromná implementácia môže medzi nimi opakovane objaviť model a schopnosti; nepočítať len dva HTTP requesty. Môžu vzniknúť poplatky alebo serverové metadáta. | `ready`, text aj JSON overené, správny model a formáty; iba syntetické výsledky, bez obsahu odpovede v reporte |
| B5 | Uložiť presne `Gateway enabled:false` s najnovšou verziou | DB zápis a audit; vymaže aktuálny Gateway check z live view, auditné udalosti zostanú; žiadne inferencie | Opätovne načítať konfiguráciu a potvrdiť Gateway off, 65 OpenAI, 0 internal, 0 overrides |
| B6 | Záverečný report a stop | Bez ďalšej zmeny | Priložiť redigovaný dôkaz B0–B5; nepokračovať na pilotnú službu ani routovanie |

### Dôležitý rozdiel: konfigurácia Gatew​ay verzus routovanie

V B1 sa dočasne zmení Gateway prepínač v databáze. To je **zápis produkčnej
konfigurácie**, hoci sa nemení žiadny z 65 routov a používateľské AI služby
zostávajú na OpenAI. Kým sú všetky routy na OpenAI, bežné volania služieb
nemajú byť poslané internému adaptéru. Zapnutie diagnostickej brány však
otvorí možnosť explicitne poslať testovacie požiadavky, preto ide o
produkčný zásah a patrí až do schválenej fázy B.

Prepnutie route na `internal`, zmena OpenAI modelu, zmena enabled stavu služby
a endpoint `/api/configurator/ai/route` sú mimo tohto plánu. Smoke test
nevytvára oprávnenie na routovanie: backend vyžaduje nový explicitný zápis
route, potvrdenie administrátora a čerstvý úspešný smoke.

## Stop pravidlá

1. **Pred B1:** ak nie je nezávisle potvrdený aktívny administrátor, Gateway
   je už zapnutá, routy sa odlišujú od schváleného východiska alebo existujú
   neuložené úpravy, neukladať nič; zaznamenať bezpečný stav a zastaviť.
2. **Pred B4:** aj pri úspešnej konektivite sa zastaviť a vyžiadať nové
   osobitné schválenie dvoch inferencií. Môžu byť spoplatnené.
3. Pri 401/403, 409 verziového konfliktu, 429 zámku/cooldownu, chybe TLS,
   timeoute, chýbajúcom modeli/formáte alebo inom neúspešnom teste:
   neopakovať v slučke, nemeníť token ani runtime environment, neprepínať
   službu na iného poskytovateľa. Bezpečne zaznamenať iba error code, fázu
   a čas.
4. Po chybe alebo úspešnom smoke obnoviť Gateway `enabled:false` cez
   administrátorské rozhranie s aktuálnou verziou. Pri konflikte verzií
   nenačítavať celý starý formulár a neprepisovať súbežné zmeny; zastaviť
   sa a vyžiadať operátora.
5. Ak je pred ukončením akýkoľvek route `internal` alebo nie je potvrdených
   všetkých 65 OpenAI routov, ukončiť testy a eskalovať; automatický cloud
   fallback sa nepredpokladá. Nedostupnosť interného provideru sa nesmie
   považovať za dôvod na tiché presmerovanie.
6. Po B5 zastaviť. Žiadny pilot, route mutation, ďalší Gateway test, reboot
   alebo nasadenie bez nového konkrétneho schválenia.

### Bezpečné chybové scenáre

- **Neplatná autentifikácia:** v lokálnych testoch sa preverí stubovaná 401
  bez výpisu tokenu/odpovede. Prípadná produkčná požiadavka s úmyselne
  neplatným testovacím Bearer tokenom je samostatné volanie na Gateway,
  môže sa zapísať do serverového logu a vyžaduje explicitné zahrnutie do
  budúceho schválenia. Nemení sa skutočný secret.
- **Nedostupná Gateway, 5xx a timeout:** simulovať iba lokálnym transportným
  stubom. Produkčnú Gateway nezastavovať, neblokovať sieť a nemeníť DNS,
  Nginx, token ani runtime env.
- **Fail-closed bez fallbacku:** lokálne overiť, že interná chyba nevykoná
  požiadavku OpenAI. Pri plánovaných produkčných testoch sa neroutuje žiadna
  služba interne, takže výpadok testov nesmie zmeniť jej provider.
- **Syntetický payload:** plain text presná značka
  `INDEXUS_TEST_OK`; JSON iba `{"marker":"indexus-test","sum":5}` z výpočtu
  `2 + 3`. Nepoužiť zákaznícke, zdravotné, firemné ani reálne texty.

## Dôkazy v záverečnom reporte

Zaznamenať bezpečne:

- UTC čas, výsledok jednotlivých krokov a redigovaný error code pri zlyhaní;
- pred/po počet routov podľa providera a počet modelových overrides;
- Gateway stav pred testom, počas schváleného okna a po vypnutí;
- model/revíziu/formáty bez tokenu, URL query, raw odpovede a promptu;
- pri smoke iba `textVerified`, `jsonVerified`, trvanie a čas kontroly;
- verziu konfigurácie, bez actor ID a obsahu auditných payloadov;
- potvrdenie, že žiadna služba nebola zmenená, že sa nevykonal OpenAI test,
  reštart, reboot ani pilotné routovanie.

Pri disable sa Gateway check v live konfigurácii invaliduje; akceptačné
metadáta úspešného smoke preto bezpečne zaznamenať pred B5. Auditné udalosti
majú zostať zachované.

## Pripravené lokálne testy

Všetky nižšie uvedené kontroly boli spustené v Replite. Dev DB test používa
izolovanú dočasnú schému a v teste explicitne blokuje provider fetch.
Ostatné Gateway/AI testy používajú syntetické odpovede; netestujú produkčnú
Gateway a nie sú produkčnými preflightmi.

```bash
npm run test:ai-settings
npm run test:ai-settings-ui
bash script/test-ai-router.sh
npx --no-install tsc --noEmit -p script/tsconfig.ai-settings.json
node --test script/check-ai-gateway-network.test.cjs
```

### Výsledky lokálneho overenia

- `test:ai-settings`: **49/49**, vrátane izolovanej development DB/HTTP
  s administrátorskou autorizáciou, konfliktmi, auditom, cooldownom,
  lockom a zákazom provider calls vo fixtures.
- `test:ai-settings-ui`: úspešný; prešiel test skutočného React komponentu
  s API stubmi, vrátane nulových automatických testov pri otvorení,
  discovery/inference brány, confirmation/Escape, 390 px a dark rendering.
- `script/test-ai-router.sh`: **105/105**, bez preskočených testov;
  všetky provider transporty sú stubované.
- typová kontrola `script/tsconfig.ai-settings.json`: exit 0.
- sieťový probe test: **3/3**; volania `curl`, `hostname`, DNS a route sú
  lokálne mockované, produkčného sieťového volania nebolo.
- Spolu **157 unit/integration testov** prešlo; UI harness a typová kontrola
  prešli samostatne.

## Miesta v zdrojovom kóde

- UI: `client/src/components/configurator/AISettingsTab.tsx`
- API a testy: `server/lib/ai/settings-controller.ts`,
  `server/lib/ai/settings-check.ts`, `server/lib/ai/settings-policy.ts`
- Admin autorizácia: `server/lib/ai/settings-authorization.ts`
- Reálna DB integrácia testovaná iba v dev: `server/lib/ai/settings-routes.db.test.ts`
- Syntetické Gateway/router testy:
  `server/lib/ai/settings.test.ts`,
  `server/lib/ai/internal-adapter.test.ts`,
  `client/src/i18n/ai-settings-translations.test.ts`
- Syntetický UI harness: `script/test-ai-settings-ui.cjs`
- Operator-only diagnóza: `script/check-internal-ai-gateway.ts`;
  **nespúšťať v Replite**.

**Príprava je dokončená; produkčná fáza B nie je vykonaná ani schválená.**
