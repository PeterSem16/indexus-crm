# INDEXUS AI Router – prvá etapa

Tento dokument opisuje prvú etapu. Nadväzujúci
[pripravený interný adaptér](ai-router-phase-2-internal.md) nemení predvolené
OpenAI smerovanie a nie je povolením produkčného nasadenia alebo aktivácie.

## Rozsah

Všetky nájdené odchádzajúce OpenAI SDK operácie prechádzajú cez `server/lib/ai-router.ts`.
OpenAI zostáva jediným povoleným poskytovateľom. Interný server nie je pripojený,
automatický fallback neexistuje. Externý Audio Analyzer 1.6, jeho kontajner,
databáza a spracovanie nahrávok ani Voice Studio sa nemenia.

Router smeruje po účele služby, nie podľa používateľa alebo obsahu požiadavky.
Katalóg `server/lib/ai/service-catalog.ts` viaže každú službu na konkrétnu operáciu:
Chat Completions, Responses, prepis audia, syntézu reči alebo test dostupnosti.
Výsledky SDK, aplikačné validácie a spracovanie nahrávok zostávajú pôvodné.
Webhooky OpenAI Realtime a overovanie ich podpisov sa nemenia: nie sú
odchádzajúcimi SDK volaniami.

## Konfigurácia a prihlasovacie údaje

- `server/config/ai-routing.ts` obsahuje revíziu a serverové prepisy smerovania.
- Predvolené smerovanie každej služby je `{provider: "openai", model: null, enabled: true}`.
- `model: null` znamená presne pôvodný model zo žiadosti, aj keď je dynamický.
- Aktuálna konfigurácia neprepisuje žiadne modely, prompty, timeouty ani retry nastavenia.
- Neznámy poskytovateľ, operácia, služba alebo neznámy konfiguračný atribút sa odmietne.
- Konfigurácia nesmie obsahovať tokeny ani URL. Interný poskytovateľ sa zatiaľ odmieta.
- Jediným miestom čítania `OPENAI_API_KEY` je OpenAI adaptér. Hodnota sa nemení,
  nevkladá do databázy ani neodosiela do klienta.
- Existujúce SDK timeout/retry voľby, RequestOptions, signály, súbory a streamy
  sa zachovávajú. Raw Beratung health-check si zachováva svoje pôvodné HTTP,
  bez-retry a chybové správanie.

Príprava konfigurácie neznamená nové administračné rozhranie. V tejto etape sú
zmeny smerovania kontrolovanými zmenami serverového zdrojového súboru. Budúca
administrácia a interný adaptér sú samostatné etapy.

## Technické logovanie a audit

Pri inicializácii sa zapíše `ai.configuration`: revízia, režim a deterministický
SHA-256 odtlačok celého efektívneho smerovania. Históriu zmeny mapovania a autora
poskytuje Git/review zdrojovej konfigurácie; runtime záznam dokladá, ktorá
konfigurácia bola načítaná. Nejde ešte o online editovanie administrátorom.

`ai.request` obsahuje iba službu, operáciu, poskytovateľa, technický model ID,
vlastný request ID, revíziu/odtlačok konfigurácie, výsledok, čas do HTTP odpovede
a prípadný HTTP status. Tento čas nie je dĺžka prehrávania ani trvanie celého
streamu. Router neloguje prompty, odpovede, prílohy, adresy, tokeny ani surové
chyby poskytovateľa. Nepokúša sa odhadovať náklady alebo chýbajúce tokenové počty.
Existujúce aplikačné chybové vetvy a validácie nie sú nahradené routerom.

Telemetria pozoruje SDK `asResponse()` bez čítania tela a vracia pôvodný
`APIPromise`; zachováva `withResponse()`, binárne odpovede a streamovanie.

## Migrované volania

