# ISCBC → INDEXUS CRM Migration Guide (v20.5)

## Overview

Complete migration from legacy ISCBC system (MSSQL database `CBC` on `10.1.2.2:1433`) to INDEXUS CRM (PostgreSQL `indexus_crm`).

**Migračný skript**: `script/migration/test-migration-20.cjs`
**Verzia**: v20.5 (2026-03-29)

---

## Architecture

### Source (MSSQL)
- **Server**: `10.1.2.2:1433`
- **Database**: `CBC`
- **User**: `cbcuser` / `XqU0nNND`

### Target (PostgreSQL)
- **Host**: `localhost`
- **Database**: `indexus_crm`
- **User**: `indexus` / `HanyurIfKisck`

---

## Postup migrácie — krok po kroku

### Príprava

```bash
cd /var/www/indexus-crm
git pull
npm run build
npx drizzle-kit push --force
```

### 1. Cleanup (voliteľné — pri prvom spustení)

Vymaže všetky predtým migrované dáta z PostgreSQL.

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs cleanup
```

**Čo zmaže:**
| Tabuľka | Podmienka |
|---------|-----------|
| `scheduled_invoices` | `created_by = 'migration-v20'` |
| `customer_debt_collection` | `data_source = 'iscbc'` |
| `invoices` | `data_source = 'iscbc'` |
| `customer_documents` | `data_source = 'iscbc'` |
| `contract_instances` | `data_source = 'iscbc'` |
| `communication_messages` | `external_id LIKE 'cbc_pho_%'` |
| `customer_notes` | `data_source = 'iscbc'` |
| `customer_potential_cases` | zákazníci s `data_source = 'iscbc'` |
| `collection_lab_results` | kolekcie s `data_source = 'iscbc'` |
| `collections` | `data_source = 'iscbc'` |
| `collaborator_activities` | `legacy_id LIKE 'cc_%'` |
| `collaborator_agreements` | `legacy_id IS NOT NULL` |
| `collaborator_addresses` | spolupracovníci s `data_source = 'iscbc'` |
| `collaborators` | `data_source = 'iscbc'` |
| `customers` | `data_source = 'iscbc'` |
| `hospitals` | `data_source = 'iscbc'` |

---

### 2. Step 3 — Nemocnice

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step3 --no-cleanup
```

- **Zdroj**: `CBC.Hospitals` + `CBC.HospitalCategories` + `CBC.MailAddresses`
- **Cieľ**: `hospitals`
- **Mapovanie**: `legacy_id = "cbc_{hos_id}"`, `data_source = 'iscbc'`
- **Čas**: ~1 minúta

---

### 3. Step 4 + 4b + 4c — Spolupracovníci

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step4 step4b step4c --no-cleanup
```

#### Step 4: Spolupracovníci (Collaborators)
- **Zdroj**: `CBC.Collaborators` + `CBC.Persons` + `CBC.MailAddresses` + `CBC.Contacts`
- **Cieľ**: `collaborators` + `collaborator_addresses`
- **Mapovanie**: `legacy_id = "cbc_{clb_id}"`, `data_source = 'iscbc'`

#### Step 4b: Dohody spolupracovníkov (Agreements)
- **Zdroj**: `CBC.CollaboratorAgreements`
- **Cieľ**: `collaborator_agreements`
- **Mapovanie**: `legacy_id = "cbc_cag_{cag_id}"`

#### Step 4c: Úkony spolupracovníkov (Activities)
- **Zdroj**: `CBC.CollectionCollaborators` + `CBC.Collaborators`
- **Cieľ**: `collaborator_activities`
- **Mapovanie**: `legacy_id = "cc_{col_id}_{clb_id}"`

- **Čas**: ~5 minút

---

### 4. Step 5 — Zákazníci

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step5 --no-cleanup
```

- **Zdroj**: `CBC.Clients` + `CBC.Persons` + `CBC.Contacts` + `CBC.MailAddresses`
- **Cieľ**: `customers`
- **Mapovanie**: `internal_id = "{cli_id}"`, `data_source = 'iscbc'`
- **Obsahuje**: meno, priezvisko, email, telefón, adresa, krajina, stav
- **Čas**: ~10-15 minút

