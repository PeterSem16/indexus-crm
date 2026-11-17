# INDEXUS Email Monitoring B1.8 — technické posúdenie a oprava klienta

## Stav

**Úplná nová regresia 135/135 zatiaľ nebola vykonaná.**
Tento report vyhodnocuje dodaný pôvodný priebežný výstup a opisuje opravu
izolovaného runnera. Nie je potvrdením aktuálnej konfigurácie produkcie ani
serverového mapovania Gateway → Ollama.

Zdroj: dodané `B18_evidence.json`, `B18_failures.json`, `B18_report.md`.
SHA-256 súboru evidence:
`93bfabe8a3386b300b37bc2dd0d69ff3a07cc1b02e8dc57fe92c981948218333`.
Pôvodné súbory neboli zmenené.

## 1. Čo skutočne obsahuje pôvodný výstup

- Začiatok: `2026-11-16T14:46:45.860Z`.
- Posledný dokončený prípad: `SYN-B17-079`, `2026-11-16T15:15:05.029Z`.
- Zachytené trvanie po dokončenie prípadu 079: **28 min 19,169 s**.
- Dokončené spracovania: **79/135**; technicky úspešné: **77**.
- Evidované pokusy: **80**. Prípad `SYN-B17-080` má `INFERENCE_STARTED`,
  ale ešte nemá výsledok. To je predodosielací záznam, nie dôkaz doručenia serveru.
- `complete=false`, `error=null`, chýba `finishedAtUtc`, `after` aj `production`.

**Záver:** ide o priebežný snapshot. Sám osebe nepreukazuje, že proces skončil.
Možnosti zahŕňajú odobratie súborov počas behu aj násilné prerušenie procesu.
Bez procesného logu, exit statusu a overenia procesu ich nemožno rozlíšiť.
Nie je podložené označiť za príčinu „celkový 30-minútový timeout“.

## 2. Dve preukázané technické zlyhania

| Prípad | Uložená chyba | Trvanie |
|---|---|---:|
| SYN-B17-001 | B12_ABORT_OR_TIMEOUT | 30 022,880 ms |
| SYN-B17-002 | B12_ABORT_OR_TIMEOUT | 30 020,908 ms |

Obe majú tri úspešné discovery GET, ale nemajú inferenčný HTTP status ani
klasifikačný výsledok. Kód pôvodného izolovaného klienta mal 30 s v SDK aj vo
vonkajšom časovači. Evidencia preto podporuje timeout jednotlivých požiadaviek,
ale nerozlišuje pôvodné presné poradie SDK a vonkajšieho abortu.
Nie je to dôkaz, že práve studený model spôsobil oneskorenie.

Pôvodný regresný cyklus po jednotlivom timeoute pokračoval. Zlyhania 001 a 002
preto samy nevysvetľujú chýbajúci výsledok 080 ani chýbajúcu finalizáciu.
Runner ani jeho spúšťač nemajú celkový deadline regresie.
30-sekundové limity v príprave sa týkajú archivácie/rozbalenia, nie inferencie.

## 3. Latencie pôvodného priebežného behu

Časy sú end-to-end: discovery, router/adaptér/parser a read-only bezpečnostné
kontroly. Nie sú to čisté GPU ani Ollama časy.

| Súbor meraní | Počet | Priemer | Medián | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|---:|
| Dokončené spracovania vrátane timeoutov | 79 | 21 452,327 ms | 21 134,147 ms | 25 089,250 ms | 18 718,240 ms | 30 022,880 ms |
| Iba technicky úspešné | 77 | 21 229,741 ms | 21 100,875 ms | 23 974,972 ms | 18 718,240 ms | 25 490,280 ms |

Nejde o meranie výkonu po oprave timeoutu ani po samostatnom zahriatí.

## 4. Klasifikácie a párové regresie

Všetkých 135 uložených vstupov a referencií bolo porovnaných so zmrazeným korpusom.
Sú nezmenené vrátane 35 nerozhodnutých polí a pôvodnej referencie prípadu 092.
Skóre bolo prepočítané z uložených riadkov. Párové porovnania boli prepočítané
z historických hodnôt `before` vložených v evidence; samostatné originálne
historické reporty B1.7/B1.6 neboli súčasťou tejto prílohy.
Súbor failures zodpovedá evidence v pôvodnom formáte.

- V 77 technicky úspešných dokončených správach nie je chyba rozhodnutého poľa.
- Preukázané nové regresie: **0 v dostupnej technicky porovnateľnej časti**.
- Opravené polia oproti vloženým historickým predikciám: **12**.
- Pretrvávajúce porovnateľné chyby: **0**; kritické klasifikačné chyby: **0 v dostupnej časti**.
- Súhrn uvádza 599 správnych a 16 chybných referenčných polí.
  Týchto 16 pochádza z dvoch technických zlyhaní bez predikcie, nie z dôkazu
  16 nesprávnych klasifikácií modelu. Technické a modelové chyby sa nesmú zamieňať.
