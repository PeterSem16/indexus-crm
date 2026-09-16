# INDEXUS CRM — Aktuálny prehľad a plán dokončenia

> **Revízia:** 16. september 2026
> **Rozsah:** revízia oproti májovému prehľadu; aktuálna implementácia CRM, Nexus Pulse, Mission, obchodno-laboratórneho procesu a kompletný plán migrácie ISCBC.
> **Podklady:** aktuálny zdrojový kód, vykonané cielené regresné overenia a existujúce testovacie rutiny, stavový dokument Pricing Engine V2 a dokumentácia migrácie ISCBC → INDEXUS.
> **Produkčné dáta:** v tejto revízii nebol vykonaný prístup na CORPCRM01 ani SQL dotazy proti produkcii. Staré počty nie sú aktuálnym stavom.

## 1. Manažérsky súhrn

INDEXUS už nie je iba evidencia zákazníkov a historických zmlúv. Obsahuje funkčné agentúrne pracovisko Nexus Pulse, riadenie práce cez Mission, prichádzajúce aj odchádzajúce volania, fronty, callbacky, nahrávanie a nadväzujúcu komunikáciu. **Nexus Pulse a Mission boli implementované; ich kľúčové mechanizmy boli overované sadou testovacích rutín.** Cielené vykonané regresné overenia, rozsah automatizovaných scenárov a limity testov sú uvedené v kapitole 12. Implementácia bola porovnaná s aktuálnym kódom.

Najnovšie opravy v repozitári však nie sú automaticky dôkazom ich nasadenia na produkciu. Tento dokument nie je záznamom nového produkčného akceptačného testu a neoznačuje všetky krajiny, brány či externých partnerov za nezávisle otestovaných.

**Nasledujúca hlavná etapa je obchodný a laboratórny reťazec:**

Nový cenník produktov a služieb → pridelenie verzie cenníka zákazníkovi → zmluva s uloženou cenou → odber → laboratórny výsledok → vyhodnotenie skutočne dodaných služieb → faktúra/splátky/skladné → úhrada a kontrola.

Nový Pricing Engine V2, zmluvný modul, fakturačný modul a Laboratory Connect už majú implementované významné časti. **Ešte však nejde o jeden dokončený automatizovaný proces.** Prioritou nie je vytvoriť ďalšiu kalkulačku, ale prepojiť existujúce moduly tak, aby používali rovnaké identifikátory, pravidlá a nemenné cenové podklady.

### 1.1 Ako čítať stav

| Označenie | Význam |
|---|---|
| Implementované a cielene testované | Funkcia existuje a jej konkrétne scenáre boli overené vykonanými testami; rozsah a výsledky sú uvedené v kapitole 12. Neznamená to univerzálnu produkčnú akceptáciu. |
| Implementované | V repozitári je funkčný kód príslušnej časti; nasadenie a produkčné dáta môžu vyžadovať potvrdenie. |
| Čiastočne prepojené | Moduly existujú, ale chýba spoločný proces, kontrola alebo automatické odovzdanie dát. |
| Na dopracovanie / overenie | Konkrétna medzera v kóde alebo chýbajúci produkčný či obchodný dôkaz. |

### 1.2 Súhrnná mapa

| Oblasť | Aktuálna etapa | Čo zostáva |
|---|---|---|
| Nexus Pulse + Mission | Implementované a cielene testované; podrobnosti v kapitole 12 | Prevádzkové monitorovanie, priebežné opravy, potvrdenie nasadenia posledných zmien. |
| Hlasové trasy a SMS brány | Implementovaný výber podľa Mission a krajiny | Evidovať akceptáciu každej používanej kombinácie krajina/trasa/brána. |
| Priority Builder a osobná fronta | Implementované | Prevádzkové overenie najnovších opráv uloženia a zobrazenia. |
| Customers + Healthcare Network / Back Office | Implementované karty, evidencie, vzťahy a pracovné postupy; podrobnosti v kapitole 2 | Aktuálne produkčné počty a úplnosť väzieb treba získať z Ubuntu SQL výpisu; obchodné a finančné integrácie zostávajú samostatnou etapou. |
| Pricing Engine V2 | Implementovaný cenník, pravidlá a výpočet | Produkčné verzie, historické priradenia a zapojenie do zákazníka/zmluvy/BO/fakturácie. |
| Contracts | Existujúci modul a cenové snapshoty v modeli | Napojenie na autoritatívny V2 výpočet a cenovú verziu. |
| Invoicing | Existujúce UI, dátový model a generovanie | Zmluvne viazaná V2 fakturácia, položky, meny, dane, splátky a bezpečné opakovanie. |
| Laboratory Connect | Implementované interné formuláre aj externé API | Zjednotiť spracovanie, autorizáciu laboratória, históriu výsledkov a obchodné následky. |
| Migrácia ISCBC | Implementované migračné skripty a mapovania; rozsah v kapitole 11 | Zjednotiť migračnú cestu, doplniť otvorené domény, vykonať reconciliáciu a riadené prepnutie. |
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

### 2.7 Customers — karta zákazníka a súvisiace evidencie

Karta **Customers** je hlavná zákaznícka evidencia, nie iba zoznam mien. Implementovaný model a používateľské rozhranie pokrývajú tieto skupiny údajov:

