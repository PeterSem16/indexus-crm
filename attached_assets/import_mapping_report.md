# INDEXUS Import – Mapping Report

> Read-only analýza CSV → cieľové DB polia. Žiadny zápis sa neudial.

**CSV súbor:** `attached_assets/indexus_gyn_data_import_1777373378251.csv`
**Vygenerované:** 2026-04-28T11:02:32.817Z

## 1. Zhrnutie

| Metrika | Hodnota |
|---|---|
| CSV riadkov spolu | 754 |
| Riadkov `record_type = medical_provider_practice` | 754 |
| Unikátnych `external_id` | 754 |
| Unikátnych `ICO` | 681 |
| Unikátnych `id_zz` | 754 |
| Osôb na extrakciu (kontaktné osoby spolu) | 947 |
| **Existujúcich kliník v DB** | 8825 |
| Match podľa `legacy_id` (= external_id) | 0 |
| Match podľa `id_zz` | 0 |
| Match podľa `ICO` | 0 |
| **Nové kliniky (INSERT)** | 754 |
| **UPDATE kliník** | 0 |
| Existujúcich osôb (collaborators) v DB | 575 |
| Existujúcich väzieb klinika↔osoba | 656 |

## 2. UPSERT stratégia

Klinika sa hľadá v tomto poradí (prvý nájdený match vyhráva):

1. `clinics.legacy_id` = CSV `external_id` *(najpresnejšie – stabilný kľúč zo zdrojového systému)*
2. `clinics.id_zz` = CSV `id_zz`
3. `clinics.ico` = CSV `ico` *(POZOR: ICO nie je unikátne – jedno IČO môže mať viac ambulancií. Ak match vráti viac kliník, riadok sa OZNAČÍ a NEZAPÍŠE bez manuálneho rozhodnutia.)*

Osoby (kontaktné):

- pre každý riadok CSV sa spracuje 1–6 kontaktných osôb (`primary_contact_person` + `contact_person_2..6`)
- match osoby v DB: `collaborators.last_name` + `collaborators.first_name` (case-insensitive) v rámci tej istej kliniky
- ak osoba v DB neexistuje → INSERT do `collaborators` + INSERT do `contact_assignments(entity_type='clinic', entity_id=clinic.id, is_primary=…)`
- ak existuje → UPDATE základných polí (titly, telefón, email iba ak sú v CSV vyplnené a v DB prázdne; UPSERT NIKDY nemaže existujúce hodnoty)

Lekár-vedúci kliniky (`primary_contact_person`) sa **navyše** zapíše aj do polí klinky `doctor_title`, `doctor_first_name`, `doctor_last_name`, `doctor_name` (kvôli kompatibilite s formulárom), ak sú prázdne.

## 3. Mapovanie CSV → DB (návrh)

