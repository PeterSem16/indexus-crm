# B1 — izolovaná integrácia Email Monitoring

## Rozsah a stav

Pripravený profil iba pre `email.monitoring`:

| Parameter | Hodnota |
|---|---|
| Endpoint | `http://10.9.2.140/gateway/v1/chat/completions` |
| Model | `indexus-email-monitoring:v1` |
| Temperature | `0.1` |
| Max tokens | `200` |
| Response format | `json_object` |
| Streaming | `false` |
| Autorizácia | existujúci serverový Bearer token; nemení sa |

**Produkčné smerovanie sa touto zmenou neprepína.** Predvolená mapa routov
ostáva prázdna (65 služieb na OpenAI); predvolené zapnutie Gateway je false.
Neukladá sa interný route, žiadne DB nastavenie ani nová hodnota prostredia.
Priradenie nového modelu je pripravené ako oddelený profil a používa sa v
injektovanom izolovanom routeri, nie v produkčnom singleton-e.

Živý výsledok modelu možno potvrdiť až zo serverového `evidence.json`.
Úspešné simulované testy NIE SÚ dôkaz správnej sémantiky lokálneho modelu.

## Implementácia

- Existujúci override provider/model sa zachováva. Interný adaptér dostáva
  overiteľný kontext služby priamo z routera. Nový model je v allowliste len
  pre `email.monitoring`, nie pre iné služby či neviazaný priamy klient.
- Profil nastaví uvedený endpoint a wire parametre iba pre tento model
  v tejto službe. Globálne parametre ani endpoint sa nemenia. Iné interné
  služby zostávajú na pôvodnej HTTPS ceste a pôvodnom modeli.
- HTTP je explicitná výnimka pre presný súkromný endpoint; prenos nie je
  šifrovaný. Redirecty sú zakázané. Nejde o všeobecné povolenie HTTP,
  vypnutie TLS kontroly ani prístup na Audio Analyzer/Ollama.
- Pôvodný systémový prompt aj celý pôvodný SDK request v monitoringovej
  službe ostávajú bajtovo nezmenené. Wire JSON formát a model aplikuje iba
  interný adaptér; OpenAI request sa nemení.
- Pred uložením sa striktne vyžaduje všetkých 9 existujúcich polí, správne
  boolean hodnoty, povolené enumy a najviac 100 znakov poznámky. Chýbajúce
  hodnoty sa nedopĺňajú vymyslenými neutrálnymi výsledkami.
- Používateľská schránka ukladá mapované AI polia a kompletný deväťpoložkový
  snapshot do metadata. Systémová schránka robí atomický JSON merge metadata,
  aby neprepísala údaje schránky/kontaktu alebo súbežnú nesúvisiacu zmenu.
  Netreba novú DB tabuľku ani stĺpec.
- Konfigurátor ponúka nový model len pri `email.monitoring`; pred schválením
  nič neukladá. Prepnutie vyžaduje aktuálne overenie presne zvoleného modelu.
  Starý smoke test dokumentového modelu nový model neautorizuje.
- Nepridáva sa cloud fallback. Pri chybe adaptér vyvolá sanitizovanú chybu;
  existujúce mailbox vetvy ju zachytia, nevymyslia analýzu a neodošlú obsah
  automaticky inému poskytovateľovi.

## Vykonané a pripravované testy

### Integračné testy vo vývoji

```bash
node --import tsx --test \
  server/lib/ai/email-monitoring-b1.test.ts \
  server/lib/ai/internal-adapter.test.ts \
  server/lib/ai/settings.test.ts \
  server/lib/ai-router.test.ts \
  server/lib/ai-router-coverage.test.ts
```

Nové testy vykonávajú pôvodnú monitoringovú funkciu extrahovanú AST postupom,
skutočný router a adaptér. Gateway transport je simulovaný. Overujú presnú
cestu, nezmenený prompt, scope modelu, parametre a zákaz fallbacku.
HTTP 401/403/429/500/504, neplatný JSON, neúplný kontrakt, nesprávne typy,
chýbajúci model a nedostatočný discovery limit sú explicitné negatívne prípady.

Databázový test používa **skutočný PostgreSQL** a rovnaký mapper/JSON merge
ako produkčný kód, ale iba dočasnú `pg_temp` tabuľku v transakcii. Overí
osobný insert aj systémový update, deväťpoložkový snapshot, true/false hodnoty
a zachovanie ostatných metadata. Nakoniec vykoná ROLLBACK. Nevytvára CRM
kontakty, správy, notifikácie ani udalosti.

