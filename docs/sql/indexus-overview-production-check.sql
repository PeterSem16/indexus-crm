-- INDEXUS overview: read-only production evidence, 2026-09-14
-- Run with psql, using your existing authorized connection. Never embed a password.
-- No customer identities, message contents, financial account details or credentials.
-- Counts are evidence of data presence, not proof of deployed functionality.
\set ON_ERROR_STOP on
\pset pager off
\timing on
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '3s';
SELECT current_timestamp AS checked_at, current_setting('transaction_read_only') AS read_only;

-- Expected tables: missing tables stay visible in this inventory.
WITH expected(table_name) AS (VALUES ('customers'),('contract_instances'),('contract_instance_products'),('collections'),('collection_lab_results'),('laboratories'),('invoices'),('invoice_items'),('scheduled_invoices'),('pricing_products'),('pricing_components'),('pricing_product_components'),('pricing_price_lists'),('pricing_collection_prices'),('pricing_storage_prices'),('pricing_incomplete_rules'),('pricing_installment_plans'),('pricing_customer_price_lists'),('campaigns'),('campaign_contacts'),('call_logs'))
SELECT table_name, to_regclass(format('public.%I',table_name)) IS NOT NULL AS exists_on_server FROM expected ORDER BY table_name;

-- Exact totals only for tables which exist.
WITH expected(table_name) AS (VALUES ('customers'),('contract_instances'),('contract_instance_products'),('collections'),('collection_lab_results'),('laboratories'),('invoices'),('invoice_items'),('scheduled_invoices'),('pricing_products'),('pricing_components'),('pricing_product_components'),('pricing_price_lists'),('pricing_collection_prices'),('pricing_storage_prices'),('pricing_incomplete_rules'),('pricing_installment_plans'),('pricing_customer_price_lists'),('campaigns'),('campaign_contacts'),('call_logs'))
SELECT format('SELECT %L AS table_name, count(*) AS row_count FROM public.%I;',table_name,table_name)
FROM expected WHERE to_regclass(format('public.%I',table_name)) IS NOT NULL ORDER BY table_name
\gexec

