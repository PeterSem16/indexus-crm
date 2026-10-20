# Status List — návrh bezpečného prechodu existujúcej Mission

**Stav: postup inventúry a kontroly pripravenosti schválený. Aktivácia
produkčného prechodu nie je schválená ani implementovaná.**

Vývojová kontrola a hranice simulácie sú opísané v
`status-list-transition-readiness.md`. Historická inventúra nie je živé
overenie produkčnej konfigurácie.

## Cieľ a poradie

Používateľ požaduje zjednotiť Testovanie a históriu a pripraviť bezpečný
prechod pôvodných pravidiel už spustenej produkčnej kampane do nového
systému automatizácie Status Listu. Až potom zapojiť automatické pravidlá
zo žltých poznámok dokumentu ambulantného gynekológa v04.

1. Jednotné Testovanie a história vrátane prehľadu pôvodných pravidiel.
2. Inventúra, porovnanie, simulácia a kontrolovaný prechod konkrétnej Mission.
3. Osobitne schválené nové správanie zo žltých poznámok.

Žiadne produkčné pravidlo sa nemení iba otvorením editora, vytvorením plánu,
nasadením podpornej funkcionality alebo importom šablóny.

## Overené hranice dnešnej implementácie

- Nové interné workflow pravidlá podporujú odpovede, potvrdenia, výbery
  a poznámky vrátane riadeného reťazenia.
- Pôvodné servisné akcie zostávajú v samostatnom vykonávacom mechanizme.
  Nový interný formát nie je univerzálnou náhradou emailov, SMS, úloh,
  callbackov a ostatných servisných akcií.
- Existujúce Testovanie simuluje jedno interné pravidlo; nejde o simuláciu
  celej kampane, pôvodného mechanizmu ani celej nadväzujúcej reťaze.
- Lokálny kód nie je dôkazom aktuálnej konfigurácie produkčnej Mission.
  Pre Medical Partner Cooperation sú k dispozícii operátorské výpisy iba na
  čítanie z 20. októbra 2026; nejde o priebežné overenie CORPCRM01.

Pred migráciou sa preto musí doplniť a overiť spoločná vykonávacia vrstva
alebo výslovná kompatibilitná cesta pre každú podporovanú rodinu akcií.
Samotné zobrazenie starej akcie v novom editore nie je konverzia mechanizmu.

## Navrhnuté rozhranie

V časti **Testovanie a história**:

- **Skúška pravidiel:** vstupná udalosť, podmienky, zvolená vetva,
  očakávané akcie, cieľ, príjemca a časovanie. Jasne označený rozsah simulácie.
- **História vykonania:** pôvodný/nový mechanizmus, čas, pôvodca, zdroj,
  výsledok a dôvod preskočenia alebo chyby. Konfiguračná zmena nie je vykonanie.
- **Prechod pôvodných pravidiel:** samostatný sprievodca
  Inventúra → Porovnanie → Skúška → Schválenie → Výsledok.

Pri každom pôvodnom pravidle ukázať:

| Stav | Význam |
| --- | --- |
| Pripravené na prevod | Úplná podporovaná zhoda udalosti, podmienok, akcií a parametrov. |
| Vyžaduje kontrolu | Chýbajúca referencia, nejednoznačná podmienka, časovanie alebo závislosť. |
| Zatiaľ nepodporované | Nový vykonávací mechanizmus zatiaľ neposkytuje rovnocenné správanie. |
| Ponechané v pôvodnom mechanizme | Vedome neprevedené pravidlo zostáva prevádzkyschopné bez aktívnej novej kópie. |
| Prevedené | Overený prechod s uloženou väzbou na pôvodné pravidlo a auditom. |

Kontrola celého plánu musí zachytiť aj kolízie medzi viacerými pravidlami,
výhradnými možnosťami a nadväzujúcimi akciami; nestačí kontrolovať každý riadok zvlášť.

## Bezpečnostné brány

### 1. Produkčná inventúra iba na čítanie

Vybrať konkrétnu Mission. Zachovať ID otázok, odpovedí, kontaktov a pôvodných
pravidiel. Nepoužívať opätovný import celej banky CLA/CLB/MPN ako migráciu.
Zachytiť konfiguračný odtlačok aj závislosti: podmienky, cieľové položky,
skupiny, príjemcov, časovanie a zdroje odpovedí.

Pred produkčnou zmenou overiť súkromnú zálohu a možnosť návratu.
Na CORPCRM01 sa nepripájať cez SSH; potrebnú serverovú kontrolu vykonáva
používateľ cez konzolu alebo neskôr autorizovaný nástroj v samotnej aplikácii.

