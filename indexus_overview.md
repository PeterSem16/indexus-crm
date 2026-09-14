# INDEXUS CRM — Aktuálny prehľad a plán dokončenia

> **Revízia:** 14. september 2026
> **Rozsah:** revízia oproti májovému prehľadu; aktuálna implementácia CRM, Nexus Pulse, Mission a nadväzujúceho obchodno-laboratórneho procesu.
> **Podklady:** aktuálny zdrojový kód a regresné testy, stavový dokument Pricing Engine V2, potvrdenie prevádzky Nexus Pulse/Mission vlastníkom systému.
> **Produkčné dáta:** v tejto revízii nebol vykonaný prístup na CORPCRM01 ani SQL dotazy proti produkcii. Staré počty nie sú aktuálnym stavom.

## 1. Manažérsky súhrn

INDEXUS už nie je iba evidencia zákazníkov a historických zmlúv. Obsahuje funkčné agentúrne pracovisko Nexus Pulse, riadenie práce cez Mission, prichádzajúce aj odchádzajúce volania, fronty, callbacky, nahrávanie a nadväzujúcu komunikáciu. **Nexus Pulse a Mission sú podľa potvrdenia vlastníka systému plne funkčné v používanom pracovnom flow.** Existencia jednotlivých funkcií bola porovnaná s aktuálnym kódom.

Najnovšie opravy v repozitári však nie sú automaticky dôkazom ich nasadenia na produkciu. Tento dokument nie je záznamom nového produkčného akceptačného testu a neoznačuje všetky krajiny, brány či externých partnerov za nezávisle otestovaných.

**Nasledujúca hlavná etapa je obchodný a laboratórny reťazec:**

Nový cenník produktov a služieb → pridelenie verzie cenníka zákazníkovi → zmluva s uloženou cenou → odber → laboratórny výsledok → vyhodnotenie skutočne dodaných služieb → faktúra/splátky/skladné → úhrada a kontrola.

Nový Pricing Engine V2, zmluvný modul, fakturačný modul a Laboratory Connect už majú implementované významné časti. **Ešte však nejde o jeden dokončený automatizovaný proces.** Prioritou nie je vytvoriť ďalšiu kalkulačku, ale prepojiť existujúce moduly tak, aby používali rovnaké identifikátory, pravidlá a nemenné cenové podklady.

### 1.1 Ako čítať stav

| Označenie | Význam |
|---|---|
| Funkčné — potvrdené vlastníkom | Vlastník potvrdil používaný pracovný flow; nejde o nové nezávislé overenie produkcie. |
| Implementované | V repozitári je funkčný kód príslušnej časti; nasadenie a produkčné dáta môžu vyžadovať potvrdenie. |
| Čiastočne prepojené | Moduly existujú, ale chýba spoločný proces, kontrola alebo automatické odovzdanie dát. |
| Na dopracovanie / overenie | Konkrétna medzera v kóde alebo chýbajúci produkčný či obchodný dôkaz. |

### 1.2 Súhrnná mapa

| Oblasť | Aktuálna etapa | Čo zostáva |
|---|---|---|
| Nexus Pulse + Mission | Funkčné — potvrdené vlastníkom; implementácia a regresné testy v repozitári | Prevádzkové monitorovanie, priebežné opravy, potvrdenie nasadenia posledných zmien. |
| Hlasové trasy a SMS brány | Implementovaný výber podľa Mission a krajiny | Evidovať akceptáciu každej používanej kombinácie krajina/trasa/brána. |
| Priority Builder a osobná fronta | Implementované | Prevádzkové overenie najnovších opráv uloženia a zobrazenia. |
| Healthcare Network / Back Office | Implementované rozšírenia | Samostatné menšie požiadavky zostávajú; nejde o blokovanie celého Pulse. |
| Pricing Engine V2 | Implementovaný cenník, pravidlá a výpočet | Produkčné verzie, historické priradenia a zapojenie do zákazníka/zmluvy/BO/fakturácie. |
| Contracts | Existujúci modul a cenové snapshoty v modeli | Napojenie na autoritatívny V2 výpočet a cenovú verziu. |
| Invoicing | Existujúce UI, dátový model a generovanie | Zmluvne viazaná V2 fakturácia, položky, meny, dane, splátky a bezpečné opakovanie. |
| Laboratory Connect | Implementované interné formuláre aj externé API | Zjednotiť spracovanie, autorizáciu laboratória, históriu výsledkov a obchodné následky. |
| Úplný obchodno-laboratórny proces | Integračná etapa pred dokončením | Akceptačný scenár od cenníka až po výsledok, faktúru a úhradu. |