- **Identita a kontakty:** interné číslo, tituly, meno, priezvisko, rodné meno, telefón, mobil a ďalšie čísla, e-mailové adresy, rodné číslo, číslo občianskeho preukazu a dátum narodenia.
- **Adresy:** trvalá adresa a voliteľná korešpondenčná adresa s krajinou, mestom, PSČ, regiónom a okresom.
- **Stav a obchodný pipeline:** stav zákazníka `potential / acquired / terminated`, prevádzkový stav `active / pending / inactive`, lead status, lead score, dátum aktualizácie skóre, zdroj registrácie a dátum registrácie.
- **Marketing a segmentácia:** newsletter, typ sťažnosti, typ spolupráce, VIP stav, tagy, poznámky, pridelený používateľ a zdroj leadu.
- **Zdravotné a pôrodné väzby:** zdravotná poisťovňa, gynekológ, kontakt na gynekológa, predpokladaný termín pôrodu, nemocnica, vybraná klinika a konkrétny spolupracovník/lekár.
- **Produkty a obchod:** zákaznícke produkty, stav služby, väzba na kampane a kontaktné entity, podklady pre zmluvu a faktúru. Táto existencia ešte neznamená, že každý predaj už prechádza výhradne cez Pricing Engine V2.
- **Prevádzková história:** poznámky, súhlasy/GDPR, dokumenty, komunikácia, odbery, prípady, faktúry, úhrady, splátky a pohľadávky. Historické dáta treba odlíšiť od nových akcií agenta.

Pri migrácii ISCBC sa zákazník skladá z `Clients`, `Persons`, `Contacts` a `MailAddresses`. Import zachováva `internal_id` a `data_source = 'iscbc'`; potenciálni klienti sa mapujú ako `client_status = 'potential'`. Pred zlúčením duplicít je potrebné porovnať interné číslo, legacy ID, dátumy, adresy a existujúce väzby. Spoločný telefón alebo e-mail sám o sebe nie je bezpečný dôvod na zlúčenie.

### 2.8 Healthcare Network — kliniky, nemocnice a PZK/PZS sieť

Healthcare Network je samostatná doména pre zdravotníckych partnerov a ich kontaktnú sieť:

- **Kliniky/ambulancie:** názov, lekár a titul, meno lekára, kategória pozície, identifikátor ZZ, kód a názov PZS/PZK podľa zdrojového označenia, IČO, úplná adresa, tri telefónne a tri e-mailové polia, web, GPS, krajina, región, okres, aktivita a poznámky.
- **Obchodný stav kliniky:** zdroj leadu, odporúčanie lekárom, konferencia, počiatočný stav, záujem o spoluprácu, záujem o zmluvu, stav zmluvy, výsledok a poznámka posledného hovoru, ďalší kontakt, odoslanie/vrátenie zmluvy a stav letákov.
- **Nemocnice:** aktívny stav, názov, adresa, krajina, laboratórium, GPS, zodpovedná osoba, reprezentant, kontaktná osoba, telefón, e-mail, regionálne údaje a väzby na spolupracovníkov.
- **Reprezentanti:** aktuálne priradenie, história platnosti priradení, zmena reprezentanta a hromadné priradenie pre kliniky aj nemocnice. Hromadná operácia pracuje s úplným náhľadom filtrovaného výberu, nie iba s aktuálnou stránkou.
- **Sieťové väzby:** referrals medzi klinikami, nemocničné siete a ich členovia, spolupracovníci/lekári naviazaní na kliniky alebo nemocnice, kategórie partnerov a udalosti kliniky.
- **Stavy spolupráce:** stavové záznamy kliniky sú oddelené od všeobecného `is_active`; zachovávajú fázu, stavový kľúč a časovú históriu, aby sa obchodný proces neprepisoval jedným aktuálnym flagom.
- **Filtrovanie a Back Office:** rovnaká logika filtrov pre zoznam a bulk operáciu, vyhľadávanie podľa zdravotníckeho partnera, mesta, reprezentanta, kontaktov, GPS, kategórie, stavu a ďalších polí. Oprávnenia a krajiny sa kontrolujú aj na serveri.

V produkčnom výpise potrebujeme osobitne zmerať počet všetkých kliník, aktívnych kliník, kliník s PZK/PZS kódom, kliník s ID ZZ, IČO, e-mailom, telefónom, GPS, zmluvným stavom a reprezentantom. Rovnakú maticu treba vyhodnotiť pre nemocnice. Výpis má obsahovať iba agregácie a rozdelenia podľa krajiny/stavu; nemá obsahovať mená lekárov, telefóny, e-maily ani kódy jednotlivých kliník.

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

### 7.1 Zjednotený realizačný plán

Na rozdiel od technického poradia jednotlivých podúloh je manažérsky postup nasledovný:

1. **Zjednotiť cenotvorbu a cenníkový modul.** Pricing Engine V2 sa stane jediným autoritatívnym výpočtom pre nové produkty, komponenty, odbery, skladné, zľavy, nekompletné odbery, meny a splátky. Zákazník a zmluva musia dostať konkrétnu cenovú verziu a nemenný položkový snapshot. Legacy Products/Configurator sa vypne až po porovnaní výsledkov.
2. **Dopracovať fakturáciu a spoluprácu s ESO účtovým systémom.** Treba uzavrieť, či ESO dostáva faktúry cez API, exportný súbor alebo inú schválenú integračnú cestu. Dohodnúť mapovanie zákazníka, firmy, meny, DPH, číselných radov, účtov, položiek, úhrad, storna a dobropisov. Synchronizácia musí byť idempotentná, auditovateľná a nesmie vytvoriť druhý doklad pri opakovaní.
3. **Dopracovať vytváranie zmlúv a templates pre zmluvy a fakturáciu.** Zmluva musí používať schválený V2 snapshot, správnu krajinu, menu, produkt, splátky a podpisovú verziu. Templates majú mať verziovanie, jazyk, krajinné pravidlá, placeholdery, audit generovania a väzbu na fakturačné podmienky. Podpísaná zmluva a vydaná faktúra sa nesmú spätne prepísať novým cenníkom.
4. **Na konci prepojiť laboratórny modul.** Laboratory Connect má po autorizovanom výsledku spustiť vyhodnotenie skutočne dodanej služby cez rovnaký engine, vytvoriť schválený podklad pre fakturáciu a zachovať históriu opráv. Interné a externé cesty musia mať rovnaké validačné a bezpečnostné pravidlá.