Pri prípadnom prenose diagnostiky do vývoja prenášať iba nevyhnutnú konfiguráciu,
nie karty kontaktov, obsah komunikácie, tokeny alebo heslá. Citlivých príjemcov
nezapisovať do logov ani verejných výstupov.

### 2. Kandidát bez účinkov

Vytvoriť samostatný návrh nových pravidiel, predvolene neaktívny.
Pôvodné pravidlá naďalej pracujú. Neznámu podmienku nikdy nepreložiť na „vždy“;
nepodporovanú akciu nevynechať a nenahradiť podobnou.

Pre každý kandidát uchovať pôvodné pravidlo, odtlačok, verziu prevodníka
a rozdiel parametrov. Opakovanie rovnakého plánu nesmie vytvárať ďalšie kópie.
Zmena konfigurácie alebo závislostí po kontrole zneplatní schválený plán.

### 3. Porovnanie bez odosielania

Vyhodnotiť tie isté vstupy v pôvodnej a novej logike bez skutočného vytvorenia
úloh, callbackov, odoslania emailov/SMS alebo zmeny odpovedí.
Porovnať nielen typ akcie, ale aj spúšťač, vetvu, cieľ, krajinu, príjemcu,
časové pásmo, pracovné dni, pevný čas a politiku existujúceho callbacku.

Ak pôvodné správanie nemožno verne simulovať, výsledok označiť ako
neoverený a prechod zablokovať. Simulácia nie je potvrdenie doručenia.
Prípadné porovnávanie na živých udalostiach musí mať samostatnú čisto
výpočtovú cestu; nesmie volať pôvodný vykonávač s vedľajšími účinkami.

### 4. Jediný vlastník vykonania

Pred prvým prechodom zaviesť a otestovať spoločnú kontrolu vlastníctva akcie
na všetkých vstupných cestách vrátane pozadia, opakovaní a reťazenia.
Pre jednu udalosť a logickú akciu smie vykonanie prevziať iba jeden mechanizmus.
Dedup a identita udalosti musia prežiť zmenu mechanizmu.

Samotné „vypnúť staré, zapnúť nové“ v dvoch HTTP požiadavkách nie je bezpečný prechod.
Prevod vybranej závislej skupiny musí mať transakčne chránené rozhodnutie,
kontrolu aktuálneho odtlačku a jasnú hranicu spracovania udalostí.
Rozpracované vykonania musia dobehnúť alebo mať overené prevzatie;
nové udalosti sa nesmú stratiť počas krátkeho prepínania.
Kým toto nie je zaručené, tlačidlo aktivácie zostáva zablokované.

### 5. Bez opakovania histórie

Zachovať existujúce odpovede, potvrdenia, poznámky, úlohy, callbacky a históriu.
Pre systémové zdroje vytvoriť východiskový stav bez prehratia starých účinkov.
Prechod nie je potvrdenie otázky ani nová udalosť klienta.

Čakajúce a splatné úlohy/callbacky sa znovu nevytvárajú. Každé existujúce
odložené vykonanie musí mať explicitne určeného vlastníka; neurčitý stav blokuje prechod.

### 6. Audit a návrat

Zobraziť kto, kedy, čo a z ktorej konfigurácie prepol, výsledky kontrol
a väzbu na pôvodné pravidlá. Sporné doručenie nesmie byť označené ako úspech
ani automaticky zopakované.

Návrat prepne vlastníctvo budúceho vykonávania cez rovnaké ochranné brány
a znova overí rozpracované udalosti. Neobnovuje starú databázu,
nemaže novšie odpovede ani už vytvorené úlohy.
Odoslaný email/SMS nemožno vziať späť. Ak sa pôvodné nastavenia medzitým zmenili,
návrat vyžaduje nové posúdenie, nie slepé zapnutie starej kópie.

## Žlté poznámky až ako samostatná etapa

Po overení prevodu existujúcich pravidiel osobitne navrhnúť a otestovať:

- rozlíšenie jedného nezastihnutia a finálnej nedostupnosti;
- päť po sebe idúcich neúspešných pokusov s odstupom šiestich pracovných dní;
- nesprávne/nefunkčné číslo, overenie návrhu kontaktu a prípadnú úlohu správcu;
- následný kontakt pri dvoch odlišných odpovediach zvažovania spolupráce
  podľa pokynov dokumentu.

Pred aktiváciou vyjasniť počítaný typ pokusu, autoritatívne dôkazy komunikácie,
pracovný kalendár, reset počítadla, význam „nevolať“ a povolený typ následného
kontaktu. Nepreviesť mesačnú kontrolu stavu na automatické vytočenie človeku,
ktorý žiada nevolať. Nevymýšľať príjemcu systémovej úlohy.

Tieto doplnenia nesmú byť skrytou súčasťou migrácie pôvodných pravidiel.