## 2. Čo pribudlo alebo sa dokončilo od pôvodného prehľadu

### 2.1 Nexus Pulse — agentúrne pracovisko

- Samostatné pracovisko agenta naviazané na prístupové práva, Mission a oprávnené kontakty.
- Vstupná kontrola podporovaného prehliadača, bezpečného spojenia, siete, mikrofónu, reproduktora, SIP/ICE a pripojeného účtu Microsoft 365.
- Mikrofónová skúška s kalibráciou okolitého hluku a detekciou reči; interaktívne potvrdenie reproduktora.
- Meranie latencie a jitteru; hodnoty v milisekundách sú opäť súčasťou výsledkov kontroly.
- Rýchla opätovná kontrola iba pri stále platnej pripravenosti; začatý úplný test nemožno obísť rýchlou cestou.
- Zmena siete alebo zariadenia vyvolá povinnú opätovnú kontrolu. Predošlý výsledok nesmie oprávniť vstup po zmene prostredia. Opakované hlásenia tej istej zmeny nesmú cyklicky rušiť a spúšťať test.
- Ochrana rozpracovaného hovoru, práce po hovore a prehrávania nahrávky; potrebná kontrola sa odkladá tak, aby pracovisko ani zákaznícka karta nezanikli. Dostupný zostáva návrat do INDEXUS.
- Opravy zobrazovania úvodu, výsledkov a záverečnej obrazovky pripravenosti vrátane desktopového a mobilného zobrazenia.

### 2.2 Mission — nastavenie a vykonávanie práce

- Nastavenie Mission, kontaktov, agentov, pracovného postupu, skriptov a stavov; nadväzujúce voľby a automatizácie.
- Stavové zoznamy a ich akcie: zmena výsledku kontaktu, callback, úloha Back Office, email alebo SMS podľa nakonfigurovaného pravidla.
- FAQ spravované na úrovni Mission a používané v agentúrnom pracovisku.
- Verzie a klonovanie nastavení Mission. Pri obnove sa majú meniť iba nastavenia patriace danému modulu, nie cudzia konfigurácia. Klonovanie má regresné pokrytie zachovania obsahu a nových identít.
- Emailové šablóny, podpisy a Microsoft 365 integračné časti; pripojený účet agenta je súčasťou readiness. Konkrétne automatické odosielateľské pravidlá podľa krajiny zostávajú predmetom samostatných požiadaviek, nie dôkazom dokončenia každého emailového scenára.
- Pracovná relácia, história komunikácie a počítadlá aktivity; relácia sa odlišuje od denných limitov a celodenných štatistík.

### 2.3 Celý tok volania a výber hlasovej trasy

