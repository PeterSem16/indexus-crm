# INDEXUS CRM — Manažérsky prehľad aktuálneho stavu

> **Revízia:** 16. september 2026
> **Rozsah:** stav CRM, agentúrneho pracoviska, Healthcare Network, obchodno-laboratórneho reťazca a migrácie ISCBC → INDEXUS.
> **Podklady:** aktuálny zdrojový kód, cielené regresné overenia, testovacie rutiny, migračná dokumentácia a anonymizovaný read-only výpis z produkcie.
> **Produkčný stav:** agregovaný výpis bol vykonaný 16. 9. 2026 o 09:22:11 UTC; databáza bola v režime `read_only = on`.

## 1. Manažérsky súhrn

INDEXUS je funkčne rozsiahly CRM systém, nie iba evidencia historických zákazníkov. Má agentúrne pracovisko Nexus Pulse a Mission, telefonickú a SMS komunikáciu, Customers, Healthcare Network, Back Office, Pricing Engine V2, zmluvy, odbery, laboratórne výsledky a základ fakturácie. Kľúčové mechanizmy pracoviska a Priority Builder boli overené cielenými regresnými rutinami.

**Celkový stav k dnešnému dňu:** prevádzkové CRM a komunikačné jadro je implementované. Obchodno-finančný reťazec však ešte nie je uzavretý ako jeden auditovateľný proces. Najväčšia medzera je medzi cenou, zmluvou, odberom, výsledkom a faktúrou. Migrácia ISCBC má pripravené skripty a rozsah, ale nie je produkčne dokončená bez zdrojovo-cieľovej reconciliácie.

Z produkčných agregácií vyplýva, že databáza obsahuje rozsiahlu historickú bázu, ale aj otvorené väzby: 165 463 zákazníkov, 10 080 kliník, 1 213 nemocníc, 198 167 odberov, 197 850 laboratórnych výsledkov, 236 935 zmlúv a 0 faktúr. Pricing V2 má cenníky a pravidlá, ale zatiaľ nemá priradenia zákazníkov.

### Priorita dokončenia

1. **Zjednotiť cenotvorbu:** Pricing Engine V2 musí byť autoritatívnym zdrojom ceny pre zákazníka, produkt, odber, zmluvu a faktúru; podpísané dokumenty musia mať nemenný cenový snapshot.
2. **Uzavrieť obchodný reťazec:** prepojiť Customers, Contracts, Collections, Laboratory Connect a Invoicing na rovnaké identifikátory a pravidlá.
3. **Dopracovať ESO a elektronickú fakturáciu:** dokončiť cieľové napojenie na účtovnú platformu, štruktúrované e-faktúry, API/export, DPH, položky, úhrady, storno, dobropisy a idempotentné opakovanie.
4. **Dokončiť zmluvy a templates:** schválené krajinné a jazykové šablóny musia používať V2 snapshot.
5. **Reconciliovať a riadiť migráciu ISCBC:** potvrdiť identity, historické väzby, prílohy, delta prenos, rollback a finančnú kontrolu.
6. **Pilot a prepnutie:** overiť nový aj migrovaný prípad od zákazníka po úhradu, potom zaviesť riadený prechod s dočasným read-only režimom ISCBC.

**Manažérsky záver:** projekt nie je pred novým vývojom CRM od začiatku. Je v etape integrácie, dátového čistenia, finančného napojenia a riadeného prechodu do plnej prevádzky. Za dokončený ho možno označiť až po úspešnom end-to-end pilote, reconciliácii a nacvičenej obnove.

### 1.1 Ako čítať stav

| Označenie | Význam |
|---|---|
| Implementované a cielene testované | Funkcia existuje a jej konkrétne scenáre boli overené; nejde o univerzálnu produkčnú akceptáciu. |
| Implementované | V repozitári je funkčný kód príslušnej časti; nasadenie a produkčné dáta môžu vyžadovať potvrdenie. |
| Čiastočne prepojené | Moduly existujú, ale chýba spoločný proces, kontrola alebo automatické odovzdanie dát. |
| Na dopracovanie / overenie | Konkrétna medzera v kóde alebo chýbajúci produkčný či obchodný dôkaz. |

