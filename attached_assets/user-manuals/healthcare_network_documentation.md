# INDEXUS — Dokumentácia: Healthcare Network

> **Healthcare Network** je jadrom práce obchodného tímu. Táto časť systému eviduje všetky zdravotnícke inštitúcie a ich personál — od veľkých pôrodníc až po súkromné gynekologické ambulancie a pôrodné asistentky. Cieľom je mať vždy aktuálny prehľad o partnerských vzťahoch, stave spolupráce a histórii kontaktov.

---

## Obsah

1. [Prehľad modulov a vzájomné vzťahy](#1-prehľad-modulov-a-vzájomné-vzťahy)
2. [Modul: Nemocnice (Hospitals)](#2-modul-nemocnice-hospitals)
3. [Modul: Ambulancie (Clinics)](#3-modul-ambulancie-clinics)
4. [Modul: Osoby / Spolupracovníci (Persons)](#4-modul-osoby--spolupracovníci-persons)
5. [Systém odporúčaní (Referral)](#5-systém-odporúčaní-referral)
6. [Práca s personálom inštitúcie](#6-práca-s-personálom-inštitúcie)
7. [Pipeline — stav spolupráce s ambulanciou](#7-pipeline--stav-spolupráce-s-ambulanciou)
8. [Tipy pre každodennú prácu](#8-tipy-pre-každodennú-prácu)

---

## 1. Prehľad modulov a vzájomné vzťahy

Healthcare Network v INDEXUS pozostáva zo štyroch navzájom prepojených entít:

```
NEMOCNICA (Hospital)
│
├── má priradené AMBULANCIE (Clinics)
│     └── ambulancia má primárneho LEKÁRA (Person)
│
└── má PERSONÁL (Persons)
      ├── Lekári (Gynekológ, Primár, Sekundár...)
      ├── Pôrodné asistentky (Midwife)
      ├── Sestry (Head Nurse, Nurse...)
      └── Iní zdravotnícki pracovníci
```

### Ako entity súvisia

| Entita | Vzťah |
|--------|-------|
| **Nemocnica → Ambulancie** | Ambulancia môže byť fyzicky umiestnená v nemocnici alebo byť súčasťou jej siete |
| **Nemocnica → Personál** | Lekári a sestry sú priradení ku konkrétnym oddeleniam nemocnice |
| **Ambulancia → Lekár** | Každá ambulancia má primárneho lekára (vlastník ambulancie) |
| **Ambulancia → Personál** | Okrem primárneho lekára môžu byť ku klinike priradené ďalšie osoby |
| **Osoba → Inštitúcie** | Jedna osoba (napr. pôrodná asistentka) môže byť priradená k viacerým nemocniciam aj ambulanciám súčasne |
| **Osoba → Osoba** | Cez systém odporúčaní — jedna osoba odporučila inú osobu ako potenciálneho spolupracovníka |

### Kedy použiť ktorý modul

- **Nemocnica** — ak ide o pôrodnicu, fakultnú nemocnicu alebo inú lôžkovú zdravotnícku inštitúciu
- **Ambulancia** — ak ide o gynekologickú ambulanciu, praktického lekára alebo ambulantnú poradňu
- **Osoba** — lekár, pôrodná asistentka, sestra alebo iný zdravotnícky pracovník, s ktorým spolupracujete alebo plánujete spolupracovať
- **Pôrodná asistentka (Midwife)** — osoba s typom alebo profesijnou klasifikáciou v kategórii pôrodných asistentiek; eviduje sa v module Osoby

---

## 2. Modul: Nemocnice (Hospitals)

### Čo tu evidujeme

Nemocnice sú veľké zdravotnícke zariadenia — pôrodnice, fakultné nemocnice, krajské nemocnice. Sú základnou geografickou kotvou siete: ambulancie a personál sú k nim priradené.

### Zoznam nemocníc

Na hlavnej stránke vidíte tabuľku všetkých nemocníc s:
- **Názvom** a **krajinou** (s vlajkou)
- **Mestom** a **krajom**
- **Stavom** (Aktívna / Neaktívna)
- **Počtom priradených ambulancií** a **personálu**
- **Príznakom siete** — ak je nemocnica súčasťou zdravotníckej siete (napr. Svet zdravia), zobrazí sa farebný štítok s názvom siete

Pomocou filtra v pravom hornom rohu môžete filtrovať nemocnice podľa krajiny, kraja, stavu aktivity alebo príslušnosti k sieti.

### Karta nemocnice — záložky

Kliknutím na nemocnicu v zozname (alebo na ikonu úpravy) sa otvorí bočný panel s tromi záložkami:

---

#### Záložka: Základné údaje

Hlavné informácie o nemocnici, ktoré môžete priamo upravovať.

| Pole | Popis |
|------|-------|
| **Celý názov** *(povinné)* | Oficiálny úplný názov nemocnice, napr. *Univerzitná nemocnica L. Pasteura Košice* |
| **Skrátený názov** | Pracovný skratený názov pre zobrazenie v zoznamoch |
| **Krajina** *(povinné)* | Krajina, kde sa nemocnica nachádza |
| **Ulica a číslo** | Adresa — ulica a číslo domu |
| **Mesto** | Mesto — po zadaní sa automaticky navrhne kraj a okres |
| **PSČ** | Poštové smerovacie číslo |
| **Kraj** | Automaticky vyplnený po zadaní mesta; možno manuálne zmeniť |
| **Okres** | Okres v rámci kraja |
| **GPS súradnice** | Zemepisná šírka a dĺžka — možno zadať ručne alebo použiť tlačidlo *Získať polohu* (využije GPS zariadenia) |
| **Zodpovedná osoba** | INDEXUS používateľ zodpovedný za túto nemocnicu |
| **Kontaktná osoba** | Meno interného kontaktu v nemocnici (nie z modulu Osôb) |
| **Laboratórium** | Priradené odberové laboratórium pre danú krajinu |
| **Aktívna** | Prepínač — neaktívne nemocnice sa nezobrazujú v kampaniach a filtroch |
| **Auto-nábor** | Ak je zapnuté, systém môže nemocnicu automaticky zaradiť do náboru |
| **Svet zdravia / Sieť** | Označenie príslušnosti k nemocničnej sieti |

> **Tip:** Po zadaní mesta systém automaticky navrhne kraj a okres. Ak návrh nesedí, použite tlačidlo s ikonou čarovnej paličky vedľa poľa Kraj.

---

#### Záložka: Personál

Zobrazuje všetkých zdravotníckych pracovníkov priradených k tejto nemocnici. Pre každú osobu vidíte:
- **Celé meno** s titulmi
- **Kategóriu / pozíciu** (Primár, Gynekológ, Pôrodná asistentka...)
- **Oddelenie** a **rolu** v rámci oddelenia
- **Kontaktné údaje** (telefón, e-mail)
- **Príznak "Primárny"** — hlavný kontakt v danej inštitúcii
- **Kto osobu odporučil** — fialový štítok s menom odporúčateľa
- **Stav** (Aktívny / Neaktívny)

Správu personálu (pridávanie, úprava priradení) vykonávate priamo v karte danej Osoby alebo cez tlačidlo správy personálu.

---

#### Záložka: Kampane

Zobrazuje históriu a aktuálny stav všetkých kampaní, do ktorých bola táto nemocnica zaradená. Môžete tu sledovať, ako prebieha kontaktovanie tejto inštitúcie v rámci jednotlivých kampaní.

---

### Pridanie novej nemocnice

Kliknite na tlačidlo **+ Pridať nemocnicu** v pravom hornom rohu. Otvorí sa sprievodca (wizard) so 5 krokmi:

1. **Základné** — názov a krajina
2. **Adresa** — ulica, mesto, PSČ, GPS
3. **Kontakty** — zodpovedná osoba, kontaktná osoba
4. **Nastavenia** — laboratórium, auto-nábor, sieť
5. **Prehľad** — kontrola pred uložením

---

## 3. Modul: Ambulancie (Clinics)

### Čo tu evidujeme

Ambulancie sú gynekologické, pôrodnícke alebo iné ambulantné pracoviská — súkromné praxe, polikliniky, poradne. Každá ambulancia má primárneho lekára (gynekológ, praktik) a sleduje sa na nej celý proces od prvého kontaktu až po aktívnu zmluvu.

### Zoznam ambulancií

Tabuľka zobrazuje:
- **Meno lekára** a **názov ambulancie**
- **Mesto, kraj, krajinu**
- **Stav pipeline** — farebný štítok ukazuje, v akom štádiu spolupráce sa ambulancia nachádza
- **Zdroj leadu** — ako sa ambulancia dostala do systému
- **Dátum posledného kontaktu / ďalší kontakt**
- **Príznak odporúčania** — ak bola ambulancia odporučená iným lekárom

### Karta ambulancie — záložky

---

#### Záložka: Základné údaje

| Sekcia | Polia |
|--------|-------|
| **Identifikácia** | Názov ambulancie, Titul lekára, Meno, Priezvisko |
| **Kódy** | ID zdravotníckeho zariadenia (ID ZZ), Kód PZS, Názov PZS, IČO |
| **Adresa** | Ulica, číslo, orientačné číslo, Mesto, PSČ, Krajina, Kraj, Okres |
| **Kontakty** | Telefón 1/2/3, E-mail 1/2/3, Web |
| **GPS** | Súradnice — zadanie ručne alebo získanie z GPS |
| **Stav** | Aktívna / Neaktívna, Poznámky |

> **Tip pre kontakty:** Ambulancia môže mať až 3 telefónne čísla a 3 e-mailové adresy. Priamo pri každom telefónnom čísle je tlačidlo pre okamžité vytočenie cez INDEXUS telefóniu.

---

#### Záložka: Pipeline a spolupráca

Táto záložka je srdcom obchodného procesu pre ambulanciu. Sleduje sa tu celý životný cyklus vzťahu.

**Zdroj leadu** — Odkiaľ pochádza tento kontakt:

| Typ | Popis |
|-----|-------|
| **Nový kontakt** | Ambulancia oslovená prvýkrát, bez predchádzajúceho vzťahu |
| **Bývalý spolupracovník** | Lekár bol v minulosti náš spolupracovník |
| **Aktuálny spolupracovník** | Ambulanciu odporučil iný náš aktívny spolupracovník |
| **Odporúčanie lekára** | Odporučil konkrétny lekár (aktivuje pole pre meno odporúčateľa) |
| **Konferencia** | Kontakt nadviazaný na odbornej konferencii |

**Stav pipeline** — Postup v obchodnom procese:

| Štádium | Popis |
|---------|-------|
| **Nekontaktovaný** | Ambulancia je v databáze, ešte nebol nadviazaný kontakt |
| **Bývalý spolupracovník** | Históric vzťahu existuje |
| **Záujem o spoluprácu** | Lekár prejavil záujem o spoluprácu s CBC |
| **Záujem o zmluvu** | Lekár je ochotný podpísať zmluvu |
| **Aktívna zmluva** | Zmluva je podpísaná a platná |
| **Nezáujem** | Lekár odmietol spoluprácu |

**Komunikácia a zmluva:**
- **Výsledok posledného hovoru** a jeho poznámka
- **Dátum ďalšieho kontaktu** — plánovanie follow-upu
- **Zmluva odoslaná / Zmluva vrátená** — dátumy sledujúce životný cyklus zmluvy
- **Letáky** — či boli odoslané, kedy a kde sú uložené

---

#### Záložka: História kontaktov

Chronologický zoznam všetkých interakcií s ambulanciou — hovory, e-maily, návštevy. Každý záznam obsahuje dátum, typ kontaktu, výsledok a poznámku.

---

#### Záložka: Komunikácia (E-mail)

Priame odoslanie e-mailu ambulancii bez opúšťania INDEXUS. Podporuje:
- Výber odosielateľa (osobný MS365 účet alebo zdieľaná schránka)
- Výber zo šablón e-mailov podľa kategórie a jazyka
- CC príjemca
- Prílohy

---

#### Záložka: Personál

Zobrazuje všetkých pracovníkov priradených k tejto ambulancii — rovnaké zobrazenie ako pri nemocnici. V hornej časti je vyčlenený primárny lekár ambulancie (majiteľ praxe).

---

#### Záložka: Kampane

História zapojenia ambulancie do kampaní.

---

#### Záložka: Sieť (Network)

Zobrazuje, do akej zdravotníckej siete ambulancia patrí (ak je súčasťou skupiny ambulancií alebo nemocničnej siete).

---

#### Záložka: Odporúčania (Referrals)

Zobrazuje zoznam odporúčaní — kto odporučil túto ambulanciu a ktoré ďalšie ambulancie táto ambulancia odporučila. Viac v kapitole [Systém odporúčaní](#5-systém-odporúčaní-referral).

---

### Pridanie novej ambulancie

Kliknite na **+ Pridať ambulanciu**. Otvorí sa bočný panel s formulárom. Pri zadávaní mesta systém automaticky navrhne kraj a okres. PSČ je možné dohľadať automaticky cez AI vyhľadávanie (tlačidlo vedľa poľa PSČ).

**Po uložení odporúčame:**
1. Nastaviť stav pipeline (aspoň *Nekontaktovaný*)
2. Doplniť zdroj leadu
3. Pridať personál cez záložku Personál

---

## 4. Modul: Osoby / Spolupracovníci (Persons)

### Čo tu evidujeme

Modul Osoby (v navigácii nazývaný aj Spolupracovníci) obsahuje všetkých zdravotníckych pracovníkov — lekárov, pôrodné asistentky, sestry a ďalší personál. Každá osoba môže byť priradená k jednej alebo viacerým nemocniciam a ambulanciám. Niektoré osoby sú zároveň aktívnymi spolupracovníkmi s uzavretou zmluvou a dostávajú odmeny.

### Typy osôb

| Typ | Popis |
|-----|-------|
| **Lekár (Doctor)** | Gynekológ, praktik, špecialist |
| **Sestra (Nurse)** | Zdravotná sestra |
| **Vedoňa / Pôrodná asistentka (Vedono)** | Pôrodná asistentka — kľúčová rola v procese odporúčaní |
| **Sestrička vedúca (Head Nurse)** | Vedúca sestra oddelenia |
| **Stážista (Resident)** | Lekár v príprave |
| **Obchodný zástupca (BM/Representative)** | Zástupca vo vonkajšom teréne |
| **Externý (External)** | Externý spolupracovník mimo zdravotníctva |
| **Iný (Other)** | Ostatné kategórie |

### Profesijné klasifikácie (podrobnejšie)

Pre presnejšiu evidenciu slúži profesijná klasifikácia:
- Gynekologickí špecialisti
- Praktickí lekári
- Primári oddelení
- Medicínski riaditelia
- Špecializované pôrodné asistentky
- Vedúce pôrodné asistentky
- Pôrodné asistentky bez špecializácie
- Vedúce sestry
- Operačné sestry
- Všeobecné sestry
- Sanitáři a zdravotnícki asistenti
- ...a ďalšie

### Karta osoby — záložky (Wizard)

Karta osoby je organizovaná do krokov/záložiek:

---

#### Záložka 1: Osobné údaje

| Pole | Popis |
|------|-------|
| **Titul pred menom** | Napr. MUDr., Mgr., doc. |
| **Meno** | Krstné meno |
| **Stredné meno** | Voliteľné |
| **Priezvisko** | Priezvisko |
| **Rodné priezvisko** | Rodné priezvisko (ak sa líši) |
| **Titul za menom** | Napr. PhD., MPH |
| **Rodné číslo** | Pre formálnu identifikáciu |
| **Dátum narodenia** | Deň, mesiac, rok |
| **Miesto narodenia** | Mesto narodenia |
| **Zdravotná poisťovňa** | Poisťovňa osoby |
| **Rodinný stav** | Slobodný/á, Ženatý/Vydatá, Rozvedený/á, Vdovec/Vdova |
| **Profesijná klasifikácia** | Podrobná kategória (viď vyššie) |
| **Najvyššie dosiahnuté vzdelanie** | Od základného po doktorát |
| **Pracovisko** | Názov primárneho pracoviska |
| **Je manažér** | Prepínač — označuje vedúce pozície |
| **Typ spolupracovníka** | Lekár, Sestra, Pôrodná asistentka... |
| **Partnerská kategória** | Presná pozícia v sieti (Primár, KOL, Gynekológ...) |
| **CBC aktivity** | Aktivity v oblasti cord blood banking |
| **Krajiny pôsobenia** | Môže pôsobiť vo viacerých krajinách |
| **Aktívna** | Stav osoby v systéme |
| **Svet zdravia** | Príslušnosť k nemocničnej sieti |
| **Klientský kontakt** | Osoba je priamym kontaktom pre klientov |

---

#### Záložka 2: Kontaktné údaje

| Pole | Popis |
|------|-------|
| **Telefón** | Pracovný telefón |
| **Mobil 1 / Mobil 2** | Mobilné čísla |
| **Iný kontakt** | Napr. WhatsApp, Viber |
| **E-mail** | E-mailová adresa |

> Priamo pri každom telefónnom čísle je tlačidlo pre okamžité vytočenie cez INDEXUS.

---

#### Záložka 3: Bankové údaje

Vyplňuje sa pre spolupracovníkov, ktorým sa vyplácajú odmeny.

| Pole | Popis |
|------|-------|
| **IBAN** | Osobný bankový účet |
| **SWIFT / BIC** | Kód banky |
| **Názov firmy** | Ak osoba fakturuje cez s.r.o. alebo živnosť |
| **IČO / DIČ / IČ DPH** | Identifikačné čísla firmy |
| **Firemný IBAN / SWIFT** | Bankový účet firmy |

---

#### Záložka 4: Zmluvy a odmeny

Evidencia zmluvných vzťahov spolupracovníka.

| Pole | Popis |
|------|-------|
| **Typ zmluvy** | Forma dohody (DPP, DPČ, zmluva o spolupráci...) |
| **Číslo zmluvy** | Interné číslo zmluvy |
| **Forma dohody** | Právna forma |
| **Platnosť od / do** | Dátumový rozsah platnosti zmluvy |
| **Zmluva odoslaná / vrátená** | Sledovanie fyzického obehu zmluvy |
| **Registrácia do SP** | Dátum prihlásenia do Sociálnej poisťovne |
| **Odhlásenie zo SP** | Dátum odhlásenia |
| **Mesačné odmeny** | Či dostáva pravidelné mesačné odmeny |
| **Typ odmeny** | Fixná suma alebo percentuálna odmena |
| **Výška fixnej odmeny** | Suma v príslušnej mene |
| **Percentuálna odmena** | Podiel z hodnoty podľa krajiny |
| **Poznámka ku zmluve** | Interné poznámky |

---

#### Záložka 5: Dokumenty

Ukladanie dokumentov priradených k osobe — skenov zmlúv, príloh, certifikátov. Dokumenty možno nahrávať a prezerať priamo v INDEXUS.

---

#### Záložka 6: Aktivity a akcie

Prehľad aktivít spolupracovníka — návštevy, hovory, akcie. Zobrazuje sa tu celá história interakcií zaznamenaná k tejto osobe.

---

#### Záložka 7: História

Kompletný chronologický prehľad všetkých zmien a udalostí zaznamenaných k tejto osobe.

---

#### Záložka 8: Medicínska sieť (Medical Network)

Kľúčová záložka — zobrazuje ku ktorým nemocniciam a ambulanciám je táto osoba priradená.

Pre každé priradenie vidíte:
- **Inštitúcia** (nemocnica alebo ambulancia) s odkazom na jej kartu
- **Oddelenie** — napr. *Gynekologicko-pôrodnícke oddelenie*
- **Pozícia** — napr. *Primár*, *Sekundár*, *Pôrodná asistentka*
- **Rola** — konkrétna rola v rámci pozície
- **Kategória** — z číselníka MPN kategórií
- **Dátum od / do** — časové ohraničenie priradenia
- **Primárne priradenie** — označenie hlavného pracoviska
- **Aktívne / Neaktívne** — stav priradenia
- **Poznámka** — voliteľná poznámka ku priradeniu

> **Dôležité:** Priradenie k inštitúcii sa pridáva cez záložku **Personál** v karte danej nemocnice alebo ambulancie — nie priamo tu. Táto záložka slúži len na prehľad a úpravu existujúcich priradení.

---

#### Záložka 9: Mobilná aplikácia

Správa prístupu spolupracovníka do INDEXUS Connect (mobilnej aplikácie). Zobrazuje stav pripojenia, QR kód na prihlásenie a nastavenia mobilného prístupu.

---

### Zdroj leadu a odporúčania pre osoby

Rovnako ako pre ambulancie, aj pre osoby sa sleduje:
- **Zdroj leadu** — ako sa osoba dostala do databázy
- **Je odporučený lekárom** — prepínač (ak áno, je viditeľné pri osobe v zozname personálu)
- **Z konferencie** — či bol kontakt nadviazaný na konferencii

---

## 5. Systém odporúčaní (Referral)

### Prečo je referral kľúčový

V cord blood banking je dôvera zásadná. Väčšina nových spolupracovníkov prichádza cez odporúčanie iného lekára alebo pôrodnej asistentky. INDEXUS preto sleduje tieto vzťahy presne — vieme kto koho odporučil, a môžeme cielene rozvíjať sieť odporúčaní.

### Ako referral funguje

#### Pre ambulancie

1. Pri zadaní ambulancie vyberiete **Zdroj leadu** = *Odporúčanie lekára*
2. Zaškrtnete prepínač **Je odporučená lekárom**
3. V záložke **Odporúčania** sa zobrazí odkaz na odporúčajúceho lekára

Systém sleduje:
- Kto odporučil túto ambulanciu
- Ktoré iné ambulancie táto ambulancia odporučila

#### Pre osoby (personál inštitúcie)

Pri priradení osoby k nemocnici alebo ambulancii cez záložku Personál môžete vyplniť:
- **Odporučil/a** — vyberte meno osoby, ktorá tohto pracovníka odporučila

Po uložení sa pri mene pracovníka v zozname personálu zobrazí fialový štítok:
> *"Odporučil Ján Novák"* (pre muža)
> *"Odporučila Jana Nováková"* (pre ženu — INDEXUS rozpozná pohlavie podľa priezviska)

### Ako udržiavať referral aktuálny — odporúčané postupy

| Situácia | Čo urobiť |
|----------|-----------|
| Lekár odporučil nového kolegu | Pri vytváraní osoby nastaviť Zdroj leadu = *Odporúčanie lekára* a zaznamenať meno odporúčateľa v priradení k inštitúcii |
| Pôrodná asistentka odporučila ambulanciu | Pri ambulancii nastaviť Zdroj leadu = *Odporúčanie lekára* a v záložke Odporúčania prepojiť s odporúčajúcou osobou |
| Aktívny spolupracovník odporučil kolegov | Zdroj leadu = *Aktuálny spolupracovník* — umožní merať produktivitu existujúcich spolupracovníkov |
| Kontakt z konferencie | Zdroj leadu = *Konferencia*, doplniť názov konferencie a dátum |

> **Prečo to dodržiavať:** Na základe zdrojov leadov možno merať, ktoré kanály prinášajú najviac spolupracovníkov a nastaviť priority oslovovania. Správne vyplnená referral história je tiež základom pre odmeny za odporúčania.

---

## 6. Práca s personálom inštitúcie

### Pridanie osoby k nemocnici alebo ambulancii

1. Otvorte kartu **nemocnice** alebo **ambulancie**
2. Prejdite na záložku **Personál**
3. Kliknite na **+ Pridať pracovníka**
4. Vyhľadajte existujúcu osobu v databáze alebo vytvorte novú
5. Vyplňte:
   - **Oddelenie** — napr. *Gynekologicko-pôrodnícke odd.*
   - **Pozícia** — napr. *Pôrodná asistentka*
   - **Kategória** — z číselníka MPN kategórií
   - **Primárne priradenie** — ak je to hlavné pracovisko tejto osoby
   - **Odporučil/a** — kto túto osobu odporučil (pre referral tracking)
   - **Aktívne** — či je priradenie momentálne aktívne
6. Uložte

### Kategorické zaradenie personálu

INDEXUS používa číselník **MPN kategórií** pre presné zaradenie personálu. Kategórie platia pre nemocnice aj ambulancie a sú rozdelené podľa rozsahu:

**Kategórie pre nemocnice:**
- Riaditeľ nemocnice (Hospital Director)
- Vedúci oddelenia (Department Head)
- Primár (Chief Physician)
- Sekundár (Attending Physician)
- Gynekológ (Gynecologist)
- Pôrodník (Obstetrician)
- Neonatológ (Neonatologist)
- Pediater (Pediatrician)
- Vedúca sestra (Head Nurse)
- Sestra (Nurse)
- Pôrodná asistentka pri pôrode (Delivery Midwife)
- Pôrodná asistentka (Midwife)
- Anestéziológ, Chirurg, Hematológ, Onkológ...

**Kategórie pre ambulancie:**
- Ambulantný gynekológ (Ambulatory Gynecologist)
- Praktický lekár (General Practitioner)
- KOL (Key Opinion Leader) — lekári s výrazným vplyvom v oblasti
- Strategický partner (Strategic Partner)
- Zdroj odporúčaní (Referral Source)

**Špeciálne kategórie:**
- Prenatal Instructor (lektor predpôrodných kurzov)
- Doula
- Konzultant laktácie (Lactation Consultant)
- Lekárnik (Pharmacist)

---

## 7. Pipeline — stav spolupráce s ambulanciou

### Vizuálny postup spolupráce

Pre každú ambulanciu INDEXUS zobrazuje **5-krokový progress bar**, ktorý ukazuje, v akom štádiu sa vzťah nachádza:

```
[Kontakt] → [Odporúčanie] → [Záujem o spoluprácu] → [Záujem o zmluvu] → [Partner]
```

| Krok | Kedy je splnený |
|------|-----------------|
| **Kontakt** | Bol nastavený zdroj leadu (ambulancia je v databáze a má priradený pôvod) |
| **Odporúčanie** | Ambulancia bola odporučená iným lekárom / spolupracovníkom |
| **Záujem o spoluprácu** | Lekár potvrdil záujem o spoluprácu (pipeline = *coop:interested*) |
| **Záujem o zmluvu** | Lekár je ochotný podpísať zmluvu (pipeline = *contract_int:interested*) |
| **Partner** | Zmluva je podpísaná a aktívna (pipeline = *contract:active*) |

Kroky označené červenou farbou signalizujú odmietnutie v danej fáze — napr. lekár odmietol spoluprácu alebo odmietol podpísať zmluvu.

### Odporúčaný postup práce s pipeline

1. **Pri prvom kontakte** — nastavte Zdroj leadu a Pipeline = *Nekontaktovaný* alebo *Záujem o spoluprácu*
2. **Po prvom hovore** — zaznamenajte výsledok (pole Výsledok posledného hovoru) a nastavte Dátum ďalšieho kontaktu
3. **Pri kladnej reakcii** — posúvajte pipeline vpred: *Záujem o spoluprácu* → *Záujem o zmluvu*
4. **Pri odoslaní zmluvy** — vyplňte Dátum odoslania zmluvy
5. **Po podpísaní** — nastavte Pipeline = *Aktívna zmluva* a doplňte Dátum vrátenia zmluvy

---

## 8. Tipy pre každodennú prácu

### Rýchle vyhľadávanie

V každom module je vyhľadávacie pole v hornej časti — hľadá podľa mena, mesta, PSČ aj kódov. Globálne vyhľadávanie (ikona lupy v navigácii) prehľadáva naraz nemocnice, ambulancie aj osoby.

### Filtrovanie

Tlačidlo **Filter** umožňuje kombinovať viacero kritérií naraz — krajina, kraj, stav pipeline, typ osoby, aktívnosť atď. Filtry možno uložiť ako **preset** pre opakované použitie.

### Export

V zozname nemocníc, ambulancií aj osôb je tlačidlo **Export** (ikona tabuľky) — exportuje aktuálne zobrazenú a filtrovanú množinu do súboru Excel/CSV.

### Obohacovanie z webu

Pri ambulanciách je dostupná funkcia **Obohatiť z webu** — systém sa pokúsi automaticky dohľadať chýbajúce kontaktné údaje (telefón, e-mail, web) na základe mena a adresy ambulancie.

### GPS a mapa

Každá nemocnica, ambulancia aj adresa osoby môže mať GPS súradnice. Súradnice možno:
- Zadať ručne
- Získať z GPS zariadenia (tlačidlo *Získať polohu*)
- Po zadaní zobraziť na mape (tlačidlo *Zobraziť na mape*)

### Viacjazyčné prostredie

INDEXUS je plne lokalizovaný — slovenčina, čeština, angličtina, maďarčina, rumunčina, taliančina, nemčina. Jazyk rozhrania sa nastavuje v profile používateľa. Krajinský filter v navigácii umožňuje zobraziť len záznamy pre vybranú krajinu.

---

*Dokumentácia Healthcare Network — INDEXUS CRM*
*Posledná aktualizácia: máj 2026*
