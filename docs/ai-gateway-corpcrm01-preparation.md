# CORPCRM01 – príprava prístupu k internej AI Gateway

## Schválený cieľ a aktuálna hranica

Gateway base URL je `https://ai.cordbloodcenter.com/gateway/`.
V serverovej konfigurácii sa môže uviesť aj bez koncového lomítka:

```text
INDEXUS_AI_GATEWAY_BASE_URL=https://ai.cordbloodcenter.com/gateway
```

Gateway na tejto adrese ešte nebola potvrdená ako nasadená. Teraz sa nesmú
posielať inferencie ani autentifikované API testy. Produkčný kód sa nasadzuje
až po samostatnom schválení. Všetky služby naďalej používajú OpenAI.

Replit nesmie internú adresu skúšať. Nasledujúcu kontrolu vykoná operátor
priamo v konzole CORPCRM01; nevyžaduje nasadenie nového CRM kódu ani token.

## Prvá kontrola: sieť a certifikát bez Gateway API

Obsah `script/check-ai-gateway-network.sh` možno vložiť priamo do konzoly
pomocou `bash <<'INDEXUS_NETWORK_CHECK' ... INDEXUS_NETWORK_CHECK`.
Kontrola je samostatná: nepredpokladá dostupnosť nových súborov na produkcii.
Overuje názov stroja, lokálne adresy, IPv4 DNS, lokálnu trasu a priamy IPv4
HTTPS HEAD na koreň domény. Nepoužíva proxy, curlrc, token, `-k` ani redirecty.
Nič neinštaluje, nemení konfiguráciu a nereštartuje procesy.

Certifikát vyhodnocuje bežné curl TLS overenie vrátane názvu domény.
Pri chybe je výstup `TLS_CHECK=not_verified`. Overenie curl ešte nedokazuje
kompatibilitu Node trust store ani pripravenosť Gateway. Koreňový HTTP 403/404
sa musí odlišovať od zlyhania DNS/TCP/TLS.

`hostname -I`, lokálna trasa a `LOCAL_CONNECTION_IP` nie sú dôkaz odchádzajúcej
adresy po NAT-e. `PROBE_ID` je nesenzitívny identifikátor root HEAD požiadavky.
AI tím ho priradí v príslušnom Nginx access logu a potvrdí skutočnú zdrojovú
adresu so zohľadnením dôveryhodných proxy/real-IP pravidiel. Nesmie sa veriť
ľubovoľnému klientskemu `X-Forwarded-For`. Nepoužívať externú „what is my IP“
službu, ktorej výsledok nemusí patriť tejto trase.

## Token: návrh uloženia, nie vykonaná zmena

V tejto príprave sa token **neukladá do Replitu** a jeho hodnota sa nežiada cez chat.
Na CORPCRM01 sa použije existujúci schválený serverový secret store. Ak vhodný
store nie je zavedený, alternatívou na samostatné schválenie je súkromný
serverový konfiguračný súbor mimo Git a všetkých webových/static/upload ciest,
s minimálnymi oprávneniami (typicky 0600) pre overený účet služby.

Konkrétne miesto, vlastník a napojenie do PM2 sa určia až z overenej serverovej
konfigurácie. Samotné vytvorenie súboru alebo premennej v operátorskej konzole
nepreukazuje dostupnosť pre bežiaci PM2 proces. Nepoužívať `pm2 env`, kompletné
dump-y prostredia alebo `set -x` vo výstupe posielanom do chatu.

Pri budúcom nasadení zostáva transport zakázaný
(`INDEXUS_AI_GATEWAY_ENABLED` nenastavené alebo `false`) a routing prázdny.
Neskoršie jednorazové diagnostické povolenie v konzole nemení PM2 ani služby.

## Kód a bezpečné nasadenie – až po osobitnom schválení

Interný adaptér je pripravený v GitHube; to nedokazuje jeho prítomnosť v
produkčnom runtime. Aktuálny produkčný HEAD, source bytes a runtime treba
zistiť pred návrhom konkrétneho nasadenia.

Pred nasadením pripraviť overenú súkromnú zálohu a rollback na určenom
`/dev/sdb1` v `/var/www/indexus-crm/data`, mimo živého DB clustra a webového
prístupu. Build musí vzniknúť v privátnom stagingu, nie vymazaním živého `dist`.
Nemenia sa OpenAI kľúče, prompty, modely alebo bežné request parametre.
Neprehrávajú sa historické požiadavky a nevytvára sa fallback do cloudu.

## Integračné testy – až keď AI tím potvrdí nasadenie

Z CORPCRM01 a výhradne so syntetickými údajmi:

1. DNS/TLS a Node klient.
2. Chýbajúci/neplatný/platný Bearer token; bez vypisovania hodnôt.
3. Readiness, model `indexus-document-audio:latest`, verzie a limity schopností.
4. Plain text a JSON object s aplikačnou validáciou.
5. Odmietnutie strict schémy, streamu, obrázkov, PDF, audia a nepovoleného modelu.
6. Timeout, abort, neplatná odpoveď a nedostupnosť bez cloudového fallbacku.
7. Technické logy bez tokenov a osobného obsahu; porovnanie kvality s OpenAI.