ESO v tejto revízii označujeme ako plánovanú externú účtovú integráciu. V repozitári nebol nájdený dôkaz dokončenej produkčnej synchronizácie INDEXUS ↔ ESO; technické rozhranie, autentizácia, vlastníctvo číselných radov a pravidlá opráv treba potvrdiť samostatným integračným návrhom.

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

Staré tvrdenie o nefunkčnom ARI/telefónii sa nepoužíva ako aktuálny stav: nahrádza ho aktuálny popis implementácie Pulse/Mission a konkrétne regresné overenia v kapitole 12. Staré plány obsahujú aj rozhodnutia, ktoré sa odvtedy implementovali; nepreberajú sa bez porovnania.

Úplný pôvodný text je zachovaný ako historická príloha v `docs/indexus-overview-2026-05-archive.md`, s odstráneným heslom z pôvodného prihlasovacieho príkazu. Archív nie je prevádzkový návod ani aktuálny backlog.

## 9. Produkčné overenie — čo poslať späť

Pripravený súbor: `docs/sql/indexus-overview-production-check.sql`. Používa iba read-only transakciu, SELECTy a klientské príkazy psql. Nevypisuje mená zákazníkov, kontakty, bankové účty, texty zmlúv, SMS, heslá ani kľúče. Chýbajúce tabuľky alebo stĺpce označí ako SKIPPED namiesto vykonania neplatného dotazu.

Na Ubuntu produkcii použite schválené existujúce prihlásenie do databázy. Príklad s databázovým účtom a interaktívnym zadaním hesla, ak ho konfigurácia vyžaduje:

```sh
psql -X -h localhost -U indexus -d indexus_crm -W -v ON_ERROR_STOP=1 -f indexus-overview-production-check.sql > indexus-overview-production-check.txt
```

Súbor SQL musí byť najprv skopírovaný na server. Heslo zadajte iba do lokálnej výzvy psql; neposielajte ho do chatu ani do príkazu. Ak máte iný schválený read-only účet alebo existujúci bezpečný prihlasovací profil, použite ten. Skript nevyžaduje zmenu práv, schémy ani konfigurácie.

Pošlite výsledný TXT. Z neho sa doplní dátovo overená príloha: pokrytie cenníkov, priradenia zákazníkov, stavy zmlúv, väzby odberov, laboratórne výsledky a reálne používanie fakturácie. SELECTy nepotvrdzujú nasadenú verziu aplikácie, úspešnosť konkrétnych hovorov či doručenie SMS; to má samostatný prevádzkový dôkaz.

### 9.1 Prosba o aktuálny anonymizovaný výpis z Ubuntu

Prosím, spusti tento SQL súbor na Ubuntu serveri nad aktuálnou databázou a pošli späť iba výsledný TXT:

```sh
psql -X -h localhost -U indexus -d indexus_crm -W -v ON_ERROR_STOP=1 \
  -f indexus-overview-production-check.sql > indexus-overview-production-check.txt
```

Ak súbor nie je v aktuálnom adresári, najprv ho bezpečne skopíruj na server. Heslo zadaj iba do interaktívnej výzvy psql; neposielaj ho do chatu, do príkazu ani do výstupu.

Výpis má obsahovať najmä:

- aktuálny celkový počet zákazníkov a rozdelenie podľa krajiny, `status`, `client_status` a zdroja,
- počet zákazníkov s klinikou, spolupracovníkom, zdravotnou poisťovňou a prideleným používateľom,
- počet a stav zákazníckych produktov, poznámok, súhlasov, prípadov, dokumentov a pohľadávok,
- všetky kliniky agregovane podľa krajiny a aktivity,
- počet kliník s PZK/PZS kódom, ID ZZ, IČO, telefónom, e-mailom, GPS a reprezentantom,
- kliniky rozdelené podľa počiatočného stavu, záujmu o spoluprácu, záujmu o zmluvu a stavu zmluvy,
- nemocnice podľa krajiny/aktivity vrátane laboratória a reprezentanta,
- počet reprezentantských priradení, histórie, referrals, nemocničných sietí, členov sietí, udalostí a stavov spolupráce,
- spolupracovníkov podľa krajiny, aktivity a zdroja,
- cenníky, cenové priradenia, zmluvy, odbery, laboratórne výsledky, faktúry, položky, splátky a väzby,
- agregované počty záznamov označených ako import z ISCBC.

Skript nečíta mená, telefóny, e-maily, rodné čísla, bankové účty, texty poznámok, dokumentov, výsledkov, API kľúče ani heslá. `SKIPPED` znamená chýbajúcu tabuľku alebo stĺpec, nie nulový počet. Po doručení TXT doplním do overview samostatnú dátovú prílohu s aktuálnymi počtami a zoznamom dátových medzier.

### 9.2 Aktuálna produkčná dátová príloha — 16. september 2026

Výpis bol vykonaný **16. 9. 2026 o 09:22:11 UTC** v read-only transakcii. Všetkých 42 kontrolovaných tabuliek existuje. Nasledujúce čísla sú aktuálny agregovaný stav databázy `indexus_crm`, nie historický májový odhad.

| Oblasť | Aktuálny stav |
|---|---:|
| Zákazníci | 165 463 |
| Zákazníci s `data_source = 'iscbc'` | 165 448 |
| Kliniky | 10 080, z toho 10 079 aktívnych |
| Kliniky s PZK/PZS kódom, ID ZZ a IČO | 753 |
| Kliniky s e-mailom / telefónom / GPS | 2 143 / 5 160 / 8 363 |
| Nemocnice | 1 213, z toho 1 142 aktívnych |
| Nemocnice s priradeným laboratóriom | 848 |
| Spolupracovníci | 20 136 |
| Aktivity spolupracovníkov | 344 756 |
| Dohody spolupracovníkov | 59 549 |
| Komunikačné správy | 1 163 531 |
| Zákaznícke poznámky | 2 404 177 |
| Zákaznícke dokumenty | 3 013 370 |
| Potenciálne prípady | 165 647 |
| Pohľadávkové záznamy | 183 778 |
| Odbery | 198 167 |
| Laboratórne výsledky | 197 850 |
| Zmluvy | 236 935 |
| Faktúry | 0 |

