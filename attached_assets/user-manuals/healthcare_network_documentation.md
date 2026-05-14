# INDEXUS — Dokumentácia: Healthcare Network

> **Healthcare Network** je jadrom práce obchodného tímu. Táto časť systému eviduje všetky zdravotnícke inštitúcie a ich personál — od veľkých pôrodníc až po súkromné gynekologické ambulancie a pôrodné asistentky. Cieľom je mať vždy aktuálny prehľad o partnerských vzťahoch, stave spolupráce a histórii kontaktov.

---

## Obsah

1. [Prehľad modulov a vzájomné vzťahy](#1-prehľad-modulov-a-vzájomné-vzťahy)
2. [Modul: Nemocnice (Hospitals)](#2-modul-nemocnice-hospitals)
3. [Modul: Ambulancie (Clinics)](#3-modul-ambulancie-clinics)
4. [Modul: Osoby / Spolupracovníci (Persons)](#4-modul-osoby--spolupracovníci-persons)
5. [Systém odporúčaní (Referral) — s reálnym príkladom](#5-systém-odporúčaní-referral--s-reálnym-príkladom)
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
| **Ambulancia → Personál** | Okrem primárneho lekára môžu byť ku ambulancii priradené ďalšie osoby |
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
| **GPS súradnice** | Zemepisná šírka a dĺžka — zadanie ručne alebo tlačidlo *Získať polohu* (GPS zariadenia) |
| **Zodpovedná osoba** | INDEXUS používateľ zodpovedný za túto nemocnicu |
| **Kontaktná osoba** | Meno interného kontaktu v nemocnici |
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

Zobrazuje históriu a aktuálny stav všetkých kampaní, do ktorých bola táto nemocnica zaradená.

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

> **Tip pre kontakty:** Ambulancia môže mať až 3 telefónne čísla a 3 e-mailové adresy. Priamo pri každom čísle je tlačidlo pre okamžité vytočenie cez INDEXUS telefóniu.

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
| **Bývalý spolupracovník** | Historický vzťah existuje |
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

Zobrazuje všetkých pracovníkov priradených k tejto ambulancii. V hornej časti je vyčlenený primárny lekár ambulancie (majiteľ praxe).

---

#### Záložka: Kampane

História zapojenia ambulancie do kampaní.

---

#### Záložka: Sieť (Network)

Zobrazuje, do akej zdravotníckej siete ambulancia patrí.

---

#### Záložka: Odporúčania (Referrals)

Zobrazuje zoznam odporúčaní — kto odporučil túto ambulanciu a ktoré ďalšie ambulancie táto ambulancia odporučila. Viac v kapitole [5 — Systém odporúčaní](#5-systém-odporúčaní-referral--s-reálnym-príkladom).

---

### Pridanie novej ambulancie

Kliknite na **+ Pridať ambulanciu**. Pri zadávaní mesta systém automaticky navrhne kraj a okres. PSČ je možné dohľadať automaticky cez AI vyhľadávanie (tlačidlo vedľa poľa PSČ).

**Po uložení odporúčame:**
1. Nastaviť stav pipeline (aspoň *Nekontaktovaný*)
2. Doplniť zdroj leadu
3. Pridať personál cez záložku Personál

---

## 4. Modul: Osoby / Spolupracovníci (Persons)

### Čo tu evidujeme

Modul Osoby obsahuje všetkých zdravotníckych pracovníkov — lekárov, pôrodné asistentky, sestry a ďalší personál. Každá osoba môže byť priradená k jednej alebo viacerým nemocniciam a ambulanciám. Niektoré osoby sú zároveň aktívnymi spolupracovníkmi s uzavretou zmluvou a dostávajú odmeny.

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

### Karta osoby — záložky (Wizard)

Karta osoby je organizovaná do 9 krokov/záložiek:

---

#### Záložka 1: Osobné údaje

| Pole | Popis |
|------|-------|
| **Titul pred menom** | Napr. MUDr., Mgr., doc. |
| **Meno / Stredné meno / Priezvisko** | Celé meno osoby |
| **Rodné priezvisko** | Rodné priezvisko (ak sa líši) |
| **Titul za menom** | Napr. PhD., MPH |
| **Rodné číslo** | Pre formálnu identifikáciu |
| **Dátum a miesto narodenia** | Deň, mesiac, rok, mesto |
| **Zdravotná poisťovňa** | Poisťovňa osoby |
| **Rodinný stav** | Slobodný/á, Ženatý/Vydatá, Rozvedený/á, Vdovec/Vdova |
| **Profesijná klasifikácia** | Podrobná kategória zdravotníckeho pracovníka |
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

| Pole | Popis |
|------|-------|
| **Typ zmluvy** | Forma dohody (DPP, DPČ, zmluva o spolupráci...) |
| **Číslo zmluvy** | Interné číslo zmluvy |
| **Platnosť od / do** | Dátumový rozsah platnosti zmluvy |
| **Zmluva odoslaná / vrátená** | Sledovanie fyzického obehu zmluvy |
| **Registrácia / odhlásenie zo SP** | Dátumy pre Sociálnu poisťovňu |
| **Mesačné odmeny** | Či dostáva pravidelné mesačné odmeny |
| **Typ odmeny** | Fixná suma alebo percentuálna odmena |
| **Výška fixnej odmeny** | Suma v príslušnej mene |
| **Percentuálna odmena** | Podiel z hodnoty podľa krajiny |

---

#### Záložka 5: Dokumenty

Ukladanie dokumentov priradených k osobe — skenov zmlúv, príloh, certifikátov. Dokumenty možno nahrávať a prezerať priamo v INDEXUS.

---

#### Záložka 6: Aktivity a akcie

Prehľad aktivít spolupracovníka — návštevy, hovory, akcie. Celá história interakcií zaznamenaná k tejto osobe.

---

#### Záložka 7: História

Kompletný chronologický prehľad všetkých zmien a udalostí zaznamenaných k tejto osobe.

---

#### Záložka 8: Medicínska sieť (Medical Network)

Kľúčová záložka — zobrazuje ku ktorým nemocniciam a ambulanciám je táto osoba priradená.

Pre každé priradenie vidíte:
- **Inštitúcia** (nemocnica alebo ambulancia) s odkazom na jej kartu
- **Oddelenie** — napr. *Gynekologicko-pôrodnícke oddelenie*
- **Pozícia** — napr. *Primár*, *Sekundár*, *Pôrodné asistentky*
- **Rola** — konkrétna rola v rámci pozície
- **Kategória** — z číselníka MPN kategórií
- **Dátum od / do** — časové ohraničenie priradenia
- **Primárne priradenie** — označenie hlavného pracoviska
- **Aktívne / Neaktívne** — stav priradenia
- **Kto osobu odporučil** — fialový štítok s menom odporúčateľa

> **Dôležité:** Priradenie k inštitúcii sa pridáva cez záložku **Personál** v karte danej nemocnice alebo ambulancie — nie priamo tu. Táto záložka slúži len na prehľad a úpravu existujúcich priradení.

---

#### Záložka 9: Mobilná aplikácia

Správa prístupu spolupracovníka do INDEXUS Connect (mobilnej aplikácie). Zobrazuje stav pripojenia, QR kód na prihlásenie a nastavenia mobilného prístupu.

---

## 5. Systém odporúčaní (Referral) — s reálnym príkladom

### Prečo je referral kľúčový

V cord blood banking je dôvera zásadná. Väčšina nových spolupracovníkov prichádza cez odporúčanie iného lekára alebo pôrodnej asistentky. INDEXUS preto sleduje tieto vzťahy presne — vieme kto koho odporučil, a môžeme cielene rozvíjať sieť odporúčaní.

---

### Reálny príklad z dát: Referral reťazec — Feráková → Korčok → Trnava

> **Toto je skutočný príklad z INDEXUS databázy, zaznamenané 15. 4. 2026. Mená a dátumy sú reálne.**

#### Situácia

Obchodný zástupca navštívil **MUDr. Nataša Feráková** z *Ambulancie detskej gynekológie* v **Novom Meste**. Pani doktorka je dlhoročná spolupracovníčka a pri rozhovore odporučila ďalší kontakt.

#### Krok 1 — MUDr. Feráková odporučí MUDr. Korčoka

MUDr. Feráková odporučila oslověniť kolegu **MUDr. Martina Korčoka**, ktorý prevádzkuje ambulanciu *4D Ultrazvuk* v **Štúrove**.

**Čo urobíme v INDEXUS:**
1. Otvorte kartu ambulancie **4D Ultrazvuk** (Štúrovo)
2. V záložke **Pipeline** nastavte:
   - Zdroj leadu = **Odporúčanie lekára**
   - Zaškrtnite prepínač **Je odporučená lekárom**
3. V záložke **Odporúčania** pridajte prepojenie na *Ambulanciu detskej gynekológie* (MUDr. Feráková, Nové Mesto)

**Výsledok v systéme:**
```
4D Ultrazvuk — MUDr. Martin Korčok, Štúrovo
  └─ [Odporúčanie] ← Ambulancia detskej gynekológie — MUDr. Nataša Feráková, Nové Mesto
       Typ: Odporúčanie lekára  |  Zaznamenané: 15.4.2026
```

#### Krok 2 — MUDr. Korčok odporučí ďalšiu ambulanciu

Po úspešnom nadviazaní spolupráce s MUDr. Korčokom on sám odporučil ďalšiu ambulanciu — **Gynekologicko-pôrodnícku ambulanciu** v **Trnave**.

**Finálny referral reťazec v INDEXUS:**

```
MUDr. Nataša Feráková
Ambulancia detskej gynekológie, Nové Mesto
        │
        └──► MUDr. Martin Korčok
             4D Ultrazvuk, Štúrovo               [15.4.2026]
                     │
                     └──► Gynekologicko-pôrodnícka ambulancia
                          Trnava                 [15.4.2026]
```

#### Čo táto viditeľnosť dáva manažérovi

- **MUDr. Feráková je kľúčový odporúčateľ** — cez jednu návštevu vznikli 2 nové ambulancie v sieti
- **Odborná dôvera sa prenáša**: Korčok dôveruje Ferákovej, Trnava dôveruje Korčokovi
- Pri plánovaní **odmien za odporúčania** je celý reťazec jasne zdokumentovaný a auditovateľný
- Môžete cielene **rozvíjať spoluprácu s Feráková** — vie odporučiť ďalšie kontakty

---

### Ako referral funguje všeobecne

#### Pre ambulancie

1. Pri zadaní ambulancie vyberiete **Zdroj leadu** = *Odporúčanie lekára*
2. Zaškrtnete prepínač **Je odporučená lekárom**
3. V záložke **Odporúčania** sa zobrazí odkaz na odporúčajúceho lekára

Systém sleduje obojstranne — kto odporučil túto ambulanciu a ktoré ďalšie ambulancie táto ambulancia odporučila.

#### Pre osoby (personál inštitúcie)

Pri priradení osoby k nemocnici alebo ambulancii cez záložku Personál môžete vyplniť:
- **Odporučil/a** — vyberte meno osoby, ktorá tohto pracovníka odporučila

Po uložení sa pri mene pracovníka v zozname personálu zobrazí fialový štítok:
> *"Odporučil Ján Novák"* (pre muža) / *"Odporučila Jana Nováková"* (pre ženu)

INDEXUS automaticky rozpozná pohlavie podľa koncovky priezviska (napr. -ová = žena).

### Odporúčané postupy pre udržiavanie referral siete

| Situácia | Čo urobiť |
|----------|-----------|
| Lekár odporučil novú ambulanciu | Nastaviť Zdroj leadu = *Odporúčanie lekára*, prepojiť cez záložku Odporúčania |
| Pôrodná asistentka odporučila kolegu | Pri novom pracovníkovi vyplniť pole *Odporučil/a* pri priradení k inštitúcii |
| Aktívny spolupracovník odporučil kolegov | Zdroj leadu = *Aktuálny spolupracovník* — meranie produktivity existujúcich spolupracovníkov |
| Kontakt z konferencie | Zdroj leadu = *Konferencia*, doplniť názov konferencie a dátum |

> **Prečo to dodržiavať:** Na základe zdrojov leadov možno merať, ktoré kanály prinášajú najviac spolupracovníkov. Správne vyplnená referral história je tiež základom pre odmeny za odporúčania.

---

## 6. Práca s personálom inštitúcie

### Pridanie osoby k nemocnici alebo ambulancii

1. Otvorte kartu **nemocnice** alebo **ambulancie**
2. Prejdite na záložku **Personál**
3. Kliknite na **+ Pridať pracovníka**
4. Vyhľadajte existujúcu osobu v databáze alebo vytvorte novú
5. Vyplňte:
   - **Oddelenie** — napr. *Gynekologicko-pôrodnícke odd.*
   - **Pozícia** — napr. *Pôrodné asistentky*
   - **Kategória** — z číselníka MPN kategórií
   - **Primárne priradenie** — ak je to hlavné pracovisko tejto osoby
   - **Odporučil/a** — kto túto osobu odporučil (pre referral tracking)
   - **Aktívne** — či je priradenie momentálne aktívne
6. Uložte

### Aktuálny zoznam MPN pozícií

INDEXUS používa číselník **MPN kategórií** pre presné zaradenie personálu.

#### Kategórie pre nemocnice

| Kód | Slovenský názov | Anglický názov |
|-----|----------------|----------------|
| `hospital_director` | Riaditeľ nemocnice | Hospital Director |
| `department_head` | Vedúci pôrodníckeho oddelenia | Head of Obstetrics Department |
| `head_nurse` | Hlavná/vrchná sestra pôrodníckeho oddelenia | Head Nurse of Obstetrics Department |
| `delivery_midwife` | Pôrodné asistentky/hebamme | Delivery Midwives |
| `department_doctor` | Lekári pôrodníckeho oddelenia | Obstetrics Department Doctors |
| `department_nurse` | Sestry pôrodníckeho oddelenia | Obstetrics Department Nurses |

#### Kategórie pre ambulancie

| Kód | Slovenský názov | Anglický názov |
|-----|----------------|----------------|
| `gynecologist_private` | Súkromný gynekológ | Private Gynecologist |
| `pediatrician_private` | Súkromný pediater | Private Pediatrician |

#### Kategórie pre nezávislých pracovníkov

| Kód | Slovenský názov | Anglický názov |
|-----|----------------|----------------|
| `prenatal_instructor` | Lektorka predpôrodnej prípravy | Prenatal Preparation Instructor |
| `doula` | Dula | Doula |
| `lactation_consultant` | Laktačná poradkyňa | Lactation Consultant |

---

## 7. Pipeline — stav spolupráce s ambulanciou

### Vizuálny postup spolupráce

Pre každú ambulanciu INDEXUS zobrazuje **5-krokový progress bar**, ktorý ukazuje, v akom štádiu sa vzťah nachádza:

```
[Kontakt] → [Odporúčanie] → [Záujem o spoluprácu] → [Záujem o zmluvu] → [Partner]
```

| Krok | Kedy je splnený |
|------|-----------------|
| **Kontakt** | Bol nastavený zdroj leadu (ambulancia má priradený pôvod) |
| **Odporúčanie** | Ambulancia bola odporučená iným lekárom / spolupracovníkom |
| **Záujem o spoluprácu** | Lekár potvrdil záujem o spoluprácu (pipeline = *coop:interested*) |
| **Záujem o zmluvu** | Lekár je ochotný podpísať zmluvu (pipeline = *contract_int:interested*) |
| **Partner** | Zmluva je podpísaná a aktívna (pipeline = *contract:active*) |

Kroky označené červenou farbou signalizujú odmietnutie v danej fáze.

### Odporúčaný postup práce s pipeline

1. **Pri prvom kontakte** — nastavte Zdroj leadu a Pipeline = *Nekontaktovaný*
2. **Po prvom hovore** — zaznamenajte výsledok a nastavte Dátum ďalšieho kontaktu
3. **Pri kladnej reakcii** — posúvajte pipeline: *Záujem o spoluprácu* → *Záujem o zmluvu*
4. **Pri odoslaní zmluvy** — vyplňte Dátum odoslania zmluvy
5. **Po podpísaní** — nastavte Pipeline = *Aktívna zmluva* a doplňte Dátum vrátenia zmluvy

---

## 8. Tipy pre každodennú prácu

### Rýchle vyhľadávanie

V každom module je vyhľadávacie pole — hľadá podľa mena, mesta, PSČ aj kódov. Globálne vyhľadávanie (ikona lupy v navigácii) prehľadáva naraz nemocnice, ambulancie aj osoby.

### Filtrovanie a presety

Tlačidlo **Filter** umožňuje kombinovať viacero kritérií naraz — krajina, kraj, stav pipeline, typ osoby, aktívnosť atď. Filtry možno uložiť ako **preset** pre opakované použitie.

### Export

V každom zozname je tlačidlo **Export** (ikona tabuľky) — exportuje aktuálne zobrazenú a filtrovanú množinu do súboru Excel/CSV.

### Obohacovanie z webu

Pre ambulancie je dostupná funkcia **Obohatiť z webu** — systém automaticky dohľadá chýbajúce kontaktné údaje (telefón, e-mail, web) na základe mena a adresy ambulancie.

### GPS a mapa

Súradnice možno zadať ručne, získať z GPS zariadenia (*Získať polohu*) alebo po zadaní zobraziť na mape (*Zobraziť na mape*). Dostupné pre nemocnice, ambulancie aj adresy osôb.

### Viacjazyčné prostredie

INDEXUS je plne lokalizovaný — slovenčina, čeština, angličtina, maďarčina, rumunčina, taliančina, nemčina. Jazyk sa nastavuje v profile používateľa. Krajinský filter v navigácii umožňuje zobraziť len záznamy pre vybranú krajinu.

---

*Dokumentácia Healthcare Network — INDEXUS CRM*
*Posledná aktualizácia: máj 2026*
