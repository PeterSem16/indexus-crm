-- ============================================================
-- INDEXUS CRM — Production Check Script
-- Spusti: PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f indexus_check.sql
-- ============================================================

\echo '============================================================'
\echo 'INDEXUS CRM — Record Counts & Control Check'
\echo '============================================================'

-- ============================================================
-- 1. CUSTOMERS
-- ============================================================
\echo ''
\echo '--- CUSTOMERS ---'

SELECT
  COUNT(*) AS total_customers,
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at,
  COUNT(*) FILTER (WHERE country = 'DE') AS de,
  COUNT(*) FILTER (WHERE country = 'IT') AS it,
  COUNT(*) FILTER (WHERE country IS NULL OR country = '') AS no_country
FROM customers;

\echo 'Sources (ISCBC migration check):'
SELECT
  COALESCE(source, 'NULL') AS source,
  COUNT(*) AS count
FROM customers
GROUP BY source
ORDER BY count DESC;

\echo 'Kontrola — zákazníci bez telefónu aj emailu:'
SELECT COUNT(*) AS customers_no_contact
FROM customers
WHERE (phone IS NULL OR phone = '') AND (email IS NULL OR email = '');

\echo 'Kontrola — zákazníci bez krajiny:'
SELECT COUNT(*) AS customers_no_country
FROM customers
WHERE country IS NULL OR country = '';

\echo 'Kontrola — zákazníci bez poistovne:'
SELECT COUNT(*) AS customers_no_insurance
FROM customers
WHERE health_insurance_id IS NULL;

\echo 'Kontrola — duplicity podľa emailu (email s viac ako 1 zákazníkom):'
SELECT COUNT(*) AS duplicate_email_groups
FROM (
  SELECT email FROM customers WHERE email IS NOT NULL AND email != ''
  GROUP BY email HAVING COUNT(*) > 1
) x;

-- ============================================================
-- 2. CONTRACTS
-- ============================================================
\echo ''
\echo '--- CONTRACTS ---'

SELECT
  COUNT(*) AS total_contracts,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired,
  COUNT(*) FILTER (WHERE status IS NULL) AS no_status
FROM contracts;

SELECT
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at,
  COUNT(*) FILTER (WHERE country = 'DE') AS de,
  COUNT(*) FILTER (WHERE country = 'IT') AS it
FROM contracts;

\echo 'Kontrola — zmluvy bez čísla zmluvy:'
SELECT COUNT(*) AS contracts_no_number
FROM contracts
WHERE contract_number IS NULL OR contract_number = '';

\echo 'Kontrola — zmluvy bez zákazníka:'
SELECT COUNT(*) AS orphan_contracts
FROM contracts c
LEFT JOIN customers cu ON cu.id = c.customer_id
WHERE cu.id IS NULL;

-- ============================================================
-- 3. COLLECTIONS
-- ============================================================
\echo ''
\echo '--- COLLECTIONS ---'

SELECT
  COUNT(*) AS total_collections,
  COUNT(*) FILTER (WHERE status = 'registered') AS registered,
  COUNT(*) FILTER (WHERE status = 'collected') AS collected,
  COUNT(*) FILTER (WHERE status = 'received') AS received,
  COUNT(*) FILTER (WHERE status = 'processed') AS processed,
  COUNT(*) FILTER (WHERE status = 'stored') AS stored
FROM collections;

SELECT
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at
FROM collections;

\echo 'Kontrola — odbery bez dátumu:'
SELECT COUNT(*) AS collections_no_date
FROM collections
WHERE collection_date IS NULL;

\echo 'Kontrola — odbery bez väzby na zmluvu:'
SELECT COUNT(*) AS orphan_collections
FROM collections c
LEFT JOIN contracts co ON co.id = c.contract_id
WHERE co.id IS NULL AND c.contract_id IS NOT NULL;

\echo 'Kontrola — odbery v stave registered > 30 dní:'
SELECT COUNT(*) AS stale_registered
FROM collections
WHERE status = 'registered'
  AND collection_date < NOW() - INTERVAL '30 days';

-- ============================================================
-- 4. INVOICES
-- ============================================================
\echo ''
\echo '--- INVOICES ---'

SELECT
  COUNT(*) AS total_invoices,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft,
  COUNT(*) FILTER (WHERE status = 'issued') AS issued,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid,
  COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM invoices;

SELECT
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at
FROM invoices;

\echo 'Kontrola — faktúry bez čísla faktúry:'
SELECT COUNT(*) AS invoices_no_number
FROM invoices
WHERE invoice_number IS NULL OR invoice_number = '';

\echo 'Kontrola — faktúry issued > 60 dní (nezaplatené):'
SELECT COUNT(*) AS overdue_risk
FROM invoices
WHERE status = 'issued'
  AND created_at < NOW() - INTERVAL '60 days';

\echo 'Kontrola — faktúry s nulovou total_amount:'
SELECT COUNT(*) AS zero_amount_invoices
FROM invoices
WHERE total_amount = 0 OR total_amount IS NULL;