#### Dátové medzery, ktoré treba riešiť pred plnohodnotným CRM

1. **Pricing V2 ešte nie je priradený zákazníkom:** existuje 12 cenových verzií, 82 cien odberov, 109 skladovacích cien, 131 pravidiel nekompletných odberov a 18 splátkových plánov, ale `pricing_customer_price_lists` má 0 priradení. `customer_products` má iba 12 záznamov.
2. **Fakturácia nie je naplnená:** `invoices` má 0 záznamov a `scheduled_invoices` tiež 0. Súčasne existuje 15 `invoice_items` bez nadradenej faktúry. Pred ESO integráciou treba rozhodnúť, či ide o historické siroty, testovacie dáta alebo chybné importné zvyšky.
3. **Odbery nemajú použiteľnú produktovú väzbu:** z 198 167 odberov je 197 718 bez `product_id` a 88 bez `contract_id`.
4. **Zmluvné ID treba reconciliovať:** SQL našiel 198 079 odberov s `contract_id`, ktorý sa nenachádza v `contract_instances`. Ide o kritickú kontrolu pred prepojením odber → zmluva → cena → faktúra; nemusí ísť o fyzicky chýbajúce historické zmluvy, ale o nesúlad ID alebo importných väzieb.
5. **Laboratórna história má otvorené väzby:** 55 výsledkov nemá existujúci odber. Pri 209 odberoch existuje viac výsledkov; to môže byť legitímna história opráv, ale musí sa označiť aktuálna verzia a auditná história.
6. **Healthcare Network nemá aktívnu históriu reprezentantov:** tabuľky `clinic_representative_assignments` a `hospital_representative_assignments` majú 0 riadkov. Na samotných nemocniciach sú pritom 2 denormalizované reprezentantské väzby a na klinikách 0. Treba rozhodnúť, či sa majú tieto existujúce väzby spätne zapísať do historických assignment tabuliek.
7. **Kliniky nie sú označené legacy ID:** všetkých 10 080 kliník má `legacy_id` NULL. Ak kliniky pochádzajú z ISCBC alebo iného starého zdroja, treba doplniť zdrojové mapovanie; bez neho sa nedá bezpečne vykonať idempotentná migrácia a reconciliácia kliník.
8. **Customers má minimum nových väzieb:** iba 1 zákazník má `clinic_id`, 1 `collaborator_id`, 17 `health_insurance_id` a 0 `assigned_user_id`. To môže byť zámer pre historický import, ale pred novým predajom treba určiť, ktoré väzby sú povinné a ktoré sa dopĺňajú až počas procesu.

Tieto výsledky menia prioritu: najprv treba uzavrieť mapovanie historických zmlúv, produktov a kliník, potom zaviesť cenové priradenia a až následne bezpečne napojiť fakturáciu na ESO. Laboratórne výsledky už v databáze vo veľkom objeme existujú, ale ich obchodný následok zatiaľ nie je spojený s V2 cenou a fakturáciou.

## 10. Technické podklady revízie

| Oblasť | Hlavné podklady v repozitári |
|---|---|
| Readiness a opakovaný test | `client/src/features/nexus-pulse-preflight/PulseDiagnostics.tsx`, `PulsePreflightProvider.tsx`; testy `e2e/pulse-readiness.spec.ts`, `e2e/pulse-gate-invalidation.spec.ts`. |
| Mission / hlas / operátorská trasa | `client/src/pages/campaign-detail.tsx`, `shared/telephony-routing.ts`, `server/inbound-routes.ts`, `server/lib/queue-engine.ts`. |
| SMS | `server/lib/sms-provider-selection.ts`, `server/lib/sms-provider.ts`. |
| Priority Builder / Queue | `client/src/components/agent/PriorityBuilder.tsx`, `priority-builder.ts`, `client/src/pages/agent-workspace.tsx`, `e2e/priority-builder.spec.ts`. |
| Mission verzie / klonovanie / FAQ | `server/nexus-pulse-version-routes.ts`, `server/lib/clone-campaign.integration.test.ts`, `shared/mission-faq.ts`. |
| Hromadné priradenie | `client/src/pages/bulk-assign.tsx`, `shared/medical-partner-filter.ts`, `server/representative-routes.ts`. |
| Customers | `client/src/pages/customers.tsx`, `client/src/components/customer-form.tsx`, `client/src/components/customer-form-wizard.tsx`, zákaznícke endpointy v `server/routes.ts`, tabuľka `customers` v `shared/schema.ts`. |
| Healthcare Network | `client/src/pages/medical-partner-network.tsx`, `client/src/pages/hospitals.tsx`, `client/src/pages/my-clinics.tsx`, `shared/medical-partner-filter.ts`, `server/representative-routes.ts`, tabuľky `clinics`, `hospitals`, siete a stavové tabuľky v `shared/schema.ts`. |
| Pricing V2 | `docs/PRICING_ENGINE_V2_STATUS.md` (starší stavový podklad, nie dôkaz dnešného nasadenia), `server/pricing-engine.ts`, `server/pricing-routes.ts`, `client/src/pages/pricing.tsx`. |
| Zmluvy a fakturácia | `shared/schema.ts`, `client/src/pages/contracts.tsx`, `client/src/pages/invoices.tsx`, fakturačné cesty v `server/routes.ts`. |
| Laboratory Connect | `client/src/pages/collections.tsx`, interné `/api/collections/:id/lab-results` a externé `/api/v1/lab-results` cesty v `server/routes.ts`, laboratórne úložisko v `server/storage.ts`. |

**Záver:** komunikačné a agentúrne jadro je funkčné. Cenový engine a obchodno-laboratórne moduly sú už významne implementované. Aktuálne sme pred dokončením ich spoločného, auditovateľného end-to-end procesu; najvyššou prioritou je cenová verzia a snapshot, bezpečné laboratórne spracovanie a fakturácia z rovnakého podkladu.