Celá migrácia má naďalej prejsť kontrolou 71 pôvodných SDK requestov pre všetkých
65 služieb. Mailbox synchronizácia, priradenie skutočného zákazníka, doručovanie
a celá produkčná slučka sa týmto dočasným DB testom netestujú.

### Živý test z CORPCRM01

Z Replitu sa k internému modelu nepristupuje. Samostatný balík sa pripraví:

```bash
node script/ai-email-monitoring-b1/package.cjs \
  generated-artifacts/ai-email-monitoring-b1/novy-sukromny-balik
```

Balík obsahuje `run-b1.cjs` a `manifest.json`. Nejde o produkčné nasadenie.
Nepotrebuje nový token ani inštaláciu balíkov; používa existujúce závislosti
z `/var/www/indexus-crm/node_modules`. Celý TypeScript parser na extrakciu
zdroja je zabalený, netreba `npx` ani sťahovanie závislostí.

Po prenesení a rozbalení do `$HOME/indexus-email-monitoring-b1` spustiť ako
existujúci používateľ `seman` na CORPCRM01:

```bash
cd /var/www/indexus-crm
node --require /etc/indexus-ai-runtime/preload.cjs \
  "$HOME/indexus-email-monitoring-b1/run-b1.cjs" --run-b1
```

Existujúci preload bezpečne dodá runtime token. Token sa nikdy nevypisuje;
neprepisovať `.env`, PM2 ani konfiguráciu Gateway. Výstup vráti iba
`B1_RESULTS <súkromná cesta>/evidence.json` a stručný bezpečný súhrn.
Vrátiť tento JSON alebo súhrn, nie súbor s prihlasovacími údajmi.
Ak preload chýba alebo token nie je dostupný, ide o blokátor; žiadny token
negenerovať, neposielať do chatu ani obchádzať kontrolu.

Runner:

1. Overí host, UID, pôvodný request/prompt a zakáže zníženie TLS ochrany.
2. Read-only dotazom uloží verziu a hash celej produkčnej AI konfigurácie.
   Pred testom vyžaduje vypnutú Gateway a 65 nezmenených OpenAI routov.
3. Použije existujúci token iba v injektovanom testovacom adaptéri.
   Autoritatívny produkčný router ani DB konfiguráciu nemení.
4. Vykoná 8 anonymných syntetických prípadov. Rozlišuje žiadosť o potvrdenie
   prijatia, potvrdenie prijatia, skutočný súhlas, odmietnutie, zrušenie,
   odložené rozhodnutie a citovaný súhlas bez vlastného súhlasu.
5. Použije dohodnuté readiness/models/capabilities kontrakty aj na tejto
   Gateway ceste. Ak nový model nie je deklarovaný alebo limit nestačí,
   bezpečne zastaví pred inferenciou; nezníži 200 ani nezmení model.
6. Uchová samostatne request, modelový obsah, adaptér, parser, deklarované
   limity a výsledky sémantických kontrol. Neukladá hlavičky ani raw výnimky.
7. Overí mapovanie výsledkov cez dočasný PostgreSQL insert/update, potom
   rollbackne. Žiadny nový trvalý CRM záznam.
8. V `finally` znovu read-only overí rovnakú verziu a hashe konfigurácie.
   Úspech vyžaduje `passed=true` aj `finalVerified=true`, Gateway=false,
   OpenAI=65 a úspech všetkých 8 sémantických prípadov.

Sekvenčný beh má najviac 8 inferencií, bez SDK retry. Chyba Gateway/parsera/
DB ho zastaví, čiastkové dôkazy sa zachovajú. Rovnaký pripravený test má
jednorazový marker; `B1_RUN_ALREADY_STARTED` sa automaticky neobchádza.
Tri chybové HTTP skúšky v reporte sú označené ako simulované; na AI server
sa kvôli nim neposielajú požiadavky a nezapína sa umelý výpadok.

## Rozhodnutie po teste

Ani `passed=true` nepovoľuje produkčné prepnutie. Treba samostatné schválenie
konkrétneho route, cieľového modelu, endpointu, overenia a rollbacku.
Táto etapa nepridáva API, ktoré by samotný výsledok izolovaného testu
automaticky premenilo na povolenie produkcie. Globálny smoke test pôvodného
modelu zostáva nedostatočný pre nový model.
