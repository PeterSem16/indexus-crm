# ISCBC → INDEXUS CRM Migration Analysis

## Connection Details
- **Server**: 10.1.2.2\MSSQLSTD
- **Database**: ISCBC
- **User**: cbcuser
- **Password**: XqU0nNND

## 1. Entity Mapping Overview

### PRIORITY 1 - Core Business Data (Must Migrate)

| # | ISCBC (MSSQL) | INDEXUS (PostgreSQL) | Notes |
|---|---------------|---------------------|-------|
| 1 | `Companies` | `billing_details` | CBC branches/entities per country |
| 2 | `Clients` + `Persons` + `PersonalData` | `customers` | Clients = parent record, Persons = person entity, PersonalData = details |
| 3 | `PotentialClients` | `customers` (clientStatus='potential') | Leads/registrations |
| 4 | `Contracts` | `contracts` (NEW TABLE NEEDED) | Service contracts |
| 5 | `ServiceCollections` | `collections` | Cord blood collections (core!) |
| 6 | `Hospitals` | `hospitals` | Collection hospitals |
| 7 | `Collaborators` | `collaborators` | Doctors, nurses, midwives |
| 8 | `Laboratories` | `laboratories` | Processing labs |
| 9 | `Invoices` + `InvoiceItems` | `invoices` + `invoice_items` | Financial records |
| 10 | `CollectionStatuses` | `collection_statuses` | Status codes |
| 11 | `CollectionEvaluationResults` | `collection_lab_results` | Lab evaluation data |

### PRIORITY 2 - Supporting Data

| # | ISCBC (MSSQL) | INDEXUS (PostgreSQL) | Notes |
|---|---------------|---------------------|-------|
| 12 | `MailAddresses` | `collaborator_addresses` / customer fields | Address records |
| 13 | `CollaboratorAgreements` | `collaborator_agreements` | Collaborator contracts |
| 14 | `Rewards` / `Rewards3` / `RewardsCZ` | `collaborator_rewards` (NEW) | Reward payments |
| 15 | `Remarks` | `customer_notes` / notes fields | Notes/comments |
| 16 | `ContractServices` + `PriceLists` | `instance_prices` + `market_product_services` | Pricing |
| 17 | `Products` + `MarketProducts` + `MarketProductInstances` | `products` + `market_product_instances` | Product catalog |
| 18 | `Contacts` + `ContactSources` | `customers` (registrationSource) | Marketing contacts |
| 19 | `CollectionTransports` + `Couriers` | Transport data (NEW or embedded) | Logistics |
| 20 | `ExchangeRates` | `exchange_rates` | Currency rates |

### PRIORITY 3 - Historical/Audit Data (Optional)

| # | ISCBC (MSSQL) | INDEXUS | Notes |
|---|---------------|---------|-------|
| 21 | `ContractStateHistories` | Audit log | Contract status changes |
| 22 | `ServiceCollectionStateHistories` | Audit log | Collection status changes |
| 23 | `InvoiceStateHistories` | Audit log | Invoice status changes |
| 24 | `RealizedPayments` | `invoice_payments` | Payment records |
| 25 | `ScheduledPayments` | `scheduled_invoices` | Payment schedules |
| 26 | `RecordChanges` + `RecordChangeDetails` | Audit log | Change tracking |
| 27 | `Logs` | System logs | Application logs |

### NOT MIGRATING (System/UI/Internal)

- `BSPList*` tables (UI configuration)
- `UISettings` (User interface preferences)
- `BSPProcess*` (Background process management)
- `LOCALIZATION*` (App localization)
- `sysdiagrams` (SQL diagrams)
- `*Test` tables (Test copies)
- `*Backup` tables (Backup copies)
- `WelcomeTasks*` (Dashboard widgets)
- `FileRepositories` (File storage - need separate file migration)
- `EmailQueue`, `SMSQueue`, `CoverLetterQueue` (Transient queues)

---

## 2. Detailed Field Mapping

### 2.1 Companies → billing_details