## 11. Migrácia ISCBC → INDEXUS — rozsah a realizačný plán

### 11.1 Čo už máme pripravené

Migrácia nie je nový projekt začínajúci analýzou od nuly. Existujú implementované importné skripty, mapovania identifikátorov, prevody stavov a kontrolné rutiny. Primárny prevádzkový podklad je docs/migration-iscbc-to-indexus.md (migračná vetva v20.5). Širšiu inventúru zdroja obsahuje script/migration/README-MIGRATION-ANALYSIS.md; postupy čistenia a obnovy sú v script/migration/MIGRATION-PROCEDURES.md.

Zdrojom je legacy ISCBC na Microsoft SQL Serveri, databáza CBC. Cieľom je existujúci PostgreSQL INDEXUS. Migrácia musí zachovať pôvodné identifikátory, krajinu, vlastníctvo údajov, historické ceny, dátumy a vzájomné väzby. Nemá spätne prepočítať staré zmluvy dnešným cenníkom ani znovu odoslať historické e-maily, SMS či faktúry.

**Rozlišujeme tri výsledky:** technický import dát, overenú zhodu so zdrojom a použiteľnosť dát v novom pracovnom procese. Až všetky tri znamenajú dokončenú migráciu. Dostupnosť importéra sama osebe nepotvrdzuje aktuálny obsah produkcie.

### 11.2 Migračný katalóg — čo vieme preniesť

| Doména | Implementovaná schopnosť / cieľ | Podmienka dokončenia |
|---|---|---|
| Nemocnice a referenčné údaje | Import nemocníc, kategórií a adries; vo fázovej vetve aj referencie potrebné pre ďalšie importy. | Skontrolovať krajiny, referencie a jednoznačné mapovanie; nepreberať automaticky všetky legacy číselníky. |
| Spolupracovníci | Osoby, kontakty, adresy, dohody a aktivity pri odberoch do evidencie spolupracovníkov a súvisiacich tabuliek. | Zachovať väzby na odbery a dohody. Samostatný synchronizačný skript overiť voči plnému historickému importu. |
| Zákazníci | Klienti, osobné a kontaktné údaje, adresy a stavy do zákazníckej evidencie. | Kontrola identity, krajiny a duplicít; žiadne zlučovanie len podľa spoločného telefónu alebo e-mailu. |
| Potenciálni zákazníci a prípady | Potenciálni klienti bez zmluvy; súvisiace údaje o prípadoch a účastníkoch odberu. | Oddeliť potenciálny prípad od existujúceho zákazníka a zachovať rodinné väzby bez nechcených duplicít. |
| Odbery | Záznamy odberov, identifikátory, dátumy, stavy a dostupné väzby na zákazníkov a partnerov. | Doplniť a overiť väzby na zmluvu, produkt, laboratórium a spolupracovníkov po importe závislých entít. |
| Laboratórne výsledky | Historické LabResults do collection_lab_results vrátane väzby na odber. | Viac výsledkov k odberu môže byť legitímna história; overiť jednotky, stav, verzie a význam údajov pre V2. |
| Poznámky | ClientRemarks do customer_notes. | Zachovať autora, čas a dostupný kontext; nevydávať importovanú poznámku za nový úkon agenta. |
| Telefonická komunikácia | PhoneCommunications do communication_messages. | Odlišovať historickú aktivitu od nového Pulse hovoru. Prenos metadát nedokazuje prenos zvukových nahrávok. |
| Zmluvy | Zmluvy, stavy, služby, historické ceny, príplatky, zálohy a platobné podklady; contract_instances a historické customer_documents/JSON. | Rozlíšiť hodnoty uložené v archíve od polí používaných aplikáciou; historický JSON nie je automaticky V2 cenový snapshot. |
| Faktúry a finančná história | Importné cesty pre faktúry, položky, realizované a plánované platby; v20 uchováva rozsiahle historické údaje aj v dokumentoch/JSON. | Overiť konkrétnu vetvu importu: archív faktúry nemusí vytvoriť aktívne invoice_items ani korektné párovanie platieb. |
| Splátky a plánované faktúry | Podklady zo scheduled payments a zmluvných harmonogramov do historických údajov a scheduled_invoices. | Neprevziať historický splnený termín ako nový pokyn na fakturáciu; overiť otvorené a už realizované záväzky. |
| Pohľadávky a vymáhanie | Import piatich zdrojových dlžníckych evidencií do customer_debt_collection. | Zhodnosť dlžnej sumy a stavu musí byť preukázaná voči faktúram a úhradám, nie iba počtom záznamov. |
| Normalizácia kontaktov | consolidate-contacts.cjs obsahuje normalizáciu a detekciu duplicít. | Pravidlá schváliť vopred; uchovať pôvodnú hodnotu a audit úpravy, neprepísať bez kontroly novšie INDEXUS údaje. |

**Dôležité:** nevyhlasujeme, že každé pole každej legacy tabuľky už má aktívny ekvivalent v INDEXUS. Časť dát má implementovanú historickú reprezentáciu; ich zapojenie do nového obchodného procesu je samostatná integračná práca.

### 11.3 Otvorené alebo samostatne riešené domény