1. Manažér nastaví Mission, dostupné kontakty, agentov, pracovný postup a hlasové parametre.
2. Pre odchádzajúci hovor vyberie **globálnu trasu**, **existujúcu SK trasu** alebo **O2 IMS**; pri O2 vyberie povolené odchádzajúce Caller ID. Toto je výber operátorskej/SIP trasy, nie automatické zisťovanie mobilného operátora volaného čísla.
3. Agent vstúpi cez readiness kontrolu. Zobrazí sa iba oprávnený výber Mission a kontaktov.
4. Kontakt sa otvorí manuálne alebo cez spoločné poradie Contacts / Auto / Next. Presná identita kontaktu a Mission sa prenesie do vytáčania a histórie hovoru.
5. SIP registrácia a príprava médií riešia pripojenie; nevydarená registrácia musí mať viditeľný výsledok. Odchádzajúce zvonenie rešpektuje nastavený časový limit.
6. Prichádzajúci hovor sa podľa DID/trasy priradí do príslušného smerovania, IVR alebo fronty. Následne sa použijú členovia fronty, dostupnosť agentov a nastavené pravidlá overflow/no-agent/standing-forward.
7. Agent vidí identitu volajúceho a vhodnú kontaktnú kartu. Zapamätanie výberu karty pri opakovanom čísle je súkromné pre agenta; neprepisuje automaticky identitu hovoru.
8. Pri odpovedaní sa používa spoločná príprava ICE/TURN/DTLS; hovor má ovládanie ukončenia, podržania a príslušné možnosti smerovania. Stav médií a obnovovanie pripojenia rešpektujú bezpečnosť aktívneho hovoru.
9. Povolenie nahrávania sa odvodzuje zo serverového kontextu Mission a konkrétneho hovoru. Ukončenie, história a nahrávanie sa finalizujú raz, aj keď príde viac udalostí ukončenia.
10. Agent vyplní výsledok, požadované kroky a prípadný callback. Automatizácie môžu vytvoriť nadväzujúcu komunikáciu alebo Back Office úlohu.
11. Callback sa vráti do plánovanej fronty podľa času Europe/Bratislava; nesmie sa stratiť len preto, že bol vytvorený v skorší deň.

Výber trasy je previazaný s Mission a serverovým rozhodnutím o Caller ID. O2 identita sa nemá opierať o ľubovoľný údaj dodaný prehliadačom. Pri smerovaní na pracovný telefón alebo mobil sa zohľadňuje registrácia a živá prítomnosť agenta.

### 2.4 SMS brány a komunikačný kontext

- Implementovaný výber medzi **BulkGate** a **SMSTOOLS** podľa dostupnej konfigurácie a krajiny; SMSTOOLS je v aktuálnej implementácii obmedzený na SK.
- Mission môže určiť povinnú SMS bránu. Server kontroluje kontext Mission a nepovoľuje tiché obídenie tejto voľby inou bránou.
- Pri manuálnom odosielaní sa overuje pracovná relácia a príslušnosť príjemcu ku kontextu, z ktorého sa odosiela.
- Neznáma, vypnutá alebo nenakonfigurovaná brána má viesť k zrozumiteľnej chybe; nie k nepozorovanému odoslaniu cez inú službu.
- Zostáva rozlišovať technicky implementované odosielanie, prijatie správy poskytovateľom a skutočné doručenie príjemcovi. Aktuálne doručenie na produkcii nebolo počas tejto revízie opätovne testované.

### 2.5 Priority Builder, referrals, mestá a Queue

- Osobné uložené pohľady a predvoľby vrátane **Referral + cities** ako počiatočného pohľadu pre nových agentov s dostupnými mestami Mission. Existujúce osobné nastavenia sa plošne neprepisujú.
- Poradie: prvá vyhovujúca skupina → mesto → voliteľné uprednostnenie referral kontaktov → triedenie v skupine. Kontakt sa nezaraďuje duplicitne do viacerých skupín.
- Nové referrals znamenajú nevolané odporúčania bez callbacku. Referral pôvod zostáva viditeľný aj po hovore alebo preplánovaní.
- Voľba uprednostnenia referral kontaktov pre každú skupinu; badge Referral a badge mesta v zobrazeniach kontaktov a preplánovanej Queue.
- Všetky mestá alebo explicitný výber miest; prázdny výber nesmie rozšíriť frontu na všetky kontakty. AI poradie miest je uložený orientačný snapshot, nie aktuálna štatistika obyvateľstva.
- Desktop, mobil, Auto a Next používajú spoločnú autoritatívnu frontu. Neuložený alebo chybný pohľad nesmie potichu spustiť širší výber.
- Najnovšia oprava: návrat na Referral + cities a Save view aktivujú a uložia existujúci pohľad bez duplikátu. Opravené aj rušenie požiadavky pri samotnom prepnutí na tento pohľad.

### 2.6 Back Office a Healthcare Network