```
ISCBC.Companies                    → INDEXUS.billing_details
─────────────────────────────────────────────────────────
com_id                             → legacy_id (store as text)
com_code                           → code
com_name                           → company_name
com_country_code                   → country_code
com_entity_code                    → entity_code
com_invoice_barcode_letter         → invoice_barcode_letter
cur_code                           → currency

+ CompanyDetails (join cod → com_id):
  cod_full_name                    → company_name (if more specific)
  cod_phone_contact                → (billing_phone - new field)
  cod_email                        → (billing_email - new field)
  cod_ico                          → tax_id
  cod_dic / cod_vat_dic            → (vat_id fields)
  
+ CompanyAccounts (join acc → com_id):
  acc_bank_name                    → bank_name
  acc_IBAN                         → bank_iban
  acc_SWIFT                        → bank_swift
  acc_account_number               → (bank_account_number)

+ MailAddresses (via CompanyDetails.add_id_*):
  add_street_and_number            → address / postal_street
  add_city                         → city / postal_city
  add_zip                          → postal_code / postal_postal_code
  add_area                         → (area/region)
  add_country                      → (country)
```

### 2.2 Clients + Persons + PersonalData → customers

```
ISCBC Chain: Client → Person → PersonalData + MailAddress
INDEXUS: customers (flat table)
─────────────────────────────────────────────────────────
Clients:
  cli_id                           → internal_id (legacy reference)
  com_id                           → (determines country_code via Companies)
  cli_children                     → (no direct field)
  cli_mailinglist                  → newsletter
  cli_marketing_signed_tx          → (marketing consent)
  cli_rating                       → lead_score (mapped)
  
PersonalData (via Persons.per_id → PersonalData.per_id, pda_valid=1):
  pda_title_prefix                 → title_before
  pda_first_name                   → first_name
  pda_middle_name                  → (no direct field, store in notes)
  pda_last_name                    → last_name
  pda_maiden_name                  → maiden_name
  pda_title_suffix                 → title_after
  pda_birth_date                   → date_of_birth
  pda_id_number                    → national_id
  pda_id_card                      → id_card_number
  pda_email                        → email
  pda_email2                       → email_2
  pda_mobile                       → mobile
  pda_mobile2                      → mobile_2
  pda_phone_number                 → phone
  pda_other_contact                → other_contact
  pda_health_insurance_code        → health_insurance_id (lookup)
  pda_bank_name                    → bank_name
  pda_account_number               → bank_account (combine with code)
  pda_account_bank_code            → bank_code
  pda_IBAN                         → bank_account (IBAN preferred)
  pda_SWIFT                        → bank_swift

MailAddresses (permanent, mat_code='PERMANENT'):
  add_street_and_number            → address
  add_city                         → city
  add_zip                          → postal_code
  add_area                         → region
  add_country                      → country

MailAddresses (correspondence, mat_code='MAIL'):
  add_name                         → corr_name
  add_street_and_number            → corr_address
  add_city                         → corr_city
  add_zip                          → corr_postal_code
  add_area                         → corr_region
  add_country                      → corr_country
  (if exists)                      → use_correspondence_address = true

Client Status Mapping:
  PotentialClients (pot_id linked) → client_status = 'potential'
  Contract exists, active          → client_status = 'acquired'
  Contract terminated              → client_status = 'terminated'
```

### 2.3 ServiceCollections → collections

```
ISCBC.ServiceCollections           → INDEXUS.collections
─────────────────────────────────────────────────────────
sco_id                             → legacy_id
sco_collection_unit_number         → cbu_number
com_id                             → billing_company_id (lookup)
mpr_id                             → product_id (lookup via MarketProducts)
com_id                             → country_code (via Companies)
cli_id (via Contracts→Clients)     → customer_id (lookup)
sco_client_first_name              → client_first_name
sco_client_last_name               → client_last_name
sco_client_phone_number            → client_phone
sco_client_mobile                  → client_mobile
sco_client_birth_date              → client_birth_day/month/year (decompose)
sco_client_id_number               → client_birth_number
sco_child_first_name               → child_first_name
sco_child_last_name                → child_last_name
sco_child_sex                      → child_gender

sco_collection_made                → collection_date
hos_id                             → hospital_id (lookup)
rer_id                             → representative_id (lookup)
lab_id                             → laboratory_id (lookup)

csu_id                             → state / status (lookup CollectionStatuses)
sco_sterility                      → status_verified_at
sco_lab_evaluation                 → status_evaluated_at
sco_paired                         → status_paired_at
sco_stored                         → status_stored_at
sco_transferred                    → status_transferred_at
sco_released                       → status_released_at
sco_waiting_for_dispose            → status_awaiting_disposal_at
sco_disposed                       → status_disposed_at
sco_evaluated                      → (part of evaluated flow)

sco_doctors_note                   → doctor_note
sco_note                           → note
sco_inserted                       → created_at
sco_updated                        → updated_at

CollectionCollaborators (join sco_id):
  doc_id where agt_id=blood        → cord_blood_collector_id
  doc_id where agt_id=tissue       → tissue_collector_id
  doc_id where agt_id=placenta     → placenta_collector_id
  doc_id where agt_id=assistant    → assistant_nurse_id
```

