# INDEXUS CRM - Database Schema Documentation

**Generated:** January 2026  
**Database:** PostgreSQL (Neon-backed)  
**ORM:** Drizzle ORM  
**Total Tables:** 97

---

## Table of Contents

1. [Overview](#overview)
2. [User & Authentication](#user--authentication)
3. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
4. [Customer Management](#customer-management)
5. [Collaborators Module](#collaborators-module)
6. [Hospitals & Clinics](#hospitals--clinics)
7. [Products & Services](#products--services)
8. [Billing & Invoicing](#billing--invoicing)
9. [Campaigns & Marketing](#campaigns--marketing)
10. [Sales Pipeline (CRM)](#sales-pipeline-crm)
11. [Contracts Management](#contracts-management)
12. [Communication (Email/SMS)](#communication-emailsms)
13. [Notifications & Tasks](#notifications--tasks)
14. [Mobile App (INDEXUS Connect)](#mobile-app-indexus-connect)
15. [Configuration & Settings](#configuration--settings)
16. [System Tables](#system-tables)
17. [Relationships Diagram](#relationships-diagram)
18. [Indexes](#indexes)

---

## Overview

The INDEXUS CRM database supports a multi-country cord blood banking CRM system with:
- Multi-country support (SK, CZ, HU, RO, IT, DE, US, CH)
- Role-based access control
- Customer lifecycle management
- Collaborator (medical staff) management
- Hospital and clinic partnerships
- Product/service configuration with complex pricing
- Invoice generation and billing
- Marketing campaigns
- Sales pipeline management
- Contract generation with e-signatures
- Email/SMS communication with AI analysis
- Mobile app for field representatives

---

## User & Authentication

### users

CRM system users who can access the system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key (UUID) |
| username | text | NO | - | Unique username |
| email | text | NO | - | Unique email address |
| full_name | text | NO | - | User's full name |
| password_hash | text | NO | - | Bcrypt hashed password |
| role | text | NO | 'user' | Legacy role: admin, manager, user |
| role_id | varchar | YES | NULL | FK to roles table (new RBAC) |
| is_active | boolean | NO | true | Account active status |
| assigned_countries | text[] | NO | {} | Array of country codes |
| avatar_url | text | YES | NULL | Profile picture URL |
| sip_enabled | boolean | NO | false | SIP phone enabled |
| sip_extension | text | YES | '' | SIP extension number |
| sip_password | text | YES | '' | SIP password |
| sip_display_name | text | YES | '' | SIP display name |
| jira_account_id | text | YES | NULL | Linked Jira account |
| jira_display_name | text | YES | NULL | Jira display name |
| auth_method | text | NO | 'local' | 'local' or 'ms365' |
| nexus_enabled | boolean | NO | false | NEXUS AI assistant enabled |
| show_notification_bell | boolean | NO | true | Show notification bell |
| show_email_queue | boolean | NO | false | Show email queue icon |
| show_sip_phone | boolean | NO | false | Show SIP phone icon |
| phone_prefix | text | YES | NULL | Phone country prefix |
| phone | text | YES | NULL | Phone number |
| created_at | timestamp | NO | now() | Record creation time |

**Example INSERT:**
```sql
INSERT INTO users (username, email, full_name, password_hash, role, assigned_countries)
VALUES ('jnovak', 'jan.novak@indexus.sk', 'Ján Novák', '$2b$10$...', 'manager', ARRAY['SK', 'CZ']);
```

**Relationships:**
- `role_id` → `roles.id`
- Referenced by: `customers.assigned_user_id`, `tasks.assigned_user_id`, `activity_logs.user_id`

---

## Role-Based Access Control (RBAC)

### roles

Custom roles for RBAC system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Unique role name |
| description | text | YES | NULL | Role description |
| department | text | YES | NULL | management, sales, operations, finance, customer_service, it, medical |
| legacy_role | text | YES | NULL | Maps to legacy role enum |
| is_active | boolean | NO | true | Role active status |
| is_system | boolean | NO | false | System roles cannot be deleted |
| created_at | timestamp | NO | now() | Creation time |
| created_by | varchar | YES | NULL | FK to users |
| updated_at | timestamp | NO | now() | Last update |

**Example INSERT:**
```sql
INSERT INTO roles (id, name, description, department, is_system)
VALUES (gen_random_uuid(), 'Sales Manager', 'Manages sales team', 'sales', false);
```

### role_module_permissions

Module-level permissions for roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| role_id | varchar | NO | - | FK to roles |
| module_key | text | NO | - | Module identifier (dashboard, customers, hospitals, etc.) |
| access | text | NO | 'visible' | 'visible' or 'hidden' |
| can_add | boolean | NO | true | Can create records |
| can_edit | boolean | NO | true | Can edit records |

### role_field_permissions

Field-level permissions within modules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| role_id | varchar | NO | - | FK to roles |
| module_key | text | NO | - | Module identifier |
| field_key | text | NO | - | Field identifier |
| permission | text | NO | 'editable' | 'editable', 'readonly', 'hidden' |

### user_roles

Many-to-many assignment of roles to users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| role_id | varchar | NO | - | FK to roles |
| assigned_at | timestamp | NO | now() | Assignment time |
| assigned_by | varchar | YES | NULL | FK to users |

---

## Customer Management

### customers

Cord blood banking customers (main customer table).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| internal_id | text | YES | NULL | Legacy internal ID |
| title_before | text | YES | NULL | Title before name (Ing., Mgr.) |
| first_name | text | NO | - | First name |
| last_name | text | NO | - | Last name |
| maiden_name | text | YES | NULL | Maiden name |
| title_after | text | YES | NULL | Title after name (PhD.) |
| phone | text | YES | NULL | Primary phone |
| mobile | text | YES | NULL | Mobile phone |
| mobile_2 | text | YES | NULL | Secondary mobile |
| other_contact | text | YES | NULL | Other contact info |
| email | text | NO | - | Primary email |
| email_2 | text | YES | NULL | Secondary email |
| national_id | text | YES | NULL | National ID (Rodne cislo) |
| id_card_number | text | YES | NULL | ID card number |
| date_of_birth | timestamp | YES | NULL | Birth date |
| newsletter | boolean | NO | false | Newsletter subscription |
| complaint_type_id | varchar | YES | NULL | FK to complaint_types |
| cooperation_type_id | varchar | YES | NULL | FK to cooperation_types |
| vip_status_id | varchar | YES | NULL | FK to vip_statuses |
| country | text | NO | - | Country code |
| city | text | YES | NULL | City |
| address | text | YES | NULL | Street address |
| postal_code | text | YES | NULL | Postal code |
| region | text | YES | NULL | Region/Area |
| use_correspondence_address | boolean | NO | false | Has separate mailing address |
| corr_name | text | YES | NULL | Correspondence name |
| corr_address | text | YES | NULL | Correspondence address |
| corr_city | text | YES | NULL | Correspondence city |
| corr_postal_code | text | YES | NULL | Correspondence postal code |
| corr_region | text | YES | NULL | Correspondence region |
| corr_country | text | YES | NULL | Correspondence country |
| bank_account | text | YES | NULL | IBAN |
| bank_code | text | YES | NULL | Bank code |
| bank_name | text | YES | NULL | Bank name |
| bank_swift | text | YES | NULL | SWIFT code |
| health_insurance_id | varchar | YES | NULL | FK to health_insurance_companies |
| client_status | text | NO | 'potential' | potential, acquired, terminated |
| status | text | NO | 'active' | active, pending, inactive |
| service_type | text | YES | NULL | cord_blood, cord_tissue, both |
| notes | text | YES | NULL | General notes |
| assigned_user_id | varchar | YES | NULL | FK to users |
| lead_score | integer | NO | 0 | Computed lead score 0-100 |
| lead_score_updated_at | timestamp | YES | NULL | Last score calculation |
| lead_status | text | NO | 'cold' | cold, warm, hot, qualified |
| created_at | timestamp | NO | now() | Creation time |

**Example INSERT:**
```sql
INSERT INTO customers (first_name, last_name, email, country, client_status)
VALUES ('Jana', 'Kovacova', 'jana.kovacova@email.sk', 'SK', 'potential');
```

**Relationships:**
- `assigned_user_id` → `users.id`
- `complaint_type_id` → `complaint_types.id`
- `cooperation_type_id` → `cooperation_types.id`
- `vip_status_id` → `vip_statuses.id`
- `health_insurance_id` → `health_insurance_companies.id`
- Referenced by: `customer_notes`, `customer_products`, `invoices`, `customer_consents`, `deals`

### customer_potential_cases

Extended data for potential clients (pregnancy info, father data, product selection).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | NO | - | FK to customers |
| case_status | text | YES | NULL | realized, duplicate, in_progress, postponed, no_interest, cancelled |
| expected_date_day | integer | YES | NULL | Expected due date (day) |
| expected_date_month | integer | YES | NULL | Expected due date (month) |
| expected_date_year | integer | YES | NULL | Expected due date (year) |
| hospital_id | varchar | YES | NULL | FK to hospitals |
| obstetrician_id | varchar | YES | NULL | FK to collaborators |
| is_multiple_pregnancy | boolean | NO | false | Multiple pregnancy flag |
| child_count | integer | YES | 1 | Number of children |
| father_title_before | text | YES | NULL | Father's title |
| father_first_name | text | YES | NULL | Father's first name |
| father_last_name | text | YES | NULL | Father's last name |
| father_title_after | text | YES | NULL | Father's title after |
| father_phone | text | YES | NULL | Father's phone |
| father_mobile | text | YES | NULL | Father's mobile |
| father_email | text | YES | NULL | Father's email |
| father_street | text | YES | NULL | Father's street |
| father_city | text | YES | NULL | Father's city |
| father_postal_code | text | YES | NULL | Father's postal code |
| father_region | text | YES | NULL | Father's region |
| father_country | text | YES | NULL | Father's country |
| product_id | varchar | YES | NULL | FK to products |
| product_type | text | YES | NULL | Product type |
| payment_type | text | YES | NULL | Payment type |
| gift_voucher | text | YES | NULL | Gift voucher code |
| contact_date_day | integer | YES | NULL | Contact date (day) |
| contact_date_month | integer | YES | NULL | Contact date (month) |
| contact_date_year | integer | YES | NULL | Contact date (year) |
| existing_contracts | text | YES | NULL | Existing contracts |
| recruiting | text | YES | NULL | Recruiting info |
| sales_channel | text | YES | NULL | CCP, CCP+D, CCAI, CCAI+D, CCAE, CCAE+D, I |
| info_source | text | YES | NULL | How customer found us |
| marketing_action | text | YES | NULL | Marketing action |
| marketing_code | text | YES | NULL | Marketing code |
| newsletter_opt_in | boolean | NO | false | Newsletter opt-in |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### customer_notes

Notes on customer records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | NO | - | FK to customers |
| user_id | varchar | NO | - | FK to users (author) |
| content | text | NO | - | Note content |
| created_at | timestamp | NO | now() | Creation time |

### customer_consents

GDPR consent tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | NO | - | FK to customers |
| consent_type | text | NO | - | marketing_email, marketing_sms, data_processing, newsletter, third_party_sharing, profiling, automated_decisions |
| legal_basis | text | NO | - | consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests |
| purpose | text | NO | - | Purpose description |
| granted | boolean | NO | false | Consent granted |
| granted_at | timestamp | YES | NULL | Grant timestamp |
| granted_by_user_id | varchar | YES | NULL | FK to users |
| revoked_at | timestamp | YES | NULL | Revocation timestamp |
| revoked_by_user_id | varchar | YES | NULL | FK to users |
| revoke_reason | text | YES | NULL | Revocation reason |
| expires_at | timestamp | YES | NULL | Expiration date |
| source | text | YES | NULL | web_form, phone, email, in_person, signed_document |
| document_reference | text | YES | NULL | Reference to signed document |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### lead_scoring_criteria

Configurable lead scoring rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Criterion name |
| description | text | YES | NULL | Description |
| category | text | NO | - | demographic, engagement, behavior, profile |
| field | text | NO | - | Field to evaluate |
| condition | text | NO | - | equals, not_empty, greater_than, less_than, contains |
| value | text | YES | NULL | Value to compare |
| points | integer | NO | 0 | Points to add/subtract |
| is_active | boolean | NO | true | Active status |
| country_code | text | YES | NULL | null = global, or country code |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

---

## Collaborators Module

### collaborators

Medical staff collaborators (doctors, nurses, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| legacy_id | text | YES | NULL | Legacy CRM ID |
| country_code | text | NO | - | Operating country |
| title_before | text | YES | NULL | Title before name |
| first_name | text | NO | - | First name |
| last_name | text | NO | - | Last name |
| maiden_name | text | YES | NULL | Maiden name |
| title_after | text | YES | NULL | Title after name |
| birth_number | text | YES | NULL | Birth number |
| birth_day | integer | YES | NULL | Birth day |
| birth_month | integer | YES | NULL | Birth month |
| birth_year | integer | YES | NULL | Birth year |
| birth_place | text | YES | NULL | Birth place |
| health_insurance_id | varchar | YES | NULL | FK to health_insurance_companies |
| marital_status | text | YES | NULL | single, married, divorced, widowed |
| collaborator_type | text | YES | NULL | doctor, nurse, assistant_doctor, head_nurse, call_center, other |
| phone | text | YES | NULL | Phone |
| mobile | text | YES | NULL | Mobile |
| mobile_2 | text | YES | NULL | Secondary mobile |
| other_contact | text | YES | NULL | Other contact |
| email | text | YES | NULL | Email |
| bank_account_iban | text | YES | NULL | Personal IBAN |
| swift_code | text | YES | NULL | SWIFT code |
| client_contact | boolean | NO | false | Is client contact |
| representative_id | varchar | YES | NULL | FK to users |
| is_active | boolean | NO | true | Active status |
| svet_zdravia | boolean | NO | false | Svet zdravia flag |
| company_name | text | YES | NULL | Company name |
| ico | text | YES | NULL | Company IČO |
| dic | text | YES | NULL | Company DIČ |
| ic_dph | text | YES | NULL | Company IČ DPH |
| company_iban | text | YES | NULL | Company IBAN |
| company_swift | text | YES | NULL | Company SWIFT |
| month_rewards | boolean | NO | false | Monthly rewards flag |
| note | text | YES | NULL | Notes |
| hospital_id | varchar | YES | NULL | FK to hospitals |
| mobile_app_enabled | boolean | NO | false | INDEXUS Connect access |
| mobile_username | text | YES | NULL | Mobile app username |
| mobile_password_hash | text | YES | NULL | Mobile app password hash |
| can_edit_hospitals | boolean | NO | false | Permission to add/edit hospitals |
| last_mobile_login | timestamp | YES | NULL | Last mobile login |
| mobile_last_active_at | timestamp | YES | NULL | Last mobile activity |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

**Example INSERT:**
```sql
INSERT INTO collaborators (first_name, last_name, country_code, collaborator_type, email)
VALUES ('MUDr. Peter', 'Horák', 'SK', 'doctor', 'peter.horak@nemocnica.sk');
```

### collaborator_addresses

Multiple addresses per collaborator.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| collaborator_id | varchar | NO | - | FK to collaborators |
| address_type | text | NO | - | permanent, correspondence, work, company |
| name | text | YES | NULL | Address name/label |
| street_number | text | YES | NULL | Street and number |
| postal_code | text | YES | NULL | Postal code |
| region | text | YES | NULL | Region |
| country_code | text | YES | NULL | Country code |
| created_at | timestamp | NO | now() | Creation time |

### collaborator_other_data

Disability and pension dates for collaborators.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| collaborator_id | varchar | NO | - | FK to collaborators (unique) |
| ztp_day | integer | YES | NULL | ZŤP disability day |
| ztp_month | integer | YES | NULL | ZŤP disability month |
| ztp_year | integer | YES | NULL | ZŤP disability year |
| old_age_pension_day | integer | YES | NULL | Old-age pension day |
| old_age_pension_month | integer | YES | NULL | Old-age pension month |
| old_age_pension_year | integer | YES | NULL | Old-age pension year |
| disability_pension_day | integer | YES | NULL | Disability pension day |
| disability_pension_month | integer | YES | NULL | Disability pension month |
| disability_pension_year | integer | YES | NULL | Disability pension year |
| widow_pension_day | integer | YES | NULL | Widow pension day |
| widow_pension_month | integer | YES | NULL | Widow pension month |
| widow_pension_year | integer | YES | NULL | Widow pension year |
| created_at | timestamp | NO | now() | Creation time |

### collaborator_agreements

Agreements with billing companies, reward types, file uploads.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| collaborator_id | varchar | NO | - | FK to collaborators |
| file_name | text | YES | NULL | Uploaded file name |
| file_path | text | YES | NULL | File storage path |
| file_size | integer | YES | NULL | File size in bytes |
| file_content_type | text | YES | NULL | MIME type |
| extracted_text | text | YES | NULL | OCR extracted text |
| billing_company_id | varchar | YES | NULL | FK to billing_details |
| contract_number | text | YES | NULL | Contract number |
| valid_from_day | integer | YES | NULL | Valid from day |
| valid_from_month | integer | YES | NULL | Valid from month |
| valid_from_year | integer | YES | NULL | Valid from year |
| valid_to_day | integer | YES | NULL | Valid to day |
| valid_to_month | integer | YES | NULL | Valid to month |
| valid_to_year | integer | YES | NULL | Valid to year |
| is_valid | boolean | NO | true | Agreement validity |
| agreement_sent_day | integer | YES | NULL | Agreement sent day |
| agreement_sent_month | integer | YES | NULL | Agreement sent month |
| agreement_sent_year | integer | YES | NULL | Agreement sent year |
| agreement_returned_day | integer | YES | NULL | Agreement returned day |
| agreement_returned_month | integer | YES | NULL | Agreement returned month |
| agreement_returned_year | integer | YES | NULL | Agreement returned year |
| agreement_form | text | YES | NULL | Agreement form type |
| reward_types | text[] | YES | {} | Array of reward type codes |
| created_at | timestamp | NO | now() | Creation time |

---

## Hospitals & Clinics

### hospitals

Hospital management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| legacy_id | text | YES | NULL | Legacy CRM ID |
| is_active | boolean | NO | true | Active status |
| name | text | NO | - | Hospital name |
| full_name | text | YES | NULL | Full official name |
| street_number | text | YES | NULL | Street address |
| representative_id | varchar | YES | NULL | FK to users |
| city | text | YES | NULL | City |
| laboratory_id | varchar | YES | NULL | FK to laboratories |
| postal_code | text | YES | NULL | Postal code |
| auto_recruiting | boolean | NO | false | Auto recruiting flag |
| region | text | YES | NULL | Region |
| responsible_person_id | varchar | YES | NULL | FK to users |
| country_code | text | NO | - | Country code |
| contact_person | text | YES | NULL | Contact person name |
| svet_zdravia | boolean | NO | false | Svet zdravia network |
| phone | text | YES | NULL | Phone |
| email | text | YES | NULL | Email |
| latitude | decimal(10,7) | YES | NULL | GPS latitude |
| longitude | decimal(10,7) | YES | NULL | GPS longitude |
| created_by_collaborator_id | varchar | YES | NULL | FK to collaborators (mobile app) |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

**Example INSERT:**
```sql
INSERT INTO hospitals (name, city, country_code, is_active)
VALUES ('Univerzitná nemocnica Bratislava', 'Bratislava', 'SK', true);
```

### clinics

Outpatient clinics (ambulancie).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Clinic name |
| doctor_name | text | YES | NULL | Doctor name |
| address | text | YES | NULL | Address |
| city | text | YES | NULL | City |
| postal_code | text | YES | NULL | Postal code |
| country_code | text | NO | 'SK' | Country code |
| phone | text | YES | NULL | Phone |
| email | text | YES | NULL | Email |
| website | text | YES | NULL | Website URL |
| latitude | decimal(10,7) | YES | NULL | GPS latitude |
| longitude | decimal(10,7) | YES | NULL | GPS longitude |
| is_active | boolean | NO | true | Active status |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

**Example INSERT:**
```sql
INSERT INTO clinics (name, doctor_name, city, country_code, website)
VALUES ('Gynekologická ambulancia', 'MUDr. Mária Nová', 'Košice', 'SK', 'https://gyn-nova.sk');
```

---

## Products & Services

### products

Base products/services offered.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Product name |
| description | text | YES | NULL | Description |
| countries | text[] | NO | {} | Available countries |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### market_product_instances

Market-specific instances of products (collections).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| product_id | varchar | NO | - | FK to products |
| country_code | text | NO | 'SK' | Target country |
| billing_details_id | varchar | YES | NULL | FK to billing_details |
| name | text | NO | - | Instance name |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| is_active | boolean | NO | true | Active status |
| description | text | YES | NULL | Description |
| created_at | timestamp | NO | now() | Creation time |

### market_product_services

Services within market product instances (storage services).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| instance_id | varchar | NO | - | FK to market_product_instances |
| name | text | NO | - | Service name |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| invoice_identifier | text | YES | NULL | Invoice ID |
| invoiceable | boolean | NO | false | Can be invoiced |
| collectable | boolean | NO | false | Can be collected |
| storable | boolean | NO | false | Can be stored |
| is_active | boolean | NO | true | Active status |
| block_automation | boolean | NO | false | Block automation |
| certificate_template | text | YES | NULL | Certificate template |
| description | text | YES | NULL | Description |
| allow_proforma_invoices | boolean | NO | false | Allow proforma |
| invoicing_period_years | integer | YES | NULL | Invoicing period |
| first_invoice_aliquote | boolean | NO | false | First invoice aliquote |
| constant_symbol | text | YES | NULL | Constant symbol |
| start_invoicing | text | YES | NULL | Start invoicing field |
| end_invoicing | text | YES | NULL | End invoicing field |
| accounting_id_offset | integer | YES | NULL | Accounting ID offset |
| ledger_account_proforma | text | YES | NULL | Proforma ledger account |
| ledger_account_invoice | text | YES | NULL | Invoice ledger account |
| created_at | timestamp | NO | now() | Creation time |

### instance_prices

Pricing for market product instances.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| instance_id | varchar | NO | - | FK to market_product_instances |
| instance_type | text | NO | 'market' | market or service |
| country_code | text | YES | NULL | Specific country |
| name | text | NO | - | Price name |
| accounting_code | text | YES | NULL | Accounting code |
| analytical_account | text | YES | NULL | Analytical account |
| price | decimal(10,2) | NO | - | Price amount |
| currency | text | NO | 'EUR' | Currency code |
| amendment | text | YES | NULL | Amendment text |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| is_active | boolean | NO | true | Active status |
| description | text | YES | NULL | Description |
| created_at | timestamp | NO | now() | Creation time |

### instance_payment_options

Payment options for market instances.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| instance_id | varchar | NO | - | FK to instance |
| instance_type | text | NO | 'market' | market or service |
| type | text | YES | NULL | Payment option type |
| name | text | NO | - | Option name |
| invoice_item_text | text | YES | NULL | Invoice item text |
| analytical_account | text | YES | NULL | Analytical account |
| accounting_code | text | YES | NULL | Accounting code |
| payment_type_fee | decimal(10,2) | YES | NULL | Fee amount |
| amendment | text | YES | NULL | Amendment |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| is_active | boolean | NO | true | Active status |
| description | text | YES | NULL | Description |
| is_multi_payment | boolean | NO | false | Multi-payment option |
| frequency | text | YES | NULL | monthly, quarterly, semi_annually, annually |
| installment_count | integer | YES | NULL | Number of installments |
| calculation_mode | text | YES | NULL | fixed, percentage |
| base_price_id | varchar | YES | NULL | FK to instance_prices |
| created_at | timestamp | NO | now() | Creation time |

### payment_installments

Individual installments for multi-payment options.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| payment_option_id | varchar | NO | - | FK to instance_payment_options |
| installment_number | integer | NO | - | Installment sequence |
| label | text | NO | - | Label (e.g., "First installment") |
| calculation_type | text | NO | 'fixed' | fixed, percentage |
| amount | decimal(10,2) | YES | NULL | Fixed amount |
| percentage | decimal(5,2) | YES | NULL | Percentage |
| due_offset_months | integer | NO | 0 | Months offset from start |
| created_at | timestamp | NO | now() | Creation time |

### instance_discounts

Discounts and surcharges for instances.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| instance_id | varchar | NO | - | FK to instance |
| instance_type | text | NO | 'market' | market or service |
| type | text | YES | NULL | Discount type |
| name | text | NO | - | Discount name |
| invoice_item_text | text | YES | NULL | Invoice text |
| analytical_account | text | YES | NULL | Analytical account |
| accounting_code | text | YES | NULL | Accounting code |
| is_fixed | boolean | NO | false | Fixed amount discount |
| fixed_value | decimal(10,2) | YES | NULL | Fixed value |
| is_percentage | boolean | NO | false | Percentage discount |
| percentage_value | decimal(5,2) | YES | NULL | Percentage value |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| is_active | boolean | NO | true | Active status |
| description | text | YES | NULL | Description |
| created_at | timestamp | NO | now() | Creation time |

### instance_vat_rates

VAT rates for market instances and services.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| instance_id | varchar | NO | - | FK to instance |
| instance_type | text | NO | 'market_instance' | market_instance or service |
| billing_details_id | varchar | YES | NULL | FK to billing_details |
| category | text | YES | NULL | VAT category |
| accounting_code | text | YES | NULL | Accounting code |
| vat_rate | decimal(5,2) | YES | NULL | VAT rate percentage |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| description | text | YES | NULL | Description |
| create_as_new_vat | boolean | NO | false | Create as new VAT |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### product_sets

Billing sets (Zostavy) - product configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| product_id | varchar | NO | - | FK to products |
| country_code | text | YES | NULL | Country code |
| name | text | NO | - | Set name |
| from_date | timestamp | YES | NULL | Valid from |
| to_date | timestamp | YES | NULL | Valid to |
| currency | text | NO | 'EUR' | Currency |
| notes | text | YES | NULL | Notes |
| is_active | boolean | NO | true | Active status |
| email_alert_enabled | boolean | NO | false | Email alerts |
| total_net_amount | decimal(12,2) | YES | NULL | Calculated net total |
| total_discount_amount | decimal(12,2) | YES | NULL | Calculated discount total |
| total_vat_amount | decimal(12,2) | YES | NULL | Calculated VAT total |
| total_gross_amount | decimal(12,2) | YES | NULL | Calculated gross total |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### product_set_collections

Links product sets to collections (Odbery).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| product_set_id | varchar | NO | - | FK to product_sets |
| instance_id | varchar | NO | - | FK to market_product_instances |
| price_id | varchar | YES | NULL | FK to instance_prices |
| payment_option_id | varchar | YES | NULL | FK to instance_payment_options |
| discount_id | varchar | YES | NULL | FK to instance_discounts |
| vat_rate_id | varchar | YES | NULL | FK to instance_vat_rates |
| quantity | integer | NO | 1 | Quantity |
| price_override | decimal(12,2) | YES | NULL | Custom price |
| sort_order | integer | NO | 0 | Sort order |
| line_net_amount | decimal(12,2) | YES | NULL | Calculated line net |
| line_discount_amount | decimal(12,2) | YES | NULL | Calculated line discount |
| line_vat_amount | decimal(12,2) | YES | NULL | Calculated line VAT |
| line_gross_amount | decimal(12,2) | YES | NULL | Calculated line gross |
| created_at | timestamp | NO | now() | Creation time |

### product_set_storage

Links product sets to storage services (Skladovanie).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| product_set_id | varchar | NO | - | FK to product_sets |
| service_id | varchar | NO | - | FK to market_product_services |
| price_id | varchar | YES | NULL | FK to instance_prices |
| discount_id | varchar | YES | NULL | FK to instance_discounts |
| vat_rate_id | varchar | YES | NULL | FK to instance_vat_rates |
| payment_option_id | varchar | YES | NULL | FK to instance_payment_options |
| quantity | integer | NO | 1 | Quantity |
| price_override | decimal(12,2) | YES | NULL | Custom price |
| sort_order | integer | NO | 0 | Sort order |
| line_net_amount | decimal(12,2) | YES | NULL | Calculated line net |
| line_discount_amount | decimal(12,2) | YES | NULL | Calculated line discount |
| line_vat_amount | decimal(12,2) | YES | NULL | Calculated line VAT |
| line_gross_amount | decimal(12,2) | YES | NULL | Calculated line gross |
| created_at | timestamp | NO | now() | Creation time |

### customer_products

Products assigned to customers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | NO | - | FK to customers |
| product_id | varchar | NO | - | FK to products |
| instance_id | varchar | YES | NULL | FK to market_product_instances |
| billset_id | varchar | YES | NULL | FK to product_sets |
| quantity | integer | NO | 1 | Quantity |
| price_override | decimal(10,2) | YES | NULL | Custom price |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | NO | now() | Creation time |

---

## Billing & Invoicing

### billing_details

Billing companies configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| country_code | text | NO | - | Primary country |
| country_codes | text[] | NO | {} | Multiple countries |
| code | text | YES | NULL | Billing company code |
| entity_code | text | YES | NULL | Entity code |
| invoice_barcode_letter | text | YES | NULL | A-Z letter for barcode |
| company_name | text | NO | - | Company name |
| address | text | NO | - | Address |
| city | text | NO | - | City |
| postal_code | text | YES | NULL | Postal code |
| tax_id | text | YES | NULL | VAT ID |
| bank_name | text | YES | NULL | Bank name |
| bank_iban | text | YES | NULL | IBAN |
| bank_swift | text | YES | NULL | SWIFT |
| vat_rate | decimal(5,2) | NO | 20 | Default VAT rate |
| currency | text | NO | 'EUR' | Default currency |
| payment_terms | integer[] | NO | {7,14,30} | Payment term options |
| default_payment_term | integer | NO | 14 | Default term |
| postal_name | text | YES | NULL | Postal address name |
| postal_street | text | YES | NULL | Postal street |
| postal_city | text | YES | NULL | Postal city |
| postal_postal_code | text | YES | NULL | Postal PSČ |
| postal_area | text | YES | NULL | Postal area |
| postal_country | text | YES | NULL | Postal country |
| residency_name | text | YES | NULL | Residency name |
| residency_street | text | YES | NULL | Residency street |
| residency_city | text | YES | NULL | Residency city |
| residency_postal_code | text | YES | NULL | Residency PSČ |
| residency_area | text | YES | NULL | Residency area |
| residency_country | text | YES | NULL | Residency country |
| full_name | text | YES | NULL | Full name |
| phone | text | YES | NULL | Phone |
| email | text | YES | NULL | Email |
| ico | text | YES | NULL | IČO |
| dic | text | YES | NULL | DIČ |
| vat_number | text | YES | NULL | IČ DPH |
| web_from_email | text | YES | NULL | Web "from" email |
| cover_letter_to_email | text | YES | NULL | Cover letter "to" email |
| default_language | text | YES | NULL | Default language |
| sent_collection_kit_to_client | boolean | NO | false | Send kit to client |
| allow_manual_payment_insert | boolean | NO | false | Allow manual payment |
| uid_is_mandatory | boolean | NO | false | UID mandatory |
| allow_empty_child_name_in_collection | boolean | NO | false | Allow empty child name |
| is_default | boolean | NO | false | Default billing company |
| is_active | boolean | NO | true | Active status |
| updated_at | timestamp | NO | now() | Last update |
| created_at | timestamp | NO | now() | Creation time |

### billing_company_accounts

Multiple bank accounts per billing company.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| billing_details_id | varchar | NO | - | FK to billing_details |
| currency | text | NO | 'EUR' | Account currency |
| name | text | YES | NULL | Account name |
| bank_name | text | YES | NULL | Bank name |
| account_number | text | YES | NULL | Account number |
| account_bank_code | text | YES | NULL | Bank code |
| iban | text | YES | NULL | IBAN |
| swift | text | YES | NULL | SWIFT |
| valid_from_day | integer | YES | NULL | Valid from day |
| valid_from_month | integer | YES | NULL | Valid from month |
| valid_from_year | integer | YES | NULL | Valid from year |
| valid_to_day | integer | YES | NULL | Valid to day |
| valid_to_month | integer | YES | NULL | Valid to month |
| valid_to_year | integer | YES | NULL | Valid to year |
| is_active | boolean | NO | true | Active status |
| is_default | boolean | NO | false | Default account |
| description | text | YES | NULL | Description |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### billing_company_audit_log

Audit trail for billing company changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| billing_details_id | varchar | NO | - | FK to billing_details |
| user_id | varchar | NO | - | FK to users |
| field_name | text | NO | - | Changed field |
| old_value | text | YES | NULL | Previous value |
| new_value | text | YES | NULL | New value |
| change_type | text | NO | 'update' | create, update, delete |
| created_at | timestamp | NO | now() | Change time |

### billing_company_laboratories

Junction table linking billing companies to laboratories.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| billing_details_id | varchar | NO | - | FK to billing_details |
| laboratory_id | varchar | NO | - | FK to laboratories |
| created_at | timestamp | NO | now() | Creation time |

### billing_company_collaborators

Junction table linking billing companies to collaborators.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| billing_details_id | varchar | NO | - | FK to billing_details |
| collaborator_id | varchar | NO | - | FK to collaborators |
| created_at | timestamp | NO | now() | Creation time |

### billing_company_couriers

Couriers assigned to billing companies.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| billing_details_id | varchar | NO | - | FK to billing_details |
| name | text | NO | - | Courier name |
| phone | text | YES | NULL | Phone number |
| email | text | YES | NULL | Email address |
| is_active | boolean | NO | true | Active status |
| description | text | YES | NULL | Description/notes |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### invoices

Generated invoices.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| invoice_number | text | NO | - | Unique invoice number |
| customer_id | varchar | NO | - | FK to customers |
| subtotal | decimal(10,2) | YES | NULL | Subtotal |
| vat_rate | decimal(5,2) | YES | NULL | VAT rate |
| vat_amount | decimal(10,2) | YES | NULL | VAT amount |
| total_amount | decimal(10,2) | NO | - | Total amount |
| currency | text | NO | 'EUR' | Currency |
| status | text | NO | 'generated' | generated, sent, paid, overdue |
| payment_term_days | integer | NO | 14 | Payment term |
| due_date | timestamp | YES | NULL | Due date |
| generated_at | timestamp | NO | now() | Generation time |
| pdf_path | text | YES | NULL | PDF file path |
| billing_company_name | text | YES | NULL | Snapshot: company name |
| billing_address | text | YES | NULL | Snapshot: address |
| billing_city | text | YES | NULL | Snapshot: city |
| billing_tax_id | text | YES | NULL | Snapshot: tax ID |
| billing_bank_name | text | YES | NULL | Snapshot: bank name |
| billing_bank_iban | text | YES | NULL | Snapshot: IBAN |
| billing_bank_swift | text | YES | NULL | Snapshot: SWIFT |

### invoice_items

Line items in invoices.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| invoice_id | varchar | NO | - | FK to invoices |
| product_id | varchar | YES | NULL | FK to products |
| description | text | NO | - | Item description |
| quantity | integer | NO | 1 | Quantity |
| unit_price | decimal(10,2) | NO | - | Unit price |
| line_total | decimal(10,2) | NO | - | Line total |

### invoice_templates

Invoice template configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Template name |
| description | text | YES | NULL | Description |
| country_code | text | NO | - | Country |
| language_code | text | NO | 'en' | Language |
| is_default | boolean | NO | false | Default template |
| is_active | boolean | NO | true | Active status |
| template_type | text | NO | 'standard' | standard, proforma, credit_note |
| header_html | text | YES | NULL | Header HTML |
| footer_html | text | YES | NULL | Footer HTML |
| logo_path | text | YES | NULL | Logo path |
| primary_color | text | YES | '#6B2346' | Brand color |
| show_vat | boolean | NO | true | Show VAT |
| show_payment_qr | boolean | NO | false | Show QR code |
| payment_instructions | text | YES | NULL | Payment instructions |
| legal_text | text | YES | NULL | Legal text |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### invoice_layouts

Invoice layout configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Layout name |
| country_code | text | NO | - | Country |
| is_default | boolean | NO | false | Default layout |
| is_active | boolean | NO | true | Active status |
| layout_config | text | NO | - | JSON layout config |
| paper_size | text | NO | 'A4' | Paper size |
| orientation | text | NO | 'portrait' | portrait, landscape |
| margin_top | integer | YES | 20 | Top margin (mm) |
| margin_bottom | integer | YES | 20 | Bottom margin |
| margin_left | integer | YES | 15 | Left margin |
| margin_right | integer | YES | 15 | Right margin |
| font_size | integer | YES | 10 | Font size |
| font_family | text | YES | 'Arial' | Font family |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### number_ranges

Invoice/proforma numbering configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Range name |
| country_code | text | NO | - | Country |
| billing_details_id | varchar | YES | NULL | FK to billing_details |
| year | integer | NO | - | Year |
| use_service_code | boolean | NO | false | Use service code |
| type | text | NO | 'invoice' | invoice, proforma |
| prefix | text | YES | NULL | Number prefix |
| suffix | text | YES | NULL | Number suffix |
| digits_to_generate | integer | NO | 6 | Digits count |
| start_number | integer | NO | 1 | Start number |
| end_number | integer | NO | 999999 | End number |
| last_number_used | integer | YES | 0 | Last used number |
| accounting_code | text | YES | NULL | Accounting code |
| description | text | YES | NULL | Description |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### exchange_rates

Daily ECB exchange rates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| currency_code | text | NO | - | Currency code (USD, CZK, HUF) |
| currency_name | text | NO | - | Currency name |
| rate | decimal(12,6) | NO | - | Rate against EUR |
| rate_date | date | NO | - | Rate date |
| updated_at | timestamp | NO | now() | Last update |

### inflation_rates

Annual inflation data.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| year | integer | NO | - | Year |
| country | varchar(2) | NO | 'SK' | Country code |
| rate | decimal(6,2) | NO | - | Rate percentage |
| source | text | YES | NULL | Data source |
| updated_at | timestamp | NO | now() | Last update |

---

## Campaigns & Marketing

### campaigns

Marketing/sales campaigns.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Campaign name |
| description | text | YES | NULL | Description |
| type | text | NO | 'marketing' | marketing, sales, follow_up, retention, upsell, other |
| status | text | NO | 'draft' | draft, active, paused, completed, cancelled |
| country_codes | text[] | NO | {} | Target countries |
| criteria | text | YES | NULL | JSON filter criteria |
| settings | text | YES | NULL | JSON settings |
| script | text | YES | NULL | Operator script |
| start_date | timestamp | YES | NULL | Start date |
| end_date | timestamp | YES | NULL | End date |
| target_contact_count | integer | YES | 0 | Target contacts |
| conversion_goal | numeric(5,2) | YES | 0 | Conversion goal % |
| created_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### campaign_contacts

Customers targeted in a campaign.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_id | varchar | NO | - | FK to campaigns |
| customer_id | varchar | NO | - | FK to customers |
| status | text | NO | 'pending' | pending, contacted, completed, failed, no_answer, callback_scheduled, not_interested |
| assigned_to | varchar | YES | NULL | FK to users |
| notes | text | YES | NULL | Notes |
| attempt_count | integer | NO | 0 | Call attempts |
| last_attempt_at | timestamp | YES | NULL | Last attempt |
| priority_score | integer | NO | 50 | Priority 0-100 |
| callback_date | timestamp | YES | NULL | Callback date |
| contacted_at | timestamp | YES | NULL | First contact |
| completed_at | timestamp | YES | NULL | Completion time |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### campaign_contact_history

Log of campaign interactions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_contact_id | varchar | NO | - | FK to campaign_contacts |
| user_id | varchar | NO | - | FK to users |
| action | text | NO | - | status_change, note_added, callback_set |
| previous_status | text | YES | NULL | Previous status |
| new_status | text | YES | NULL | New status |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | NO | now() | Creation time |

### campaign_contact_sessions

Individual call/contact attempt logs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_contact_id | varchar | NO | - | FK to campaign_contacts |
| user_id | varchar | NO | - | FK to users |
| started_at | timestamp | NO | now() | Session start |
| ended_at | timestamp | YES | NULL | Session end |
| duration_seconds | integer | YES | NULL | Duration |
| outcome | text | NO | 'pending' | pending, answered, no_answer, busy, voicemail, failed |
| notes | text | YES | NULL | Notes |
| callback_scheduled | boolean | YES | false | Callback set |
| callback_date | timestamp | YES | NULL | Callback date |

### campaign_templates

Reusable campaign configurations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Template name |
| description | text | YES | NULL | Description |
| type | text | NO | 'marketing' | Campaign type |
| country_codes | text[] | NO | {} | Countries |
| criteria | text | YES | NULL | JSON criteria |
| settings | text | YES | NULL | JSON settings |
| script | text | YES | NULL | Operator script |
| is_default | boolean | NO | false | Default template |
| created_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### campaign_schedules

Working hours and scheduling rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_id | varchar | NO | - | FK to campaigns (unique) |
| working_days | text[] | NO | {monday,...,friday} | Working days |
| working_hours_start | text | NO | '09:00' | Start time |
| working_hours_end | text | NO | '17:00' | End time |
| max_attempts_per_contact | integer | NO | 3 | Max attempts |
| min_hours_between_attempts | integer | NO | 24 | Hours between attempts |
| auto_assign_contacts | boolean | NO | true | Auto-assign |
| prioritize_callbacks | boolean | NO | true | Prioritize callbacks |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### campaign_operator_settings

Operator assignments with workload weights.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_id | varchar | NO | - | FK to campaigns |
| user_id | varchar | NO | - | FK to users |
| is_active | boolean | NO | true | Active status |
| workload_weight | integer | NO | 100 | Weight (100 = normal) |
| max_contacts_per_day | integer | YES | 50 | Daily limit |
| assigned_countries | text[] | YES | {} | Assigned countries |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### campaign_metrics_snapshots

Aggregated metrics for reporting.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| campaign_id | varchar | NO | - | FK to campaigns |
| snapshot_date | timestamp | NO | - | Snapshot date |
| snapshot_hour | integer | YES | NULL | Hour (0-23) or null for daily |
| total_contacts | integer | NO | 0 | Total contacts |
| pending_contacts | integer | NO | 0 | Pending contacts |
| contacted_contacts | integer | NO | 0 | Contacted |
| completed_contacts | integer | NO | 0 | Completed |
| failed_contacts | integer | NO | 0 | Failed |
| total_calls | integer | NO | 0 | Total calls |
| successful_calls | integer | NO | 0 | Successful calls |
| avg_call_duration_seconds | integer | YES | 0 | Average duration |
| conversion_rate | numeric(5,2) | YES | 0 | Conversion rate |
| created_at | timestamp | NO | now() | Creation time |

---

## Sales Pipeline (CRM)

### pipelines

Sales pipelines (Pipedrive-like).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| name | varchar(255) | NO | - | Pipeline name |
| description | text | YES | NULL | Description |
| country_codes | text[] | YES | NULL | Target countries |
| is_default | boolean | YES | false | Default pipeline |
| is_active | boolean | YES | true | Active status |
| created_at | timestamp | YES | now() | Creation time |
| updated_at | timestamp | YES | now() | Last update |

### pipeline_stages

Stages within a pipeline.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| pipeline_id | varchar | NO | - | FK to pipelines (CASCADE) |
| name | varchar(255) | NO | - | Stage name |
| color | varchar(50) | YES | '#3b82f6' | Stage color |
| order | integer | NO | 0 | Sort order |
| probability | integer | YES | 0 | Win probability % |
| rotting_days | integer | YES | NULL | Days until "rotting" |
| is_won_stage | boolean | YES | false | Won stage flag |
| is_lost_stage | boolean | YES | false | Lost stage flag |
| created_at | timestamp | YES | now() | Creation time |

### deals

Sales opportunities.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| title | varchar(500) | NO | - | Deal title |
| pipeline_id | varchar | NO | - | FK to pipelines |
| stage_id | varchar | NO | - | FK to pipeline_stages |
| customer_id | varchar | YES | NULL | FK to customers |
| campaign_id | varchar | YES | NULL | FK to campaigns |
| contract_instance_id | varchar | YES | NULL | FK to contract_instances |
| assigned_user_id | varchar | YES | NULL | FK to users |
| value | decimal(15,2) | YES | 0 | Deal value |
| currency | varchar(10) | YES | 'EUR' | Currency |
| probability | integer | YES | 0 | Win probability |
| expected_close_date | date | YES | NULL | Expected close |
| actual_close_date | date | YES | NULL | Actual close |
| status | varchar(50) | YES | 'open' | open, won, lost |
| lost_reason | text | YES | NULL | Lost reason |
| source | varchar(255) | YES | NULL | Lead source |
| country_code | varchar(10) | YES | NULL | Country |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | YES | now() | Creation time |
| updated_at | timestamp | YES | now() | Last update |

### deal_activities

Deal activities (calls, emails, meetings, tasks).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| deal_id | varchar | NO | - | FK to deals (CASCADE) |
| user_id | varchar | YES | NULL | FK to users |
| type | varchar(50) | NO | - | call, email, meeting, task, note |
| subject | varchar(500) | NO | - | Subject |
| description | text | YES | NULL | Description |
| due_at | timestamp | YES | NULL | Due date |
| completed_at | timestamp | YES | NULL | Completion time |
| outcome | varchar(255) | YES | NULL | Call outcome |
| duration | integer | YES | NULL | Duration (minutes) |
| is_completed | boolean | YES | false | Completed flag |
| reminder_at | timestamp | YES | NULL | Reminder time |
| reminder_sent | boolean | YES | false | Reminder sent |
| priority | varchar(20) | YES | 'normal' | low, normal, high, urgent |
| created_at | timestamp | YES | now() | Creation time |

### deal_products

Products linked to deals.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| deal_id | varchar | NO | - | FK to deals (CASCADE) |
| product_id | varchar | NO | - | FK to products |
| quantity | integer | NO | 1 | Quantity |
| price | decimal(15,2) | YES | NULL | Price |
| discount | decimal(15,2) | YES | NULL | Discount |
| notes | text | YES | NULL | Notes |
| created_at | timestamp | YES | now() | Creation time |

### automation_rules

Pipeline automation rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | - | Primary key |
| pipeline_id | varchar | NO | - | FK to pipelines (CASCADE) |
| name | varchar(255) | NO | - | Rule name |
| description | text | YES | NULL | Description |
| is_active | boolean | YES | true | Active status |
| trigger_type | varchar(50) | NO | - | deal_created, stage_changed, deal_won, deal_lost, deal_rotting, activity_completed, customer_updated |
| trigger_config | jsonb | YES | NULL | Trigger configuration |
| action_type | varchar(50) | NO | - | create_activity, send_email, assign_owner, update_deal, move_stage, add_note, create_deal |
| action_config | jsonb | YES | NULL | Action configuration |
| execution_count | integer | YES | 0 | Execution count |
| last_executed_at | timestamp | YES | NULL | Last execution |
| created_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | YES | now() | Creation time |
| updated_at | timestamp | YES | now() | Last update |

---

## Contracts Management

### contract_categories

Categories for contract templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | - | Primary key |
| value | varchar(50) | NO | - | Unique code (e.g., "general") |
| label | text | NO | - | Default label |
| label_sk | text | YES | NULL | Slovak label |
| label_cz | text | YES | NULL | Czech label |
| label_hu | text | YES | NULL | Hungarian label |
| label_ro | text | YES | NULL | Romanian label |
| label_it | text | YES | NULL | Italian label |
| label_de | text | YES | NULL | German label |
| label_us | text | YES | NULL | English label |
| description | text | YES | NULL | Description |
| sort_order | integer | NO | 0 | Sort order |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### contract_templates

Reusable contract document templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Template name |
| description | text | YES | NULL | Description |
| country_code | varchar(2) | NO | - | Country |
| language_code | varchar(5) | NO | - | Language |
| category | varchar(50) | NO | 'general' | Category code |
| status | varchar(20) | NO | 'draft' | draft, published, archived |
| content_html | text | YES | NULL | HTML with Handlebars |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### contract_category_default_templates

Per-country default templates for categories.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | - | Primary key |
| category_id | integer | NO | - | FK to contract_categories |
| country_code | varchar(2) | NO | - | Country |
| template_type | varchar(20) | NO | 'pdf_form' | pdf_form, docx |
| template_id | varchar | YES | NULL | FK to contract_templates |
| source_pdf_path | text | YES | NULL | PDF file path |
| source_docx_path | text | YES | NULL | DOCX file path |
| original_docx_path | text | YES | NULL | Original DOCX backup |
| preview_pdf_path | text | YES | NULL | PDF preview path |
| extracted_fields | text | YES | NULL | JSON field names |
| placeholder_mappings | text | YES | NULL | JSON mappings |
| html_content | text | YES | NULL | HTML content |
| conversion_status | varchar(20) | NO | 'pending' | pending, processing, completed, failed |
| conversion_error | text | YES | NULL | Error message |
| conversion_metadata | text | YES | NULL | JSON metadata |
| is_active | boolean | NO | true | Active status |
| created_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### contract_template_versions

Version history for templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | serial | NO | - | Primary key |
| category_id | integer | NO | - | FK to contract_categories |
| country_code | varchar(2) | NO | - | Country |
| version_number | integer | NO | 1 | Version number |
| docx_file_path | text | NO | - | DOCX path |
| html_content | text | YES | NULL | HTML content |
| change_description | text | YES | NULL | Change notes |
| created_by | varchar | YES | NULL | FK to users |
| created_by_name | text | YES | NULL | Creator name |
| is_default | boolean | NO | false | Default version |
| created_at | timestamp | NO | now() | Creation time |

### contract_instances

Generated contract instances.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| contract_number | varchar(50) | NO | - | Contract number (e.g., ZML-2025-00001) |
| template_id | varchar | NO | - | FK to contract_templates |
| template_version_id | varchar | YES | NULL | FK to contract_template_versions |
| customer_id | varchar | NO | - | FK to customers |
| billing_details_id | varchar | NO | - | FK to billing_details |
| initiated_from | varchar(20) | YES | NULL | potential_case, quick_contact, direct |
| potential_case_id | varchar | YES | NULL | FK to customer_potential_cases |
| quick_contact_id | varchar | YES | NULL | FK reference |
| status | varchar(20) | NO | 'draft' | draft, sent, pending_signature, signed, completed, cancelled, expired |
| valid_from | date | YES | NULL | Valid from |
| valid_to | date | YES | NULL | Valid to |
| total_net_amount | decimal(12,2) | YES | NULL | Net amount |
| total_vat_amount | decimal(12,2) | YES | NULL | VAT amount |
| total_gross_amount | decimal(12,2) | YES | NULL | Gross amount |
| currency | varchar(3) | NO | 'EUR' | Currency |
| rendered_html | text | YES | NULL | Final rendered HTML |
| pdf_path | text | YES | NULL | PDF path |
| signature_mode | varchar(20) | NO | 'simple' | simple, advanced, qualified |
| customer_snapshot | text | YES | NULL | JSON customer data |
| billing_snapshot | text | YES | NULL | JSON billing data |
| selected_product_id | varchar(50) | YES | NULL | Product code |
| internal_notes | text | YES | NULL | Internal notes |
| created_by | varchar | YES | NULL | FK to users |
| sent_at | timestamp | YES | NULL | Sent time |
| sent_by | varchar | YES | NULL | FK to users |
| signed_at | timestamp | YES | NULL | Signed time |
| completed_at | timestamp | YES | NULL | Completion time |
| cancelled_at | timestamp | YES | NULL | Cancellation time |
| cancelled_by | varchar | YES | NULL | FK to users |
| cancellation_reason | text | YES | NULL | Cancel reason |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### contract_instance_products

Products linked to contracts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| contract_id | varchar | NO | - | FK to contract_instances |
| product_set_id | varchar | YES | NULL | FK to product_sets |
| product_id | varchar | YES | NULL | FK to products |
| product_snapshot | text | YES | NULL | JSON product data |
| price_snapshot | text | YES | NULL | JSON pricing data |
| installment_snapshot | text | YES | NULL | JSON installments |
| quantity | integer | NO | 1 | Quantity |
| unit_price | decimal(12,2) | YES | NULL | Unit price |
| discount_percent | decimal(5,2) | YES | NULL | Discount % |
| discount_amount | decimal(12,2) | YES | NULL | Discount amount |
| vat_rate | decimal(5,2) | YES | NULL | VAT rate |
| line_net_amount | decimal(12,2) | YES | NULL | Line net |
| line_vat_amount | decimal(12,2) | YES | NULL | Line VAT |
| line_gross_amount | decimal(12,2) | YES | NULL | Line gross |
| sort_order | integer | NO | 0 | Sort order |
| created_at | timestamp | NO | now() | Creation time |

### contract_participants

Parties involved in contracts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| contract_id | varchar | NO | - | FK to contract_instances |
| participant_type | varchar(20) | NO | - | customer, billing_company, internal_witness, guarantor |
| full_name | text | NO | - | Full name |
| email | text | YES | NULL | Email |
| phone | text | YES | NULL | Phone |
| address | text | YES | NULL | Address |
| personal_id | text | YES | NULL | Personal ID |
| company_id | text | YES | NULL | IČO |
| tax_id | text | YES | NULL | DIČ |
| vat_number | text | YES | NULL | IČ DPH |
| role | varchar(50) | YES | NULL | signer, witness, authorized_representative |
| signature_required | boolean | NO | false | Signature required |
| signed_at | timestamp | YES | NULL | Signed time |
| created_at | timestamp | NO | now() | Creation time |

### contract_signature_requests

Signature collection with OTP verification.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| contract_id | varchar | NO | - | FK to contract_instances |
| participant_id | varchar | NO | - | FK to contract_participants |
| signer_name | text | NO | - | Signer name |
| signer_email | text | YES | NULL | Signer email |
| signer_phone | text | YES | NULL | Signer phone |
| verification_method | varchar(20) | NO | 'email_otp' | email_otp, sms_otp, both |
| otp_code | varchar(10) | YES | NULL | OTP code |
| otp_expires_at | timestamp | YES | NULL | OTP expiry |
| otp_verified_at | timestamp | YES | NULL | OTP verification time |
| otp_attempts | integer | NO | 0 | OTP attempts |
| signature_type | varchar(20) | NO | 'drawn' | drawn, uploaded, typed |
| signature_data | text | YES | NULL | Base64 signature |
| signature_hash | text | YES | NULL | SHA-256 hash |
| request_sent_at | timestamp | YES | NULL | Request sent |
| signed_at | timestamp | YES | NULL | Signed time |
| signer_ip_address | text | YES | NULL | IP address |
| signer_user_agent | text | YES | NULL | User agent |
| status | varchar(20) | NO | 'pending' | pending, sent, otp_verified, signed, expired, cancelled |
| expires_at | timestamp | YES | NULL | Expiry time |
| created_at | timestamp | NO | now() | Creation time |

### contract_audit_log

Complete audit trail for contracts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| contract_id | varchar | NO | - | FK to contract_instances |
| action | varchar(50) | NO | - | created, updated, sent, viewed, otp_sent, otp_verified, signed, completed, cancelled |
| actor_id | varchar | YES | NULL | FK to users |
| actor_type | varchar(20) | NO | 'user' | user, system, customer |
| actor_name | text | YES | NULL | Actor name |
| actor_email | text | YES | NULL | Actor email |
| ip_address | text | YES | NULL | IP address |
| user_agent | text | YES | NULL | User agent |
| details | text | YES | NULL | JSON details |
| previous_value | text | YES | NULL | Previous state |
| new_value | text | YES | NULL | New state |
| created_at | timestamp | NO | now() | Creation time |

### variable_blocks

Variable categories for templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| code | varchar(50) | NO | - | Unique code (e.g., "customer") |
| display_name | text | NO | - | Slovak display name |
| display_name_en | text | YES | NULL | English display name |
| description | text | YES | NULL | Description |
| icon | varchar(50) | YES | NULL | Lucide icon name |
| priority | integer | YES | 0 | Sort order |
| is_active | boolean | YES | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### variables

Template variables from forms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| block_id | varchar | NO | - | FK to variable_blocks |
| key | varchar(100) | NO | - | Variable key (e.g., "customer.fullName") |
| label | text | NO | - | Slovak label |
| label_en | text | YES | NULL | English label |
| description | text | YES | NULL | Description |
| data_type | varchar(20) | NO | 'text' | text, date, number, boolean, email, phone, address, iban |
| source_form | varchar(100) | YES | NULL | Source form |
| example | text | YES | NULL | Example value |
| is_computed | boolean | YES | false | Computed field |
| compute_expression | text | YES | NULL | Computation expression |
| is_required | boolean | YES | false | Required field |
| is_deprecated | boolean | YES | false | Deprecated field |
| default_value | text | YES | NULL | Default value |
| priority | integer | YES | 0 | Sort order |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### variable_keywords

Keywords for block matching.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| block_id | varchar | NO | - | FK to variable_blocks |
| keyword | varchar(100) | NO | - | Keyword to match |
| locale | varchar(5) | NO | 'sk' | Language |
| weight | integer | YES | 1 | Match weight |
| is_exact | boolean | YES | false | Exact match |
| created_at | timestamp | NO | now() | Creation time |

---

## Communication (Email/SMS)

### communication_messages

Email and SMS sent to customers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | YES | NULL | FK to customers |
| user_id | varchar | YES | NULL | FK to users |
| type | text | NO | - | email, sms |
| direction | text | NO | 'outbound' | outbound, inbound |
| subject | text | YES | NULL | Email subject |
| content | text | NO | - | Message content |
| recipient_email | text | YES | NULL | Recipient email |
| recipient_phone | text | YES | NULL | Recipient phone |
| sender_phone | text | YES | NULL | Sender phone (SMS) |
| status | text | NO | 'pending' | pending, sent, delivered, failed |
| external_id | text | YES | NULL | Provider message ID |
| provider | text | YES | NULL | bulkgate, sendgrid, etc. |
| delivery_status | text | YES | NULL | Delivery status |
| error_message | text | YES | NULL | Error message |
| sent_at | timestamp | YES | NULL | Sent time |
| delivered_at | timestamp | YES | NULL | Delivery time |
| created_at | timestamp | NO | now() | Creation time |
| ai_analyzed | boolean | YES | false | AI analyzed |
| ai_sentiment | text | YES | NULL | positive, neutral, negative, angry |
| ai_alert_level | text | YES | NULL | none, warning, critical |
| ai_has_angry_tone | boolean | YES | NULL | Angry tone detected |
| ai_has_rude_expressions | boolean | YES | NULL | Rude expressions |
| ai_wants_to_cancel | boolean | YES | NULL | Cancel intent |
| ai_wants_consent | boolean | YES | NULL | Consent intent |
| ai_does_not_accept_contract | boolean | YES | NULL | Contract rejection |
| ai_analysis_note | text | YES | NULL | AI notes |
| ai_analyzed_at | timestamp | YES | NULL | Analysis time |

### user_ms365_connections

MS365 OAuth connections per user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users (unique, CASCADE) |
| access_token | text | NO | - | OAuth access token |
| refresh_token | text | YES | NULL | OAuth refresh token |
| token_expires_at | timestamp | YES | NULL | Token expiry |
| account_id | text | YES | NULL | MSAL account ID |
| email | text | NO | - | Connected email |
| display_name | text | YES | NULL | Display name |
| is_connected | boolean | NO | true | Connection status |
| last_sync_at | timestamp | YES | NULL | Last sync |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### user_ms365_shared_mailboxes

Shared mailbox access.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| connection_id | varchar | NO | - | FK to user_ms365_connections (CASCADE) |
| user_id | varchar | NO | - | FK to users (CASCADE) |
| email | text | NO | - | Shared mailbox email |
| display_name | text | NO | - | Display name |
| is_default | boolean | NO | false | Default mailbox |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### email_signatures

HTML email signatures.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users (CASCADE) |
| mailbox_email | text | NO | - | 'personal' or shared mailbox email |
| html_content | text | NO | '' | HTML signature |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### email_routing_rules

Email routing and processing rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Rule name |
| description | text | YES | NULL | Description |
| is_active | boolean | NO | true | Active status |
| priority | integer | NO | 0 | Execution order |
| stop_processing | boolean | NO | false | Stop after match |
| conditions | jsonb | NO | [] | JSON conditions array |
| match_mode | text | NO | 'all' | 'all' or 'any' |
| actions | jsonb | NO | [] | JSON actions array |
| mailbox_filter | text[] | YES | {} | Target mailboxes |
| auto_assign_customer | boolean | NO | true | Auto-assign to customer |
| enable_ai_analysis | boolean | NO | false | Enable AI analysis |
| ai_pipeline_actions | jsonb | YES | NULL | AI pipeline actions |
| created_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### email_tags

Custom email tags.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Unique tag name |
| color | text | NO | '#6B7280' | Hex color |
| description | text | YES | NULL | Description |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### email_metadata

Routing results and tags for emails.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| message_id | text | NO | - | MS Graph message ID |
| mailbox_email | text | NO | - | Mailbox email |
| priority | text | YES | 'normal' | low, normal, high, urgent |
| importance | text | YES | 'normal' | low, normal, high |
| tags | text[] | YES | {} | Array of tag names |
| matched_rules | text[] | YES | {} | Matched rule IDs |
| customer_id | varchar | YES | NULL | FK to customers |
| is_processed | boolean | NO | false | Processed flag |
| processed_at | timestamp | YES | NULL | Process time |
| ai_analyzed | boolean | NO | false | AI analyzed |
| ai_sentiment | text | YES | NULL | Sentiment |
| ai_has_inappropriate_content | boolean | NO | false | Inappropriate content |
| ai_alert_level | text | YES | NULL | Alert level |
| ai_analysis_note | text | YES | NULL | AI notes |
| ai_analyzed_at | timestamp | YES | NULL | Analysis time |
| ai_has_angry_tone | boolean | NO | false | Angry tone |
| ai_has_rude_expressions | boolean | NO | false | Rude expressions |
| ai_wants_to_cancel | boolean | NO | false | Cancel intent |
| ai_wants_consent | boolean | NO | false | Consent intent |
| ai_does_not_accept_contract | boolean | NO | false | Contract rejection |
| ai_pipeline_action_taken | boolean | NO | false | Pipeline action taken |
| ai_pipeline_stage_id | varchar | YES | NULL | Target stage ID |
| ai_pipeline_stage_name | varchar | YES | NULL | Stage name |
| ai_pipeline_action_reason | text | YES | NULL | Action reason |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### customer_email_notifications

Email notifications in customer detail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| customer_id | varchar | NO | - | FK to customers (CASCADE) |
| message_id | text | NO | - | MS Graph message ID |
| mailbox_email | text | NO | - | Mailbox email |
| subject | text | NO | - | Email subject |
| sender_email | text | NO | - | Sender email |
| sender_name | text | YES | NULL | Sender name |
| recipient_email | text | YES | NULL | Recipient (outbound) |
| direction | text | NO | 'inbound' | inbound, outbound |
| body_preview | text | YES | NULL | Body preview |
| received_at | timestamp | NO | - | Received time |
| priority | text | YES | 'normal' | Priority |
| is_read | boolean | NO | false | Read status |
| read_at | timestamp | YES | NULL | Read time |
| read_by | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |

### gsm_sender_configs

SMS sender configuration per country.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| country_code | varchar(10) | NO | - | Unique country code |
| sender_id_type | varchar(20) | NO | - | gSystem, gShort, gText, gMobile, gPush, gOwn, gProfile |
| sender_id_value | varchar(50) | YES | NULL | Sender value |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

---

## Notifications & Tasks

### notifications

User notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| type | text | NO | - | new_email, new_sms, new_customer, status_change, sentiment_alert, task_assigned, task_due, task_completed, mention, system |
| title | text | NO | - | Title |
| message | text | NO | - | Message |
| priority | text | NO | 'normal' | low, normal, high, urgent |
| entity_type | text | YES | NULL | Related entity type |
| entity_id | varchar | YES | NULL | Related entity ID |
| is_read | boolean | NO | false | Read status |
| dismissed | boolean | NO | false | Dismissed status |
| created_at | timestamp | NO | now() | Creation time |

### notification_rules

Automated notification rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| name | text | NO | - | Rule name |
| description | text | YES | NULL | Description |
| trigger_type | text | NO | - | Trigger type |
| trigger_config | text | YES | NULL | JSON config |
| notification_type | text | NO | - | Notification type |
| notification_priority | text | NO | 'normal' | Priority |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### tasks

Tasks assigned to users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| title | text | NO | - | Task title |
| description | text | YES | NULL | Description |
| due_date | timestamp | YES | NULL | Due date |
| priority | text | NO | 'medium' | low, medium, high, urgent |
| status | text | NO | 'pending' | pending, in_progress, completed, cancelled |
| assigned_user_id | varchar | NO | - | FK to users |
| created_by_user_id | varchar | NO | - | FK to users |
| customer_id | varchar | YES | NULL | FK to customers |
| country | text | YES | NULL | Country filter |
| resolution | text | YES | NULL | Resolution notes |
| resolved_by_user_id | varchar | YES | NULL | FK to users |
| resolved_at | timestamp | YES | NULL | Resolution time |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### task_comments

Comments on tasks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| task_id | varchar | NO | - | FK to tasks |
| user_id | varchar | NO | - | FK to users |
| content | text | NO | - | Comment content |
| created_at | timestamp | NO | now() | Creation time |

### activity_logs

User action audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| action | text | NO | - | login, logout, create, update, delete, view, export, consent_granted, consent_revoked |
| entity_type | text | YES | NULL | customer, product, invoice, user, consent, etc. |
| entity_id | varchar | YES | NULL | Entity ID |
| entity_name | text | YES | NULL | Entity name |
| details | text | YES | NULL | JSON details |
| ip_address | text | YES | NULL | IP address |
| created_at | timestamp | NO | now() | Creation time |

### saved_searches

User saved filter presets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| name | text | NO | - | Search name |
| module | text | NO | - | customers, collaborators, hospitals, etc. |
| filters | text | NO | - | JSON filter criteria |
| is_default | boolean | NO | false | Default search |
| created_at | timestamp | NO | now() | Creation time |

### chat_messages

Direct messages between users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| sender_id | varchar | NO | - | FK to users |
| receiver_id | varchar | NO | - | FK to users |
| content | text | NO | - | Message content |
| is_read | boolean | NO | false | Read status |
| created_at | timestamp | NO | now() | Creation time |

---

## Mobile App (INDEXUS Connect)

### visit_events

Field visit records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| collaborator_id | varchar | NO | - | FK to collaborators |
| country_code | text | NO | - | Country |
| subject | text | NO | - | Visit type code (1-12) |
| start_time | timestamp | NO | - | Start time |
| end_time | timestamp | NO | - | End time |
| is_all_day | boolean | NO | false | All-day event |
| latitude | decimal(10,7) | YES | NULL | GPS latitude |
| longitude | decimal(10,7) | YES | NULL | GPS longitude |
| location_address | text | YES | NULL | Geocoded address |
| hospital_id | varchar | YES | NULL | FK to hospitals |
| remark | text | YES | NULL | Remark/notes |
| remark_voice_url | text | YES | NULL | Voice recording URL |
| remark_detail | text | YES | NULL | Visited person type (1-7) |
| visit_type | text | YES | NULL | Visit type (1-12) |
| place | text | YES | NULL | Place (1-6) |
| status | text | NO | 'scheduled' | scheduled, in_progress, completed, cancelled, not_realized |
| actual_start | timestamp | YES | NULL | Actual start time |
| actual_end | timestamp | YES | NULL | Actual end time |
| start_latitude | decimal(10,7) | YES | NULL | Start GPS latitude |
| start_longitude | decimal(10,7) | YES | NULL | Start GPS longitude |
| end_latitude | decimal(10,7) | YES | NULL | End GPS latitude |
| end_longitude | decimal(10,7) | YES | NULL | End GPS longitude |
| is_cancelled | boolean | NO | false | Cancelled flag |
| is_not_realized | boolean | NO | false | Not realized flag |
| synced_from_mobile | boolean | NO | false | Mobile sync flag |
| mobile_device_info | text | YES | NULL | Device info |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### voice_notes

Voice recordings for visits.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| visit_event_id | varchar | NO | - | FK to visit_events |
| collaborator_id | varchar | NO | - | FK to collaborators |
| file_path | text | NO | - | Audio file path |
| file_name | text | YES | NULL | File name |
| duration_seconds | integer | YES | NULL | Duration |
| file_size | integer | YES | NULL | File size |
| transcription | text | YES | NULL | Whisper transcription |
| is_transcribed | boolean | NO | false | Transcribed flag |
| transcription_language | text | YES | NULL | Language |
| created_at | timestamp | NO | now() | Creation time |

### mobile_push_tokens

Push notification tokens.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| collaborator_id | varchar | NO | - | FK to collaborators |
| token | text | NO | - | Push token |
| platform | text | NO | - | ios, android, expo |
| device_id | text | YES | NULL | Device ID |
| device_name | text | YES | NULL | Device name |
| is_active | boolean | NO | true | Active status |
| last_used_at | timestamp | YES | NULL | Last used |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

---

## Configuration & Settings

### complaint_types

Customer complaint types.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Type name |
| country_code | text | YES | NULL | null = global |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### cooperation_types

Customer cooperation types.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Type name |
| country_code | text | YES | NULL | null = global |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### vip_statuses

Customer VIP statuses.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Status name |
| country_code | text | YES | NULL | null = global |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### health_insurance_companies

Health insurance companies per country.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Company name |
| code | text | NO | - | Company code |
| country_code | text | NO | - | Country |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### laboratories

Laboratories per country.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Laboratory name |
| country_code | text | NO | - | Country |
| is_active | boolean | NO | true | Active status |
| created_at | timestamp | NO | now() | Creation time |

### departments

Organizational structure.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| name | text | NO | - | Department name |
| description | text | YES | NULL | Description |
| parent_id | varchar | YES | NULL | FK to self (hierarchy) |
| sort_order | integer | NO | 0 | Sort order |
| is_active | boolean | NO | true | Active status |
| contact_first_name | text | YES | NULL | Contact first name |
| contact_last_name | text | YES | NULL | Contact last name |
| contact_email | text | YES | NULL | Contact email |
| contact_phone | text | YES | NULL | Contact phone |
| created_at | timestamp | NO | now() | Creation time |

### service_configurations

Service configurations for Konfigurator.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| service_code | text | NO | - | Service code |
| service_name | text | NO | - | Display name |
| description | text | YES | NULL | Description |
| country_code | text | NO | - | Country |
| is_active | boolean | NO | true | Active status |
| invoiceable | boolean | NO | false | Can be invoiced |
| collectable | boolean | NO | false | Can be collected |
| storable | boolean | NO | false | Can be stored |
| base_price | decimal(12,2) | YES | NULL | Base price |
| currency | text | NO | 'EUR' | Currency |
| vat_rate | decimal(5,2) | YES | NULL | VAT rate |
| processing_days | integer | YES | NULL | Processing time |
| storage_years | integer | YES | NULL | Storage duration |
| additional_options | text | YES | NULL | JSON options |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### service_instances

Service instances with invoicing config.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| service_id | varchar | NO | - | FK to service_configurations |
| name | text | NO | - | Instance name |
| from_date | date | YES | NULL | Valid from |
| to_date | date | YES | NULL | Valid to |
| invoice_identifier | text | YES | NULL | Invoice ID |
| is_active | boolean | NO | true | Active status |
| certificate_template | text | YES | NULL | Certificate template |
| description | text | YES | NULL | Description |
| billing_details_id | varchar | YES | NULL | FK to billing_details |
| allow_proforma_invoices | boolean | NO | false | Allow proforma |
| invoicing_period_years | integer | YES | 1 | Invoicing period |
| constant_symbol | text | YES | NULL | Constant symbol |
| start_invoicing_field | text | YES | 'REALIZED' | Start invoicing |
| end_invoicing_field | text | YES | NULL | End invoicing |
| accounting_id_offset | integer | YES | NULL | Accounting offset |
| ledger_account_proforma | text | YES | NULL | Proforma ledger |
| ledger_account_invoice | text | YES | NULL | Invoice ledger |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

### sip_settings

Global SIP server configuration (singleton).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| server | text | NO | '' | SIP server |
| port | integer | NO | 5060 | SIP port |
| ws_port | integer | NO | 8089 | WebSocket port |
| ws_path | text | NO | '/ws' | WebSocket path |
| transport | text | NO | 'wss' | ws, wss, tcp, udp |
| realm | text | YES | '' | Realm |
| stun_server | text | YES | '' | STUN server |
| turn_server | text | YES | '' | TURN server |
| turn_username | text | YES | '' | TURN username |
| turn_password | text | YES | '' | TURN password |
| is_enabled | boolean | NO | false | Enabled status |
| updated_at | timestamp | NO | now() | Last update |
| updated_by | varchar | YES | NULL | FK to users |

### call_logs

SIP call logs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| user_id | varchar | NO | - | FK to users |
| customer_id | varchar | YES | NULL | FK to customers |
| campaign_id | varchar | YES | NULL | FK to campaigns |
| campaign_contact_id | varchar | YES | NULL | FK to campaign_contacts |
| phone_number | text | NO | - | Phone number |
| direction | text | NO | 'outbound' | inbound, outbound |
| status | text | NO | 'initiated' | initiated, ringing, answered, completed, failed, no_answer, busy, cancelled |
| started_at | timestamp | NO | now() | Start time |
| answered_at | timestamp | YES | NULL | Answer time |
| ended_at | timestamp | YES | NULL | End time |
| duration_seconds | integer | YES | 0 | Duration |
| sip_call_id | text | YES | NULL | SIP call ID |
| notes | text | YES | NULL | Notes |
| metadata | text | YES | NULL | JSON metadata |
| created_at | timestamp | NO | now() | Creation time |

### country_system_settings

System settings per country for automated emails/SMS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| country_code | varchar(10) | NO | - | Unique country code |
| system_email_enabled | boolean | NO | false | Email enabled |
| system_email_address | varchar(255) | YES | NULL | MS365 email |
| system_email_display_name | varchar(100) | YES | NULL | Display name |
| system_email_user_id | varchar(255) | YES | NULL | MS365 user ID |
| system_sms_enabled | boolean | NO | false | SMS enabled |
| system_sms_sender_type | varchar(20) | YES | NULL | SMS sender type |
| system_sms_sender_value | varchar(50) | YES | NULL | SMS sender value |
| alerts_enabled | boolean | NO | true | Alerts enabled |
| notifications_enabled | boolean | NO | true | Notifications enabled |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

---

## System Tables

### ms365_pkce_store

OAuth PKCE code verifier storage.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| state | text | NO | - | OAuth state |
| code_verifier | text | NO | - | PKCE code verifier |
| user_id | varchar | YES | NULL | FK to users |
| created_at | timestamp | NO | now() | Creation time |
| expires_at | timestamp | NO | - | Expiry time |

### system_ms365_connections

System-level MS365 connections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key |
| country_code | varchar(10) | NO | - | Unique country code |
| access_token | text | NO | - | OAuth access token |
| refresh_token | text | YES | NULL | Refresh token |
| token_expires_at | timestamp | YES | NULL | Token expiry |
| account_id | text | YES | NULL | MSAL account ID |
| email | text | NO | - | Connected email |
| display_name | text | YES | NULL | Display name |
| is_connected | boolean | NO | true | Connection status |
| last_sync_at | timestamp | YES | NULL | Last sync |
| created_at | timestamp | NO | now() | Creation time |
| updated_at | timestamp | NO | now() | Last update |

---

## Relationships Diagram

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                         CORE ENTITIES                            │
                    └─────────────────────────────────────────────────────────────────┘
                    
                    ┌──────────┐          ┌──────────────┐          ┌──────────────┐
                    │  users   │◄────────►│    roles     │◄────────►│  departments │
                    └────┬─────┘          └──────────────┘          └──────────────┘
                         │                       │
                         │                       ▼
                         │              ┌─────────────────────┐
                         │              │ role_module_perms   │
                         │              │ role_field_perms    │
                         │              │ user_roles          │
                         │              └─────────────────────┘
                         │
    ┌────────────────────┼────────────────────────────────────────────────────────────┐
    │                    │                                                             │
    ▼                    ▼                    ▼                    ▼                   │
┌──────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────────┐          │
│ customers │◄────►│ collaborators│     │  hospitals  │      │   products   │          │
└────┬─────┘      └──────┬──────┘      └──────┬──────┘      └──────┬───────┘          │
     │                   │                    │                    │                   │
     │                   │                    │                    ▼                   │
     │                   │                    │     ┌──────────────────────────────┐   │
     │                   │                    │     │ market_product_instances     │   │
     │                   │                    │     │ market_product_services      │   │
     │                   │                    │     │ instance_prices              │   │
     │                   │                    │     │ instance_payment_options     │   │
     │                   │                    │     │ instance_discounts           │   │
     │                   │                    │     │ instance_vat_rates           │   │
     │                   │                    │     │ product_sets                 │   │
     │                   │                    │     └──────────────────────────────┘   │
     │                   │                    │                                        │
     ▼                   ▼                    ▼                    ▼                   │
┌────────────────┐  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐          │
│customer_notes  │  │collab_addresses│ │   clinics    │  │billing_details  │          │
│customer_consents│ │collab_other    │  └──────────────┘ │billing_accounts │          │
│customer_products│ │collab_agreements│                  │billing_couriers │          │
│potential_cases │  │visit_events    │                   │billing_labs     │          │
└────────────────┘  │voice_notes     │                   └─────────────────┘          │
                    │mobile_push_tokens                                                │
                    └───────────────┘                                                  │
                                                                                       │
    ┌──────────────────────────────────────────────────────────────────────────────────┘
    │                         SALES & MARKETING
    ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│  campaigns   │◄────►│ campaign_    │      │   pipelines      │
│              │      │ contacts     │      │   pipeline_stages│
│              │      │ contact_hist │      │   deals          │
│              │      │ sessions     │      │   deal_activities│
│              │      │ schedules    │      │   deal_products  │
│              │      │ operators    │      │   automation_rules│
│              │      │ metrics      │      └──────────────────┘
└──────────────┘      │ templates    │
                      └──────────────┘

    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                         CONTRACTS & INVOICING                                     │
    ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│contract_categories│     │contract_templates│      │contract_instances│
│category_defaults  │     │template_versions │      │instance_products │
└──────────────────┘      │variable_blocks   │      │participants      │
                          │variables         │      │signature_requests│
                          │variable_keywords │      │audit_log         │
                          └──────────────────┘      └──────────────────┘

┌──────────────────┐      ┌──────────────────┐
│   invoices       │      │ invoice_templates│
│   invoice_items  │      │ invoice_layouts  │
└──────────────────┘      │ number_ranges    │
                          └──────────────────┘

    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                         COMMUNICATION                                             │
    ▼
┌───────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│communication_messages │   │user_ms365_connections│   │email_routing_rules  │
│customer_email_notifs  │   │ms365_shared_mailboxes│   │email_tags           │
│                       │   │email_signatures      │   │email_metadata       │
└───────────────────────┘   └──────────────────────┘   └─────────────────────┘

┌──────────────────────┐    ┌──────────────────────┐
│gsm_sender_configs    │    │country_system_settings│
│sip_settings          │    │                      │
│call_logs             │    └──────────────────────┘
└──────────────────────┘
```

---

## Indexes

Most tables have automatic indexes on primary keys. Additional recommended indexes:

```sql
-- Customers
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_assigned_user ON customers(assigned_user_id);
CREATE INDEX idx_customers_lead_score ON customers(lead_score DESC);

-- Collaborators
CREATE INDEX idx_collaborators_country ON collaborators(country_code);
CREATE INDEX idx_collaborators_hospital ON collaborators(hospital_id);
CREATE INDEX idx_collaborators_mobile_enabled ON collaborators(mobile_app_enabled);

-- Hospitals
CREATE INDEX idx_hospitals_country ON hospitals(country_code);
CREATE INDEX idx_hospitals_active ON hospitals(is_active);

-- Clinics
CREATE INDEX idx_clinics_country ON clinics(country_code);
CREATE INDEX idx_clinics_city ON clinics(city);
CREATE INDEX idx_clinics_active ON clinics(is_active);

-- Campaigns
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);

-- Deals
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_customer ON deals(customer_id);

-- Contracts
CREATE INDEX idx_contract_instances_customer ON contract_instances(customer_id);
CREATE INDEX idx_contract_instances_status ON contract_instances(status);

-- Communication
CREATE INDEX idx_communication_customer ON communication_messages(customer_id);
CREATE INDEX idx_communication_type ON communication_messages(type);
CREATE INDEX idx_email_metadata_message ON email_metadata(message_id);
CREATE INDEX idx_email_metadata_customer ON email_metadata(customer_id);

-- Activity Logs
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- Visit Events
CREATE INDEX idx_visit_events_collaborator ON visit_events(collaborator_id);
CREATE INDEX idx_visit_events_hospital ON visit_events(hospital_id);
CREATE INDEX idx_visit_events_status ON visit_events(status);
CREATE INDEX idx_visit_events_start ON visit_events(start_time);
```

---

## Notes

1. **UUIDs**: Most primary keys use `gen_random_uuid()` for globally unique identifiers
2. **Soft Deletes**: Tables use `is_active` boolean instead of hard deletes
3. **Audit Trail**: `activity_logs` and various `*_audit_log` tables track changes
4. **Multi-tenancy**: `country_code` fields enable multi-country data segregation
5. **Cascading**: Foreign keys with `CASCADE` delete related records automatically
6. **JSON Fields**: `jsonb` columns store flexible configurations (automation rules, email routing)
7. **Array Columns**: PostgreSQL arrays used for multi-value fields (countries, tags)
8. **Decimal Precision**: Financial amounts use `decimal(10,2)` or `decimal(12,2)`
9. **Timestamps**: All tables include `created_at`, many include `updated_at`
10. **Legacy Support**: Some tables have `legacy_id` for data migration from old systems