\echo 'Faktúry — celkové sumy podľa krajiny a stavu:'
SELECT country, status, COUNT(*) AS count, ROUND(SUM(total_amount::numeric), 2) AS total
FROM invoices
WHERE total_amount IS NOT NULL
GROUP BY country, status
ORDER BY country, status;

-- ============================================================
-- 5. HEALTHCARE NETWORK
-- ============================================================
\echo ''
\echo '--- HEALTHCARE NETWORK ---'

\echo 'Nemocnice:'
SELECT
  COUNT(*) AS total_hospitals,
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at
FROM hospitals;

\echo 'Kliniky:'
SELECT
  COUNT(*) AS total_clinics,
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu,
  COUNT(*) FILTER (WHERE country = 'AT') AS at
FROM clinics;

\echo 'Spolupracovníci (Collaborators):'
SELECT
  COUNT(*) AS total_collaborators,
  COUNT(*) FILTER (WHERE country = 'SK') AS sk,
  COUNT(*) FILTER (WHERE country = 'CZ') AS cz,
  COUNT(*) FILTER (WHERE country = 'HU') AS hu
FROM collaborators;

\echo 'Kontrola — kliniky bez regiónu:'
SELECT COUNT(*) AS clinics_no_region
FROM clinics
WHERE region IS NULL OR region = '';

\echo 'Kontrola — nemocnice bez kliník:'
SELECT COUNT(*) AS hospitals_no_clinics
FROM hospitals h
LEFT JOIN clinics c ON c.hospital_id = h.id
WHERE c.id IS NULL;

-- ============================================================
-- 6. NEXUS — KOMUNIKÁCIA
-- ============================================================
\echo ''
\echo '--- NEXUS COMMUNICATION ---'

\echo 'Správy (Email/SMS):'
SELECT
  COUNT(*) AS total_messages,
  COUNT(*) FILTER (WHERE type = 'email') AS email,
  COUNT(*) FILTER (WHERE type = 'sms') AS sms,
  COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
  COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound
FROM communication_messages;

\echo 'Kampane:'
SELECT
  COUNT(*) AS total_campaigns,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'paused') AS paused,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft
FROM campaigns;

\echo 'Kampaňové kontakty:'
SELECT COUNT(*) AS total_campaign_contacts FROM campaign_contacts;

\echo 'Tasks:'
SELECT
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE status = 'open') AS open,
  COUNT(*) FILTER (WHERE status = 'done') AS done,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') AS overdue
FROM tasks;

\echo 'SOP Articles:'
SELECT COUNT(*) AS total_sop FROM sop_articles;

\echo 'Hovorové záznamy:'
SELECT COUNT(*) AS total_call_logs FROM call_logs;

\echo 'Visit Events:'
SELECT COUNT(*) AS total_visits FROM visit_events;

-- ============================================================
-- 7. USER MANAGEMENT
-- ============================================================
\echo ''
\echo '--- USER MANAGEMENT ---'

SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE is_active = true) AS active,
  COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) AS inactive
FROM users;

\echo 'Používatelia per krajina:'
SELECT
  COALESCE(country, 'NULL') AS country,
  COUNT(*) AS count
FROM users
GROUP BY country
ORDER BY count DESC;

\echo 'Roly:'
SELECT COUNT(*) AS total_roles FROM roles;

\echo 'Kontrola — aktívni používatelia bez roly:'
SELECT COUNT(*) AS users_no_role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role_id IS NULL AND u.is_active = true;

-- ============================================================
-- 8. PRODUCTS & CONFIGURATION
-- ============================================================
\echo ''
\echo '--- PRODUCTS & CONFIG ---'

SELECT COUNT(*) AS total_products FROM products;
SELECT COUNT(*) AS total_instances FROM market_product_instances;

\echo 'Instancie per krajina:'
SELECT
  COALESCE(country, 'NULL') AS country,
  COUNT(*) AS count
FROM market_product_instances
GROUP BY country
ORDER BY count DESC;

SELECT COUNT(*) AS billing_companies FROM billing_company_accounts;
SELECT COUNT(*) AS invoice_templates FROM invoice_templates;
SELECT COUNT(*) AS message_templates FROM message_templates;
SELECT COUNT(*) AS web_forms FROM web_forms;
SELECT COUNT(*) AS web_form_submissions FROM web_form_submissions;
SELECT COUNT(*) AS automation_rules FROM automation_rules;

-- ============================================================
-- SUMMARY
-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SUMMARY — Rýchly prehľad'
\echo '============================================================'

SELECT 'customers' AS module, COUNT(*) AS records FROM customers
UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'hospitals', COUNT(*) FROM hospitals
UNION ALL SELECT 'clinics', COUNT(*) FROM clinics
UNION ALL SELECT 'collaborators', COUNT(*) FROM collaborators
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'campaign_contacts', COUNT(*) FROM campaign_contacts
UNION ALL SELECT 'communication_messages', COUNT(*) FROM communication_messages
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'call_logs', COUNT(*) FROM call_logs
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'invoices_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'web_form_submissions', COUNT(*) FROM web_form_submissions
UNION ALL SELECT 'visit_events', COUNT(*) FROM visit_events
UNION ALL SELECT 'sop_articles', COUNT(*) FROM sop_articles
ORDER BY records DESC;