- **Súbory, podpísané dokumenty a prílohy:** širšia analýza počíta so samostatným prenosom súborového úložiska. Databázový customer_documents/JSON nie je dôkaz prenosu PDF, skenov alebo binárnych príloh. Potrebný je manifest, kontrolný súčet, mapovanie vlastníka, prístupových práv a overenie otvorenia súboru.
- **Odmeny spolupracovníkov, doprava a kuriéri:** uvedené v širšej analýze; kompletná vykonateľná cesta nebola v audite doložená. Pred zaradením do hotového rozsahu treba potvrdiť cieľový model, mapovanie a importér.
- **Úplný audit zmien a ďalšie komunikačné archívy:** import poznámok a telefonických záznamov nepokrýva automaticky všetky auditné udalosti, e-maily, SMS a nahrávky. Každý archív vyžaduje osobitnú inventúru zdroja a dôkaz migrácie.
- **Produkty, historické cenníky a meny:** referenčné importy nie sú automatickým prevodom legacy cien do Pricing Engine V2. Treba explicitné priradenie historických podmienok alebo nemenný legacy snapshot; existujúci importér V2 sa nesmie bez kontroly použiť na používaný cenník.
- **Účtovné integrácie a kompletné číselníky:** inventúra zdrojových tabuliek je širšia než preukázaný prevádzkový import. Každá doména dostane rozhodnutie: aktívne migrovať, zachovať iba v archíve alebo vedome neprenášať.
- **Legacy používateľské rozhranie:** staré UI/BSP konfigurácie, lokalizácie, dashboardové widgety, testovacie/záložné tabuľky a prechodné odosielacie fronty sa nemigrujú ako aktívne údaje. Prístupy a roly sa nastavia podľa bezpečnostného modelu INDEXUS; staré prihlasovacie údaje sa nekopírujú do dokumentácie ani logov.

### 11.4 Použiteľné nástroje a ich hranice

Hlavná prevádzková vetva používa script/migration/test-migration-20.cjs. Napriek názvu obsahuje skutočné zápisy do cieľovej databázy — **nie je to read-only test**. Dokumentácia popisuje postupné kroky, dávkovanie, oddelený import zmlúv/faktúr a označenie prenesených záznamov pomocou legacy_id, data_source a podľa domény created_by.

Existuje aj fázová rodina: run-migration.sh, migrate-phase1-reference.cjs, migrate-phase2-core.cjs, migrate-phase3-collections.cjs a migrate-phase4-invoices.cjs v script/migration/. Tieto vetvy sa nesmú bez porovnania kombinovať nad rovnakými dátami. Pred produkčným použitím treba zvoliť jednu autoritatívnu cestu a zosúladiť jej výstupy s aktuálnou schémou, najmä pri zmluvách, fakturačných položkách a úhradách.

verify-migration.cjs porovnáva počty vybraných zdrojových a cieľových evidencií. Nie je úplným dôkazom finančnej zhody, správnych väzieb ani bezpečnej opakovateľnosti importu. Obsahuje aj vzorky osobných údajov; jeho surový výstup sa neposiela do chatu. Zdieľajú sa iba anonymizované agregácie. Prehľadový SQL z kapitoly 9 nenahrádza samostatnú zdrojovo-cieľovú reconciliáciu ISCBC.

### 11.5 Etapy riadenej migrácie

**M0 — Inventúra a schválenie rozsahu.** Zaznamenať verziu aplikácie, zdrojovej a cieľovej schémy, krajiny, časový rozsah a dátový objem. Pre každú doménu uviesť zdroj, cieľ, transformačné pravidlá, vlastníka kontroly a spôsob akceptácie. Výstup: schválený migračný katalóg vrátane archívov a výnimiek.

**M1 — Mapovanie a historická kontinuita.** Zostaviť jednoznačné mapy zdrojových identifikátorov na INDEXUS ID. Schváliť stavy, krajiny, meny, časové pásma, číselné rady, produkty a cenové verzie. Rozhodnúť konflikt medzi starou hodnotou a novšou ručnou úpravou v INDEXUS. Výstup: žiadna nejednoznačná väzba bez evidovanej výnimky.

**M2 — Príprava a obnova.** Overiť zálohu a skutočne nacvičiť obnovu na kontrolovanom prostredí. Použiť minimálne oprávnenia, oddelené spojenia a bezpečné prihlasovanie. Vypnúť následné automatizácie importu, odosielanie správ a generovanie dokladov. Výstup: schválený návratový postup a import bez vonkajších účinkov.

**M3 — Reprezentatívny pilot.** Na oddelenej kópii preniesť vzorku každej krajiny a typu prípadu: nový/potenciálny klient, historická zmluva, úplný/neúplný odber, opravený výsledok, uhradená/neuhradená faktúra, splátka a príloha. Vzorka musí zachovať závislosti, nestačí náhodný limit riadkov každej tabuľky. Výstup: rovnaký prípad dohľadateľný od zákazníka po finančný zostatok.

**M4 — Dávkový import v poradí závislostí.** Referencie → nemocnice a spolupracovníci → zákazníci → zmluvy a ich cenové podklady → odbery, účastníci a výsledky → dokumenty, komunikácia a poznámky → faktúry, položky, platby, harmonogramy a pohľadávky. Prevádzková v20 dokumentácia má odbery pred zmluvami; ak zostane toto poradie, následné doplnenie a kontrola zmluvných väzieb je povinný explicitný krok. Veľké domény spracovať samostatne, s kontrolnými bodmi a logom dávok.

**M5 — Reconciliácia a opakovaný beh.** Porovnať oprávnený zdrojový rozsah s cieľom po doménach, krajinách a stavoch. Testovať prerušenie a opakovanie dávky: nevzniknú duplicity, nové doklady ani prepis novších údajov. Kontrolovať unikátnosť legacy identít, neexistujúce referencie, zachovanie cien, príloh a histórie. Výstup: reprodukovateľný kontrolný protokol, nie iba hlásenie skriptu o dokončení.

**M6 — Obchodná akceptácia.** Back Office, financie a laboratórna prevádzka overia reálne typy prípadov v UI. Osobitne sa skúša pokračovanie historickej zmluvy v novom systéme, nová faktúra po migrácii a oprava lab výsledku bez prepisu vydaného dokladu. Výstup: žiadna blokujúca dátová alebo funkčná chyba.