---

### 5. Step 6 + 6b — Odbery a Cases

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step6 step6b --no-cleanup
```

#### Step 6: Odbery + Lab výsledky
- **Zdroj**: `CBC.Collections` + `CBC.CollectionStatuses` + `CBC.LabResults` + `CBC.CollectionAttendees`
- **Cieľ**: `collections` + `collection_lab_results`
- **Mapovanie**: `legacy_id = "cbc_{col_id}"`, `data_source = 'iscbc'`

#### Step 6b: Cases (otcovské dáta)
- **Zdroj**: `CBC.Fathers` / zákaznícke dáta
- **Cieľ**: `customer_potential_cases`

- **Čas**: ~15-20 minút

---

### 6. Step 8 — Poznámky

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step8 --no-cleanup
```

- **Zdroj**: `CBC.ClientRemarks`
- **Cieľ**: `customer_notes`
- **Mapovanie**: `legacy_id = "remark_{clr_id}"`, `data_source = 'iscbc'`
- **Čas**: ~5 minút

---

### 7. Step 9 — Telefonické komunikácie

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step9 --no-cleanup
```

- **Zdroj**: `CBC.PhoneCommunications`
- **Cieľ**: `communication_messages`
- **Mapovanie**: `external_id = "cbc_pho_{pho_id}"`
- **Čas**: ~10 minút

---

### 8. Step 11 — Zmluvy zákazníkov

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step11 --no-cleanup
```

- **Zdroj**: `CBC.Contracts` + `CBC.ContractStatuses` + `CBC.ContractServices` + `CBC.ContractServicePricings` + `CBC.HistoryCSPs` + `CBC.ContractHistory` + `CBC.Surcharges` + `CBC.Prepayments` + `CBC.SchedulePayments`
- **Cieľ**: `contract_instances` + `customer_documents`
- **Mapovanie**: `internal_id = "contract_{con_id}"`, `data_source = 'iscbc'`
- **Obsahuje**: kompletný `legacyData` JSON so všetkými službami, cenníkmi, historiou, príplatkami
- **Čas**: ~30-40 minút

#### Status mapping
| CBC kód | Normalizovaný |
|---------|---------------|
| `REG_CSA_ACTIVE` | active |
| `REG_CSA_FINISHED` | finished |
| `REG_CSA_CANCELLED` | cancelled |
| `REG_CSA_SUSPENDED` | suspended |
| `REG_CSA_CREATED` | created |

---

### 9. Step 12 — Faktúry (chunk-based)

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step12 --no-cleanup
```

- **Zdroj**: `CBC.Invoices` + `CBC.InvoiceItems` + `CBC.ScheduledPayments` + `CBC.RealizedPayments` + `CBC.InvoiceSchedulesPaymentDates` + `CBC.InvoiceStatuses` + `CBC.InvoiceTypes` + `CBC.Companies` + `CBC.CompanyDetails` + `CBC.CompanyAccounts` + `CBC.VATs`
- **Cieľ**: **duálny insert** do:
  1. `customer_documents` (záložka Dokumenty na profile zákazníka)
  2. `invoices` (modul Faktúry)
  3. `scheduled_invoices` (nezaplatené splátky z ScheduledPayments)
- **Mapovanie**: `legacy_id = "invoice_{inv_id}"`, `data_source = 'iscbc'`
- **Číslo faktúry v module**: `CBC-{pôvodné_číslo}`
- **Chunk-based processing**: 25,000 cse_ids na chunk (kvôli OOM s ~1M+ faktúrami)
- **Čas**: ~120-130 minút

#### Status mapping (faktúry)
| CBC kód | Normalizovaný | Modul Invoices |
|---------|---------------|----------------|
| `REG_IST_NEW` | new | generated |
| `REG_IST_FILLED` | filled | generated |
| `REG_IST_INDUE` | in_due | sent |
| `REG_IST_SENT` | sent | sent |
| `REG_IST_PAID` | paid | paid |
| `REG_IST_PARTIALLY_PAID` | partially_paid | partially_paid |
| `REG_IST_OVERDUE` | overdue | overdue |
| `REG_IST_STORNO` | cancelled | cancelled |
| `REG_IST_CREDIT_NOTE` | credit_note | cancelled |

#### Type mapping
| CBC kód | Typ |
|---------|-----|
| `REG_ITY_INVOICE` | Faktúra |
| `REG_ITY_CREDIT_NOTE` | Dobropis |
| `REG_ITY_PROFORMA` | Zálohovka |
| `REG_ITY_ADVANCE` | Preddavok |
| `REG_ITY_DEBIT_NOTE` | Ťarchopis |

---

### 10. Step 13 — Vymáhanie pohľadávok

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step13 --no-cleanup
```