| Pôvodný súbor | Počet SDK miest | Oblasť |
|---|---:|---|
| `server/routes.ts` | 43 | E-mail/SMS, preklady, NEXUS, dokumenty, hovory, kontakty, reporty |
| `server/inbound-routes.ts` | 3 | IVR a hlasová schránka – syntéza reči |
| `server/template-processor.ts` | 1 | Identifikácia PDF polí |
| `server/lib/automation-analysis.ts` | 1 | Responses API: text, obrázky a PDF |
| `server/lib/automation-routes.ts` | 1 | Návrhy automatizácií |
| `server/lib/beratung-email-service.ts` | 3 | Prepis, analýza a preklad |
| `server/lib/email-monitoring-service.ts` | 1 | Monitoring e-mailov |
| `server/lib/priority-city-ranking.ts` | 1 | Poradie miest |
| `server/lib/queue-engine.ts` | 4 | Prepis a analýza záznamov/odkazov |
| `server/lib/region-suggestion.ts` | 1 | Región a okres |
| `server/lib/representative-region-suggestions.ts` | 1 | Návrh území |
| `server/lib/scraper-ai.ts` | 1 | Extrakcia kontaktov |
| `server/lib/task-ai-checklist.ts` | 1 | Checklist úlohy |
| `server/lib/task-resolution-draft.ts` | 1 | Návrh riešenia úlohy |
| `server/lib/task-sentiment.ts` | 1 | Sentiment úlohy |
| `server/lib/training-room-ws.ts` | 3 | Prepis a preklady tréningu |
| `server/lib/virtual-agent.ts` | 4 | Prepis, dialóg, hlas a súhrn |
| **Spolu** | **71** | |

Ďalšie jedno pôvodné raw HTTP volanie v `server/beratung-routes.ts` je presunuté
pod `aiChatProbe("beratung.health", ...)`. Aj pripravenosť recovery workerov
pre hovory používa centrálnu kontrolu; ich dátové správanie sa nemení.

## Overenie

Spustiť z koreňa projektu:

```bash
bash script/test-ai-router.sh
npm run build
```

Testy routera používajú syntetické dáta a lokálne stubované `fetch`/SDK
rozhrania. Nevolajú OpenAI ani interný server a nemenia žiadne API kľúče.
Pokrývajú Chat Completions, Responses s obrázkom/PDF, multipart audio, binárne
TTS, streamovanie, chyby, abort, timeout/retry konfiguráciu, izoláciu služieb,
odmietnutie nepovoleného poskytovateľa, telemetriu a legacy rollback.

Zdrojový regresný test porovnáva počty a SHA-256 odtlačky všetkých 71 pôvodných
argumentov volania vrátane promptov, modelov a request options. Fixture bola
zachytená pred migráciou. Pri budúcej úmyselnej zmene požiadaviek treba jej zmenu
samostatne skontrolovať; neobnovovať ju len preto, aby test prešiel.

Tento typ testu dokazuje rovnaké požiadavky a kontrakty, nie deterministicky
identické odpovede skutočného LLM. Prihlásené UI a živé produkčné AI operácie
nie sú týmto automaticky overené.

### Samostatné živé overenie v testovacom prostredí

```bash
npx --no-install tsx script/ai-router-live-check.ts --live
```

Príkaz vykoná najviac 10 malých spoplatnených požiadaviek na existujúci
OpenAI adaptér. Používa iba syntetický text, obrázok a PDF; nevytvára CRM
udalosti, nečíta zákaznícke dáta a nepripája databázu. Každý scenár overí
v legacy aj routed režime bez zmeny prostredia bežiacej aplikácie.
Opakovanie nie je súčasťou bežného regresného testu.

Výsledok sa uloží do ignorovaného
`generated-artifacts/ai-router-live-check/report.json`; neobsahuje kľúče,
prompty, obsah odpovedí alebo surové chyby poskytovateľa.
Konkrétne výsledky a hranice overenia sú v
[protokole živého overenia](ai-router-live-acceptance.md).

## Okamžitý rollback bez zmeny databázy

1. V serverovej konfigurácii procesu nastaviť **necitlivú** premennú
   `INDEXUS_AI_ROUTER_MODE=legacy`.
2. Reštartovať iba proces INDEXUS-u so znovunačítaným prostredím.
3. Overiť záznam `ai.configuration` s `mode: "legacy"` a dostupnosť aplikácie.
4. Vyskúšať jednu povolenú syntetickú AI operáciu.

Legacy režim vracia priamo pôvodný OpenAI SDK klient, ignoruje všetky modelové
prepisy/smerovacie nastavenia a nepridáva request telemetriu. Používa rovnaký
existujúci API kľúč, modely a prompty. Je to návrat k pôvodnej ceste poskytovateľa,
nie prepnutie na iného poskytovateľa alebo replay historických operácií.

Na návrat k routeru nastaviť `INDEXUS_AI_ROUTER_MODE=routed` a znovu reštartovať.
Ak problém vyžaduje návrat zdrojového vydania, použiť predchádzajúce overené
vydanie aplikácie; databázu neobnovovať a Audio Analyzer nereštartovať.

Produkčné nasadenie nie je súčasťou samotnej implementácie tejto etapy.