### 1.2 Súhrnná mapa

| Oblasť | Aktuálna etapa | Čo zostáva |
|---|---|---|
| Nexus Pulse + Mission | Implementované a cielene testované | Prevádzkové monitorovanie a potvrdenie nasadenia posledných zmien. |
| Hlasové trasy a SMS brány | Implementovaný výber podľa Mission a krajiny | Evidovať akceptáciu každej používanej kombinácie krajina/trasa/brána. |
| Priority Builder a osobná fronta | Implementované | Prevádzkové overenie najnovších opráv uloženia a zobrazenia. |
| Customers + Healthcare Network / Back Office | Implementované karty, evidencie, vzťahy a pracovné postupy | Úplnosť väzieb a reprezentantskej histórie je v produkcii nízka; treba dokončiť obchodné integrácie. |
| Pricing Engine V2 | Implementovaný cenník, pravidlá a výpočet | Produkčné verzie, historické priradenia a zapojenie do zákazníka/zmluvy/BO/fakturácie. |
| Contracts | Existujúci modul a cenové snapshoty v modeli | Napojenie na autoritatívny V2 výpočet a cenovú verziu. |
| Invoicing | Existujúce UI, dátový model a generovanie | Zmluvne viazaná V2 fakturácia, položky, meny, dane, splátky a bezpečné opakovanie. |
| Laboratory Connect | Implementované interné formuláre aj externé API | Zjednotiť spracovanie, autorizáciu laboratória, históriu výsledkov a obchodné následky. |
| Migrácia ISCBC | Implementované migračné skripty a mapovania | Reconciliácia, otvorené domény, delta prenos a riadené prepnutie. |
| Úplný obchodno-laboratórny proces | Integračná etapa pred dokončením | Akceptačný scenár od cenníka až po výsledok, faktúru a úhradu. |

## 2. Čo pribudlo alebo sa dokončilo od pôvodného prehľadu

### 2.1 Nexus Pulse — agentúrne pracovisko

- Agentúrne pracovisko je napojené na Mission, oprávnenia, kontakty a readiness kontrolu.
- Readiness overuje prehliadač, sieť, mikrofón, reproduktor, SIP/ICE, latenciu, účet Microsoft 365 a zmenu prostredia.
- Pri zmene siete alebo zariadenia vyžaduje novú kontrolu; chráni aktívny hovor, prácu po hovore a návrat do INDEXUS.
- Kľúčové mechanizmy boli pokryté cielenými regresnými rutinami; produkčné nasadenie každej kombinácie prostredia treba prevádzkovo monitorovať.

### 2.2 Mission — nastavenie a vykonávanie práce

- Mission riadi kontakty, agentov, pracovný postup, skripty, stavové zoznamy, automatizácie a FAQ.
- Podporuje callbacky, Back Office úlohy, e-mail/SMS akcie, verzie, klonovanie a audit pracovnej relácie.
- Klonovanie a obnova chránia nastavenia iných modulov; pripojený Microsoft 365 účet je súčasťou readiness.

### 2.3 Celý tok volania a výber hlasovej trasy

- Odchádzajúce hovory používajú serverom povolenú trasu a Caller ID; vstupný kontakt a Mission sa zachovajú v histórii.
- Prichádzajúce hovory sa smerujú cez DID, IVR/frontu, dostupnosť agenta a pravidlá overflow alebo forward.
- Hovorový tok zahŕňa SIP registráciu, ICE/TURN/DTLS, nahrávanie odvodené zo serverového kontextu, ukončenie a jednotnú históriu.
- Výsledok hovoru môže vytvoriť callback, komunikáciu alebo Back Office úlohu; čas callbacku sa riadi časovým pásmom Europe/Bratislava.

