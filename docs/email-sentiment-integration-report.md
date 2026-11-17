# Výsledný report: izolovaná integrácia email.sentiment

Dátum: 17. 11. 2026.

**Výsledok: pripravené a overené v izolovanom prostredí. Živý AI server
z CORPCRM01 ešte nebol overený; produkčné smerovanie nebolo aktivované.**

## Implementácia

- `indexus-email-sentiment:4b` je povolený len pre `email.sentiment`.
- Autentifikovaný Gateway adaptér zachováva validovaný HTTP 422
  `review_required` ako samostatný neúspešný výsledok. Nesprávny alebo
  príliš veľký chybový obal sa za tento stav nepovažuje.
- Parser vyžaduje presne deväť správne typovaných polí bez implicitných
  hodnôt, aliasov alebo opráv modelového záveru.
- Pôvodná obchodná vetva odmieta manuálne posúdenie aj technické zlyhanie:
  žiadne klasifikačné metadata, zmeny obchodného stavu ani cloud fallback.
- Interný profil má jeden deadline 30 000 ms, maximálne 300 tokenov
  a nulové retries; globálne ani request nastavenie ho nepredĺži.
- Pôvodný CRM request/prompt bol porovnaný so zverejneným základom:
  byte-identický. Referenčný SHA-256 request výrazu:
  `c9147b18f0dcf0d6a92b5ca06a2a3a17e8572e919be3968bd3bb51eebc18e88a`.

## Výsledky overenia

Testovaná bola selektívna zostava na zverejnenom základe, nie iba celý
lokálny pracovný strom s nesúvisiacimi rozpracovanými zmenami.

| Kontrola | Výsledok |
|---|---|
| Nové testy email.sentiment | 32 PASS |
| Regresie Routera, Gateway a email.monitoring | 99 PASS |
| Spolu | **131 PASS, 0 FAIL, 0 SKIP** |
| Úzka striktná TypeScript kontrola | PASS |
| Produkčný backendový bundle selektívnej zostavy | PASS |
| Pôvodný request a prompt | Nezmenený |
| Zdroj email-monitoring-service oproti začiatku práce | Nezmenený |
| Produkčné smerovanie email.sentiment | Neaktivované |

Reprodukovateľný kompletný beh:

```bash
npx tsx --test \
  server/lib/ai/email-sentiment.test.ts \
  server/lib/ai/internal-adapter.test.ts \
  server/lib/ai-router.test.ts \
  server/lib/ai/email-monitoring-b1.test.ts \
  server/lib/ai/email-monitoring-b112.test.ts \
  server/lib/email-monitoring-service-flow.test.ts \
  server/lib/email-monitoring-detail-route.test.ts
```

Celkový beh testov trval 45 978 ms. Natívny HTTP test s readiness oneskorenou
o 8 sekúnd a inferenciou oneskorenou o 25 sekúnd skončil po **30 004 ms**.
Štyri milisekundy nad nominálny deadline predstavujú pozorovanú réžiu
časovača a návratu do aplikácie, nie nový 30-sekundový limit pre inferenciu.
Počet inferenčných pokusov: **1**. Počet obchodných účinkov: **0**.

Sada zahŕňa úspech, manuálne posúdenie, neúplný/nesprávne typovaný JSON,
neplatný Gateway obal, nedokončenú generáciu, 401/403/422/5xx, sieťové
zlyhanie, odmietnuté presmerovanie, timeout discovery aj spoločný deadline.
Zákaz obchodných účinkov sa overoval na pôvodnej obchodnej vetve z routes,
nie iba na jej testovej napodobenine.

## Čo tieto výsledky dokazujú a nedokazujú

Reálny bol klientský kód INDEXUS, Router, SDK, natívny fetch, lokálny
HTTP transport, aplikačný parser a podmienka obchodnej vetvy.
Syntetická bola Gateway a odpovede modelu. Autentifikácia sa testovala
syntetickým Bearer tokenom.

Tieto výsledky **nedokazujú**:
- živé TLS, autentifikáciu alebo discovery nového modelu na internej Gateway;
- mapovanie na skutočný adaptér/Ollama, vypnuté thinking a ukončenie
  upstream výpočtu po prerušení klienta;
- skutočnú latenciu alebo klasifikačnú presnosť modelu;
- slovenský jazyk reálnych generovaných poznámok;
- zobrazenie výsledku v prihlásenom produkčnom UI alebo produkčné nasadenie.

Osempoložkový SK/EN/CS/HU/RO/IT/DE korpus overuje integračný kontrakt
s vopred definovanými odpoveďami, nie presnosť AI. Údaj AI tímu
17 PASS / 1 REVIEW_REQUIRED / 0 FAIL preto zostáva oddeleným dôkazom.

Historická celosystémová sada C1 sa pri prvom pokuse zastavila na starom
inventári zdrojových hashov (`email-monitoring-service.ts`), ktorý sa
nezhodoval už s nezmeneným súborom na začiatku tejto práce. Inventár ani
historické výsledky sa neprepisovali. Tento blokovaný beh nie je zahrnutý
do 131 úspešných testov. Aktuálny čistý replay prísneho sentiment parsera
má samostatný úspešný test v novej sade.

Build hlásil existujúce duplicitné mapovacie kľúče a upozornenia
na import.meta v CJS; dokončil sa úspešne. Vývojová aplikácia po reštarte
naštartovala, verejná prihlasovacia obrazovka sa vykreslila. Existujúce
chyby spojenia na Asterisk vo vývojovom prostredí týmto rozsahom neboli riešené.

## Zostávajúci krok

AI tím musí potvrdiť vystavenie nového modelu cez existujúcu autentifikovanú
Gateway. Potom treba vykonať izolovaný syntetický test z CORPCRM01,
zmerať celú živú cestu a manuálne posúdiť skutočné slovenské poznámky
podľa postupu v `docs/email-sentiment-integration.md`.

Z tejto relácie nie je dostupný interný AI server ani autorizovaná konzola
CORPCRM01; živý test preto nebol vykonaný a nie je vydávaný za úspešný.
Žiadne produkčné `.env`, PM2 ani uložené smerovanie sa nemenilo.
Samotná aktivácia produkčnej služby naďalej vyžaduje samostatné schválenie.