**M7 — Finálny prenos zmien a prepnutie.** Dohodnúť servisné okno a zastaviť zápisy do legacy. Zaznamenať hranicu posledných zmien a vykonať overený delta prenos vrátane zmien stavov a riešenia zmazaných záznamov. Dostupný spolupracovnícky sync nie je univerzálny delta mechanizmus celej databázy; ten treba pre každú doménu doložiť alebo nahradiť schváleným finálnym exportom počas odstávky. Po reconciliácii povoliť INDEXUS ako jediný zapisujúci systém.

**M8 — Stabilizácia a odovzdanie.** Monitorovať chyby, neúplné väzby, fronty, splatnosti a finančné zostatky. ISCBC ponechať dočasne read-only podľa schválenej retenčnej politiky. Odovzdať mapovania, výnimky, návody, prevádzkový dohľad a výsledky kontrol. Legacy vypnúť až po vyriešení závislostí a archívneho prístupu.

### 11.6 Akceptačné podmienky a návrat

| Kontrola | Podmienka prijatia |
|---|---|
| Úplnosť | Každý záznam schváleného zdrojového rozsahu má cieľ alebo zdôvodnenú výnimku; rozdiel nie je skrytý súhrnným počtom. |
| Identita a väzby | Jednoznačná legacy mapa; žiadna nevysvetlená duplicita ani neexistujúci povinný odkaz. |
| Financie | Po krajinách a menách súhlasia základy, dane, celkové sumy, úhrady a otvorené zostatky; tolerancie zaokrúhlenia sú vopred schválené. |
| História | Historická cena a vydaný doklad sa nemenia podľa súčasného V2; zachované sú pôvod a časové súvislosti. |
| Súbory a prístupy | Kontrolné súčty, počet súborov, vlastníctvo, oprávnenia a otvorenie reprezentatívnych príloh sú overené. |
| Opakovateľnosť | Reštart dávky nevytvorí duplicity ani neodošle správu alebo doklad druhýkrát. |
| Pokračovanie práce | Migrovaný aj nový prípad úspešne prejdú procesom zmluva → odber → výsledok → faktúra → úhrada. |
| Obnova | Nacvičený návrat, určený rozhodovateľ, maximálna prípustná strata dát a čas obnovy. |

Pred prepnutím možno chybný import v izolovanom cieli zahodiť a obnoviť zálohu. V živej zmiešanej databáze sa nesmie použiť plošné čistenie ani mazanie iba podľa data_source; mohli pribudnúť ručné úpravy a nové väzby. Ani čiastočný cleanup nie je automaticky bezpečný. Po prepnutí treba najprv zastaviť zápisy, zachovať všetky nové INDEXUS zmeny a schváliť ich spätné prenesenie alebo dočasný read-only režim. Samotné obnovenie starej zálohy bez zachovania týchto zmien by spôsobilo stratu dát.

## 12. Implementácie a testovacie rutiny — dôkazová mapa

### 12.1 Už vykonané cielené overenia

Nasledujúce výsledky pochádzajú z predchádzajúcich vývojových overení zaznamenaných pri realizácii zmien. Pri tejto dokumentačnej revízii sa testy znovu nespúšťali; nejde o nový produkčný test ani o výsledok celej testovacej sady na aktuálnej verzii.

| Implementácia | Vykonané overenie | Čo výsledok preukazuje |
|---|---|---|
| Pulse — opakovaná povinná kontrola po zmene prostredia | 3 browser scenáre a 25 Vitest testov prešli pri oprave; e2e/pulse-gate-invalidation.spec.ts a súvisiace pulse-gate fixtures/rutiny. | Kontrola sa obnoví po zmene prostredia; súbežné invalidácie nespúšťajú cyklické reštarty a staré async dokončenie neuvoľní novú kontrolu. |
| Pulse — viditeľnosť latencie | latency-result-visibility.node.test.ts prešiel po cielenej oprave. | Latencia/jitter už nie sú nesprávne vylúčené z hlavného zobrazenia diagnostiky. |
| Priority Builder | 3 cielené browser scenáre v e2e/priority-builder.spec.ts prešli pri oprave. | Uloženie referral_cities, explicitná reaktivácia a zachovanie požiadavky pri prepnutí pohľadu. |

Existujú aj manuálne formuláre komplexného testovania Pulse zo septembra 2026. Obsahujú úspešné, podmienené, neúspešné aj nevykonané scenáre. Preto sa nepoužívajú ako tvrdenie, že úplne všetky funkcie a prostredia prešli. Nálezy zo staršieho testu treba spárovať s následnou opravou a regresným scenárom; staré zlyhanie nie je automaticky dnešný stav a samotná oprava nie je univerzálnou akceptáciou.

### 12.2 Dostupné automatizované rutiny a rozsah

Táto tabuľka je katalóg existujúcich testov, nie dodatočne vytvorený zoznam úspešných behov. Kde nie je vyššie uvedený vykonaný výsledok, dokument potvrdzuje dostupnosť rutiny, nie jej dnešný PASS.