### 2.4 SMS brány a komunikačný kontext

- Výber SMS brány je viazaný na Mission a krajinu; podporované sú BulkGate a SMSTOOLS podľa konfigurácie.
- Server overuje pracovnú reláciu, príslušnosť príjemcu a povinnú bránu; pri chýbajúcej konfigurácii vráti chybu.
- Implementované odoslanie neznamená automaticky produkčne potvrdené doručenie každej správy.

### 2.5 Priority Builder, referrals, mestá a Queue

- Priority Builder určuje osobné poradie podľa skupiny, mesta a voliteľnej priority referral kontaktov.
- Autoritatívna fronta je spoločná pre desktop, mobil, Auto a Next; prázdny alebo chybný výber nesmie rozšíriť frontu.
- Referral pôvod, mesto a uložený pohľad zostávajú viditeľné; cielené browser testy pokrývajú uloženie a reaktiváciu pohľadu.

### 2.6 Back Office a Healthcare Network

- Back Office spracúva úlohy zo stavových automatizácií, odpovede agentov a odovzdanie práce s ochranou proti súbežnému dokončeniu.
- Viditeľnosť je riadená krajinou a oprávneniami; dokončenie sa pripisuje skutočnému riešiteľovi.
- Healthcare Network a bulk priradenie reprezentantov používajú spoločné filtre a úplný náhľad výberu, nie iba aktuálnu stránku.

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

### ESO a elektronická fakturácia — podmienka dokončenia

ESO je cieľová elektronická účtovná platforma pre účtovné spracovanie faktúr, platieb a opravných dokladov. V aktuálnej revízii nebol potvrdený hotový produkčný konektor; preto ESO nemožno považovať za dokončenú časť len na základe existujúceho fakturačného UI.

Pre dokončenie projektu treba vykonať tieto kroky:

1. **Potvrdiť cieľové rozhranie ESO:** rozhodnúť medzi API a bezpečným exportom, určiť vlastníka integrácie, krajiny, účtovné subjekty a testovacie prostredie.
2. **Zjednotiť dátové mapovanie:** zákazník, fakturačný subjekt, IČ DPH, mena, číselný rad, položky, daň, splatnosť, platba, storno a dobropis musia mať jednoznačné mapovanie INDEXUS ↔ ESO.
3. **Zaviesť elektronickú faktúru:** faktúra musí byť dostupná v právne a technicky požadovanom štruktúrovanom formáte, napríklad UBL/XML; samotné PDF nestačí. Požiadavky sa musia potvrdiť podľa príslušnej krajiny a aktuálneho režimu elektronickej fakturácie.
4. **Pripojiť odoslanie a stavový cyklus:** odoslanie, prijatie, odmietnutie, doručenie, úhrada a chyba musia mať stav v INDEXUS; opakovanie nesmie vytvoriť duplicitný doklad.
5. **Zabezpečiť audit a bezpečnosť:** ukladať odkaz na pôvodný cenový snapshot, XML/export, odpoveď ESO, čas odoslania, používateľa alebo automatizáciu a dôvod každej opravy.
6. **Reconciliovať účtovníctvo:** pravidelne porovnávať faktúry, dobropisy, úhrady, otvorené zostatky a chyby medzi INDEXUS a ESO. Rozdiel nesmie zostať iba v manuálnej tabuľke.
7. **Spustiť pilot:** overiť nový predaj, historickú cenu, splátku, skladné, čiastočný odber, opravu výsledku, storno, dobropis, odmietnutú e-faktúru a opakované odoslanie.

Elektronická fakturácia preto nie je samostatný výstup na konci projektu. Je to kontrolný bod celého reťazca: cena → zmluva → odber → výsledok → faktúra → ESO → úhrada.

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
- Pripraviť štruktúrovaný e-fakturačný formát a napojenie na ESO vrátane stavov odoslania a odmietnutia.
- Akceptácia: opakované potvrdenie nevytvorí druhú faktúru; súčet položiek sedí s dokladom a odsúhlaseným podkladom; ESO prijme alebo jasne odmietne doklad.