- **Zdroj**: `CBC.DebtorsSKRest`, `CBC.DebtorsCZ`, `CBC.DebtorsEurocord`, `CBC.DebtorsHU`, `CBC.DebtorsRO`
- **Cieľ**: `customer_debt_collection`
- **Mapovanie**: `data_source = 'iscbc'`
- **Čas**: ~5 minút

---

### 11. Step 14 — Potenciálni klienti

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step14 --no-cleanup
```

- **Zdroj**: `CBC.PotentialClients` (bez existujúcej zmluvy)
- **Cieľ**: `customers` s `client_status = 'potential'`
- **Mapovanie**: `internal_id = "pot_{id}"`, `data_source = 'iscbc'`
- **Čas**: ~5-10 minút

---

### 12. Verifikácia

```bash
MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs verify --no-cleanup
```

Zobrazí porovnávaciu tabuľku počtov záznamov v CBC vs INDEXUS CRM.

---

## Kompletný beh (všetky kroky naraz)

Ak chcete spustiť úplne všetko od čistenia po verifikáciu:

```bash
cd /var/www/indexus-crm && git pull && npm run build && npx drizzle-kit push --force

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step3 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step4 step4b step4c --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step5 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step6 step6b --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step8 step9 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step11 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step12 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs step13 step14 --no-cleanup

MIGRATION_LIMIT=999999 node --max-old-space-size=8192 script/migration/test-migration-20.cjs verify --no-cleanup