- Back Office úlohy zo stavových automatizácií, spracovanie a odpovede agentov, odovzdanie úloh a ochrana proti súbežnému dokončeniu.
- Viditeľnosť podľa krajiny a oprávnení; správne priradenie dokončenej práce riešiteľovi, nie automaticky pôvodnému adresátovi úlohy.
- Otváranie plných kariet zákazníka, kliniky či nemocnice z nadväzujúcej práce; opravy obnovovania uložených údajov a opakovaných notifikácií.
- Hromadné prideľovanie reprezentantov pre Clinics a Hospitals používa spoločné polia a filtre s AND/OR, rýchle filtre a uložené pohľady.
- Náhľad aj potvrdenie pracujú s celým výberom, nie len stránkou. Zmena filtra, typu, režimu či reprezentanta zneplatní starý náhľad; potvrdenie je previazané s výberom a cieľom.

Otvorené drobné požiadavky, napríklad ďalšie správanie reprezentanta pri vytváraní kariet, badge úloh alebo nastavenia automatizácií, nie sú týmto dokumentom označené za dokončené.

## 3. Nový systém cien produktov a služieb — Pricing Engine V2

### 3.1 Čo už existuje

- Katalóg produktov a komponentov: produkt je kombinácia odberových/skladovaných komponentov, nie iba jedna pevná cena.
- Verziované cenníky podľa krajiny, mena, platnosť a stavy draft / active / archived.
- Ceny odberu produktu alebo jednotlivých komponentov, skladné podľa dĺžky skladovania, predplatenie a splátkové plány.
- Matica nekompletných odberov; pravidlá kontaminácie, nízkeho objemu a paušálneho poplatku pri príslušnom výsledku.
- Zľavy sales/Back Office na produkt aj komponent, s kontrolou maximálnych povolených hodnôt.
- Položkový výpočet s odôvodnením pravidiel, menovým prepočtom a upozorneniami; nákladové ceny a marže.
- Administrátorské UI, kalkulačka, import/export a úpravy cenníkov; podklady pre infláciu a FX.
- Dátový model priradenia zákazníka ku konkrétnej cenovej verzii. Samotná existencia tabuľky neznamená dokončené automatické priradenie v každom predajnom flow.

### 3.2 Čo ešte nie je uzavreté

1. Nahradenie pôvodného Products / Configurator v zákazníckych, zmluvných a fakturačných cestách. V2 nemá zostať navždy len paralelnou kalkulačkou.
2. Jednoznačné mapovanie starých produktov a balíkov na V2 produkty a komponenty.
3. Automatické a auditovateľné pridelenie správnej cenovej verzie zákazníkovi pri obchodnom rozhodnutí.
4. Historické cenníky a politika grandfatheringu: existujúci zákazník nesmie dostať dnešnú cenu len preto, že sa načítala aktuálna konfigurácia.
5. Trvalé uloženie výpočtu do obchodného dokumentu a napojenie na BO/fakturáciu. V overených cestách sa nenašlo dokončené prepojenie kalkulačky V2 so vznikom zmluvných a fakturačných položiek.
6. Akceptácia ročnej zmeny cenníka vrátane inflácie a krajinných výnimiek. Existujúce inflačné/FX funkcie treba overiť ako celý proces; neoznačujeme ich plošne za chýbajúce.

Pôvodný importér bol navrhnutý na vymazanie a opätovné naplnenie cenových dát. **Pred importom do používaného prostredia treba overiť jeho správanie a väzby zákazníkov; nesmie sa použiť ako neoverená migrácia historických cien.** Táto revízia nič neimportuje ani nemení v databáze.

## 4. Contracts — zmluvy a záväzná cena

Zmluvný modul existuje vrátane stavov, produktov a dátových polí pre uložený rozpis produktu, ceny a splátok. Historická migrácia zmlúv nie je dôkazom dokončenia nového predaja cez V2.

### Cieľový postup

1. Zvoliť zákazníka, krajinu, fakturačný subjekt, produkt/služby a obchodné podmienky.
2. Server určí povolenú verziu cenníka a vypočíta cenu spoločným Pricing Engine.
3. Používateľ uvidí položky, menu, zľavy, dane podľa schválenej politiky, splátky a upozornenia.
4. Pri uložení/podpise sa zachová nemenný cenový snapshot: vstupy, cenová verzia, pravidlá, položky a výsledné sumy.
5. Zmena cenníka nesmie spätne meniť podpísanú zmluvu. Nová dohodnutá cena má mať samostatnú dohľadateľnú zmenu.