### Krok 8 — Splátky, skladné, úhrady a opravy

- Prepojiť harmonogramy na rovnakú fakturačnú službu a explicitné pravidlá splatnosti, zrušenia a opakovania.
- Schváliť spracovanie platieb a opravných dokladov; existujúce vydané doklady neprepisovať podľa neskoršieho laboratórneho výsledku.
- Odosielať do ESO aj splátky, úhrady, storno a dobropisy a pravidelne reconciliovať otvorené zostatky.
- Akceptácia: splátka vznikne presne raz, úhrada má správny doklad a zostatok, oprava má auditnú väzbu a opakované odoslanie do ESO nevytvorí duplicitu.

### Krok 9 — Pilot a úplné prepnutie

- Pilotná krajina a laboratórny partner, potom ďalšie krajiny po samostatnej akceptácii.
- Overiť nový predaj, historický cenník, chýbajúci údaj, opakovanú správu, opravu výsledku, chybu poskytovateľa a bezpečné opakovanie fakturácie.
- Až po porovnaní výsledkov obmedziť starý Products/Configurator a legacy fakturačné cesty. Zachovať históriu a plán návratu.
- Akceptácia: dohľadateľný reťazec zákazník → zmluva → odber → výsledok → cenový podklad → faktúra → úhrada.

Fakturačné jadro možno vyvíjať paralelne s laboratórnym konektorom po schválení cenového snapshotu a identít. Automatické účtovanie skutočného výsledku však závisí od oboch.

## 8. Súčasný stav projektu — produkčné agregácie

Výpis bol vykonaný **16. 9. 2026 o 09:22:11 UTC** v read-only transakcii. Všetkých 42 kontrolovaných tabuliek existuje. Ide o agregovaný stav databázy `indexus_crm`, nie o produkčný akceptačný test aplikácie.

| Oblasť | Stav |
|---|---:|
| Zákazníci / ISCBC zdroj | 165 463 / 165 448 |
| Kliniky / aktívne | 10 080 / 10 079 |
| Kliniky s PZK/PZS, ID ZZ a IČO | 753 |
| Nemocnice / aktívne | 1 213 / 1 142 |
| Spolupracovníci | 20 136 |
| Odbery / laboratórne výsledky | 198 167 / 197 850 |
| Zmluvy / faktúry | 236 935 / 0 |
| Komunikačné správy | 1 163 531 |
| Zákaznícke poznámky / dokumenty | 2 404 177 / 3 013 370 |

### Manažérske implikácie

- Pricing V2 má 12 cenových verzií a pravidlá, ale **0 priradení zákazníkov**.
- **197 718 odberov nemá produkt** a 198 079 odberových `contract_id` nemá zhodu v `contract_instances`.
- **Fakturácia ešte nie je naplnená**; existuje 0 faktúr a 15 fakturačných položiek bez nadradenej faktúry.
- **55 výsledkov nemá existujúci odber**; pri 209 odberoch existuje viac výsledkov, čo treba rozlíšiť ako aktuálny výsledok alebo históriu.
- Kliniky nemajú `legacy_id` a reprezentantská assignment história kliník aj nemocníc je prázdna.

Tieto údaje potvrdzujú, že ďalšia etapa je dátová a integračná: najprv uzavrieť identity a väzby, potom priradiť cenové verzie a až následne spustiť fakturačný a ESO proces.

## 9. Technické podklady revízie

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


## 10. Migrácia ISCBC → INDEXUS — rozsah a realizačný plán

### 10.1 Čo už máme pripravené

