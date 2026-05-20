# Modul Collaborators (Spolupracovnici) - Dokumentacia

## Prehľad

Modul Collaborators sluzi na spravu spolupracovnikov (lekarov, zdravotnych sestier, obchodnych zastupitov a dalsich) v systeme INDEXUS CRM. Kazdy spolupracovnik moze mat priradene nemocnice, zmluvy, adresy a pristup do mobilnej aplikacie INDEXUS Connect.

## Databazove tabulky

### 1. collaborators - Hlavna tabulka spolupracovnikov

Hlavna tabulka obsahujuca vsetky udaje o spolupracovnikoch.

#### Struktura

| Stlpec | Typ | Popis | Povinne |
|--------|-----|-------|---------|
| id | VARCHAR (UUID) | Primarny kluc | Auto |
| legacy_id | TEXT | ID z predchadzajuceho CRM systemu | Nie |
| country_code | TEXT | Primarny kod krajiny (SK, CZ, HU, RO, IT, DE, USA) | Ano |
| country_codes | TEXT[] | Pole krajin - spolupracovnik moze pracovat vo viacerych krajinach | Ano |
| title_before | TEXT | Titul pred menom (napr. MUDr., Ing.) | Nie |
| first_name | TEXT | Krstne meno | Ano |
| last_name | TEXT | Priezvisko | Ano |
| maiden_name | TEXT | Rodne priezvisko | Nie |
| title_after | TEXT | Titul za menom (napr. PhD., MBA) | Nie |
| birth_number | TEXT | Rodne cislo | Nie |
| birth_day | INTEGER | Den narodenia (1-31) | Nie |
| birth_month | INTEGER | Mesiac narodenia (1-12) | Nie |
| birth_year | INTEGER | Rok narodenia | Nie |
| birth_place | TEXT | Miesto narodenia | Nie |
| health_insurance_id | VARCHAR | ID zdravotnej poistovne | Nie |
| marital_status | TEXT | Rodinny stav (single, married, divorced, widowed) | Nie |
| collaborator_type | TEXT | Typ spolupracovnika | Nie |
| phone | TEXT | Telefonne cislo (pevna linka) | Nie |
| mobile | TEXT | Mobilne cislo 1 | Nie |
| mobile_2 | TEXT | Mobilne cislo 2 | Nie |
| other_contact | TEXT | Iny kontakt | Nie |
| email | TEXT | Emailova adresa | Nie |
| bank_account_iban | TEXT | IBAN bankoveho uctu | Nie |
| swift_code | TEXT | SWIFT kod banky | Nie |
| client_contact | BOOLEAN | Kontaktna osoba pre klientov | Ano (default: false) |
| representative_id | VARCHAR | ID prideleneho reprezentanta (users.id) | Nie |
| is_active | BOOLEAN | Aktivny spolupracovnik | Ano (default: true) |
| svet_zdravia | BOOLEAN | Pracuje pre Svet Zdravia | Ano (default: false) |
| company_name | TEXT | Nazov spolocnosti (ak je SZCO) | Nie |
| ico | TEXT | ICO | Nie |
| dic | TEXT | DIC | Nie |
| ic_dph | TEXT | IC DPH | Nie |
| company_iban | TEXT | IBAN firemneho uctu | Nie |
| company_swift | TEXT | SWIFT firemnej banky | Nie |
| month_rewards | BOOLEAN | Ma nastavene mesacne odmeny | Ano (default: false) |
| reward_type | TEXT | Typ odmeny: 'fixed' (fixna suma) alebo 'percentage' (percento) | Nie |
| fixed_reward_amount | TEXT | Vyska fixnej odmeny | Nie |
| fixed_reward_currency | TEXT | Mena fixnej odmeny (EUR, CZK, HUF, RON, USD) | Nie (default: EUR) |
| percentage_rewards | JSONB | Percentualne odmeny podla krajiny {"SK": "10", "CZ": "12"} | Nie |
| note | TEXT | Poznamka | Nie |
| hospital_id | VARCHAR | ID priradenej nemocnice (zastarale) | Nie |
| hospital_ids | TEXT[] | Pole ID nemocnic | Ano |
| mobile_app_enabled | BOOLEAN | Ma povoleny pristup do INDEXUS Connect | Ano (default: false) |
| mobile_username | TEXT | Uzivatelske meno pre mobilnu aplikaciu | Nie |
| mobile_password_hash | TEXT | Hash hesla pre mobilnu aplikaciu | Nie |
| can_edit_hospitals | BOOLEAN | Moze upravovat nemocnice cez mobilnu app | Ano (default: false) |
| last_mobile_login | TIMESTAMP | Datum posledneho prihlasenia do mobilnej app | Nie |
| mobile_last_active_at | TIMESTAMP | Datum poslednej aktivity v mobilnej app | Nie |
| created_at | TIMESTAMP | Datum vytvorenia zaznamu | Auto |
| updated_at | TIMESTAMP | Datum poslednej upravy | Auto |