**Zostáva dopracovať:** prepojenie vytvorenia/úpravy zmluvy na V2 výpočet, povinné väzby a blokovanie chýbajúcich vstupov, používateľský náhľad uloženého výpočtu a akceptačné testy po zmene cenníka. Konkrétny existujúci podpisový kanál a šablóny treba overiť v krajinnom akceptačnom teste; nejde o požiadavku automaticky nahradiť podpisový systém.

## 5. Invoicing — faktúry, splátky a skladné

### Implementované časti

- Fakturačný dátový model, položky, platby, meny, sumy a stavy.
- Zoznam faktúr s vyhľadávaním, filtrami, stavovým prehľadom a PDF.
- Konfigurácia fakturačných subjektov a číslovacích radov; dátový základ plánovaných faktúr.
- Existujúce hromadné generovanie a vytváranie plánovaných splátok.

### Konkrétna integračná medzera

Overená cesta `/api/invoices/bulk-generate` pracuje so starými zákazníckymi produktmi a `priceOverride × quantity`, používa EUR a nevytvára plnohodnotnú V2 väzbu na zmluvný výpočet ani príslušný položkový reťazec. **Túto cestu nemožno prezentovať ako hotovú V2 fakturáciu.**

Zostáva vytvoriť alebo doplniť jednotnú službu fakturácie zo zmluvy/odsúhlaseného vyúčtovania. Musí vytvoriť faktúru aj položky, zachovať menu, dane a cenový snapshot, naviazať doklad na zmluvu a spracovať opakovanú požiadavku bez duplicitnej faktúry.

Splátky a opakované skladné musia vychádzať z uložených podmienok. Plánovaná faktúra potrebuje dátum, sumu, stav, väzbu na pôvodný obchod a vytvorený doklad. Existencia plánovacích tabuliek a endpointov sama nepotvrdzuje automatickú prevádzku pravidelného spracovania.

Pred aktiváciou treba schváliť historické faktúry verzus nový začiatok, fakturačné firmy a účty, číslovanie, daňové pravidlá, krajinné PDF a platobné údaje/QR. Starý údaj „0 faktúr“ pochádza z mája a musí sa znovu zmerať, nie opakovať ako dnešný fakt.

## 6. Collections a Laboratory Connect

### 6.1 Čo je implementované

- Evidencia odberov s väzbami na zákazníka, zmluvu, produkt a laboratórium. Nie všetky väzby sú v modeli povinné.
- Formuláre laboratórnych výsledkov a ukladanie výsledkov v internom CRM.
- Externé API Laboratory Connect: prijatie výsledku, dávka do 100 položiek, čítanie a aktualizácia, vyhľadanie odberu podľa identifikátora alebo externej referencie.
- API kľúče s oprávneniami na čítanie/zápis výsledkov; ochrana pred duplicitou pri zadanom `clientResultId`. Tento identifikátor je v aktuálnom modeli globálne unikátny.
- Externá cesta aktualizuje stav odberu pri príslušnom číselnom stave výsledku. Dávka vracia výsledok jednotlivých položiek.

Ide o implementované rozhranie, nie iba plán. **Nie je však potvrdený kompletný živý proces s konkrétnym laboratórnym partnerom ani automatické prepojenie na cenové vyúčtovanie.** Konfigurácia laboratórnej URL sama nepotvrdzuje existenciu odchádzajúceho konektora.

### 6.2 Konkrétne otvorené body z revízie

