# email.sentiment – výsledky prípravy regresného balíka

Dátum: 17. 11. 2026. Pokračovanie existujúcej úlohy.

**Používateľ prijal 80 PASS / 0 FAIL / 0 SKIP.** Nasledujúce čísla sú
pôvodné namerané výsledky nezávislých kontrol, nie nové merania pri
dokumentačnej príprave. Aktuálny ďalší postup je výhradne sekvenčná
regresia po schválení trasy; fáza B nie je povolená.

## Výsledok

**REVIEW_REQUIRED.** Regresné podklady sú doplnené a nezávislé kontroly prešli.
Živá CRM inferencia ani záťaž neboli vykonané. Žiadna produkčná alebo
sieťová konfigurácia sa nemenila.

## Odovzdaný balík

- `script/ai-email-sentiment/regression-corpus.ts`: presne 18 pôvodných
  prípadov K01–K12, EN, CS, HU, RO, IT, DE; predmet `Syntetický test`.
- `script/ai-email-sentiment/regression-evaluator.ts`: striktný existujúci
  parser plus výhradne dodané čiastkové referencie; žiadne odvodzovanie
  očakávaní podľa modelových výstupov.
- `script/ai-email-sentiment/regression.test.ts`: 24 nezávislých kontrol.
- `server/lib/ai/email-sentiment.test.ts`: 56 kontrol pôvodnej aplikačnej
  cesty, Routera, SDK, parsera, mapovania a bezpečnostných vetiev.
- `script/ai-email-sentiment/README.md`: spustenie, obmedzenia a význam
  jednotlivých výsledkov.
- `docs/email-sentiment-test-proposals.md`: aktuálny návrh konkrétnej
  SSH/TLS trasy, preflight bez inferencie, sekvenčný profil a blokátory.

## Namerané nezávislé kontroly

Príkaz:

```bash
npx tsx --test script/ai-email-sentiment/regression.test.ts server/lib/ai/email-sentiment.test.ts
```

| Meranie | Výsledok |
|---|---|
| Testy kódu a syntetického HTTP transportu spolu | 80 PASS / 0 FAIL / 0 SKIP |
| Celkový čas tejto sady | 52 162 ms |
| Zdieľaný deadline pomalého natívneho HTTP fixture | 30 003 ms |
| Inferenčné pokusy v deadline teste | 1 proti lokálnemu fixture serveru |
| Obchodné účinky v deadline teste | 0 |
| Striktná TypeScript kontrola zmenených súborov a závislostí | PASS |
| Živé inferencie voči AI serveru | 0 |

Pozorovaná réžia návratu nad nominálny 30-sekundový deadline je 3 ms.
Nejde o latenciu modelu. Zrušenie HTTP požiadavky na strane CRM samo osebe
nedokazuje, kedy upstream ukončil už prijatú inferenciu.

Všetkých 18 dodaných predmetov/tiel prešlo cez skutočne extrahovaný
pôvodný CRM analyzátor a SDK do lokálneho natívneho HTTP fixture.
Kontroluje sa presné znenie odoslaného predmetu a obsahu aj zachovanie
syntetickej deväťpoľovej odpovede. Pôvodný CRM prompt sa neprepisoval.
K12 má navyše samostatný transportný test bezpečného HTTP 422.

Syntetické úplné odpovede sú **iba vstupy testovania kódu**, nie nové gold
referencie. Pri poliach mimo pôvodných čiastkových očakávaní sa kontroluje
typ a povolená hodnota, nie vymyslená klasifikačná zhoda.

Ručné schválenia v pozitívnych fixture testoch sa vzťahujú iba na známu
konštantnú slovenskú testovaciu poznámku. Nepotvrdzujú jazyk neexistujúcich
živých výstupov.

Historických 136 úspešných kontrol sa nesčíta s novými 80:
37 sentimentových kontrol sa prekrýva. Predchádzajúcich 99 kontrol širšej
regresie je zaznamenaných v predchádzajúcom overení; tento beh ich
neoznačuje za opätovne vykonané.

## Osobitné hodnotenie K12

- Platná deväťpoľová klasifikácia musí spĺňať `wantsConsent=false`.
- Rozpoznané `review_required` je **SAFE_REJECTION**, nie platná
  klasifikácia: `classificationValid=false`, nula hodnotených polí.
- Report rozlišuje napríklad 17 platných klasifikácií + jedno bezpečné
  odmietnutie; nesmie ich premenovať na 18 úspešných JSON klasifikácií.
- Technická chyba nie je bezpečné odmietnutie.
- `review_required` na inom prípade nie je automaticky úspech.

## Čo ešte nemožno tvrdiť

Nie je nameraná presnosť živého modelu na 18 prípadoch, slovenský jazyk jeho
poznámok, P95/P99 inferencie, bezpečná kapacita spoločného Ollama ani nulový
dopad na `email.monitoring`.

Korpus už nechýba. Živý beh čaká na schválenú trasu, autentifikáciu,
zhodu Gateway s pôvodným note kontraktom, pripravený izolovaný živý klient
a produkčnú pozorovateľnosť/bezpečnú kapacitu. Nový limit 100 znakov
pre note nie je schválený. Fáza B je vyradená z aktuálneho postupu.
Navrhnuté SSH/TLS riešenie sa neimplementovalo a pôvodné Python testy
na AI serveri sa nečítali ani nespúšťali.

Produkčné smerovanie sa neaktivuje automaticky ani po úspešnom
nezávislom alebo budúcom živom teste.
