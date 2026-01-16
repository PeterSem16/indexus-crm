# INDEXUS Connect - Kompletná dokumentácia

## Obsah

1. [Prehľad aplikácie](#1-prehľad-aplikácie)
2. [Inštalácia a stiahnutie](#2-inštalácia-a-stiahnutie)
3. [Nastavenie prístupu v INDEXUS CRM](#3-nastavenie-prístupu-v-indexus-crm)
4. [Prihlásenie do aplikácie](#4-prihlásenie-do-aplikácie)
5. [Hlavné funkcie](#5-hlavné-funkcie)
6. [Správa návštev nemocníc](#6-správa-návštev-nemocníc)
7. [GPS sledovanie](#7-gps-sledovanie)
8. [Hlasové poznámky](#8-hlasové-poznámky)
9. [Offline režim](#9-offline-režim)
10. [Nastavenia a profil](#10-nastavenia-a-profil)
11. [Technické špecifikácie](#11-technické-špecifikácie)
12. [Riešenie problémov](#12-riešenie-problémov)

---

## 1. Prehľad aplikácie

### Čo je INDEXUS Connect?

INDEXUS Connect je mobilná aplikácia určená pre terénnych pracovníkov (spolupracovníkov) spoločností zaoberajúcich sa uchovávaním pupočníkovej krvi. Aplikácia umožňuje:

- **Správu návštev nemocníc** - plánovanie, sledovanie a dokumentovanie návštev
- **GPS sledovanie** - automatické zaznamenávanie polohy počas návštev
- **Hlasové poznámky** - nahrávanie a automatický prepis poznámok pomocou AI
- **Offline prácu** - plná funkcionalita aj bez internetového pripojenia
- **Viacjazyčnú podporu** - SK, CZ, HU, DE, IT, RO, EN

### Podporované zariadenia

| Platforma | Minimálna verzia |
|-----------|-----------------|
| Android   | Android 10+     |
| iOS       | iOS 14+         |

---

## 2. Inštalácia a stiahnutie

### Android (APK)

1. Otvorte webový prehliadač na svojom Android zariadení
2. Prejdite na prihlasovaciu stránku INDEXUS CRM: `https://indexus.cordbloodcenter.com`
3. Kliknite na tlačidlo **"Stiahnuť aplikáciu INDEXUS Connect"**
4. Potvrďte stiahnutie APK súboru
5. Po stiahnutí otvorte súbor a povoľte inštaláciu z neznámych zdrojov (ak sa zobrazí výzva)
6. Dokončite inštaláciu

### iOS (TestFlight)

Pre iOS zariadenia kontaktujte administrátora pre pozvánku do TestFlight programu.

---

## 3. Nastavenie prístupu v INDEXUS CRM

### Kto môže nastaviť prístup?

Prístup do mobilnej aplikácie môžu nastaviť iba používatelia s administrátorskými právami v INDEXUS CRM.

### Postup nastavenia (pre administrátorov)

#### Krok 1: Prístup k spolupracovníkovi

1. Prihláste sa do INDEXUS CRM
2. V menu vyberte **Spolupracovníci**
3. Nájdite spolupracovníka, ktorému chcete povoliť prístup do mobilnej aplikácie
4. Kliknite na meno spolupracovníka alebo ikonu úprav

#### Krok 2: Otvorenie formulára

1. Kliknite na **Upraviť spolupracovníka**
2. Prejdite cez jednotlivé kroky formulára:
   - Osobné údaje
   - Kontaktné údaje
   - Bankové údaje
   - Firemné údaje
   - **INDEXUS Connect** ← tento krok obsahuje nastavenie mobilnej aplikácie

#### Krok 3: Konfigurácia mobilného prístupu

V kroku **INDEXUS Connect** nájdete tieto nastavenia:

| Pole | Popis |
|------|-------|
| **Povoliť prístup do mobilnej aplikácie** | Prepínač na zapnutie/vypnutie prístupu |
| **Používateľské meno** | Unikátne prihlasovacie meno pre mobilnú aplikáciu |
| **Heslo** | Heslo pre prihlásenie (min. 6 znakov odporúčané) |
| **Potvrdiť heslo** | Opakované zadanie hesla pre overenie |

#### Krok 4: Uloženie

1. Zapnite prepínač **"Povoliť prístup do mobilnej aplikácie"**
2. Zadajte **používateľské meno** (napr. `jan.novak`)
3. Zadajte a potvrďte **heslo**
4. Pokračujte na krok **Prehľad**
5. Skontrolujte údaje a kliknite na **Uložiť**

### Dôležité upozornenia

- Používateľské meno musí byť unikátne v celom systéme
- Heslo sa ukladá v zašifrovanej forme (bcrypt)
- Pri úprave existujúceho spolupracovníka môžete ponechať pole hesla prázdne pre zachovanie aktuálneho hesla
- Vypnutím prepínača sa okamžite zablokuje prístup do mobilnej aplikácie

---

## 4. Prihlásenie do aplikácie

### Prvé prihlásenie

1. Otvorte aplikáciu **INDEXUS Connect**
2. Zvoľte preferovaný jazyk (SK/CZ/HU/DE/IT/RO/EN)
3. Zadajte **používateľské meno** priradené administrátorom
4. Zadajte **heslo**
5. Voliteľne zaškrtnite **"Zapamätať si ma"**
6. Kliknite na **Prihlásiť sa**

### Automatické prihlásenie

Ak ste zaškrtli "Zapamätať si ma", aplikácia vás pri ďalšom spustení automaticky prihlási.

### Offline prihlásenie

Ak ste sa predtým úspešne prihlásili a nemáte internetové pripojenie, môžete sa prihlásiť do offline režimu s uloženými údajmi.

---

## 5. Hlavné funkcie

### Domovská obrazovka (Dashboard)

Po prihlásení sa zobrazí prehľadová obrazovka s:

- **Dnešné návštevy** - zoznam naplánovaných návštev na dnešný deň
- **Rýchle štatistiky**:
  - Počet návštev tento týždeň
  - Počet čakajúcich na synchronizáciu
  - Miera dokončenia
- **Nedávna aktivita** - chronologický zoznam posledných akcií

### Navigácia

Spodná navigačná lišta obsahuje:

| Ikona | Názov | Funkcia |
|-------|-------|---------|
| Home | Domov | Prehľadová obrazovka |
| Calendar | Návštevy | Kalendár a zoznam návštev |
| Plus | Nová návšteva | Rýchle vytvorenie návštevy |
| Map | Mapa | GPS mapa s nemocnicami |
| User | Profil | Nastavenia a odhlásenie |

---

## 6. Správa návštev nemocníc

### Vytvorenie novej návštevy

1. Kliknite na **+** v navigácii alebo **"+ Nová návšteva"**
2. Vyplňte formulár:
   - **Nemocnica** - vyberte zo zoznamu
   - **Typ návštevy** - Odber, Zmluva, Školenie, Iné
   - **Dátum a čas** - plánovaný termín
   - **Poznámky** - voliteľný popis
3. Kliknite na **Uložiť**

### Typy návštev

| Typ | Popis |
|-----|-------|
| Odber (Delivery) | Odber pupočníkovej krvi |
| Zmluva (Contract) | Podpísanie zmluvy |
| Školenie (Training) | Vzdelávanie personálu |
| Stretnutie (Meeting) | Pracovné stretnutie |
| Iné (Other) | Ostatné typy |

### Stavy návštev

| Stav | Farba | Popis |
|------|-------|-------|
| Naplánovaná | Modrá | Návšteva je v pláne |
| Prebiehajúca | Oranžová | Práve prebieha |
| Dokončená | Zelená | Úspešne ukončená |
| Zrušená | Červená | Zrušená návšteva |

### Začatie návštevy

1. Nájdite návštevu v kalendári
2. Kliknite na **"Začať návštevu"**
3. GPS sledovanie sa automaticky spustí
4. Môžete pridávať hlasové poznámky

### Ukončenie návštevy

1. Kliknite na **"Ukončiť návštevu"**
2. Vyplňte súhrn (voliteľné)
3. GPS sledovanie sa zastaví
4. Údaje sa uložia a čakajú na synchronizáciu

---

## 7. GPS sledovanie

### Ako funguje?

- GPS sa automaticky aktivuje pri začatí návštevy
- Poloha sa zaznamenáva každých 30 sekúnd
- Údaje sa ukladajú lokálne a synchronizujú pri pripojení

### Oprávnenia

Aplikácia vyžaduje povolenie prístupu k polohe:
- **Android**: "Povoliť prístup k polohe" → "Vždy" alebo "Počas používania aplikácie"
- **iOS**: "Povoliť prístup k polohe pri používaní aplikácie"

### Zobrazenie na mape

- V záložke **Mapa** vidíte:
  - Vašu aktuálnu polohu
  - Nemocnice vo vašej krajine
  - Históriu návštev

---

## 8. Hlasové poznámky

### Nahrávanie poznámky

1. Počas aktívnej návštevy kliknite na ikonu **mikrofónu**
2. Hovorte zrozumiteľne do mikrofónu
3. Kliknite na **Stop** pre ukončenie nahrávania
4. Poznámka sa automaticky prepíše pomocou AI (OpenAI Whisper)

### Prepis hlasu

- Prepis prebieha automaticky po synchronizácii
- Podporované jazyky: SK, CZ, HU, DE, IT, RO, EN
- Prepísaný text sa zobrazí pod nahrávkou

### Správa poznámok

- Každá návšteva môže mať viacero hlasových poznámok
- Poznámky môžete prehrať, prezerať prepis alebo odstrániť

---

## 9. Offline režim

### Kedy sa aktivuje?

Offline režim sa automaticky aktivuje pri:
- Strate internetového pripojenia
- Slabom signáli
- Deaktivácii mobilných dát

### Čo funguje offline?

| Funkcia | Dostupnosť |
|---------|------------|
| Prezeranie návštev | Áno |
| Vytváranie návštev | Áno |
| GPS sledovanie | Áno |
| Hlasové poznámky | Nahrávanie áno, prepis nie |
| Pridávanie nemocníc | Áno |
| Synchronizácia | Nie |

### Synchronizácia

- Pri obnovení pripojenia sa automaticky spustí synchronizácia
- Ikona synchronizácie zobrazuje počet čakajúcich položiek
- Môžete manuálne spustiť synchronizáciu potiahnutím nadol

### Riešenie konfliktov

Ak sa rovnaké údaje zmenili na serveri aj lokálne:
- **Server vyhráva** - serverová verzia má prednosť
- Vaše lokálne zmeny sa archivujú pre prípad potreby

---

## 10. Nastavenia a profil

### Profil používateľa

V záložke **Profil** nájdete:
- Meno a priezvisko
- Priradenú krajinu
- Počet návštev
- Posledná synchronizácia

### Nastavenia aplikácie

| Nastavenie | Popis |
|------------|-------|
| Jazyk | Výber jazyka rozhrania |
| Automatická synchronizácia | Zapnutie/vypnutie |
| GPS presnosť | Vysoká/Stredná/Nízka |
| Push notifikácie | Zapnutie/vypnutie |
| Tmavý režim | Zapnutie/vypnutie |

### Odhlásenie

1. Prejdite na **Profil**
2. Kliknite na **Odhlásiť sa**
3. Potvrďte odhlásenie
4. Lokálne údaje zostanú zachované pre offline prístup

---

## 11. Technické špecifikácie

### API endpointy

Mobilná aplikácia komunikuje so serverom cez REST API:

| Endpoint | Metóda | Popis |
|----------|--------|-------|
| `/api/mobile/auth/login` | POST | Prihlásenie |
| `/api/mobile/auth/verify` | GET | Overenie tokenu |
| `/api/mobile/hospitals` | GET | Zoznam nemocníc |
| `/api/mobile/hospitals` | POST | Vytvorenie nemocnice |
| `/api/mobile/hospitals/:id` | PUT | Aktualizácia nemocnice |
| `/api/mobile/visit-events` | GET | Zoznam návštev |
| `/api/mobile/visit-events` | POST | Vytvorenie návštevy |
| `/api/mobile/visit-events/:id` | PUT | Aktualizácia návštevy |
| `/api/mobile/visit-events/:id` | DELETE | Odstránenie návštevy |
| `/api/mobile/visit-options` | GET | Lokalizované typy návštev |
| `/api/mobile/voice-notes` | POST | Nahranie hlasovej poznámky |
| `/api/mobile/voice-notes/:visitEventId` | GET | Zoznam poznámok pre návštevu |
| `/api/mobile/push-token` | POST | Registrácia push tokenu |
| `/api/mobile/push-token` | DELETE | Deaktivácia push tokenu |

### Autentifikácia

- **Typ**: JWT Bearer token
- **Platnosť**: 30 dní
- **Hlavička**: `Authorization: Bearer <token>`

### Lokálne úložisko

| Dáta | Úložisko |
|------|----------|
| Štruktúrované údaje | SQLite |
| Nastavenia | AsyncStorage |
| Hlasové nahrávky | Súborový systém |
| Cache obrázkov | Expo Cache |

### Minimálne požiadavky

| Požiadavka | Hodnota |
|------------|---------|
| RAM | 2 GB |
| Úložisko | 100 MB |
| Internetové pripojenie | Pre synchronizáciu |

---

## 12. Riešenie problémov

### Nemôžem sa prihlásiť

**Možné príčiny a riešenia:**

1. **Nesprávne prihlasovacie údaje**
   - Skontrolujte používateľské meno a heslo
   - Kontaktujte administrátora pre reset hesla

2. **Prístup nie je povolený**
   - Administrátor musí povoliť prístup v INDEXUS CRM
   - Skontrolujte, či je prepínač "Povoliť prístup do mobilnej aplikácie" zapnutý

3. **Žiadne internetové pripojenie**
   - Skontrolujte Wi-Fi alebo mobilné dáta
   - Skúste offline prihlásenie (ak ste sa predtým prihlásili)

### GPS nefunguje

1. Skontrolujte, či má aplikácia povolený prístup k polohe
2. Zapnite GPS v nastaveniach zariadenia
3. Reštartujte aplikáciu

### Hlasové poznámky sa neprepíšu

1. Skontrolujte internetové pripojenie
2. Prepis prebieha na serveri - počkajte na synchronizáciu
3. Overte, že nahrávka nie je poškodená

### Synchronizácia zlyhala

1. Skontrolujte internetové pripojenie
2. Skúste manuálnu synchronizáciu (potiahnutie nadol)
3. Reštartujte aplikáciu
4. Ak problém pretrváva, kontaktujte technickú podporu

### Aplikácia padá

1. Zatvorte a znova otvorte aplikáciu
2. Vymažte cache aplikácie v nastaveniach zariadenia
3. Aktualizujte na najnovšiu verziu
4. Kontaktujte technickú podporu

---

## Kontakt na podporu

**Technická podpora:**
- Email: support@cordbloodcenter.com
- Telefón: +421 XXX XXX XXX

**Pracovná doba:**
- Pondelok - Piatok: 8:00 - 17:00 CET

---

*Dokumentácia INDEXUS Connect v1.0*
*Posledná aktualizácia: Január 2026*