| Bod | Zistenie | Potrebné dokončenie |
|---|---|---|
| Interné verzus externé uloženie | Obe cesty existujú, ale interný zápis nemá rovnakú aktualizáciu stavu odberu ako API v1. | Jednotné validácie, mapovanie stavov a úmyselne zhodné následky. |
| Identita odberu | Interná aktualizácia pripúšťa klientom dodaný `collectionId`. | Identitu pevne viazať na autorizovaný cieľ; zabrániť presunu výsledku na iný odber. |
| Aktuálny výsledok verzus história | Interná cesta vyberá jeden výsledok, no databáza povoľuje viac výsledkov odberu. | Schváliť model histórie/verzií alebo jedného aktuálneho výsledku; nepoužiť svojvoľne prvý riadok. |
| Izolácia laboratória | API oprávnenie nie je preukázane naviazané na laboratórium a jeho povolené odbery; interné cesty vyžadujú doplnenie rozsahovej autorizácie. | Serverová kontrola laboratória/krajiny/odberu, audit zdroja a negatívne testy. |
| Opakované výsledky | Neprázdny externý identifikátor je globálne unikátny; bez neho môže vzniknúť viac záznamov. | Dohodnúť identifikátory partnerov, opakovanie a opravy; neoznačovať každú druhú verziu za nežiaducu duplicitu. |
| Obchodný následok | Výsledok nemení automaticky V2 výpočet, zmluvu ani faktúru. | BO vyhodnotenie skutočného odberu cez rovnaký engine a schválené vyúčtovanie. |

Tieto body sú podmienkami pred rozšírením ostrého externého prístupu. Revízia ich dokumentuje; aplikácia ani jej oprávnenia sa v rámci tejto práce nemenia.

## 7. Postup dokončenia od cien po Laboratory Connect

Poradie určuje závislosti, nie sľúbený termín. Odhady a dátumy sa majú stanoviť až po potvrdení produkčného stavu, pravidiel fakturácie a rozhrania laboratória.

### Krok 0 — Potvrdiť východiskový stav

- Spustiť priložený read-only prehľad na Ubuntu produkcii a identifikovať chýbajúce tabuľky/stĺpce aj aktuálne počty.
- Prevádzkovo potvrdiť verziu nasadenej aplikácie a aktívne krajiny; databázový SELECT nepotvrdzuje SIP hovory, doručenie SMS ani spojenie s laboratóriom.
- Oddeliť historické importované dáta, testovacie doklady a nový proces.
- Výstup: potvrdený inventár, zoznam krajín a zoznam dátových nedostatkov bez osobných údajov.

### Krok 1 — Dokončiť a schváliť katalóg/cenníky

- Pricing Administrator overí produkty, komponenty, služby, skladné, zľavy, nekompletné odbery a splátky pre každú krajinu.
- Schváliť verzie a účinnosť, historické cenníky a inflačné výnimky. Neaktivovať neúplné pravidlá.
- Akceptácia: každá podporovaná kombinácia dá očakávaný položkový výsledok alebo explicitnú chybu; historická verzia zostáva dostupná.

### Krok 2 — Pripojiť zákazníka a existujúce produkty

- Doplniť mapovanie legacy produktov na V2 a jednoznačné priradenie cenovej verzie ku obchodnému vzťahu.
- Oddeliť nových a existujúcich zákazníkov; nedoplniť historickú cenu odhadom.
- Akceptácia: uloženie a opätovné otvorenie zákazníka zachová produkt a cenovú verziu; zmena aktívneho cenníka ich nezmení.

### Krok 3 — Pripojiť Contracts na V2

- Použiť spoločný serverový výpočet, uložiť položkový snapshot a zobraziť ho pred potvrdením/podpisom.
- Doplniť stavy vytvorenie, úprava, potvrdenie, zrušenie a zmena podmienok bez prepisovania histórie.
- Akceptácia: zmluva sa dá znovu zobraziť s identickou cenou aj po zmene cenníka; chýbajúce vstupy blokujú vznik záväzného dokumentu.

### Krok 4 — Zjednotiť väzby na odber

- Každý fakturovateľný odber má jednoznačnú zmluvu, zákazníka, produkt/komponenty a cenovú verziu.
- Existujúce chýbajúce väzby riešiť odsúhlaseným mapovaním, nie automatickým odhadom.
- Akceptácia: neúplný alebo cudzí odber nemôže vytvoriť obchodný doklad.

### Krok 5 — Dokončiť bezpečný príjem laboratórnych výsledkov