pm2 restart indexus-crm
```

**Celkový odhadovaný čas: ~3.5-4 hodiny**

---

## Dôležité poznámky

### Pamäť (OOM ochrana)
- Vždy používajte `--max-old-space-size=8192` (8GB heap)
- Step 11 a Step 12 spúšťajte **samostatne** (nie spolu), aby sa neuvoľnená pamäť z jedného kroku nekombinovala s druhým
- Step 12 spracováva faktúry v chunkoch po 25k cse_ids

### Reštart vs pokračovanie
- `--no-cleanup` zabráni mazaniu starých dát — kroky preskočia existujúce záznamy (idempotentné)
- Pri opakovanom spustení s `--no-cleanup` sa vložia len nové záznamy (duplicity sa preskočia podľa `legacy_id`)
- Bez `--no-cleanup` sa najskôr všetko vymaže a potom znova naimportuje

### MSSQL batch size
- Veľké dotazy sú automaticky rozdelené na dávky po 5000 IDs
- Timeout na MSSQL request: 10 minút (600s)

### Environment variable
- `MIGRATION_LIMIT=100` — test s prvými 100 klientmi
- `MIGRATION_LIMIT=999999` — plná migrácia (bez limitu)

---

## Verifikačné SQL dotazy

```bash
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "
SELECT 'hospitals' as tabulka, count(*) as pocet FROM hospitals WHERE data_source = 'iscbc'
UNION ALL SELECT 'collaborators', count(*) FROM collaborators WHERE data_source = 'iscbc'
UNION ALL SELECT 'collaborator_agreements', count(*) FROM collaborator_agreements WHERE legacy_id IS NOT NULL
UNION ALL SELECT 'collaborator_activities', count(*) FROM collaborator_activities WHERE legacy_id LIKE 'cc_%'
UNION ALL SELECT 'customers', count(*) FROM customers WHERE data_source = 'iscbc'
UNION ALL SELECT 'collections', count(*) FROM collections WHERE data_source = 'iscbc'
UNION ALL SELECT 'collection_lab_results', count(*) FROM collection_lab_results WHERE collection_id IN (SELECT id FROM collections WHERE data_source = 'iscbc')
UNION ALL SELECT 'customer_notes', count(*) FROM customer_notes WHERE data_source = 'iscbc'
UNION ALL SELECT 'communication_messages', count(*) FROM communication_messages WHERE external_id LIKE 'cbc_pho_%'
UNION ALL SELECT 'contract_instances', count(*) FROM contract_instances WHERE data_source = 'iscbc'
UNION ALL SELECT 'customer_documents', count(*) FROM customer_documents WHERE data_source = 'iscbc'
UNION ALL SELECT 'invoices', count(*) FROM invoices WHERE data_source = 'iscbc'
UNION ALL SELECT 'scheduled_invoices', count(*) FROM scheduled_invoices WHERE created_by = 'migration-v20'
UNION ALL SELECT 'customer_debt_collection', count(*) FROM customer_debt_collection WHERE data_source = 'iscbc'
ORDER BY tabulka;
"
```

---

## Referencia CBC tabuliek

| CBC tabuľka | Krok | Popis |
|-------------|------|-------|
| `Hospitals`, `HospitalCategories` | step3 | Nemocnice |
| `Collaborators`, `Persons` | step4 | Spolupracovníci |
| `CollaboratorAgreements` | step4b | Dohody |
| `CollectionCollaborators` | step4c | Úkony |
| `Clients`, `Persons`, `Contacts` | step5 | Zákazníci |
| `Collections`, `LabResults` | step6 | Odbery |
| `Fathers` | step6b | Cases |
| `ClientRemarks` | step8 | Poznámky |
| `PhoneCommunications` | step9 | Komunikácie |
| `Contracts`, `ContractServices`, `ContractServicePricings` | step11 | Zmluvy |
| `Invoices`, `InvoiceItems`, `ScheduledPayments`, `RealizedPayments` | step12 | Faktúry |
| `DebtorsSKRest`, `DebtorsCZ`, `DebtorsEurocord`, `DebtorsHU`, `DebtorsRO` | step13 | Vymáhanie |
| `PotentialClients` | step14 | Potenciálni klienti |

---

## ISCBC Badge

Migrované záznamy zobrazujú oranžový **ISCBC** badge v UI:
- Zoznam zmlúv (`/contracts`) — vedľa čísla zmluvy
- Detail zmluvy — v hlavičke
- Zoznam faktúr (`/invoices`) — vedľa čísla faktúry
- Zákaznícke faktúry (`/customer-invoices`) — v zozname aj detaile
- Záložka Dokumenty na profile zákazníka — na každom migrovanom riadku

## Schémové rozšírenia pre migráciu

### `contract_instances`
- `dataSource` (text) — `'indexus'` alebo `'iscbc'`
- `legacyData` (jsonb) — kompletný CBC záznam
- `hospitalId` zmenený na `varchar`

### `invoices`
- `dataSource` (text) — `'indexus'` alebo `'iscbc'`
- `legacyData` (jsonb) — kompletný CBC záznam vrátane items, payments
- `contractInstanceId` (varchar) — link na zmluvu
- `note` (text)
- `pdf_downloaded_at` (timestamp)

### `customer_documents`
- `variableSymbol`, `amountNoVat`, `paidAmount`, `fullyPaid`, `contractInstanceId`

## Lokalizácia

Všetky CBC status kódy sú lokalizované v 7 jazykoch (EN, SK, CS, HU, RO, IT, DE):
- `REG_IST_*` (stavy faktúr)
- `REG_CSA_*` (stavy zmlúv)
- `REG_ITY_*` (typy faktúr)

Labels používajú `getDocumentStatusLabel()` a `getDocumentTypeLabel()` z `client/src/lib/document-status.ts`.