Existujúci diagnostický nástroj `script/check-internal-ai-gateway.ts --check`
testuje discovery a `--smoke` pridáva dve syntetické inferencie. Nie je to
kompletný dôkaz všetkých vyššie uvedených negatívnych integračných scenárov.
Tieto príkazy sa **teraz ešte nespúšťajú**.

## Aktivácia a rollback

Až po integračných testoch, potvrdení schopností/limitov, kontrole logov,
porovnaní kvality a samostatnom schválení sa vyberie jediná pilotná textová
služba. Prepnutie bude explicitná kontrolovaná zmena provider/model mapovania.
Ostatné služby zostanú na OpenAI. Audio Analyzer 1.6, Audio API a Voice Studio
sa nemenia.

Rollback routera: `INDEXUS_AI_ROUTER_MODE=legacy` a riadený reštart INDEXUS-u
so správne načítaným prostredím. Obnova kódu je samostatný overený návrat
runtime; neobnovuje automaticky databázu a nereštartuje Audio Analyzer.

## Technický report – pravdivý priebežný stav

| Oblasť | Stav |
|---|---|
| Dohodnutá URL | `https://ai.cordbloodcenter.com/gateway/` |
| Interný adaptér v GitHube | Pripravený; predchádzajúcich 105 kontrol a build prešli |
| Produkčný runtime | Prítomnosť nového adaptéra zatiaľ neoverená |
| IP CORPCRM01 | `10.1.2.111` – lokálna adresa a zdroj priameho IPv4 spojenia |
| IPv4 DNS | Úspech: `ai.cordbloodcenter.com` → `10.9.2.140` |
| Priame HTTPS/TLS | Úspech: koreň domény HTTP 200, curl exit 0, TLS verify result 0 |
| IP videná AI serverom | Čaká sa na koreláciu root probe na prijímacej strane |
| Uloženie tokenu | Postup navrhnutý; uloženie nepotvrdené, hodnota sa neuvádza |
| Živé integračné testy Gateway | Zámerne nespustené; Gateway sa ešte pripravuje |
| Smerovanie existujúcich služieb | V pripravenom zdroji OpenAI; žiadna zmena produkcie vykonaná |
| Aktivácia | Nepovolená; vyžaduje samostatné schválenie pilotnej služby |

### Doložený sieťový výsledok z CORPCRM01

Operátor poskytol výsledok kontroly z **2026-11-11 17:03:09 UTC**.
Kontrola nevyžadovala token ani nasadenie nového CRM kódu.

- Lokálna IPv4: `10.1.2.111`.
- DNS: `10.9.2.140`, `DNS_EXIT=0`.
- Trasa: `10.9.2.140 via 10.1.1.1 dev eth0 src 10.1.2.111`.
- Skutočný vzdialený cieľ curl: `10.9.2.140`; lokálna adresa spojenia: `10.1.2.111`.
- Overenie certifikátu a mena hosta: `TLS_VERIFY_RESULT=0`, `CURL_EXIT=0`.
- Koreň domény: `HTTP_STATUS=200`.
- Čas TCP: približne 23 ms; čas od začiatku po TLS handshake: približne 48 ms.
  Ide o jednorazové časy, nie výkonnostný záväzok.
- Identifikátor pre AI tím: `indexus-network-20261111T170309Z-17196`.
- `GATEWAY_API=not_called`, `TOKEN=not_used`, `INFERENCE=not_called`.

Toto potvrdzuje priame IPv4 DNS/TCP/HTTPS spojenie z CORPCRM01 ku koreňu domény
v čase kontroly. **Nepotvrdzuje nasadenie `/gateway/`, Bearer autentifikáciu,
pripravenosť modelu, Node trust store ani integračné správanie adaptéra.**
Zdroj po prípadnom NAT-e stále musí potvrdiť prijímajúca strana; nesmie sa
automaticky stotožniť s lokálnou adresou `10.1.2.111`.

### Odovzdanie AI tímu

Vyhľadať root HEAD požiadavku s query identifikátorom
`indexus-network-20261111T170309Z-17196` okolo `2026-11-11 17:03:09 UTC`
v príslušnom prístupovom logu. Potvrdiť zdrojovú adresu s ohľadom na skutočnú
proxy/NAT topológiu a dôveryhodné real-IP nastavenia; až podľa tejto adresy
pripraviť Nginx obmedzenie prístupu pre CORPCRM01.

Následne potvrdiť sprevádzkovanie dohodnutých endpointov pod `/gateway/`,
Bearer autentifikáciu a skutočné text/JSON schopnosti modelu
`indexus-document-audio:latest`. Token neposielať v chate ani v bežnom reporte.
Do tohto potvrdenia sa z INDEXUS-u nespúšťajú živé Gateway API/inferenčné testy.
