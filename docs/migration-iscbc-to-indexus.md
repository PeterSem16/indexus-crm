# ISCBC → INDEXUS CRM Migration Guide

## Overview

Migration from legacy ISCBC system (MSSQL database `CBC` on `10.1.2.2:1433`) to INDEXUS CRM (PostgreSQL).

**Current phase**: 100-record test migration (no billing/rewards in this phase, but invoice data is migrated to both `customer_documents` and `invoices` modules).

## Architecture

### Source
- **Database**: Microsoft SQL Server
- **Server**: `10.1.2.2:1433`
- **Database name**: `CBC`
- **Credentials**: `cbcuser` / `XqU0nNND`

### Target
- **Database**: PostgreSQL
- **Connection**: `localhost`, user `indexus`, database `indexus_crm`, password `HanyurIfKisck`

### Migration Scripts
| File | Purpose |
|------|---------|
| `script/migration/test-migration-20.cjs` | Main migration script (20 steps) |
| `script/migration/cleanup-test-migration.cjs` | Cleanup script to remove all migrated data before re-running |

## Migration Steps (test-migration-20.cjs)

### Step 1: Customers (Clients + Persons)
- Source: `CBC.Clients` joined with `CBC.Persons`
- Target: `customers`
- Key mapping: `internal_id = "cbc_{cli_id}"`
- Includes: personal data, contact info, country, status

### Step 2: Customer Contacts (Phones, Emails)
- Source: `CBC.Contacts`
- Target: `customers` (phone, email fields updated)

### Step 3: Customer Addresses
- Source: `CBC.Addresses`
- Target: `customer_addresses`

### Step 4: Collections (Odbery)
- Source: `CBC.Collections` + `CBC.CollectionStatuses`
- Target: `collections`
- Key mapping: `legacy_id = cbc_col_id`

### Step 5: Collection Lab Results
- Source: `CBC.LabResults`
- Target: `collection_lab_results`

### Step 6: Hospitals
- Source: `CBC.Hospitals`
- Target: `hospitals`
- Key mapping: `legacy_id = cbc_hos_id`

### Step 7: Collaborators (Spolupracovníci)
- Source: `CBC.Collaborators` + `CBC.Persons`
- Target: `collaborators`
- Key mapping: `legacy_id = cbc_col_id`

### Step 8: Collaborator Activities
- Source: `CBC.CollaboratorActivities`
- Target: `collaborator_activities`

### Step 9: Collaborator Addresses
- Source: `CBC.CollaboratorAddresses`
- Target: `collaborator_addresses`

### Step 10: Collaborator Agreements
- Source: `CBC.CollaboratorAgreements`
- Target: `collaborator_agreements`

### Step 11: Contracts → contract_instances
- Source: `CBC.Contracts` joined with `CBC.ContractStatuses`, `CBC.ContractSets`
- Target: `contract_instances`
- Key mapping: `internal_id = "contract_{con_id}"`
- Hospital/collaborator lookup uses `legacy_id` (not `internal_id`)
- `hospitalId` stored as `varchar` (hospitals use UUID PKs)
- `dataSource = 'iscbc'`, `legacyData` stores full CBC row as JSON
- Status mapped from `REG_CSA_*` codes

### Step 12: Invoices → customer_documents + invoices
- Source: `CBC.Invoices` joined with `CBC.InvoiceStatuses`, `CBC.InvoiceTypes`, `CBC.ContractSets`, `CBC.Contracts`, `CBC.Clients`, `CBC.Companies`, `CBC.Currencies`
- Additional sources preloaded into `legacyData`:
  - `CBC.InvoiceItems` — invoice line items (item name, qty, unit, unit prices, VAT rate, totals)
  - `CBC.InvoicePayments` — payment records (name, amounts, due date, status)
  - `CBC.InvoicePaymentItems` / `CBC.PaymentSubItems` — payment sub-items (payment date, amounts, exchange rate, payment type, document, account, bank, VS, message, note)
- Target: **dual insert** into:
  1. `customer_documents` (customer profile Documents tab)
  2. `invoices` (main Invoices module)
- Key mapping: `legacy_id = cbc_inv_id`
- Invoice number in module: `CBC-{original_number}` (unique prefix)
- Company name: chain `Contracts.cli_id → Clients.com_id → Companies.com_name`
- Contract instance link: `contract_instance_id` via `internal_id = "contract_{con_id}"`
- Legacy data structure in `legacyData` JSON field includes `items[]`, `payments[].subItems[]`
- New column: `invoices.pdf_downloaded_at` — tracks when PDF was downloaded from INDEXUS
- UI: "Legacy" tab in Invoice Detail drawer shows items, payments with expandable sub-items

#### Status Mapping
| CBC Status Code | Normalized | Invoices Module Status |
|----------------|------------|----------------------|
| `REG_IST_NEW` | new | generated |
| `REG_IST_FILLED` | filled | generated |
| `REG_IST_INDUE` | in_due | sent |
| `REG_IST_PAID` | paid | paid |
| `REG_IST_OVERDUE` | overdue | overdue |
| `REG_IST_CANCELLED` | cancelled | cancelled |

#### Type Mapping
| CBC Type Code | Display |
|--------------|---------|
| `REG_ITY_INVOICE` | Invoice |
| `REG_ITY_CREDIT_NOTE` | Credit Note |
| `REG_ITY_PROFORMA` | Proforma |

### Step 13: Debt Collection (Vymáhanie)
- Source: `CBC.DebtCollection`
- Target: `customer_debt_collection`
- `dataSource = 'iscbc'`

