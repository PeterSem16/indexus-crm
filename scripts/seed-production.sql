-- INDEXUS CRM Production Seed Data
-- Run this after: npm run db:push
-- Usage: psql $DATABASE_URL < scripts/seed-production.sql

-- ============================================
-- 1. DEPARTMENTS
-- ============================================
INSERT INTO departments (id, name, description, parent_id, sort_order, is_active) VALUES
('41298830-9730-487c-a706-4f7c702860d7', 'Root', 'Root department', NULL, 0, true),
('a8829a5f-6c67-456d-983c-4c6d6f032ce0', 'Management & Executive', 'Management & Executive', '41298830-9730-487c-a706-4f7c702860d7', 0, true),
('4ce2f131-7e80-492f-b2d1-600681a6ac9e', 'Customer Service', '', 'a8829a5f-6c67-456d-983c-4c6d6f032ce0', 0, true),
('563ad42c-9490-4071-a8d9-2aa4cfb5866f', 'IT & Infrastructure', '', 'a8829a5f-6c67-456d-983c-4c6d6f032ce0', 0, true),
('29ac9f39-17ae-416a-bb41-fd049b75ec57', 'Laboratories & medical', '', 'a8829a5f-6c67-456d-983c-4c6d6f032ce0', 0, true),
('a596c804-3b50-4d58-83aa-8c49b063be7a', 'Sales', '', 'a8829a5f-6c67-456d-983c-4c6d6f032ce0', 0, true),
('a9340bfc-5625-4d54-b8eb-8e67eea12bf2', 'Call centrum', '', 'a596c804-3b50-4d58-83aa-8c49b063be7a', 0, true),
('ac064337-65af-47c7-b34c-d5f0c7750c84', 'Finance', '', NULL, 0, true),
('d67ed1b4-0fa1-49f6-a514-0371f838d221', 'Accountant', '', 'ac064337-65af-47c7-b34c-d5f0c7750c84', 0, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. ROLES
-- ============================================
INSERT INTO roles (id, name, description, department, is_active, is_system, legacy_role) VALUES
('79aa3568-c3be-4ae0-8488-e686ba66e061', 'Administrator', 'Full access to all modules and features', '563ad42c-9490-4071-a8d9-2aa4cfb5866f', true, true, 'admin'),
('9ab86324-bb34-4886-94cf-b58b76f19dcd', 'Manager', 'Dashboard access only', 'a8829a5f-6c67-456d-983c-4c6d6f032ce0', true, true, 'manager'),
('267c8e41-f8fb-4311-a0aa-c3ca78ef1735', 'User', 'Access to operational modules', 'a596c804-3b50-4d58-83aa-8c49b063be7a', true, true, 'user'),
('b81523f5-3306-40ad-9173-5962fe499fa3', 'Call Centrum', 'Základné oprávnenie pre call centrum', 'a9340bfc-5625-4d54-b8eb-8e67eea12bf2', true, false, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. USERS (default password: Admin123!)
-- Password hash: $2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.
-- ============================================
INSERT INTO users (id, username, email, full_name, auth_method, is_active, role_id, password_hash) VALUES
('67467ce3-7a44-4f67-a3d3-6a251e2991e5', 'admin', 'seman@cordbloodcenter.com', 'System Administrator', 'local', true, '79aa3568-c3be-4ae0-8488-e686ba66e061', '$2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.'),
('62b874a9-d7b5-4432-bf74-8a62c0815218', 'seman', 'seman@dialcom.sk', 'Peter Seman', 'local', true, '79aa3568-c3be-4ae0-8488-e686ba66e061', '$2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.'),
('95c58392-d61e-41e2-b5d3-ed1f9d93147d', 'michal.kollar', 'michal.kollar@cordbloodcenter.com', 'Michal Kollár', 'ms365', true, '79aa3568-c3be-4ae0-8488-e686ba66e061', '$2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.'),
('aba4129a-6634-49b7-addd-a433a54b5852', 'kollar', 'kollar@cordbloodcenter.com', 'Martin Kollár', 'local', true, '9ab86324-bb34-4886-94cf-b58b76f19dcd', '$2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. PRODUCTS
-- ============================================
INSERT INTO products (id, name, description, is_active, countries) VALUES
('f008b2e8-2262-45c5-93f7-d0316b9978b5', 'Pupočníková krv', 'Odber pupočníkovej krvi', true, '{SK,CZ,HU,RO,IT}'),
('c6358bef-acc1-439e-94e9-3b6ef5d22767', 'Pupočníková krv + tkanivo', '', true, '{SK,CZ,HU,RO,IT}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. PIPELINES
-- ============================================
INSERT INTO pipelines (id, name, description, country_codes, is_default, is_active) VALUES
('pipeline_1767879545493', 'Hlavný predajný proces', 'Štandardný predajný proces pre cord blood služby', '{SK,CZ,HU,RO,IT,DE,US,CH}', true, true),
('pipeline_1767959903065', 'VIP customers', '', '{SK,CZ,HU,RO,IT,DE,US,CH}', false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. PIPELINE STAGES
-- ============================================
INSERT INTO pipeline_stages (id, pipeline_id, name, color, "order", probability, is_won_stage, is_lost_stage, rotting_days) VALUES
('stage_1767879545500_0', 'pipeline_1767879545493', 'Lead', '#6b7280', 0, 10, false, false, 14),
('stage_1767879545512_1', 'pipeline_1767879545493', 'Kvalifikovaný', '#ec4899', 1, 25, false, false, 14),
('stage_1767879545517_2', 'pipeline_1767879545493', 'Návrh', '#8b5cf6', 2, 50, false, false, NULL),
('stage_1767879545522_3', 'pipeline_1767879545493', 'Vyjednávanie', '#f59e0b', 3, 75, false, false, NULL),
('stage_1767879545526_4', 'pipeline_1767879545493', 'Vyhraný', '#22c55e', 4, 100, true, false, NULL),
('stage_1767879545530_5', 'pipeline_1767879545493', 'Stratený', '#ef4444', 5, 0, false, true, NULL),
('stage_1767961221208', 'pipeline_1767959903065', 'Lead', '#3b82f6', 0, 60, false, false, 14),
('stage_1767961257984', 'pipeline_1767959903065', 'Kvalifikovaný', '#10b981', 1, 90, false, false, 14),
('stage_1767961277475', 'pipeline_1767959903065', 'Návrh', '#8b5cf6', 2, 10, false, false, 14),
('stage_1767961308145', 'pipeline_1767959903065', 'Vyjednávanie', '#ef4444', 3, 90, false, false, 14)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. BILLING DETAILS
-- ============================================
INSERT INTO billing_details (id, country_code, company_name, code, entity_code, invoice_barcode_letter, vat_rate, currency, payment_terms, default_payment_term, is_default, is_active, country_codes, residency_country) VALUES
('3297c2df-f072-49ea-9e9d-f14b7effed0d', 'SK', 'Cord Blood Center s.r.o.', 'CBC_SK', '19', 'B', 20.00, 'EUR', '{7,14,30}', 7, false, true, '{SK}', 'SK'),
('1bc11f8c-5ac8-46f9-87ba-f4c80d4f0224', 'CZ', 'Cord Blood Center CZ s.r.o.', 'CBC_CZ', '49', NULL, 20.00, 'CZK', '{7,14,30}', 14, true, true, '{CZ}', NULL),
('8b525887-1bcb-47f6-989f-d5f42f3cd992', 'SK', 'CBC AG', 'CBC_AG', '71', 'G', 20.00, 'EUR', '{7,14,30}', 14, true, true, '{SK,CZ,HU,RO,IT}', 'CH'),
('cccdf791-9956-4198-b5cb-99e114116847', 'SK', 'Slovenský register placentárnych krvotvorných buniek. Občianske združenie', 'EUROCORD', '11', 'X', 20.00, 'EUR', '{7,14,30}', 14, false, true, '{SK,CZ,HU,RO,IT}', 'SK')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. COUNTRY SYSTEM SETTINGS
-- ============================================
INSERT INTO country_system_settings (id, country_code, system_email_enabled, system_email_address, system_email_display_name, system_sms_enabled, system_sms_sender_type, system_sms_sender_value, alerts_enabled, notifications_enabled) VALUES
('fbc2ab74-2b82-4034-9d0a-910360d79cfb', 'SK', true, 'noreply@cordbloodcenter.sk', 'INDEXUS systém', true, 'gText', 'Indexus', true, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE
-- ============================================
-- Default credentials:
--   Username: admin, seman, kollar
--   Password: Admin123!
-- 
-- Note: Change passwords after first login!