-- Each aggregate is guarded by its required schema. SKIPPED is not a zero.
WITH checks(ord,check_name,sql_text,requirements) AS (VALUES
(1, 'Cenniky podla krajiny a stavu', 'SELECT country_code, status, count(*) AS price_lists FROM public.pricing_price_lists GROUP BY country_code,status ORDER BY country_code,status;', '{"pricing_price_lists":["country_code","status"]}'::jsonb),
(2, 'Zakaznici s priradenou cenovou verziou', 'SELECT count(*) AS assignments, count(DISTINCT customer_id) AS assigned_customers, count(DISTINCT price_list_id) AS referenced_price_lists FROM public.pricing_customer_price_lists;', '{"pricing_customer_price_lists":["customer_id","price_list_id"]}'::jsonb),
(3, 'Pokrytie cien odberu', 'SELECT count(DISTINCT price_list_id) AS price_lists_with_collection_prices, count(*) AS price_rows FROM public.pricing_collection_prices;', '{"pricing_collection_prices":["price_list_id"]}'::jsonb),
(4, 'Pokrytie skladneho', 'SELECT count(DISTINCT price_list_id) AS price_lists_with_storage_prices, count(*) AS price_rows FROM public.pricing_storage_prices;', '{"pricing_storage_prices":["price_list_id"]}'::jsonb),
(5, 'Pokrytie matice', 'SELECT count(DISTINCT price_list_id) AS price_lists_with_incomplete_rules, count(*) AS rules FROM public.pricing_incomplete_rules;', '{"pricing_incomplete_rules":["price_list_id"]}'::jsonb),
(6, 'Zmluvy podla stavu', 'SELECT status, count(*) AS contracts FROM public.contract_instances GROUP BY status ORDER BY status;', '{"contract_instances":["status"]}'::jsonb),
(7, 'Zmluvy podla meny', 'SELECT currency, count(*) AS contracts FROM public.contract_instances GROUP BY currency ORDER BY currency;', '{"contract_instances":["currency"]}'::jsonb),
(8, 'Odbery chybajuce vazby', 'SELECT count(*) AS collections, count(*) FILTER (WHERE contract_id IS NULL) AS without_contract, count(*) FILTER (WHERE product_id IS NULL) AS without_product, count(*) FILTER (WHERE laboratory_id IS NULL) AS without_lab FROM public.collections;', '{"collections":["contract_id","product_id","laboratory_id"]}'::jsonb),
(9, 'Odbery neexistujuca zmluva', 'SELECT count(*) AS orphan_contract_links FROM public.collections c WHERE c.contract_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contract_instances t WHERE t.id=c.contract_id);', '{"collections":["contract_id"],"contract_instances":["id"]}'::jsonb),
(10, 'Odbery podla stavu', 'SELECT status, count(*) AS collections FROM public.collections GROUP BY status ORDER BY status;', '{"collections":["status"]}'::jsonb),
(11, 'Laboratorne vysledky', 'SELECT count(*) AS results, count(DISTINCT collection_id) AS collections_with_results, count(*) FILTER (WHERE client_result_id IS NULL) AS without_external_result_id FROM public.collection_lab_results;', '{"collection_lab_results":["collection_id","client_result_id"]}'::jsonb),
(12, 'Odbery s viacerymi vysledkami - moze ist o legitimnu historiu', 'SELECT count(*) AS collections_with_multiple_results, coalesce(sum(n-1),0) AS additional_result_rows FROM (SELECT collection_id,count(*) AS n FROM public.collection_lab_results GROUP BY collection_id HAVING count(*)>1) x;', '{"collection_lab_results":["collection_id"]}'::jsonb),
(13, 'Vysledky bez existujuceho odberu', 'SELECT count(*) AS orphan_lab_results FROM public.collection_lab_results r WHERE NOT EXISTS (SELECT 1 FROM public.collections c WHERE c.id=r.collection_id);', '{"collection_lab_results":["collection_id"],"collections":["id"]}'::jsonb),
(14, 'Aktivne laboratoria podla krajiny', 'SELECT country_code,is_active,count(*) AS laboratories FROM public.laboratories GROUP BY country_code,is_active ORDER BY country_code,is_active;', '{"laboratories":["country_code","is_active"]}'::jsonb),
(15, 'Faktury podla krajiny a stavu', 'SELECT customer_country,status,count(*) AS invoices FROM public.invoices GROUP BY customer_country,status ORDER BY customer_country,status;', '{"invoices":["customer_country","status"]}'::jsonb),
(16, 'Faktury podla meny', 'SELECT currency,count(*) AS invoices FROM public.invoices GROUP BY currency ORDER BY currency;', '{"invoices":["currency"]}'::jsonb),
(17, 'Faktury podla zdroja', 'SELECT data_source,count(*) AS invoices FROM public.invoices GROUP BY data_source ORDER BY data_source;', '{"invoices":["data_source"]}'::jsonb),
(18, 'Faktury bez zmluvy', 'SELECT count(*) AS invoices, count(*) FILTER (WHERE contract_instance_id IS NULL) AS without_contract FROM public.invoices;', '{"invoices":["contract_instance_id"]}'::jsonb),
(19, 'Faktury bez poloziek', 'SELECT count(*) AS invoices_without_items FROM public.invoices i WHERE NOT EXISTS (SELECT 1 FROM public.invoice_items t WHERE t.invoice_id=i.id);', '{"invoices":["id"],"invoice_items":["invoice_id"]}'::jsonb),
(20, 'Polozky bez faktury', 'SELECT count(*) AS orphan_invoice_items FROM public.invoice_items t WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=t.invoice_id);', '{"invoices":["id"],"invoice_items":["invoice_id"]}'::jsonb),
(21, 'Planovane faktury', 'SELECT status,count(*) AS scheduled FROM public.scheduled_invoices GROUP BY status ORDER BY status;', '{"scheduled_invoices":["status"]}'::jsonb),
(22, 'Planovane faktury oznacene created bez dokladu', 'SELECT count(*) AS created_without_invoice_link FROM public.scheduled_invoices WHERE status=''created'' AND created_invoice_id IS NULL;', '{"scheduled_invoices":["status","created_invoice_id"]}'::jsonb)
), checked AS (
 SELECT *, NOT EXISTS (
   SELECT 1 FROM jsonb_each(requirements) AS r(table_name,columns)
   WHERE to_regclass(format('public.%I',r.table_name)) IS NULL
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.columns) AS wanted(column_name)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=wanted.column_name))
 ) AS available FROM checks
)
SELECT CASE WHEN available
 THEN format('SELECT %L AS check_name;',check_name) || E'\n' || sql_text
 ELSE format('SELECT %L AS check_name, %L AS result;',check_name,'SKIPPED - required table or column is absent') END
FROM checked ORDER BY ord
\gexec
COMMIT;