### Step 14: Customer Notes
- Source: `CBC.Notes`
- Target: `customer_notes`
- `legacy_id` set

### Step 15: Phone Calls / Communication
- Source: `CBC.PhoneCalls`
- Target: `communication_messages`
- `provider = 'cbc_legacy'`

### Step 16: Potential Clients
- Source: `CBC.PotentialClients`
- Target: `customers` with `client_status = 'potential'`
- Key mapping: `internal_id = "pot_{id}"`

### Steps 17-20: Verification & Summary
- Record counts per table
- Error summary
- Migration timestamp log

## Running the Migration

### Prerequisites
1. Ensure PostgreSQL schema is up to date:
   ```bash
   npm run build
   npx drizzle-kit push --force
   ```

2. Ensure MSSQL is accessible from the server (network connectivity to `10.1.2.2:1433`)

### Full Command (Ubuntu server)
```bash
cd /var/www/indexus-crm && \
  git pull && \
  npm run build && \
  npx drizzle-kit push --force && \
  node script/migration/cleanup-test-migration.cjs && \
  MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs 2>&1 | tee /tmp/migration-v20.txt && \
  pm2 restart indexus-crm
```

### Environment Variable
- `MIGRATION_LIMIT=100` — limits to first 100 clients (for testing)
- Remove the limit for full migration

### Re-running
The cleanup script removes all migrated data before re-running:
```bash
node script/migration/cleanup-test-migration.cjs
```
It deletes data with markers: `data_source = 'iscbc'`, `legacy_id IS NOT NULL`, `internal_id IS NOT NULL`, `provider = 'cbc_legacy'`.

## ISCBC Badge

Migrated records display an orange **ISCBC** badge in the UI:
- **Contracts list** (`/contracts`) — next to contract number
- **Contract detail** — in the header
- **Invoices list** (`/invoices`) — next to invoice number
- **Customer Invoices** (`/customer-invoices`) — in list and detail panel
- **Customer Documents tab** — on each migrated document row

## Data Deduplication

The Documents tab on customer profile handles deduplication:
- ISCBC contracts: shown from `contract_instances` (not duplicated from `customer_documents`)
- ISCBC invoices: shown from `invoices` module (not duplicated from `customer_documents`)
- Dedup is by `legacyData.inv_id` / `legacyData.contract_instance_id`

## Schema Extensions for Migration

### `contract_instances` table
- `dataSource` (text) — `'indexus'` or `'iscbc'`
- `legacyData` (jsonb) — full CBC row
- `hospitalId` changed to `varchar` (was integer)

### `invoices` table
- `dataSource` (text) — `'indexus'` or `'iscbc'`
- `legacyData` (jsonb) — full CBC row
- `contractInstanceId` (varchar) — link to contract
- `note` (text)

### `customer_documents` table
- `variableSymbol`, `amountNoVat`, `paidAmount`, `fullyPaid`, `contractInstanceId`

## Localization

All CBC status codes are localized in 7 languages (EN, SK, CS, HU, RO, IT, DE):
- `REG_IST_*` (invoice statuses)
- `REG_CSA_*` (contract statuses)
- `REG_ITY_*` (invoice types)

Labels use `getDocumentStatusLabel()` and `getDocumentTypeLabel()` from `client/src/lib/document-status.ts`.

## CBC Database Reference

### Key Tables Used
| CBC Table | Purpose |
|-----------|---------|
| `Clients` | Customer master data |
| `Persons` | Personal details (name, birth date) |
| `Contacts` | Phone, email |
| `Addresses` | Customer addresses |
| `Contracts` | Customer contracts |
| `ContractSets` | Contract-to-client linkage |
| `ContractStatuses` | Status registry (`REG_CSA_*`) |
| `Invoices` | Invoice records |
| `InvoiceStatuses` | Invoice status registry (`REG_IST_*`) |
| `InvoiceTypes` | Invoice type registry (`REG_ITY_*`) |
| `Companies` | Billing company details |
| `Currencies` | Currency codes |
| `Collections` | Blood collection records |
| `LabResults` | Lab analysis results |
| `Hospitals` | Hospital registry |
| `Collaborators` | Sales collaborators |
| `DebtCollection` | Debt collection cases |
| `Notes` | Customer notes |
| `PhoneCalls` | Call history |
| `PotentialClients` | Lead/prospect data |

### Important Column Notes
- `Invoices.cur_code_account` (NOT `cur_code_accounting`)
- `Invoices.inv_date_of_payment` used as due date (no `inv_due_date` column exists)
- No `inv_storno`, `inv_storno_date` columns exist
- Company name chain: `Contracts.cli_id → Clients.com_id → Companies.com_name`
- Contract instance internal_id format: `contract_{con_id}`

## Verification

After migration, check the summary output:
```
=== MIGRÁCIA DOKONČENÁ ===
Customers (migrated):          100
Collections (migrated):        XX
Contracts (migrated):          128
Documents-Invoices (migrated): 293
Invoices-Module (migrated):    293
DebtCollection (migrated):     XX
```

### PostgreSQL Verification Queries
```sql
-- Count migrated records
SELECT 'customers' as t, COUNT(*) FROM customers WHERE internal_id IS NOT NULL
UNION ALL SELECT 'contracts', COUNT(*) FROM contract_instances WHERE data_source = 'iscbc'
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices WHERE data_source = 'iscbc'
UNION ALL SELECT 'documents', COUNT(*) FROM customer_documents WHERE data_source = 'iscbc';

-- Check invoice-contract linking
SELECT COUNT(*) as linked FROM invoices 
WHERE data_source = 'iscbc' AND contract_instance_id IS NOT NULL;
```