| Oblasť | Konkrétne rutiny | Rozsah a hranica |
|---|---|---|
| Readiness a volanie | e2e/pulse-readiness.spec.ts; e2e/pulse-dial.spec.ts; client/src/features/nexus-pulse-preflight/diagnostics.test.ts, presentation-state.test.ts, recording-playback.test.ts. | Prístup do pracoviska, diagnostika a spracovanie dial požiadaviek; browser fixture nie je živý operátorský hovor. |
| Mission FAQ a nahrávanie | shared/mission-faq.test.ts; client/src/lib/mission-faq.test.ts; shared/mission-recording.test.ts; client/src/lib/mission-recording.test.ts. | Pravidlá Mission, FAQ a nahrávania; samostatne treba prevádzkové overenie uloženia a prehratia konkrétneho hovoru. |
| Hlasové trasy a SMS | shared/telephony-routing.test.ts; server/lib/inbound-did.test.ts; server/lib/smstools.test.ts. | Validácia a spracovanie routingu/poskytovateľa; nie potvrdenie doručenia SMS alebo akceptácie každého Caller ID operátorom. |
| Inbound karta a callbacky | client/src/lib/inbound-call-claim.test.ts; client/src/lib/repeated-inbound-card-flow.test.ts; shared/scheduled-callback.test.ts. | Korelácia inbound udalosti, opakovaný výber karty a callback pravidlá. |
| Priority a mestá | server/lib/priority-city-ranking.test.ts; server/lib/collaborator-priority-city.test.ts; shared/priority-city.test.ts; e2e/priority-builder.spec.ts. | Pravidlá osobného poradia, referral miest a správanie editora vrátane chybových stavov. |
| Klonovanie Mission | server/lib/clone-campaign.test.ts; server/lib/clone-campaign.integration.test.ts; script/test-clone-campaign.sh. | Jednotkové a integračné porovnanie klonu, nových identít a väzieb. Integračný beh vyžaduje kontrolované testovacie dáta. |
| Back Office a partneri | client/src/lib/back-office-alert.test.ts; shared/medical-partner-filter.test.ts. | Spracovanie upozornení a zhodná logika filtrov; nenahrádza úplnú akceptáciu všetkých rolí a úkonov BO. |
| Customers a Healthcare Network | client/src/components/customer-form.tsx; client/src/pages/customers.tsx; shared/medical-partner-filter.test.ts; client/src/components/agent/priority-city-queue.node.test.ts; server/representative-routes.ts. | Karta zákazníka, zdravotné/klinické väzby, spoločná logika filtrov a priradenie reprezentantov; aktuálna produkčná úplnosť sa overí agregovaným SQL výpisom. |
| Migrácia | script/migration/test-mssql-connection.cjs; test-migration-20.cjs; verify-migration.cjs. | Spojenie, vykonateľný import a čiastkové porovnanie. Importná rutina zapisuje dáta; názov test nie je záruka bezpečného dry-run. |

### 12.3 Čo ešte musí pokryť finálna akceptácia

Pre Pricing V2, Contracts, Laboratory Connect a Invoicing existuje významná implementácia a stavová dokumentácia; v audite nebol doložený uzavretý úspešný end-to-end protokol celého reťazca. Cenový import so samokontrolou nie je náhradou nezávislých obchodných testov.

Pred úplným prechodom treba vykonať maticu: krajina × produkt × historická/nová cena × úplný/neúplný odber × zľava × splátka × oprava výsledku. Overiť aj odmietnutie neoprávneného zápisu, opakovanú správu laboratória, súbežnú fakturáciu, nedostupnú bránu a obnovu po prerušení. Pre migráciu pribudnú finančná reconciliácia, prílohy, delta prenos a rollback.

Každý finálny protokol má obsahovať verziu aplikácie, prostredie, dátum, použitú dátovú vzorku, príkaz alebo manuálny scenár, očakávaný/skutočný výsledok a otvorené výnimky. Tak možno stav „implementované a testované“ podložiť konkrétnym rozsahom namiesto všeobecného vyhlásenia.

<!-- pagebreak -->

## 13. Záverečné resumé — čo presne dokončiť pre plnohodnotný INDEXUS CRM

INDEXUS už má implementované CRM evidencie, agentúrne pracovisko Nexus Pulse, Mission, hlasovú a SMS komunikáciu, Back Office, cenový engine, zmluvy, odbery, fakturačné funkcie a laboratórne API. Kľúčové opravy pracoviska boli cielene regresne otestované. Existuje aj rozsiahly migračný základ ISCBC. **Zostávajúca práca je najmä integrácia, overenie dát a riadený prechod — nie výstavba CRM od začiatku.**

1. **Zjednotiť cenotvorbu a cenníkový modul:** dokončiť autoritatívny Pricing Engine V2 pre zákazníka, produkt, komponent, odber, skladné, zľavy, meny a splátky. Každá zmluva musí dostať konkrétnu cenovú verziu a nemenný položkový snapshot; až potom možno vypnúť legacy Products/Configurator.
2. **Dopracovať fakturáciu a spoluprácu s ESO:** uzavrieť API/exportnú cestu, mapovanie zákazníkov, firiem, DPH, účtov, číselných radov, položiek, úhrad, storna a dobropisov. Opakované odoslanie musí byť idempotentné a auditovateľné.
3. **Dopracovať tvorbu zmlúv a templates:** vytváranie zmluvy, jazykové a krajinné šablóny, podpisová verzia, placeholdery a fakturačné podmienky musia používať schválený V2 snapshot. Podpísané zmluvy a vydané faktúry sa nesmú spätne prepisovať.
4. **Prepojiť laboratórny modul:** po autorizovanom výsledku zjednotiť internú a externú validáciu, vyhodnotiť skutočne dodanú službu cez rovnaký engine a vytvoriť schválený fakturačný podklad s históriou opráv.
5. **Dokončiť a nacvičiť migráciu ISCBC:** schváliť katalóg, preniesť dáta aj prílohy, doplniť väzby a mapovania, otestovať opakovanie, vykonať zdrojovo-cieľovú reconciliáciu a pripraviť delta prenos.
6. **Urobiť spoločný pilot:** overiť nový aj migrovaný prípad od Customers/Healthcare Network cez komunikáciu, zmluvu, odber, výsledok, faktúru a úhradu. Uzavrieť blokujúce nálezy a odovzdať protokol.
7. **Riadené prepnutie a prevádzka:** povoliť jediný zapisujúci systém, zachovať ISCBC dočasne read-only, monitorovať väzby a financie a mať nacvičený rollback bez straty nových INDEXUS zmien.

**Cieľový stav:** nový aj historický zákazník sa obslúži v INDEXUS bez paralelného ručného prepisovania do ISCBC. Každá zmluva, odber, výsledok, faktúra a úhrada má dohľadateľný pôvod, správne väzby a kontrolovanú históriu. Až úspešná procesná akceptácia spolu s dátovou reconciliáciou a nacvičenou obnovou umožní označiť prechod za dokončený.
