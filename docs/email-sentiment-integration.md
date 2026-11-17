# email.sentiment – izolovaná integrácia interného modelu

## Rozsah a stav

Pripravený model: `indexus-email-sentiment:4b`. Táto zmena poskytuje izolovanú
integračnú konfiguráciu a bezpečné spracovanie odpovedí; **neaktivuje produkčné
smerovanie**. Nemení uložené AI nastavenia, produkčný token, PM2, databázovú
schému ani model, prompt alebo 120-sekundový profil `email.monitoring`.

Hlásené výsledky AI tímu (17 PASS, 1 REVIEW_REQUIRED, 0 FAIL) sú výsledky
lokálneho adaptéra na AI serveri. Nie sú výsledkom živého testu cez INDEXUS.

Používateľ prijal následný regresný balík **80 PASS / 0 FAIL / 0 SKIP**.
Aktuálny ďalší krok je iba návrh izolovaného HTTPS pripojenia a
sekvenčnej regresie; konkrétna trasa ešte nie je schválená ani vytvorená.
Fáza B a produkčná aktivácia nie sú povolené. Úplný aktuálny postup je v
`docs/email-sentiment-test-proposals.md`.

## Komunikačná cesta

Existujúci CRM analyzátor → AI Router (`email.sentiment`) → interný SDK
adaptér → autentifikovaná kanonická HTTPS Gateway → adaptér AI servera →
Ollama → OpenAI-kompatibilný obal → striktný CRM parser → obchodná vetva.

Kanonická base URL zostáva `https://ai.cordbloodcenter.com/gateway/`.
Existujúci adaptér overuje `health/ready`, `v1/models` a
`indexus/v1/capabilities` pred odoslaním `v1/chat/completions`. Lokálne
`http://127.0.0.1:8792` a `/health` patria výhradne AI serveru; nie sú novou
adresou ani readiness kontraktom CRM.

Pre izolovaný budúci test je navrhnutá samostatná in-memory base URL
`https://127.0.0.1:28443/` na CORPCRM01 cez SSH k loopback TLS vstupu
18443 pred testovacou Gateway 8771 na AI serveri. Ide o návrh, nie
existujúci endpoint alebo zmenu kanonickej produkčnej base URL.

Prístup používa existujúcu serverovú Bearer autentifikáciu. Presmerovania sa
nesmú nasledovať. Token, obsah správ a surové chybové odpovede sa nezapisujú
do nových diagnostík. Interné zlyhanie nevyvolá externý cloud fallback.

## Povolenie a parametre

- Nový model sa povoľuje výhradne službe `email.sentiment`, nikdy globálne
  alebo pre `email.monitoring`, SMS či inú službu.
- Testovacia konfigurácia vytvorí vlastný Router v pamäti, používa len
  syntetický token a vyžaduje explicitne dodaný transport. Nečíta ani
  nezapisuje nastavenia produkčného Routera.
- Pôvodný CRM prompt, predspracovanie, základný model OpenAI a vstupné správy
  sa zachovávajú. Len zvolený interný profil používa nový model,
  `temperature: 0.1`, `max_tokens: 300`, `response_format: json_object`
  a `stream: false`.
- Deadline pre interné volanie `email.sentiment` je najviac **30 000 ms**,
  zdieľaný discovery, inferenciou a čítaním odpovedí. Kratší limit volajúceho
  ostáva kratší. Dlhší managed alebo request timeout ho nepredĺži.
- Automatické retries sú vypnuté, aj keď ich globálne nastavenie alebo
  volajúci skúša povoliť. Timeout nevyvolá náhradnú klasifikáciu.
- Thinking musí vypnúť adaptér/Gateway na AI serveri. CRM si nevymýšľa
  nepodporovaný OpenAI parameter a netvrdí, že stav upstreamu overilo.
  Rovnako musí AI tím potvrdiť svoj interný 25-sekundový timeout Ollama.

## Deväťpolový kontrakt

| Pole | Typ / hodnoty |
|---|---|
| sentiment | positive, neutral, negative, angry |
| hasInappropriateContent | boolean |
| hasAngryTone | boolean |
| hasRudeExpressions | boolean |
| wantsToCancel | boolean |
| wantsConsent | boolean |
| doesNotAcceptContract | boolean |
| alertLevel | none, warning, critical |
| note | neprázdny text, požadovaný slovenský jazyk; pôvodný kontrakt neobsahuje nový 100-znakový limit |

Gateway sa musí zosúladiť s pôvodným kontraktom bez orezávania poznámok.
Aktuálny CRM validátor má ochrannú hranicu 1000 znakov a vstupný limit
32768 znakov; ide o existujúce správanie parsera, nie o novo schválené
obchodné obmedzenie Gateway. V tejto dokumentačnej úlohe sa nemení.
Nový limit sa nezavádza bez dohody. Pred živým testom AI tím doloží
zachovanie platnej poznámky nad 100 znakov bez skrátenia.

Chýbajúce polia, polia navyše, alias `wantsCancel`, nesprávne typy,
neplatné hodnoty a neplatný JSON sa odmietajú. Nepridávajú sa predvolené
hodnoty. Pôvodná kompatibilita s kompletným markdown JSON blokom v OpenAI
odpovedi zostáva; interný JSON režim navyše overuje Gateway obal a ukončenie
`finish_reason: stop`.

