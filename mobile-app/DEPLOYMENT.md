# INDEXUS Connect - Nasadenie mobilnej aplikácie

## Prehľad

Tento dokument popisuje ako vytvoriť a distribuovať mobilnú aplikáciu INDEXUS Connect pre Android a iOS.

---

## Predpoklady

1. **Node.js** (v18 alebo novší)
2. **Expo účet** (zadarmo na expo.dev)
3. **EAS CLI** nainštalovaný globálne

```bash
npm install -g eas-cli
```

---

## Krok 1: Prihlásenie do Expo

```bash
eas login
```

Zadajte svoje Expo prihlasovacie údaje (alebo si vytvorte účet na https://expo.dev).

---

## Krok 2: Konfigurácia projektu

```bash
cd mobile-app
npm install
eas build:configure
```

---

## Krok 3: Vytvorenie Android APK

```bash
eas build --platform android --profile preview
```

Tento príkaz:
- Vytvorí .apk súbor v cloude
- Po dokončení dostanete odkaz na stiahnutie
- Build trvá približne 10-15 minút

**Výstup:** Odkaz na stiahnutie .apk súboru

---

## Krok 4: Vytvorenie iOS buildu (interná distribúcia)

### Požiadavky pre iOS:
- Apple Developer účet (99€/rok) - https://developer.apple.com
- Registrované zariadenia (UDID) pre ad-hoc distribúciu

```bash
eas build --platform ios --profile preview
```

Pri prvom spustení budete vyzvaní na:
1. Prihlásenie do Apple Developer účtu
2. Vytvorenie provisioning profile
3. Registráciu zariadení (UDID)

**Ako získať UDID zariadenia:**
1. Pripojte iPhone/iPad k Macu
2. Otvorte Finder a kliknite na zariadenie
3. Kliknite na "Serial Number" - zobrazí sa UDID

---

## Krok 5: Hostovanie na Ubuntu serveri

### 5.1 Vytvorte priečinok pre súbory

```bash
sudo mkdir -p /var/www/indexus-crm/data/mobile-app
sudo chown www-data:www-data /var/www/indexus-crm/data/mobile-app
```

### 5.2 Nahrajte súbory

Nahrajte stiahnuté súbory (.apk a .ipa) do tohto priečinka:

```bash
# Príklad pomocou scp
scp indexus-connect.apk user@indexus.cordbloodcenter.com:/var/www/indexus-crm/data/mobile-app/
```

### 5.3 Nginx konfigurácia

Pridajte do vašej Nginx konfigurácie:

```nginx
location /mobile-app/ {
    alias /var/www/indexus-crm/data/mobile-app/;
    add_header Content-Disposition 'attachment';
    
    # MIME typy pre mobilné aplikácie
    types {
        application/vnd.android.package-archive apk;
        application/octet-stream ipa;
    }
}
```

Reštartujte Nginx:
```bash
sudo systemctl reload nginx
```

---

## Krok 6: Odkazy na stiahnutie

Po nahratí budú súbory dostupné na:

- **Android:** `https://indexus.cordbloodcenter.com/mobile-app/indexus-connect.apk`
- **iOS:** `https://indexus.cordbloodcenter.com/mobile-app/indexus-connect.ipa`

---

## Inštalácia na zariadeniach

### Android
1. Stiahnite .apk súbor
2. Otvorte súbor
3. Povoľte inštaláciu z neznámych zdrojov (ak je potrebné)
4. Nainštalujte aplikáciu

### iOS (ad-hoc)
Pre iOS je potrebné:
1. Zariadenie musí byť registrované v Apple Developer účte
2. Provisioning profile musí obsahovať UDID zariadenia
3. Použite nástroj ako Diawi.com alebo AppCenter pre distribúciu

**Alternatíva pre iOS bez Developer účtu:**
- Použite TestFlight (vyžaduje App Store Connect)
- Alebo Expo Go pre testovanie

---

## Aktualizácia aplikácie

### OTA (Over-The-Air) aktualizácie pre JavaScript zmeny:

```bash
eas update --branch preview --message "Popis zmien"
```

### Nový build (pre natívne zmeny):

```bash
eas build --platform all --profile preview
```

---

## Príkazy - zhrnutie

| Akcia | Príkaz |
|-------|--------|
| Inštalácia závislostí | `npm install` |
| Android APK | `eas build --platform android --profile preview` |
| iOS build | `eas build --platform ios --profile preview` |
| Obidve platformy | `eas build --platform all --profile preview` |
| OTA aktualizácia | `eas update --branch preview` |

---

## Riešenie problémov

### "eas: command not found"
```bash
npm install -g eas-cli
```

### iOS build zlyhá na podpise
Uistite sa, že máte platný Apple Developer účet a správny provisioning profile.

### Android build zlyhá
Skontrolujte, či `app.json` obsahuje správny `package` identifikátor.

---

## Kontakt

Pre technickú podporu kontaktujte IT oddelenie.