| # | CSV stĺpec | Cieľ | Transformácia | Pozn. |
|---|---|---|---|---|
| 1 | `external_id` | `clinics.legacy_id` | trim | UPSERT key (primary) |
| 2 | `source_system` | `ignored` | — | len pre log |
| 3 | `record_type` | `ignored` | filter == medical_provider_practice | filter, neukladá sa |
| 4 | `country_code` | `clinics.country_code` | trim, default SK |  |
| 5 | `provider_name` | `clinics.name` | trim | povinné |
| 6 | `legal_name` | `clinics.notes (append)` | ak ≠ provider_name → 'Právny názov: …' |  |
| 7 | `ico` | `clinics.ico` | trim, len číslice | UPSERT key (sekundárny) |
| 8 | `id_zz` | `clinics.id_zz` | trim | UPSERT key (terciárny – stabilný kľúč ZZ) |
| 9 | `primary_specialty` | `clinics.notes (append)` | 'Špecializácia: …' (en kľúč → SK label v notes) |  |
| 10 | `kod_pzs_primary` | `clinics.pzs_code` | trim |  |
| 11 | `kod_pzs_all` | `clinics.notes (append)` | split('|') → 'Všetky kódy PZS: a, b, c' |  |
| 12 | `kod_pzs_count` | `ignored` | — | derivovateľné |
| 13 | `kod_pzs_description` | `clinics.pzs_name` | trim, max ~ TEXT |  |
| 14 | `weekly_office_hours` | `clinics.notes (append)` | 'Týž. ord. hodiny: X h' | žiadne dedikované pole |
| 15 | `insurance_vszp` | `clinics.notes (append)` | 1/0 → 'Poisťovňa VšZP: áno/nie' |  |
| 16 | `insurance_dovera` | `clinics.notes (append)` | 1/0 → 'Poisťovňa Dôvera: áno/nie' |  |
| 17 | `insurance_union` | `clinics.notes (append)` | 1/0 → 'Poisťovňa Union: áno/nie' |  |
| 18 | `street` | `clinics.street` | trim |  |
| 19 | `building_number` | `clinics.street_number` | trim |  |
| 20 | `orientation_number` | `clinics.orientation_number` | trim |  |
| 21 | `city` | `clinics.city` | trim |  |
| 22 | `district` | `clinics.district` | trim |  |
| 23 | `region` | `clinics.region` | trim |  |
| 24 | `country` | `ignored` | — | country_code už máme |
| 25 | `address_full` | `clinics.address` | trim, normalizovať newliny → ', ' |  |
| 26 | `primary_phone` | `clinics.phone` | normalizePhone (+421…) |  |
| 27 | `phone_2` | `clinics.phone2` | normalizePhone |  |
| 28 | `phone_3` | `clinics.phone3` | normalizePhone |  |
| 29 | `phone_4` | `clinics.notes (append)` | 'Tel. 4: …' | žiadne pole phone4 |
| 30 | `phone_5` | `clinics.notes (append)` | 'Tel. 5: …' |  |
| 31 | `phone_6` | `clinics.notes (append)` | 'Tel. 6: …' |  |
| 32 | `phones_all` | `ignored` | — | už rozparsované |
| 33 | `primary_email` | `clinics.email` | trim, lower |  |
| 34 | `email_2` | `clinics.email2` | trim, lower |  |
| 35 | `email_3` | `clinics.email3` | trim, lower |  |
| 36 | `email_4` | `clinics.notes (append)` | 'Email 4: …' |  |
| 37 | `email_5` | `clinics.notes (append)` | 'Email 5: …' |  |
| 38 | `emails_all` | `ignored` | — |  |
| 39 | `primary_contact_person` | `clinics.doctor_* + collaborators[0]` | parsePersonName → doctor_title/first/last + vytvorí osobu (is_primary=true) |  |
| 40 | `contact_person_2` | `collaborators[1]` | parsePersonName → ďalšia osoba (is_primary=false) |  |
| 41 | `contact_person_3` | `collaborators[2]` | parsePersonName |  |
| 42 | `contact_person_4` | `collaborators[3]` | parsePersonName |  |
| 43 | `contact_person_5` | `collaborators[4]` | parsePersonName |  |
| 44 | `contact_person_6` | `collaborators[5]` | parsePersonName |  |
| 45 | `contact_persons_all` | `ignored` | — |  |
| 46 | `website_primary` | `clinics.website` | trim |  |
| 47 | `websites_all` | `clinics.notes (append)` | split('|') → 'Ďalšie weby: …' (bez primary) |  |
| 48 | `source_urls` | `clinics.notes (append)` | 'Zdroj URL: …' |  |
| 49 | `source_files` | `clinics.notes (append)` | 'Zdroj súbory: …' |  |
| 50 | `notes` | `clinics.notes (append)` | raw |  |
| 51 | `contact_enriched_from_web` | `clinics.notes (append)` | ak ='1' → 'Kontakt obohatený z webu: áno' |  |
| 52 | `contact_enriched_source_url` | `clinics.notes (append)` | 'Zdroj obohatenia: …' |  |
| 53 | `contact_enriched_note` | `clinics.notes (append)` | raw |  |
| 54 | `import_tags` | `clinics.tags` | split(';') → text[] |  |
| 55 | `data_quality_flags` | `clinics.notes (append)` | 'Quality flags: …' |  |