Migrácia nie je nový projekt začínajúci analýzou od nuly. Existujú implementované importné skripty, mapovania identifikátorov, prevody stavov a kontrolné rutiny. Primárny prevádzkový podklad je docs/migration-iscbc-to-indexus.md (migračná vetva v20.5). Širšiu inventúru zdroja obsahuje script/migration/README-MIGRATION-ANALYSIS.md; postupy čistenia a obnovy sú v script/migration/MIGRATION-PROCEDURES.md.

Zdrojom je legacy ISCBC na Microsoft SQL Serveri, databáza CBC. Cieľom je existujúci PostgreSQL INDEXUS. Migrácia musí zachovať pôvodné identifikátory, krajinu, vlastníctvo údajov, historické ceny, dátumy a vzájomné väzby. Nemá spätne prepočítať staré zmluvy dnešným cenníkom ani znovu odoslať historické e-maily, SMS či faktúry.

**Rozlišujeme tri výsledky:** technický import dát, overenú zhodu so zdrojom a použiteľnosť dát v novom pracovnom procese. Až všetky tri znamenajú dokončenú migráciu. Dostupnosť importéra sama osebe nepotvrdzuje aktuálny obsah produkcie.

### 10.2 Migračný katalóg — čo vieme preniesť

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

### 10.3 Otvorené alebo samostatne riešené domény

- **Súbory, podpísané dokumenty a prílohy:** širšia analýza počíta so samostatným prenosom súborového úložiska. Databázový customer_documents/JSON nie je dôkaz prenosu PDF, skenov alebo binárnych príloh. Potrebný je manifest, kontrolný súčet, mapovanie vlastníka, prístupových práv a overenie otvorenia súboru.
- **Odmeny spolupracovníkov, doprava a kuriéri:** uvedené v širšej analýze; kompletná vykonateľná cesta nebola v audite doložená. Pred zaradením do hotového rozsahu treba potvrdiť cieľový model, mapovanie a importér.
- **Úplný audit zmien a ďalšie komunikačné archívy:** import poznámok a telefonických záznamov nepokrýva automaticky všetky auditné udalosti, e-maily, SMS a nahrávky. Každý archív vyžaduje osobitnú inventúru zdroja a dôkaz migrácie.
- **Produkty, historické cenníky a meny:** referenčné importy nie sú automatickým prevodom legacy cien do Pricing Engine V2. Treba explicitné priradenie historických podmienok alebo nemenný legacy snapshot; existujúci importér V2 sa nesmie bez kontroly použiť na používaný cenník.
- **Účtovné integrácie a kompletné číselníky:** inventúra zdrojových tabuliek je širšia než preukázaný prevádzkový import. Každá doména dostane rozhodnutie: aktívne migrovať, zachovať iba v archíve alebo vedome neprenášať.
- **Legacy používateľské rozhranie:** staré UI/BSP konfigurácie, lokalizácie, dashboardové widgety, testovacie/záložné tabuľky a prechodné odosielacie fronty sa nemigrujú ako aktívne údaje. Prístupy a roly sa nastavia podľa bezpečnostného modelu INDEXUS; staré prihlasovacie údaje sa nekopírujú do dokumentácie ani logov.

### 10.4 Použiteľné nástroje a ich hranice

Hlavná prevádzková vetva používa script/migration/test-migration-20.cjs. Napriek názvu obsahuje skutočné zápisy do cieľovej databázy — **nie je to read-only test**. Dokumentácia popisuje postupné kroky, dávkovanie, oddelený import zmlúv/faktúr a označenie prenesených záznamov pomocou legacy_id, data_source a podľa domény created_by.

Existuje aj fázová rodina: run-migration.sh, migrate-phase1-reference.cjs, migrate-phase2-core.cjs, migrate-phase3-collections.cjs a migrate-phase4-invoices.cjs v script/migration/. Tieto vetvy sa nesmú bez porovnania kombinovať nad rovnakými dátami. Pred produkčným použitím treba zvoliť jednu autoritatívnu cestu a zosúladiť jej výstupy s aktuálnou schémou, najmä pri zmluvách, fakturačných položkách a úhradách.

