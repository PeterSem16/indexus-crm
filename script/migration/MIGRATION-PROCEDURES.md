# INDEXUS CRM — Migračné procedúry

## Prehľad

Existujú dve migračné procedúry pre prenos dát z ISCBC (MSSQL `CBC` databáza, server `10.1.2.2:1433`) do INDEXUS PostgreSQL.

---

## Procedúra A: Plná migrácia (vymazanie testovacích dát + migrácia)

**Účel**: Vymaže všetky testovacie dáta v moduloch Customers, Contracts, Invoices a spustí čistú migráciu z CBC. Ponechá testovacieho klienta **Peter Seman** pre potreby testovania.

**Čo sa vymaže:**
- `scheduled_invoices` — všetky testovacie (created_by != 'migration-v20' a nie viazané na Peter Seman)
- `invoice_payments`, `invoice_items`, `invoices` — všetky (okrem viazaných na Peter Seman)
- `contract_instances` — všetky (okrem viazaných na Peter Seman)
- `customer_debt_collection` — všetky
- `customer_documents` — všetky (typ invoice/contract, okrem viazaných na Peter Seman)
- `customer_notes`, `communication_messages` — všetky (okrem viazaných na Peter Seman)
- `customer_potential_cases` — všetky (okrem viazaných na Peter Seman)
- `customers` — všetky okrem Peter Seman

**Čo sa UPSERTUJE (update ak existuje, insert ak nie):**
- `collaborators` + `collaborator_addresses` + `collaborator_agreements` + `collaborator_activities`
- `collections` + `collection_lab_results`
- `hospitals`

**Čo sa resetuje (číselníky):**
- `number_ranges.last_number_used` → 0 (pre všetky aktívne číselné rady typu invoice, proforma, contract)

### Spustenie — Procedúra A

```bash
cd /var/www/indexus-crm && git pull && npm run build && npx drizzle-kit push --force

# 1. Plný cleanup (vymaže všetko okrem Peter Seman)
node script/migration/cleanup-full-migration.cjs

# 2. Migrácia zo 100 CBC klientov
MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs 2>&1 | tee /tmp/migration-v20-full.txt

# 3. Reštart aplikácie
pm2 restart indexus-crm
```

### Celý príkaz na jeden riadok:

```bash
cd /var/www/indexus-crm && git pull && npm run build && npx drizzle-kit push --force && node script/migration/cleanup-full-migration.cjs && MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs 2>&1 | tee /tmp/migration-v20-full.txt && pm2 restart indexus-crm
```

---

## Procedúra B: Inkrementálna migrácia (ponechanie testovacích dát)

**Účel**: Ponechá existujúce testovacie dáta vo všetkých moduloch. Vymaže iba predchádzajúce migrované dáta (s príznakom `data_source = 'iscbc'` alebo `legacy_id IS NOT NULL`) a spustí novú migráciu.

**Čo sa vymaže:**
- Iba záznamy s `data_source = 'iscbc'`, `legacy_id IS NOT NULL`, `created_by = 'migration-v20'`
- Testovacie dáta vytvorené manuálne v UI zostávajú nedotknuté

**Čo sa UPSERTUJE:**
- `collaborators`, `hospitals`, `collections` — update ak existuje s legacy_id, insert ak nie

**Číselníky sa NErresetujú** — pokračujú od aktuálnej hodnoty.

### Spustenie — Procedúra B

```bash
cd /var/www/indexus-crm && git pull && npm run build && npx drizzle-kit push --force

# 1. Cleanup iba migrovaných dát
node script/migration/cleanup-test-migration.cjs

# 2. Migrácia zo 100 CBC klientov
MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs 2>&1 | tee /tmp/migration-v20.txt

# 3. Reštart aplikácie
pm2 restart indexus-crm
```

### Celý príkaz na jeden riadok:

```bash
cd /var/www/indexus-crm && git pull && npm run build && npx drizzle-kit push --force && node script/migration/cleanup-test-migration.cjs && MIGRATION_LIMIT=100 node script/migration/test-migration-20.cjs 2>&1 | tee /tmp/migration-v20.txt && pm2 restart indexus-crm
```

---

## Porovnanie procedúr

| Aspekt | Procedúra A (Plná) | Procedúra B (Inkrementálna) |
|--------|-------------------|---------------------------|
| Testovacie dáta | Vymazané (okrem Peter Seman) | Ponechané |
| Migrované dáta | Vymazané a znovu naimportované | Vymazané a znovu naimportované |
| Číselníky (number_ranges) | Resetované na 0 | Nedotknuté |
| Collaborators | Upsert | Upsert |
| Hospitals | Upsert | Upsert |
| Collections | Upsert | Upsert |
| Peter Seman | Ponechaný | Ponechaný |
| Použitie | Čistý štart pred produkciou | Iteratívne testovanie migrácie |

---

## Technické detaily

### Pripojenie MSSQL (CBC)
- Server: `10.1.2.2`, Port: `1433`, DB: `CBC`
- User: `cbcuser`, Password: `XqU0nNND`

### Pripojenie PostgreSQL (INDEXUS)
- Host: `localhost`, Port: `5432`, DB: `indexus_crm`
- User: `indexus`, Password: `HanyurIfKisck`

### Migračný skript: `test-migration-20.cjs`
- 13 krokov (Steps 1-13)
- Premenná `MIGRATION_LIMIT` — počet klientov na migráciu (default: 100)
- Označenie: `data_source = 'iscbc'`, `created_by = 'migration-v20'`
- Billing dáta: CompanyDetails (IČO/DIČ/IČ DPH), CompanyAccounts (IBAN/SWIFT), VATs (sadzby DPH)

### Cleanup skripty
- `cleanup-test-migration.cjs` — Procedúra B (len migrované dáta)
- `cleanup-full-migration.cjs` — Procedúra A (všetko okrem Peter Seman + reset číselníkov)

### Overenie migrácie
```bash
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "
  SELECT 'customers' as tbl, count(*) FROM customers WHERE internal_id IS NOT NULL
  UNION ALL SELECT 'contracts', count(*) FROM contract_instances WHERE data_source = 'iscbc'
  UNION ALL SELECT 'invoices', count(*) FROM invoices WHERE data_source = 'iscbc'
  UNION ALL SELECT 'scheduled_inv', count(*) FROM scheduled_invoices WHERE created_by = 'migration-v20'
  UNION ALL SELECT 'collections', count(*) FROM collections WHERE legacy_id IS NOT NULL
  UNION ALL SELECT 'collaborators', count(*) FROM collaborators WHERE legacy_id IS NOT NULL
  UNION ALL SELECT 'hospitals', count(*) FROM hospitals WHERE legacy_id IS NOT NULL
  ORDER BY tbl;
"
```