- Zjednotiť interné a externé ukladanie, oprávnenia, identitu odberu a model verzií výsledku.
- S partnerom odsúhlasiť identifikátory, stavy, povinné polia, opakovanie a opravné správy.
- Akceptácia: cudzí odber je odmietnutý; opakovanie nevytvára neúmyselný duplikát; oprava má dohľadateľnú históriu a správny stav.

### Krok 6 — BO vyhodnotenie a konečné vyúčtovanie

- Z laboratórneho výsledku vyhodnotiť odobraté/uskladnené komponenty, kontamináciu a objem.
- Použiť cenovú verziu dohodnutú so zákazníkom a rovnaký engine ako fakturácia.
- Rozdiel oproti pôvodnej ponuke musí byť vysvetlený a schválený; nepísať novú cenu potichu do podpísanej zmluvy.
- Akceptácia: kompletný, čiastočný, kontaminovaný, nízkoobjemový aj nulový odber majú reprodukovateľné vyúčtovanie.

### Krok 7 — V2 faktúra zo zmluvy/vyúčtovania

- Zaviesť jednu službu, ktorá vytvorí doklad a položky z uloženého podkladu, nie z momentálneho cenníka alebo legacy override.
- Zabezpečiť menu, dane, fakturačný subjekt, číslovací rad, PDF a platobné údaje.
- Akceptácia: opakované potvrdenie nevytvorí druhú faktúru; súčet položiek sedí s dokladom a odsúhlaseným podkladom.

### Krok 8 — Splátky, skladné, úhrady a opravy

- Prepojiť harmonogramy na rovnakú fakturačnú službu a explicitné pravidlá splatnosti, zrušenia a opakovania.
- Schváliť spracovanie platieb a opravných dokladov; existujúce vydané doklady neprepisovať podľa neskoršieho laboratórneho výsledku.
- Akceptácia: splátka vznikne presne raz, úhrada má správny doklad a zostatok, oprava má auditnú väzbu.

### Krok 9 — Pilot a úplné prepnutie

- Pilotná krajina a laboratórny partner, potom ďalšie krajiny po samostatnej akceptácii.
- Overiť nový predaj, historický cenník, chýbajúci údaj, opakovanú správu, opravu výsledku, chybu poskytovateľa a bezpečné opakovanie fakturácie.
- Až po porovnaní výsledkov obmedziť starý Products/Configurator a legacy fakturačné cesty. Zachovať históriu a plán návratu.
- Akceptácia: dohľadateľný reťazec zákazník → zmluva → odber → výsledok → cenový podklad → faktúra → úhrada.

Fakturačné jadro možno vyvíjať paralelne s laboratórnym konektorom po schválení cenového snapshotu a identít. Automatické účtovanie skutočného výsledku však závisí od oboch.

## 8. Ostatné moduly a pôvodné kontrolné nálezy

Zákazníci, kliniky, nemocnice, spolupracovníci, komunikácia, zmluvy, odbery, oprávnenia, NexusPoint/SharePoint, AI/Lead Intelligence a web formuláre zostávajú súčasťou INDEXUS. Táto revízia ich neodstraňuje ani ich historický import neoznačuje za nový úspech posledného obdobia.

Pôvodné údaje z mája boli: 205 tabuliek, 165 462 zákazníkov, 236 935 zmlúv, 198 066 odberov, 1 163 268 komunikačných správ, 0 faktúr a 15 fakturačných položiek. **Ide výhradne o historický snapshot.** Aktuálne počty, chýbajúce poisťovne, používateľské roly a väzby odberov treba znovu overiť. Ani počet prázdnych väzieb sám osebe neurčuje, že sa majú doplniť automaticky alebo záznamy zmazať.

Staré tvrdenie o nefunkčnom ARI/telefónii sa nepoužíva ako aktuálny stav: nahrádza ho vyššie uvedené potvrdenie funkčného Pulse/Mission a popis dnešnej implementácie. Staré plány obsahujú aj rozhodnutia, ktoré sa odvtedy implementovali; nepreberajú sa bez porovnania.