verify-migration.cjs porovnáva počty vybraných zdrojových a cieľových evidencií. Nie je úplným dôkazom finančnej zhody, správnych väzieb ani bezpečnej opakovateľnosti importu. Obsahuje aj vzorky osobných údajov; jeho surový výstup sa neposiela do chatu. Zdieľajú sa iba anonymizované agregácie. Prehľadový SQL z kapitoly 9 nenahrádza samostatnú zdrojovo-cieľovú reconciliáciu ISCBC.

### 10.5 Etapy riadenej migrácie

**M0 — Inventúra a schválenie rozsahu.** Zaznamenať verziu aplikácie, zdrojovej a cieľovej schémy, krajiny, časový rozsah a dátový objem. Pre každú doménu uviesť zdroj, cieľ, transformačné pravidlá, vlastníka kontroly a spôsob akceptácie. Výstup: schválený migračný katalóg vrátane archívov a výnimiek.

**M1 — Mapovanie a historická kontinuita.** Zostaviť jednoznačné mapy zdrojových identifikátorov na INDEXUS ID. Schváliť stavy, krajiny, meny, časové pásma, číselné rady, produkty a cenové verzie. Rozhodnúť konflikt medzi starou hodnotou a novšou ručnou úpravou v INDEXUS. Výstup: žiadna nejednoznačná väzba bez evidovanej výnimky.

**M2 — Príprava a obnova.** Overiť zálohu a skutočne nacvičiť obnovu na kontrolovanom prostredí. Použiť minimálne oprávnenia, oddelené spojenia a bezpečné prihlasovanie. Vypnúť následné automatizácie importu, odosielanie správ a generovanie dokladov. Výstup: schválený návratový postup a import bez vonkajších účinkov.

**M3 — Reprezentatívny pilot.** Na oddelenej kópii preniesť vzorku každej krajiny a typu prípadu: nový/potenciálny klient, historická zmluva, úplný/neúplný odber, opravený výsledok, uhradená/neuhradená faktúra, splátka a príloha. Vzorka musí zachovať závislosti, nestačí náhodný limit riadkov každej tabuľky. Výstup: rovnaký prípad dohľadateľný od zákazníka po finančný zostatok.

**M4 — Dávkový import v poradí závislostí.** Referencie → nemocnice a spolupracovníci → zákazníci → zmluvy a ich cenové podklady → odbery, účastníci a výsledky → dokumenty, komunikácia a poznámky → faktúry, položky, platby, harmonogramy a pohľadávky. Prevádzková v20 dokumentácia má odbery pred zmluvami; ak zostane toto poradie, následné doplnenie a kontrola zmluvných väzieb je povinný explicitný krok. Veľké domény spracovať samostatne, s kontrolnými bodmi a logom dávok.

**M5 — Reconciliácia a opakovaný beh.** Porovnať oprávnený zdrojový rozsah s cieľom po doménach, krajinách a stavoch. Testovať prerušenie a opakovanie dávky: nevzniknú duplicity, nové doklady ani prepis novších údajov. Kontrolovať unikátnosť legacy identít, neexistujúce referencie, zachovanie cien, príloh a histórie. Výstup: reprodukovateľný kontrolný protokol, nie iba hlásenie skriptu o dokončení.

**M6 — Obchodná akceptácia.** Back Office, financie a laboratórna prevádzka overia reálne typy prípadov v UI. Osobitne sa skúša pokračovanie historickej zmluvy v novom systéme, nová faktúra po migrácii a oprava lab výsledku bez prepisu vydaného dokladu. Výstup: žiadna blokujúca dátová alebo funkčná chyba.