#### Typy spolupracovnikov (collaborator_type)

| Hodnota | Popis SK | Popis EN |
|---------|----------|----------|
| doctor | Lekar | Doctor |
| nurse | Sestra | Nurse |
| resident | Rezident | Resident |
| callCenter | Call centrum | Call Center |
| headNurse | Starsie sestra | Head Nurse |
| bm | Business Manager | Business Manager |
| vedono | Veduca odd | Department Head |
| external | Externy spolupracovnik | External Collaborator |
| representative | Zastupca | Representative |
| other | Iny | Other |

#### Rodinny stav (marital_status)

| Hodnota | Popis |
|---------|-------|
| single | Slobodny/a |
| married | Zenaty/Vydata |
| divorced | Rozvedeny/a |
| widowed | Vdovec/Vdova |

#### Priklad zaznamu

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "countryCode": "SK",
  "countryCodes": ["SK", "CZ"],
  "titleBefore": "MUDr.",
  "firstName": "Jana",
  "lastName": "Novakova",
  "titleAfter": "PhD.",
  "collaboratorType": "doctor",
  "email": "jana.novakova@example.com",
  "mobile": "+421 901 234 567",
  "isActive": true,
  "hospitalIds": ["hosp-uuid-1", "hosp-uuid-2"],
  "monthRewards": true,
  "rewardType": "percentage",
  "percentageRewards": {"SK": "10", "CZ": "8"},
  "mobileAppEnabled": true,
  "mobileUsername": "jnovakova"
}
```

---

### 2. collaborator_addresses - Adresy spolupracovnikov

Tabulka pre ulozenie roznych typov adries spolupracovnika.

#### Struktura

| Stlpec | Typ | Popis | Povinne |
|--------|-----|-------|---------|
| id | VARCHAR (UUID) | Primarny kluc | Auto |
| collaborator_id | VARCHAR | ID spolupracovnika | Ano |
| address_type | TEXT | Typ adresy | Ano |
| name | TEXT | Nazov (napr. nazov firmy) | Nie |
| street_number | TEXT | Ulica a cislo | Nie |
| city | TEXT | Mesto | Nie |
| postal_code | TEXT | PSC | Nie |
| region | TEXT | Kraj/Region | Nie |
| country_code | TEXT | Kod krajiny | Nie |
| created_at | TIMESTAMP | Datum vytvorenia | Auto |

#### Typy adries (address_type)

| Hodnota | Popis |
|---------|-------|
| permanent | Trvale bydlisko |
| correspondence | Korenspondencna adresa |
| work | Pracovna adresa |
| company | Sidlo firmy |

#### Priklad zaznamu

```json
{
  "id": "addr-uuid-1",
  "collaboratorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "addressType": "permanent",
  "streetNumber": "Hlavna 123",
  "city": "Bratislava",
  "postalCode": "81101",
  "countryCode": "SK"
}
```

---

### 3. collaborator_other_data - Doplnkove udaje

Tabulka pre datumy dochodkov a ZTP preukazu.

#### Struktura

| Stlpec | Typ | Popis | Povinne |
|--------|-----|-------|---------|
| id | VARCHAR (UUID) | Primarny kluc | Auto |
| collaborator_id | VARCHAR | ID spolupracovnika (unikatne) | Ano |
| ztp_day | INTEGER | Den vydania ZTP | Nie |
| ztp_month | INTEGER | Mesiac vydania ZTP | Nie |
| ztp_year | INTEGER | Rok vydania ZTP | Nie |
| old_age_pension_day | INTEGER | Den odchodu do starobneho dochodku | Nie |
| old_age_pension_month | INTEGER | Mesiac odchodu do starobneho dochodku | Nie |
| old_age_pension_year | INTEGER | Rok odchodu do starobneho dochodku | Nie |
| disability_pension_day | INTEGER | Den priznat invalidneho dochodku | Nie |
| disability_pension_month | INTEGER | Mesiac priznat invalidneho dochodku | Nie |
| disability_pension_year | INTEGER | Rok priznat invalidneho dochodku | Nie |
| widow_pension_day | INTEGER | Den priznat vdovskeho dochodku | Nie |
| widow_pension_month | INTEGER | Mesiac priznat vdovskeho dochodku | Nie |
| widow_pension_year | INTEGER | Rok priznat vdovskeho dochodku | Nie |
| created_at | TIMESTAMP | Datum vytvorenia | Auto |

#### Priklad zaznamu

```json
{
  "id": "other-uuid-1",
  "collaboratorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ztpDay": 15,
  "ztpMonth": 6,
  "ztpYear": 2020,
  "oldAgePensionDay": 1,
  "oldAgePensionMonth": 1,
  "oldAgePensionYear": 2030
}
```

---

### 4. collaborator_agreements - Zmluvy spolupracovnikov

Tabulka pre zmluvy a dohody so spolupracovnikmi.

#### Struktura

| Stlpec | Typ | Popis | Povinne |
|--------|-----|-------|---------|
| id | VARCHAR (UUID) | Primarny kluc | Auto |
| collaborator_id | VARCHAR | ID spolupracovnika | Ano |
| file_name | TEXT | Nazov suboru | Nie |
| file_path | TEXT | Cesta k suboru | Nie |
| file_size | INTEGER | Velkost suboru v bajtoch | Nie |
| file_content_type | TEXT | MIME typ suboru | Nie |
| extracted_text | TEXT | Extrahovany text z PDF | Nie |
| billing_company_id | VARCHAR | ID fakturacnej spolocnosti | Nie |
| contract_number | TEXT | Cislo zmluvy | Nie |
| valid_from_day | INTEGER | Den platnosti od | Nie |
| valid_from_month | INTEGER | Mesiac platnosti od | Nie |
| valid_from_year | INTEGER | Rok platnosti od | Nie |
| valid_to_day | INTEGER | Den platnosti do | Nie |
| valid_to_month | INTEGER | Mesiac platnosti do | Nie |
| valid_to_year | INTEGER | Rok platnosti do | Nie |
| is_valid | BOOLEAN | Zmluva je platna | Ano (default: true) |
| agreement_sent_day | INTEGER | Den odoslania zmluvy | Nie |
| agreement_sent_month | INTEGER | Mesiac odoslania zmluvy | Nie |
| agreement_sent_year | INTEGER | Rok odoslania zmluvy | Nie |
| agreement_returned_day | INTEGER | Den vratenia podpisanej zmluvy | Nie |
| agreement_returned_month | INTEGER | Mesiac vratenia podpisanej zmluvy | Nie |
| agreement_returned_year | INTEGER | Rok vratenia podpisanej zmluvy | Nie |
| agreement_form | TEXT | Forma zmluvy | Nie |
| reward_types | TEXT[] | Typy odmien podla zmluvy | Nie |
| created_at | TIMESTAMP | Datum vytvorenia | Auto |

#### Typy odmien (reward_types)

| Hodnota | Popis |
|---------|-------|
| recruitment | Naborova odmena |
| assistance | Asistencia |
| puk_collection | Odber PUK |
| plk_collection | Odber PLK |
| tpu_collection | Odber TPU |
| tpl_collection | Odber TPL |
| informing | Informovanie |
| emergency_grant | Pohotovostna dotacia |
| prophylaxis | Profylaxia |
| head_nurse | Starsie sestra |
| lecture | Prednaska |
| management | Manazment |
| disability_card | ZTP preukaz |
| old_age_pension | Starobny dochodok |
| widow_pension | Vdovsky dochodok |
| vip | VIP |
| dpa_signed | Podpisana DPA |
| monthly_rewarding_signed | Podpisane mesacne odmenovanie |
| internal_employee | Interny zamestnanec |
| contact_person_reward | Odmena kontaktnej osoby |
| responsible_person_reward | Odmena zodpovednej osoby |

#### Priklad zaznamu

```json
{
  "id": "agr-uuid-1",
  "collaboratorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "billingCompanyId": "billing-uuid-1",
  "contractNumber": "CBC-2024-001",
  "validFromDay": 1,
  "validFromMonth": 1,
  "validFromYear": 2024,
  "validToDay": 31,
  "validToMonth": 12,
  "validToYear": 2024,
  "isValid": true,
  "agreementForm": "DPP",
  "rewardTypes": ["recruitment", "assistance"]
}
```

---

### 5. visit_events - Navstevy terenu (INDEXUS Connect)

Tabulka pre zaznamy terennych navstev z mobilnej aplikacie.

#### Struktura

| Stlpec | Typ | Popis | Povinne |
|--------|-----|-------|---------|
| id | VARCHAR (UUID) | Primarny kluc | Auto |
| collaborator_id | VARCHAR | ID spolupracovnika | Ano |
| country_code | TEXT | Kod krajiny | Ano |
| subject | TEXT | Typ navstevy (kod 1-14) | Ano |
| hospital_id | VARCHAR | ID nemocnice | Nie |
| notes | TEXT | Poznamky | Nie |
| planned_date | TIMESTAMP | Planovany datum | Ano |
| status | TEXT | Stav: scheduled, in_progress, completed, cancelled, not_realized | Ano |
| actual_start | TIMESTAMP | Skutocny zaciatok | Nie |
| actual_end | TIMESTAMP | Skutocny koniec | Nie |
| start_latitude | DOUBLE | GPS sirka - zaciatok | Nie |
| start_longitude | DOUBLE | GPS dlzka - zaciatok | Nie |
| end_latitude | DOUBLE | GPS sirka - koniec | Nie |
| end_longitude | DOUBLE | GPS dlzka - koniec | Nie |
| created_at | TIMESTAMP | Datum vytvorenia | Auto |

#### Typy navstev (subject)

| Kod | Popis |
|-----|-------|
| 1 | Osobna navsteva |
| 2 | Telefonicka navsteva |
| 3 | Online porada |
| 4 | Skolenie |
| 5 | Konferencia |
| 6 | Kontrola problemoveho odberu |
| 7 | Dovoz nemocnicneho setu |
| 8 | Prednaska pre tehotne |
| 9 | Skupinova prednaska pre porodnicky |
| 10 | Sprava zmluvy - nemocnica |
| 11 | Sprava zmluvy - lekar |
| 12 | Sprava zmluvy - obchodny partner |
| 13 | Skupinova prednaska pre lekarov |
| 14 | Ine |

---

## API Endpointy

### Zakladne operacie

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | /api/collaborators | Zoznam vsetkych spolupracovnikov |
| GET | /api/collaborators/:id | Detail spolupracovnika |
| POST | /api/collaborators | Vytvorenie noveho spolupracovnika |
| PUT | /api/collaborators/:id | Aktualizacia spolupracovnika |
| DELETE | /api/collaborators/:id | Zmazanie spolupracovnika |

### Adresy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | /api/collaborators/:id/addresses | Zoznam adries spolupracovnika |
| POST | /api/collaborators/:id/addresses | Pridanie adresy |
| PUT | /api/collaborators/:id/addresses/:addressId | Aktualizacia adresy |
| DELETE | /api/collaborators/:id/addresses/:addressId | Zmazanie adresy |

### Zmluvy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | /api/collaborators/:id/agreements | Zoznam zmluv spolupracovnika |
| POST | /api/collaborators/:id/agreements | Pridanie zmluvy |
| PUT | /api/collaborators/:id/agreements/:agreementId | Aktualizacia zmluvy |
| DELETE | /api/collaborators/:id/agreements/:agreementId | Zmazanie zmluvy |

### Mobilna aplikacia

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| PUT | /api/collaborators/:id/mobile-credentials | Nastavenie pristupovych udajov pre INDEXUS Connect |

---

## Pouzivanie modulu v UI

### 1. Pristup k modulu

Modul Collaborators je dostupny v hlavnom menu pod ikonou "Spolupracovnici".

### 2. Zoznam spolupracovnikov

- Zobrazuje vsetkych spolupracovnikov s moznostou filtrovania podla krajiny
- Stlpce: Meno, Typ, Email, Telefon, Nemocnice, Stav
- Akcie: Upravit, Zmazat

### 3. Pridanie/Uprava spolupracovnika

Formular je rozdeleny do tabov (krokov):

#### Tab 1: Personal Info (Osobne udaje)
- Meno, priezvisko, tituly
- Datum narodenia, rodne cislo
- Typ spolupracovnika
- Rodinny stav
- Priradenie krajin (multi-select)
- Priradenie nemocnic (multi-select)
- Reprezentant
- Aktivny prepinac

#### Tab 2: Contact Details (Kontaktne udaje)
- Telefonky (pevna linka, mobil 1, mobil 2)
- Email
- Bankove udaje (IBAN, SWIFT)

#### Tab 3: Company & Addresses (Firma a Adresy)
- Firemne udaje (nazov, ICO, DIC, IC DPH)
- Firemny bankovy ucet
- Adresy (trvale bydlisko, korenspondencna, pracovna, sidlo firmy)

#### Tab 4: Banking (Odmeny)
- Mesacne odmeny (prepinac)
- Typ odmeny: Fixna suma alebo Percento
- Fixna suma: zadanie sumy a meny
- Percento: zadanie percenta pre kazdu pridelenu krajinu

#### Tab 5: Agreements (Zmluvy)
- Zoznam zmluv
- Pridanie/uprava zmluvy
- Upload suboru zmluvy

#### Tab 6: History (Historia)
- Zobrazenie vsetkych zmien na zazname
- Kto a kedy urobil zmenu
- Konkretne zmeny (stare vs nove hodnoty)

#### Tab 7: INDEXUS Connect
- Povolenie pristupu do mobilnej aplikacie
- Uzivatelske meno a heslo
- Stav posledneho prihlasenia

### 4. Filtrovanie

- Globalny filter krajiny v headeri filtuje spolupracovnikov podla ich priradenych krajin
- Fulltextove vyhladavanie podla mena, emailu

### 5. Historia zmien

Kazda zmena na zazname spolupracovnika je zaznamenana v Activity Logs:
- Vytvorenie spolupracovnika
- Aktualizacia polí (s detailom co sa zmenilo)
- Zmena mobilnych pristupov
- Pridanie/zmazanie adries a zmluv

---

## Vztahy medzi tabulkami

```
collaborators (1) ──────────── (N) collaborator_addresses
      │
      ├────────────────────── (1) collaborator_other_data
      │
      ├────────────────────── (N) collaborator_agreements
      │
      ├────────────────────── (N) visit_events
      │
      └─── representative_id ─── (1) users

hospitals (N) ─── hospital_ids ─── (N) collaborators
```

---

## Bezpecnost a opravnenia

### Pristup k modulu
- Pristup len pre prihlasenych uzivatelov
- Filtrovanie podla priradenych krajin uzivatela

### Mobilna aplikacia
- JWT autentifikacia s 30-dnovou platnostou tokenu
- Hesla su hashované pomocou bcrypt
- Kazdy API request aktualizuje `mobile_last_active_at`

### Activity Logging
- Vsetky zmeny su logovane s ID uzivatela
- Zaznamenava sa co sa zmenilo (stare vs nove hodnoty)

---

## Migrace a uprava databazy

Pri pridani novych poli do schemy:

```bash
# Na Replit
npm run db:push

# Na Ubuntu serveri
cd /var/www/indexus-crm
git pull origin main
npx drizzle-kit push
pm2 restart indexus-crm
```