Úplný pôvodný text je zachovaný ako historická príloha v `docs/indexus-overview-2026-05-archive.md`, s odstráneným heslom z pôvodného prihlasovacieho príkazu. Archív nie je prevádzkový návod ani aktuálny backlog.

## 9. Produkčné overenie — čo poslať späť

Pripravený súbor: `docs/sql/indexus-overview-production-check.sql`. Používa iba read-only transakciu, SELECTy a klientské príkazy psql. Nevypisuje mená zákazníkov, kontakty, bankové účty, texty zmlúv, SMS, heslá ani kľúče. Chýbajúce tabuľky alebo stĺpce označí ako SKIPPED namiesto vykonania neplatného dotazu.

Na Ubuntu produkcii použite schválené existujúce prihlásenie do databázy. Príklad s databázovým účtom a interaktívnym zadaním hesla, ak ho konfigurácia vyžaduje:

```sh
psql -X -h localhost -U indexus -d indexus_crm -W -v ON_ERROR_STOP=1 -f indexus-overview-production-check.sql > indexus-overview-production-check.txt
```

Súbor SQL musí byť najprv skopírovaný na server. Heslo zadajte iba do lokálnej výzvy psql; neposielajte ho do chatu ani do príkazu. Ak máte iný schválený read-only účet alebo existujúci bezpečný prihlasovací profil, použite ten. Skript nevyžaduje zmenu práv, schémy ani konfigurácie.

Pošlite výsledný TXT. Z neho sa doplní dátovo overená príloha: pokrytie cenníkov, priradenia zákazníkov, stavy zmlúv, väzby odberov, laboratórne výsledky a reálne používanie fakturácie. SELECTy nepotvrdzujú nasadenú verziu aplikácie, úspešnosť konkrétnych hovorov či doručenie SMS; to má samostatný prevádzkový dôkaz.

## 10. Technické podklady revízie

| Oblasť | Hlavné podklady v repozitári |
|---|---|
| Readiness a opakovaný test | `client/src/features/nexus-pulse-preflight/PulseDiagnostics.tsx`, `PulsePreflightProvider.tsx`; testy `e2e/pulse-readiness.spec.ts`, `e2e/pulse-gate-invalidation.spec.ts`. |
| Mission / hlas / operátorská trasa | `client/src/pages/campaign-detail.tsx`, `shared/telephony-routing.ts`, `server/inbound-routes.ts`, `server/lib/queue-engine.ts`. |
| SMS | `server/lib/sms-provider-selection.ts`, `server/lib/sms-provider.ts`. |
| Priority Builder / Queue | `client/src/components/agent/PriorityBuilder.tsx`, `priority-builder.ts`, `client/src/pages/agent-workspace.tsx`, `e2e/priority-builder.spec.ts`. |
| Mission verzie / klonovanie / FAQ | `server/nexus-pulse-version-routes.ts`, `server/lib/clone-campaign.integration.test.ts`, `shared/mission-faq.ts`. |
| Hromadné priradenie | `client/src/pages/bulk-assign.tsx`, `shared/medical-partner-filter.ts`, `server/representative-routes.ts`. |
| Pricing V2 | `docs/PRICING_ENGINE_V2_STATUS.md` (starší stavový podklad, nie dôkaz dnešného nasadenia), `server/pricing-engine.ts`, `server/pricing-routes.ts`, `client/src/pages/pricing.tsx`. |
| Zmluvy a fakturácia | `shared/schema.ts`, `client/src/pages/contracts.tsx`, `client/src/pages/invoices.tsx`, fakturačné cesty v `server/routes.ts`. |
| Laboratory Connect | `client/src/pages/collections.tsx`, interné `/api/collections/:id/lab-results` a externé `/api/v1/lab-results` cesty v `server/routes.ts`, laboratórne úložisko v `server/storage.ts`. |

**Záver:** komunikačné a agentúrne jadro je funkčné. Cenový engine a obchodno-laboratórne moduly sú už významne implementované. Aktuálne sme pred dokončením ich spoločného, auditovateľného end-to-end procesu; najvyššou prioritou je cenová verzia a snapshot, bezpečné laboratórne spracovanie a fakturácia z rovnakého podkladu.