**M7 — Finálny prenos zmien a prepnutie.** Dohodnúť servisné okno a zastaviť zápisy do legacy. Zaznamenať hranicu posledných zmien a vykonať overený delta prenos vrátane zmien stavov a riešenia zmazaných záznamov. Dostupný spolupracovnícky sync nie je univerzálny delta mechanizmus celej databázy; ten treba pre každú doménu doložiť alebo nahradiť schváleným finálnym exportom počas odstávky. Po reconciliácii povoliť INDEXUS ako jediný zapisujúci systém.

**M8 — Stabilizácia a odovzdanie.** Monitorovať chyby, neúplné väzby, fronty, splatnosti a finančné zostatky. ISCBC ponechať dočasne read-only podľa schválenej retenčnej politiky. Odovzdať mapovania, výnimky, návody, prevádzkový dohľad a výsledky kontrol. Legacy vypnúť až po vyriešení závislostí a archívneho prístupu.

### 10.6 Akceptačné podmienky a návrat

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

## 11. Implementácie a testovacie rutiny — dôkazová mapa

### 11.1 Už vykonané cielené overenia

Nasledujúce výsledky pochádzajú z predchádzajúcich vývojových overení zaznamenaných pri realizácii zmien. Pri tejto dokumentačnej revízii sa testy znovu nespúšťali; nejde o nový produkčný test ani o výsledok celej testovacej sady na aktuálnej verzii.

| Implementácia | Vykonané overenie | Čo výsledok preukazuje |
|---|---|---|
| Pulse — opakovaná povinná kontrola po zmene prostredia | 3 browser scenáre a 25 Vitest testov prešli pri oprave; e2e/pulse-gate-invalidation.spec.ts a súvisiace pulse-gate fixtures/rutiny. | Kontrola sa obnoví po zmene prostredia; súbežné invalidácie nespúšťajú cyklické reštarty a staré async dokončenie neuvoľní novú kontrolu. |
| Pulse — viditeľnosť latencie | latency-result-visibility.node.test.ts prešiel po cielenej oprave. | Latencia/jitter už nie sú nesprávne vylúčené z hlavného zobrazenia diagnostiky. |
| Priority Builder | 3 cielené browser scenáre v e2e/priority-builder.spec.ts prešli pri oprave. | Uloženie referral_cities, explicitná reaktivácia a zachovanie požiadavky pri prepnutí pohľadu. |

Existujú aj manuálne formuláre komplexného testovania Pulse zo septembra 2026. Obsahujú úspešné, podmienené, neúspešné aj nevykonané scenáre. Preto sa nepoužívajú ako tvrdenie, že úplne všetky funkcie a prostredia prešli. Nálezy zo staršieho testu treba spárovať s následnou opravou a regresným scenárom; staré zlyhanie nie je automaticky dnešný stav a samotná oprava nie je univerzálnou akceptáciou.

### 11.2 Dostupné automatizované rutiny a rozsah

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

### 11.3 Čo ešte musí pokryť finálna akceptácia

Pre Pricing V2, Contracts, Laboratory Connect a Invoicing existuje významná implementácia a stavová dokumentácia; v audite nebol doložený uzavretý úspešný end-to-end protokol celého reťazca. Cenový import so samokontrolou nie je náhradou nezávislých obchodných testov.

Pred úplným prechodom treba vykonať maticu: krajina × produkt × historická/nová cena × úplný/neúplný odber × zľava × splátka × oprava výsledku. Overiť aj odmietnutie neoprávneného zápisu, opakovanú správu laboratória, súbežnú fakturáciu, nedostupnú bránu a obnovu po prerušení. Pre migráciu pribudnú finančná reconciliácia, prílohy, delta prenos a rollback.

Každý finálny protokol má obsahovať verziu aplikácie, prostredie, dátum, použitú dátovú vzorku, príkaz alebo manuálny scenár, očakávaný/skutočný výsledok a otvorené výnimky. Tak možno stav „implementované a testované“ podložiť konkrétnym rozsahom namiesto všeobecného vyhlásenia.