### 2.4 Hospitals → hospitals

```
ISCBC.Hospitals                    → INDEXUS.hospitals
─────────────────────────────────────────────────────────
hos_id                             → legacy_id
hos_name                           → name
hos_full_name                      → full_name
hos_active                         → is_active
rer_id                             → representative_id (lookup)
lab_id                             → laboratory_id (lookup)
hos_svet_zdravia                   → svet_zdravia
hos_note                           → (notes field if added)
hos_inserted                       → created_at
hos_updated                        → updated_at

MailAddresses (via add_id):
  add_street_and_number            → street_number
  add_city                         → city
  add_zip                          → postal_code
  add_area                         → region
  add_country                      → country_code

Contact fields need separate query:
  doc_id_contact_person            → contact_person (lookup name)
  doc_id_responsible_person        → responsible_person_id
```

### 2.5 Collaborators → collaborators

```
ISCBC.Collaborators                → INDEXUS.collaborators
─────────────────────────────────────────────────────────
doc_id                             → legacy_id
cty_id                             → collaborator_type (lookup CollaboratorTypes.cty_code)
doc_active                         → is_active
doc_note                           → note
doc_svet_zdravia                   → svet_zdravia
doc_client_contract                → client_contact
doc_monthly_rewards                → month_rewards
doc_bank_name                      → (not in INDEXUS directly)
doc_IBAN                           → bank_account_iban
doc_SWIFT                          → swift_code
doc_ICO                            → ico
doc_DIC                            → dic
doc_IC_DPH                         → ic_dph
doc_birth_place                    → birth_place
rer_id                             → representative_id (lookup)
doc_inserted                       → created_at
doc_updated                        → updated_at

PersonalData (via per_id → PersonalData):
  pda_title_prefix                 → title_before
  pda_first_name                   → first_name
  pda_last_name                    → last_name
  pda_maiden_name                  → maiden_name
  pda_title_suffix                 → title_after
  pda_birth_date                   → birth_day/month/year (decompose)
  pda_id_number                    → birth_number
  pda_mobile                       → mobile
  pda_mobile2                      → mobile_2
  pda_phone_number                 → phone
  pda_email                        → email
  pda_other_contact                → other_contact

Country (via Companies.com_country_code):
  com_country_code                 → country_code

CollaboratorsHospitals:
  hos_id (multiple)                → hospital_ids[]
```

### 2.6 Invoices → invoices

```
ISCBC.Invoices                     → INDEXUS.invoices
─────────────────────────────────────────────────────────
inv_id                             → legacy_id
inv_invoice_number                 → invoice_number
cli_id (via ContractServices→...) → customer_id (lookup)
acc_id                             → billing_details_id (lookup via CompanyAccounts)
cur_code_home                      → currency
ist_id                             → status (map InvoiceStatuses)
inv_variable_symbol                → variable_symbol
inv_specific_symbol                → specific_symbol
inv_constant_symbol                → constant_symbol
inv_date_of_delivery               → delivery_date
inv_date_of_issue                  → issue_date
inv_dispatch_date                  → send_date
inv_date_of_payment                → due_date
inv_amount_cur_home_no_vat         → subtotal
inv_amount_cur_home_with_vat       → total_amount
inv_paid_cur_home                  → paid_amount
inv_exchange_rate                  → (exchange rate field)
inv_fully_paid                     → payment_date
inv_note                           → (notes)
inv_inserted                       → created_at
inv_period_from                    → period_from
inv_period_to                      → period_to

InvoiceItems (join inv_id):
  iit_label                        → name
  iit_units                        → quantity
  iit_price_per_unit_cur_home_*    → unit_price
  iit_price_cur_home_with_vat      → line_total
  vat_id → VATs.vat_rate           → vat_rate
```

---

## 3. Key Relationships & Join Paths

### Client → Collection Flow (ISCBC):
```
PotentialClients (pot_id)
  └── Clients (cli_id, pot_id→)
        └── Contracts (con_id, cli_id→)
              └── ContractServices (cse_id, con_id→)
                    └── ServiceCollections (sco_id, via cse→sco_id)
                          ├── CollectionCollaborators (doc_id, sco_id→)
                          ├── CollectionEvaluationResults (sco_id→)
                          └── ServiceCollectionStateHistories (sco_id→)
```

