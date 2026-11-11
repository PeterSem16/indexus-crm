# INDEXUS AI Gateway – schválený kontrakt pre textové služby

**Stav: kontrakt používateľ schválil. Nie je to potvrdenie nasadeného servera.**

Na interné AI sa dostane **iba CORPCRM01, nie Replit**. Gateway bude samostatná
služba nad Ollama. Začiatočný model je `indexus-document-audio:latest`;
jeho dostupnosť a schopnosti sa ešte musia reálne overiť. Strict JSON Schema
nie je zatiaľ schválená schopnosť.

| Služba | Port | Hranica |
|---|---|---|
| Ollama | 11434 | Lokálny backend, nie priamy cieľ CRM adaptéra |
| Audio API | 8765 | Existujúcich šesť audio endpointov; nemení sa |
| Testovacie Audio API | 8766 | Rovnaká audio sada; nemení sa |
| Audio Analyzer | 8780 | Existujúce webové rozhranie; nemení sa |
| AI Gateway | 8770 iba návrh | Samostatná nová služba; port/TLS treba potvrdiť |

Model, sieťová cesta, port a HTTPS sa overia výhradne z príslušnej serverovej
siete. Z Replitu sa neskenujú interné porty ani neskúša súkromná adresa.

Cieľ je pripojiť prvé interné textové modely cez INDEXUS adaptér. Gateway nemusí
napodobňovať Responses, PDF, obrázky, prepis, syntézu reči ani celé OpenAI API.
Existujúce služby zostávajú na OpenAI až do samostatného prepnutia a overenia.

## Zodpovednosti

- INDEXUS: autorizácia zdroja, výber služby/modelu, mapovanie požiadavky,
  validácia výsledku, timeout/abort, technická telemetria a audit smerovania.
- Gateway: overenie servisného tokenu, povolený model, jeho reálna pripravenosť,
  inferencia a pravdivé informácie o podporovaných schopnostiach.
- Výstup z modelu je nedôveryhodný obsah, nie oprávnenie vykonať CRM akciu.
- Bez implicitného externého fallbacku, automatickej zmeny modelu alebo
  spätného prehrávania historických analýz.

## Sieť a autentifikácia

Adresu `10.9.2.140` zatiaľ berieme iba ako identifikáciu plánovaného servera.
Port, úplná base URL, DNS, TLS certifikát a sieťová cesta **nie sú potvrdené**.
Nevychádzať z predpokladu HTTP/80. Gateway volá iba backend INDEXUS-u,
nikdy priamo prehliadač alebo mobilný klient.

Navrhovaná autentifikácia: `Authorization: Bearer <service-token>`, aj pre
testovacie/discovery endpointy. Skutočný token sa poskytne cez bezpečné úložisko,
nikdy cez chat, Git alebo bežnú databázovú konfiguráciu. Testovanie a produkcia
majú samostatné poverenia. Existujúci OpenAI kľúč sa nemení.

Po odsúhlasení sa môže použiť názov serverovej premennej
`INDEXUS_AI_GATEWAY_TOKEN` pre secret a `INDEXUS_AI_GATEWAY_BASE_URL` pre URL.
Tento dokument ich nevytvára ani neaktivuje.

Spojenie sa musí overiť zo siete, kde beží príslušný INDEXUS backend. Dostupnosť
z iného stroja nepreukazuje dostupnosť z CORPCRM01. Test z Replitu sám osebe
nemôže dokázať produkčnú smerovateľnosť súkromnej adresy.

## Dohodnuté endpointy

| Metóda a cesta | Účel |
|---|---|
| `GET /health/ready` | HTTP 200 iba pri pripravenosti; inak 503 |
| `GET /v1/models` | OpenAI-style zoznam povolených textových modelov |
| `GET /indexus/v1/capabilities` | Explicitný kontrakt schopností a limitov podľa modelu |
| `POST /v1/chat/completions` | Textové požiadavky a odpovede v kompatibilnom formáte |

Cesty sú dohodnuté pre novú Gateway; nepatria k existujúcemu Audio API.

### Schopnosti modelov

Ilustračná odpoveď, nie tvrdenie o existujúcich modeloch:

```json
{
  "apiVersion": "1",
  "models": [
    {
      "id": "example-text-model",
      "revision": "immutable-serving-revision",
      "operations": ["chat.completions"],
      "inputModalities": ["text"],
      "outputFormats": ["text", "json_object"],
      "streaming": false,
      "maxInputTokens": null,
      "maxOutputTokens": null
    }
  ]
}
```

`null` znamená nezistený limit, nie neobmedzenú kapacitu. Model ID je stabilný;
revízia identifikuje konkrétny model/serving konfiguráciu. Discovery záznam nie
je dôkaz úspešného testu a nesmie sám zapnúť službu v INDEXUS-e.

`json_schema`, streamovanie, nástroje a multimodalita sa nesmú inzerovať bez
implementácie a testov. Prompt „vráť JSON“ sám osebe nezaručuje strict JSON Schema.

### Textová požiadavka

```json
{
  "model": "example-text-model",
  "messages": [
    {"role": "system", "content": "Return only a JSON object."},
    {"role": "user", "content": "Synthetic integration check."}
  ],
  "temperature": 0,
  "max_tokens": 256,
  "response_format": {"type": "json_object"},
  "stream": false
}
```

Prvá integrácia podporuje textový obsah rolí system/user/assistant. Pri každom
parametri musí byť dohodnuté, či je podporovaný. Nepodporované hodnoty sa
odmietnu; nesmú byť potichu ignorované alebo nahradené.

### Textová odpoveď

```json
{
  "id": "gateway-generated-request-id",
  "object": "chat.completion",
  "model": "example-text-model",
  "choices": [
    {
      "index": 0,
      "message": {"role": "assistant", "content": "{\"ok\":true}"},
      "finish_reason": "stop"
    }
  ]
}
```

`finish_reason` musí rozlišovať dokončenie od skrátenia. `usage` sa môže pridať,
ak sú počty skutočne známe; nesmú sa vymýšľať tokeny alebo náklady. Aplikačný
JSON sa validuje na strane INDEXUS-u aj pri platnej HTTP odpovedi.

## Chyby a prevádzka

- 401: neplatná/chýbajúca autentifikácia; 403: nepovolený prístup.
- 404: neznámy model/endpoint; 422: nepodporovaná schopnosť alebo požiadavka.
- 429: obmedzenie kapacity, prípadne `Retry-After`.
- 503: služba/model nepripravený; 504: prekročený upstream čas.
- Chyba obsahuje bezpečný strojový kód a technický request ID, nie token,
  prompt, obsah prílohy, stack trace alebo interné prístupové údaje.
- Dohodnúť limity veľkosti, súbehu a deadline. Abort/odpojenie klienta nemá
  nechávať neobmedzenú opustenú inferenciu.
- Zmenu dostupnosti nikdy nezameniť za úspešný prázdny analytický výsledok.

## Prijímacie testy pred zapnutím jednej služby

1. Autentifikácia: platný/chýbajúci/neplatný token a obmedzenie siete.
2. Zoznam modelov a schopností zodpovedá skutočnej implementácii.
3. Text, JSON object a prípadne strict schema majú overené kontrakty.
4. Neznámy model, nepodporované PDF/obrázok/stream, preťaženie a timeout
   vrátia explicitnú chybu bez fallbacku.
5. Rovnaké syntetické vstupy sa porovnajú s OpenAI na úrovni správnosti,
   validácie, úplnosti a latencie; nevyžaduje sa totožné voľné znenie.
6. Tokeny a zákaznícky obsah sa nezobrazujú v logoch oboch strán.
7. Až potom sa po schválení prepne jedna vybraná textová služba.

## Mimo prvej textovej integrácie

Responses API s PDF/obrázkami zostáva na OpenAI, kým sa samostatne nepotvrdí
interná schopnosť. Audio Analyzer 1.6 zostáva bez zásahov do kódu, kontajnera,
databázy a spracovania nahrávok. Jeho API sa najprv zdokumentuje a následne
pripojí samostatným adaptérom. Voice Studio je ďalšia samostatná etapa.

## Čo musí Gateway strana potvrdiť

Úplnú base URL/port/TLS a sieťovú cestu, autentifikačnú schému (nie hodnotu
tokenu), endpointy, model ID/revízie, skutočné schopnosti, limity, timeouty a
chybové odpovede. Pred týmto potvrdením sa interné smerovanie v INDEXUS-e
neaktivuje.