- 17 nerozhodnutých polí patrí k vykonaným správam; ďalšie zostávajú v nevykonanej časti.
  `null` zostáva `REVIEW_REQUIRED`, nie úspech ani chyba.
- Prípady 024, 025, 052, 061, 071, 074, 077 sú dokončené bez známej chyby.
  **088 a 092 neboli vykonané.** Celá 35-prípadová sada B1.6 nebola vykonaná.
- Nezávislé posúdenie slovenčiny poznámok zostáva otvorené.

Z tejto čiastočnej evidencie nemožno vyhlásiť PASS ani kompletné odstránenie regresií.

## 5. Mapovanie CRM Gateway → Ollama

CRM používa službu `email.monitoring` a vyžaduje alias
`indexus-email-monitoring:v1` na kanonickom HTTPS endpointe
`https://ai.cordbloodcenter.com/gateway/v1/chat/completions`.
Úspešné uložené odpovede používajú požadovaný alias.

To nepotvrdzuje skutočný Ollama backend ani klasifikačné pravidlá. Potrebné
sú read-only dôkazy z AI servera: efektívne mapovanie aliasu na backend,
meno a digest modelu a identita/hash nasadených pravidiel vrátane Gateway
promptu, ak sa pravidlá pridávajú tam. Samotný `ollama show` nepotvrdzuje,
že na daný model skutočne smeruje Gateway.

**Stav: REVIEW_REQUIRED — podklady zo servera neboli dodané.**

## 6. Oprava izolovaného klienta

- Len B1.8: SDK timeout aj vonkajší časovač jednej správy sú 120 000 ms.
- Historické piloty si ponechali 30 s; produkčné CRM nastavenia sa nemenili.
- Jedna samostatná zahrievacia požiadavka s pôvodným neutrálnym vstupom B1.2.
  Je uložená ako `warmup`, mimo skóre a latencií hodnotenej sady.
- Po úspešnom zahriatí celý korpus od začiatku: 100 + 35, nie chýbajúci zvyšok.
- Najviac 136 inferencií: 1 zahriatie + 135 hodnotených; žiadne retries,
  fallback, zmena inferenčných parametrov ani automatické opravovanie predikcií.
- Nový jednorazový profil nemení ani nemaže staré markery a reporty.
- Priebežný report zahŕňa elapsed time, deadline, zdroj abortu, SIGINT/SIGTERM,
  bezpečné chyby transportu a deklarovanú Gateway revision.
- Rodičovský spúšťač vypíše exit status/signál a nemá celkový timeout regresie.
  SIGKILL a externé zásahy nemusia umožniť finálny zápis.
- Pred novým behom overiť, že pôvodný proces už nebeží; nič automaticky nezabíjať.
  Beh spustiť s privátnym logom mimo životnosti terminálu.

## 7. Produkčná bezpečnosť

Pôvodný vstupný snapshot: `gateway.enabled=false`, **65 OpenAI**, **0 internal**,
**0 modelOverrides**. Všetkých 79 dostupných kontrol dokončených riadkov
potvrdzuje zhodu pred/po spracovaní s týmto zmrazeným základom.
Záverečný snapshot v prílohe chýba, preto **nemožno potvrdiť nezmenený stav
po skončení ani aktuálny stav produkcie**.

Priložený runner eviduje 0 zápisov nastavení, 0 zápisov záznamov a 0 notifikácií.
Pripravená oprava mení iba samostatné testovacie nástroje, nie aplikáciu,
produkčné routovanie, databázové nastavenia, model ani PM2.
Spustenie cez read-only konfiguráciu má pred/po aj priebežné bezpečnostné kontroly.
Produkčná aktivácia nie je povolená ani pri budúcom PASS.

## 8. Čo chýba k finálnemu výstupu

1. Overiť, či pôvodný proces skončil, a dodať jeho log/exit status, ak existuje.
2. Doložiť efektívne AI-serverové mapovanie a pravidlá.
3. Na CORPCRM01 vykonať nový samostatný beh od prvého prípadu s opraveným klientom.
4. Prevziať finálne `B18_report.md`, `B18_evidence.json`, `B18_failures.json`,
   preveriť 135/135, latencie, chyby, regresie aj záverečný produkčný snapshot.

Príprava a offline testy sa nesmú prezentovať ako dokončená živá regresia.

## Overenie opravy

Prešlo 81 TypeScript testov a 18 CJS testov (spolu **99**), vrátane
simulovaného prekročenia 30 s pri 120-sekundovom limite, abortu pri 120 s,
odlíšenia SIGTERM, jedného zahriatia mimo skóre a úplného 135-prípadového
cyklu bez retries. Testy prešli aj na pripnutom publikovanom základe
s pridanými iba vybranými zmenami. Prešla cielená kontrola TypeScriptu
a zostavenie izolovaného B1.8 bundle; kompatibilný B1.7 bundle sa tiež zostavil.
Mockované klasifikácie a časy v testoch nie sú novými výsledkami modelu.