### Client → Invoice Flow (ISCBC):
```
Clients (cli_id)
  └── Contracts (con_id, cli_id→)
        └── ContractServices (cse_id, con_id→)
              └── Invoices (inv_id, cse_id→)
                    ├── InvoiceItems (inv_id→)
                    ├── ScheduledPayments (inv_id→)
                    └── RealizedPayments (inv_id→)
```

### Collaborator → Rewards Flow (ISCBC):
```
Collaborators (doc_id)
  ├── CollaboratorAgreements (doc_id→)
  ├── CollectionCollaborators (doc_id→, sco_id→)
  └── Rewards (doc_id→, sco_id→, con_id→)
```

---

## 4. Status Code Mapping

### Collection Statuses (CollectionStatuses → collection_statuses):
```sql
-- Query to extract:
SELECT csu_id, csu_code, csu_default_name, csu_order 
FROM CollectionStatuses ORDER BY csu_order
```

### Contract Statuses (ContractStatuses):
```sql
SELECT csa_id, csa_code, csa_default_name, csa_order 
FROM ContractStatuses ORDER BY csa_order
```

### Invoice Statuses (InvoiceStatuses):
```sql
SELECT ist_id, ist_code, ist_default_name, ist_order 
FROM InvoiceStatuses ORDER BY ist_order
```

---

## 5. Data Volume Estimates

Need to run on MSSQL to determine:
```sql
SELECT 'Companies' as tbl, COUNT(*) as cnt FROM Companies
UNION ALL SELECT 'Clients', COUNT(*) FROM Clients
UNION ALL SELECT 'PotentialClients', COUNT(*) FROM PotentialClients
UNION ALL SELECT 'Contracts', COUNT(*) FROM Contracts
UNION ALL SELECT 'ServiceCollections', COUNT(*) FROM ServiceCollections
UNION ALL SELECT 'Hospitals', COUNT(*) FROM Hospitals
UNION ALL SELECT 'Collaborators', COUNT(*) FROM Collaborators
UNION ALL SELECT 'Invoices', COUNT(*) FROM Invoices
UNION ALL SELECT 'Persons', COUNT(*) FROM Persons
UNION ALL SELECT 'PersonalData', COUNT(*) FROM PersonalData
UNION ALL SELECT 'MailAddresses', COUNT(*) FROM MailAddresses
UNION ALL SELECT 'CollaboratorAgreements', COUNT(*) FROM CollaboratorAgreements
UNION ALL SELECT 'Rewards', COUNT(*) FROM Rewards
UNION ALL SELECT 'InvoiceItems', COUNT(*) FROM InvoiceItems
UNION ALL SELECT 'CollectionEvaluationResults', COUNT(*) FROM CollectionEvaluationResults
ORDER BY 1
```

---

## 6. Missing Tables in INDEXUS (Need to Create)

### 6.1 Contracts Table
ISCBC has a robust `Contracts` table that doesn't have a direct equivalent in INDEXUS. Need to create:
- `contracts` table with fields from ISCBC.Contracts
- Link to customers, hospitals, collaborators, products

### 6.2 Contract Services
- `contract_services` linking contracts to specific services/products with pricing

### 6.3 Rewards
- `collaborator_rewards` for tracking payments to collaborators

---

## 7. Migration Order (Dependencies)

```
Phase 1 - Reference Data (no dependencies):
  1. Companies → billing_details
  2. CollectionStatuses → collection_statuses  
  3. Laboratories → laboratories
  4. Products/MarketProducts → products
  5. MarketProductInstances → market_product_instances
  6. HealthInsurance lookup → health_insurance_companies
  7. CollaboratorTypes → (config)
  8. ExchangeRates → exchange_rates

Phase 2 - Core Entities (depend on Phase 1):
  9. Hospitals → hospitals
  10. Collaborators + PersonalData + Addresses → collaborators + addresses
  11. Clients + Persons + PersonalData + Addresses → customers

Phase 3 - Business Records (depend on Phase 2):
  12. Contracts → contracts (NEW)
  13. PotentialClients → customers (merge/update)
  14. ServiceCollections → collections
  15. CollectionEvaluationResults → collection_lab_results
  16. CollectionCollaborators → (update collections with collaborator IDs)

Phase 4 - Financial (depend on Phase 3):
  17. Invoices + InvoiceItems → invoices + invoice_items
  18. RealizedPayments → invoice_payments
  19. ScheduledPayments → scheduled_invoices
  20. Rewards → collaborator_rewards (NEW)

Phase 5 - Historical/Audit (optional):
  21. StateHistories → audit log entries
  22. Remarks → customer_notes / notes
  23. RecordChanges → audit trail
```