## 4. Vzorové riadky (5)

### Vzorka 1 (CSV riadok 2)

**Klinika:**

```json
{
  "legacy_id": "61-36670651-A0001",
  "name": "A GYN s. r. o.",
  "ico": "36670651",
  "id_zz": "61-36670651-A0001",
  "country_code": "SK",
  "street": "Malokarpatské námestie",
  "street_number": "1124",
  "orientation_number": "2",
  "city": "Bratislava - mestská časť Lamač",
  "district": "Bratislava IV",
  "region": "BA",
  "phone": "421915725079",
  "phone2": null,
  "email": "ambulancia@agyn.sk",
  "website": "https://www.e-vuc.sk/buxus/generate_page.php?page_id=60364",
  "pzs_code": "P65281009201",
  "tags": [
    "gyn",
    "sk",
    "medical_partner_candidate",
    "indexus_import"
  ]
}
```

**Hlavná osoba (primary_contact_person):**

```json
{
  "raw": "MUDr. Dagmar Psalmanová, PhD., MBA",
  "titleBefore": "MUDr.",
  "firstName": "Dagmar",
  "lastName": "Psalmanová",
  "titleAfter": "PhD., MBA"
}
```

**Ďalšie osoby (1):**

```json
[
  {
    "raw": "Slávka Pialová",
    "titleBefore": null,
    "firstName": "Slávka",
    "lastName": "Pialová",
    "titleAfter": null
  }
]
```

### Vzorka 2 (CSV riadok 3)

**Klinika:**

```json
{
  "legacy_id": "64-44991673-A0001",
  "name": "A.N.G. s.r.o.",
  "ico": "44991673",
  "id_zz": "64-44991673-A0001",
  "country_code": "SK",
  "street": "Rábska",
  "street_number": "4289",
  "orientation_number": "19",
  "city": "Kolárovo",
  "district": "Komárno",
  "region": "NR",
  "phone": "421918838148",
  "phone2": "421905344542",
  "email": null,
  "website": "https://www.e-vuc.sk/nsk/zdravotnictvo/ambulantne-zdravotnicke-zariadenia/komarno/primarna-gynekologicko-porodnicka-ambulancia-mudr.goghova-angelika-kolarovo-a.n.g..html?page_id=87173",
  "pzs_code": "P65983009201",
  "tags": [
    "gyn",
    "sk",
    "medical_partner_candidate",
    "indexus_import"
  ]
}
```

**Hlavná osoba (primary_contact_person):**

```json
{
  "raw": "MUDr. Gőghová Angelika",
  "titleBefore": "MUDr.",
  "firstName": "Gőghová",
  "lastName": "Angelika",
  "titleAfter": null
}
```

**Ďalšie osoby (2):**

```json
[
  {
    "raw": "Oroszi Anita",
    "titleBefore": null,
    "firstName": "Oroszi",
    "lastName": "Anita",
    "titleAfter": null
  },
  {
    "raw": "MUDr. Angelika Gőghová",
    "titleBefore": "MUDr.",
    "firstName": "Angelika",
    "lastName": "Gőghová",
    "titleAfter": null
  }
]
```

### Vzorka 3 (CSV riadok 4)

**Klinika:**

```json
{
  "legacy_id": "64-35965665-A0001",
  "name": "AB GYN s.r.o.",
  "ico": "35965665",
  "id_zz": "64-35965665-A0001",
  "country_code": "SK",
  "street": "Čsl. Armády",
  "street_number": "1601",
  "orientation_number": "11",
  "city": "Hurbanovo",
  "district": "Komárno",
  "region": "NR",
  "phone": "421915404922",
  "phone2": "421357603467",
  "email": null,
  "website": "https://www.e-vuc.sk/nsk/zdravotnictvo/ambulantne-zdravotnicke-zariadenia/komarno/primarna-gynekologicko-porodnicka-ambulancia-hurbanovo-ab-gyn.html?page_id=87177",
  "pzs_code": "P39081009201",
  "tags": [
    "gyn",
    "sk",
    "medical_partner_candidate",
    "indexus_import"
  ]
}
```