Parser overuje štruktúru, nie pravdivosť modelového záveru alebo slovenský
jazyk prirodzeného textu. Sémantika a jazyk vyžadujú samostatné posúdenie
skutočných modelových výstupov; textové heuristiky ho nenahrádzajú.

## REVIEW_REQUIRED a technické chyby

Iba odpoveď na inferenciu tohto service/model páru so stavom HTTP 422 a
oboma položkami `error.code` a `error.type` presne `review_required`
sa mapuje na:

```json
{"status":"review_required","code":"review_required","reason":"possible_prompt_injection_affected_consent_classification"}
```

Známy dôvod sa zachováva bezpečným strojovým kódom. Pripravená kompatibilita
rozpozná presnú správu z odovzdania aj rovnaký explicitný `reason_code`.
Neznámy dôvod má hodnotu `unspecified`; nesmie sa vymyslieť ani preniesť
surový upstream text, ktorý môže obsahovať zákaznícke údaje.
Telo je ohraničené na 8192 bajtov. Všeobecná
422, chýbajúci typ, chyba discovery alebo rovnaký text pri inom HTTP stave
nie sú týmto výsledkom. Ostatné služby zachovávajú pôvodné spracovanie chýb.

Neplatná klasifikácia alebo komunikácia vrátia samostatný výsledok
`status: failed`. Žiadny z týchto stavov nie je deväťpolová klasifikácia.
Existujúca obchodná vetva akceptuje výhradne úspešne validovaný výsledok
bez chybového `status`; nevykoná klasifikačné zápisy, pipeline prechody
ani naviazané obchodné akcie pri zlyhaní.

Týmto nevzniká nový Back Office workflow ani automaticky vytvorená úloha
na manuálne posúdenie. Odovzdáva sa explicitný neúspešný stav a bezpečný
diagnostický kód; nejednoznačný výsledok sa nesmie následne schváliť automaticky.

## Reprodukovateľné testovanie

```bash
npx tsx --test server/lib/ai/email-sentiment.test.ts
```

Test spúšťa reálny Router, SDK, natívny Node fetch, lokálny HTTP fixture server,
striktný parser a pôvodnú obchodnú vetvu vybranú z aktuálneho zdroja.
Vymenený je len sieťový transport do syntetickej Gateway a modelové odpovede.
Nevykonáva požiadavky na živú Gateway/Ollama, nepoužíva skutočné tokeny
a nespúšťa obchodné zápisy.

Testy zahŕňajú všetkých deväť polí, starší osempoložkový fixture korpus
aj pôvodných 18 dodaných prípadov s čiastkovými referenciami,
REVIEW_REQUIRED, chyby autentifikácie, nesprávny JSON
a obal, skrátenú odpoveď, sieťové zlyhanie, presmerovanie, prekročenie limitu,
izoláciu modelov a zachovanie historického čistého parser replay.
**Korpus overuje integračný kontrakt, nie presnosť živého modelu.**

Súbežný fixture test overuje oddelenie úspechu, súhlasu a manuálneho posúdenia,
nie kapacitu zdieľaného živého Ollama. Simulácie výpadku adaptéra a Ollama
nemenia dostupnosť skutočných služieb.

Samostatný reálny časový test zdrží readiness o 8 sekúnd a potom inferenciu
o 25 sekúnd. Klient musí skončiť pri jednom spoločnom 30-sekundovom deadline,
nie až po súčte týchto časov alebo po novom limite pre každý endpoint.
Obmedzenie klienta samo osebe nepreukazuje ukončenie výpočtu v Ollama.

## Podmienky živého overenia a prevádzky

1. AI tím musí doložiť nový model cez schválenú izolovanú testovaciu
   Gateway vrátane discovery/capabilities, autentifikácie, note kontraktu,
   vypnutého thinking a nulových upstream retries. Nevystavovať ho kvôli
   testu na produkčnej Gateway 8770 a neotvárať CRM priamy port 8792/Ollama.
2. Na AI serveri pripraviť samostatnú spravovanú službu s obmedzenými
   oprávneniami, chráneným naslúchaním, riadeným reštartom, readiness,
   bezpečnými logmi a alertmi. Ručne spustený Python nie je tento dôkaz.
3. Po schválení konkrétnej trasy vykonať technický preflight bez inferencie
   z CORPCRM01 cez schválený serverový credential loader. Token neposielať
   do Replitu, nevypisovať a nemeniť produkčné `.env`, PM2 ani uložené routy.
4. Po preflight a splnení produkčných bezpečnostných podmienok použiť
   izolovanú inštanciu Routera na presne 18 sekvenčných prípadov, bez
   opakovaní, zahrievacích volaní, fallbacku alebo fázy B. Porovnať raw
   JSON a parser, manuálne posúdiť slovenské poznámky a časy vrátane
   discovery; nemenia sa očakávania podľa odpovedí.
5. Osobitne doložiť nulové obchodné akcie pri REVIEW_REQUIRED a chybách,
   žiadne retries/fallback a nezmenené produkčné nastavenia pred a po teste.
6. Živý výsledok a prevádzkovú pripravenosť predložiť používateľovi.
   **Ani úspešný test nepovoľuje aktiváciu produkčného smerovania.**

Z Replitu nie je povolený interný sieťový prístup a lokálny test nemôže
potvrdiť stav AI servera. Pri absencii živých dôkazov zostáva výsledný stav
**pripravené na izolované živé overenie, nie produkčne schválené**.