**Hlavná osoba (primary_contact_person):**

```json
{
  "raw": "MUDr. Anna Bašternáková",
  "titleBefore": "MUDr.",
  "firstName": "Anna",
  "lastName": "Bašternáková",
  "titleAfter": null
}
```

### Vzorka 4 (CSV riadok 5)

**Klinika:**

```json
{
  "legacy_id": "61-46506381-A0001",
  "name": "ACsonogyn s. r. o.",
  "ico": "46506381",
  "id_zz": "61-46506381-A0001",
  "country_code": "SK",
  "street": "Hroboňova",
  "street_number": "3484",
  "orientation_number": "4",
  "city": "Bratislava - mestská časť Staré Mesto",
  "district": "Bratislava I",
  "region": "BA",
  "phone": "421254792509",
  "phone2": null,
  "email": null,
  "website": "https://www.e-vuc.sk/buxus/generate_page.php?page_id=60317",
  "pzs_code": "P23054009201",
  "tags": [
    "gyn",
    "sk",
    "medical_partner_candidate",
    "indexus_import"
  ]
}
```

**Hlavná osoba (primary_contact_person):**

```json
{
  "raw": "MUDr. Anton Čunderlík PhD",
  "titleBefore": "MUDr.",
  "firstName": "Anton",
  "lastName": "Čunderlík",
  "titleAfter": "PhD"
}
```

**Ďalšie osoby (2):**

```json
[
  {
    "raw": "MUDr. Anton Čunderlík",
    "titleBefore": "MUDr.",
    "firstName": "Anton",
    "lastName": "Čunderlík",
    "titleAfter": null
  },
  {
    "raw": "Eliška Lacková",
    "titleBefore": null,
    "firstName": "Eliška",
    "lastName": "Lacková",
    "titleAfter": null
  }
]
```

### Vzorka 5 (CSV riadok 6)

**Klinika:**

```json
{
  "legacy_id": "65-36811602-A0001",
  "name": "AETAS, s.r.o.",
  "ico": "36811602",
  "id_zz": "65-36811602-A0001",
  "country_code": "SK",
  "street": "9. mája",
  "street_number": "438",
  "orientation_number": "15",
  "city": "Turčianske Teplice",
  "district": "Turčianske Teplice",
  "region": "ZA",
  "phone": "421434924267",
  "phone2": "421434923473",
  "email": null,
  "website": "https://www.e-vuc.sk/zsk/zdravotnictvo/ambulantne-zdravotnicke-zariadenia/turcianske-teplice/primarna-gynekologicko-porodnicka-ambulancia-mudr.-kristina-biskupska-bodova-phd.-turcianske-teplice-aetas.html?page_id=54399",
  "pzs_code": "P67180009201",
  "tags": [
    "gyn",
    "sk",
    "medical_partner_candidate",
    "indexus_import"
  ]
}
```

**Hlavná osoba (primary_contact_person):**

```json
{
  "raw": "MUDr. Kristína Biskupská Boďová, PhD.",
  "titleBefore": "MUDr.",
  "firstName": "Kristína",
  "lastName": "Biskupská Boďová",
  "titleAfter": "PhD."
}
```

## 5. Duplicity / problémy v CSV

### Viacnásobné riadky s rovnakým ICO (61)

Tieto IČO sa v CSV vyskytujú viackrát – pre nich sa UPSERT bude opierať o `external_id` alebo `id_zz`, nie o `ico`:

- `36244546` × 2
- `36351296` × 2
- `36559148` × 2
- `36223409` × 2
- `44085443` × 3
- `44544774` × 2
- `36589101` × 2
- `36726508` × 3
- `35946792` × 2
- `53708253` × 2
- `46908994` × 2
- `36862363` × 2
- `45302391` × 2
- `36633828` × 3
- `45736251` × 2
- `36713422` × 3
- `35828412` × 2
- `50385780` × 2
- `46481711` × 2
- `36357804` × 2
- `47570288` × 2
- `56496257` × 2
- `36363987` × 2
- `44090293` × 2
- `46167170` × 2
- `36861219` × 2
- `47951583` × 2
- `35912120` × 3
- `36270792` × 2
- `46465456` × 2
- `36239071` × 2
- `47252359` × 2
- `44182279` × 4
- `35962712` × 2
- `36350567` × 2
- `36864285` × 2
- `36800813` × 2
- `36702994` × 3
- `31935583` × 2
- `37897047` × 2
- `33726825` × 3
- `36255394` × 3
- `33145067` × 2
- `36514616` × 2
- `36349402` × 3
- `36084221` × 2
- `51452944` × 2
- `36366161` × 2
- `46449248` × 3
- `31392946` × 2
- … a ďalších 11

Všetky mená sa rozparsovali bez varovania. ✓

## 6. DB polia v `clinics`, ktoré CSV nepokrýva

Tieto polia v CSV nie sú prítomné a pri UPDATE existujúcich kliník zostanú **nedotknuté**:

- `postal_code` *(SK CSV ho neobsahuje – ostane to čo je v DB)*
- `latitude`, `longitude`
- `is_active`, `is_referred_by_doctor`, `is_from_conference`
- `lead_source`, `lead_source_date`, `lead_source_notes`
- `conference_name`, `conference_date`
- `initial_status`, `interest_cooperation`, `interest_contract`, `contract_status`
- `last_call_result`, `last_call_note`, `next_contact_date`
- `contract_sent_date`, `contract_returned_date`
- `has_flyers`, `flyers_sent_date`, `flyers_location`
- `doctor_position_category_id` *(ak chceš, vieme ho odvodiť z titulu `MUDr.` → "doctor")*

## 7. Otvorené otázky pre teba (potvrď / oprav)

1. **`primary_specialty`** (`gynecology_obstetrics`) – mám ho zapísať len do `notes`, alebo chceš ho mapovať na nejakú iné pole (napr. nový `primary_specialty` stĺpec)?
2. **Poisťovne** (`insurance_vszp/dovera/union`) – stačí v `notes`, alebo chceš preto vytvoriť relácie cez `health_insurance_companies` (vyžaduje schema change)?
3. **Telefóny 4–6, e-maily 4–5** – aktuálne idú do `notes`. OK, alebo majú ísť do `contact_channels` (per-osoba)?
4. **`primary_contact_person`** – má sa skopírovať do `clinics.doctor_*` polí len ak sú prázdne, alebo vždy prepísať?
5. **Tagy** (`import_tags`) – navrhujem doplniť každej importovanej klinike navyše tag `indexus_import_2026_04` na ľahkú identifikáciu. OK?
6. **Match podľa ICO** – ak existuje viac kliník s rovnakým ICO, navrhujem riadok preskočiť a zalogovať. Alebo radšej priradiť k tej s najpresnejším id_zz?
7. **Polia, ktoré v CSV chýbajú** (napr. `postal_code`, `latitude/longitude`) – nechať existujúce hodnoty v DB nedotknuté pri UPDATE? *(odporúčané)*

## 7. Ďalšie kroky

Po tom, čo schváliš (alebo upravíš) toto mapovanie, pripravím zápisový script `scripts/import-clinics-write.ts` s týmito vlastnosťami:

- `--dry-run` (default) – iba vypíše čo by spravil, nič nezapíše
- `--commit` – skutočný zápis v jednej DB transakcii pre každý riadok
- `--limit=N` – spracuje len prvých N riadkov
- log do `attached_assets/import_run_<timestamp>.log`
- pre UPDATE NIKDY nemaže existujúce non-null polia
- bezpečné spustenie aj na Replit aj na Ubuntu (`DATABASE_URL=… npx tsx scripts/import-clinics-write.ts --commit`)
