-- Medical Partner Network - Seed Data
-- Partner Categories, Communication Schedules, First Contact Protocols, Migration

-- ========== 1. PARTNER CATEGORIES ==========
INSERT INTO partner_categories (id, code, name, name_en, entity_scope, sort_order, is_active) VALUES
  (gen_random_uuid(), 'hospital_director', 'Riaditeľ nemocnice', 'Hospital Director', 'hospital', 1, true),
  (gen_random_uuid(), 'department_head', 'Vedúci pôrodníckeho oddelenia', 'Department Head', 'hospital', 2, true),
  (gen_random_uuid(), 'head_nurse', 'Hlavná/vrchná sestra pôrodníckeho oddelenia', 'Head Nurse', 'hospital', 3, true),
  (gen_random_uuid(), 'delivery_midwife', 'Pôrodné asistentky/hebamme', 'Delivery Midwife', 'hospital', 4, true),
  (gen_random_uuid(), 'department_doctor', 'Lekári pôrodníckeho oddelenia', 'Department Doctor', 'hospital', 5, true),
  (gen_random_uuid(), 'department_nurse', 'Sestry pôrodníckeho oddelenia', 'Department Nurse', 'hospital', 6, true),
  (gen_random_uuid(), 'ambulant_gynecologist', 'Ambulantní gynekológovia', 'Ambulatory Gynecologist', 'clinic', 7, true),
  (gen_random_uuid(), 'ambulant_nurse', 'Ambulantné sestry', 'Ambulatory Nurse', 'clinic', 8, true),
  (gen_random_uuid(), 'independent_midwife', 'Midwives/Hebamme – samostatne podnikajúce', 'Independent Midwife', 'independent', 9, true),
  (gen_random_uuid(), 'doctor_undefined', 'Lekár – nedefinovaný', 'Doctor Undefined', 'hospital', 10, true)
ON CONFLICT (code) DO NOTHING;

-- ========== 2. COMMUNICATION SCHEDULES ==========
-- Riaditel nemocnice: osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'in_person', 12, true FROM partner_categories WHERE code = 'hospital_director';

-- Veduci oddelenia: osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'in_person', 12, true FROM partner_categories WHERE code = 'department_head';

-- Hlavna sestra: telefon 3m, osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'phone', 3, true FROM partner_categories WHERE code = 'head_nurse';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'in_person', 12, true FROM partner_categories WHERE code = 'head_nurse';

-- Lekar v nemocnici: telefon 3m, osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'phone', 3, true FROM partner_categories WHERE code = 'department_doctor';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'in_person', 12, true FROM partner_categories WHERE code = 'department_doctor';

-- Porodne asistentky: telefon 3m, osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'phone', 3, true FROM partner_categories WHERE code = 'delivery_midwife';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, NULL, 'in_person', 12, true FROM partner_categories WHERE code = 'delivery_midwife';

-- Ambulantny gynekolog A: telefon 3m, osobne 6m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'A', 'phone', 3, true FROM partner_categories WHERE code = 'ambulant_gynecologist';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'A', 'in_person', 6, true FROM partner_categories WHERE code = 'ambulant_gynecologist';

-- Ambulantny gynekolog B: telefon 3m, osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'B', 'phone', 3, true FROM partner_categories WHERE code = 'ambulant_gynecologist';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'B', 'in_person', 12, true FROM partner_categories WHERE code = 'ambulant_gynecologist';

-- Ambulantny gynekolog C: email 12m, telefon 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'C', 'email', 12, true FROM partner_categories WHERE code = 'ambulant_gynecologist';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'C', 'phone', 12, true FROM partner_categories WHERE code = 'ambulant_gynecologist';

-- Midwife A: telefon 3m, osobne 6m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'A', 'phone', 3, true FROM partner_categories WHERE code = 'independent_midwife';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'A', 'in_person', 6, true FROM partner_categories WHERE code = 'independent_midwife';

-- Midwife B: telefon 3m, osobne 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'B', 'phone', 3, true FROM partner_categories WHERE code = 'independent_midwife';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'B', 'in_person', 12, true FROM partner_categories WHERE code = 'independent_midwife';

-- Midwife C: email 12m, telefon 12m
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'C', 'email', 12, true FROM partner_categories WHERE code = 'independent_midwife';
INSERT INTO communication_schedules (id, category_id, subcategory, channel_type, frequency_months, is_active)
SELECT gen_random_uuid(), id, 'C', 'phone', 12, true FROM partner_categories WHERE code = 'independent_midwife';

-- ========== 3. FIRST CONTACT PROTOCOLS ==========

-- Riaditel nemocnice
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Oslovenie a návrh na spoluprácu pri zabezpečení odberov pupočníkovej krvi (CB), tkaniva pupočníka (CT) a placenty (PT) s vysvetlením navrhovaných podmienok spolupráce.',
  ARRAY['Návrh zmluvy s prílohami', 'Informácia o privátnom bankingu CB, CT, PT'], true
FROM partner_categories WHERE code = 'hospital_director';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 2, 'Komunikácia s Nemocnicou podľa požiadaviek riaditeľa do uzavretia zmluvy.', ARRAY[]::text[], true
FROM partner_categories WHERE code = 'hospital_director';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 3, 'Poďakovanie za uzavretie zmluvy.', ARRAY[]::text[], true
FROM partner_categories WHERE code = 'hospital_director';

-- Veduci oddelenia
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Stretnutie po dohode s riaditeľom nemocnice – informovanie o spoločnosti, vysvetlenie podmienok spolupráce, predloženie SOP, vysvetlenie postupu pri odbere, postup pri auditoch a postup pri zaškoľovaní odberových pracovníkov.',
  ARRAY['SOP pre odber', 'Inštruktážny materiál k odberu'], true
FROM partner_categories WHERE code = 'department_head';

-- Hlavna sestra
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Stretnutie po dohode s vedúcim pôrodníckeho oddelenia – informovanie o spoločnosti, vysvetlenie podmienok spolupráce, predloženie SOP, vysvetlenie postupu pri odbere, postup pri auditoch a postup pri zaškoľovaní odberových pracovníkov.',
  ARRAY['SOP pre odber', 'Inštruktážny materiál k odberu', 'Informačný materiál o firme a poskytovanej službe pre gynekológa'], true
FROM partner_categories WHERE code = 'head_nurse';

-- Lekari porodnickeho oddelenia
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Stretnutie po dohode s vedúcim oddelenia – informovanie o spoločnosti, vysvetlenie podmienok spolupráce, predloženie SOP, vysvetlenie postupu pri odbere.',
  ARRAY['SOP pre odber', 'Inštruktážny materiál k odberu', 'Informačný materiál o firme a poskytovanej službe pre gynekológa'], true
FROM partner_categories WHERE code = 'department_doctor';

-- Sestry porodneho oddelenia
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Stretnutie po dohode s vedúcim oddelenia – informovanie o spoločnosti, vysvetlenie podmienok spolupráce, predloženie SOP, vysvetlenie postupu pri odbere.',
  ARRAY['SOP pre odber', 'Inštruktážny materiál k odberu', 'Informačný materiál o firme a poskytovanej službe pre gynekológa'], true
FROM partner_categories WHERE code = 'department_nurse';

-- Ambulantni gynekologovia
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Oslovenie (listom alebo telefonicky alebo osobne) a informovanie o činnosti spoločnosti, vrátane noviniek medicínskych a firemných.',
  ARRAY['Templát listu pre gynekológa', 'Informačný materiál o firme a službe pre gynekológa', 'Formulár v CRM o návšteve'], true
FROM partner_categories WHERE code = 'ambulant_gynecologist';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 2, 'Spýtať sa či by spoločnosť mohla distribuovať informačné materiály v jeho ambulancii.', ARRAY[]::text[], true
FROM partner_categories WHERE code = 'ambulant_gynecologist';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 3, 'V prípade záujmu o inú spoluprácu (distribúcia odberových kitov, vyšetrenia klientke pred pôrodom a po pôrode), predstaviť ju.',
  ARRAY['Informačný materiál k iným formám spolupráce'], true
FROM partner_categories WHERE code = 'ambulant_gynecologist';

-- Midwives
INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 1, 'Oslovenie (listom alebo telefonicky alebo osobne) a informovanie o činnosti spoločnosti, vrátane noviniek medicínskych a firemných.',
  ARRAY['Templát listu pre gynekológa', 'Informačný materiál o firme a službe pre gynekológa', 'Formulár v CRM o návšteve'], true
FROM partner_categories WHERE code = 'independent_midwife';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 2, 'Spýtať sa či by spoločnosť mohla distribuovať informačné materiály v jeho ambulancii.', ARRAY[]::text[], true
FROM partner_categories WHERE code = 'independent_midwife';

INSERT INTO first_contact_protocols (id, category_id, step_order, description, required_documents, is_active)
SELECT gen_random_uuid(), id, 3, 'V prípade záujmu o inú spoluprácu (distribúcia odberových kitov, vyšetrenia klientke pred pôrodom a po pôrode), predstaviť ju.',
  ARRAY['Informačný materiál k iným formám spolupráce'], true
FROM partner_categories WHERE code = 'independent_midwife';

-- ========== 4. MIGRATE EXISTING COLLABORATOR DATA ==========

-- 4a. Create contact_assignments from collaborators who have hospitalId
INSERT INTO contact_assignments (id, person_id, entity_type, entity_id, category_id, department, position, is_primary, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'hospital',
  c.hospital_id,
  NULL,
  NULL,
  NULL,
  true,
  c.is_active,
  c.created_at,
  c.updated_at
FROM collaborators c
WHERE c.hospital_id IS NOT NULL
  AND c.hospital_id != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_assignments ca
    WHERE ca.person_id = c.id AND ca.entity_id = c.hospital_id AND ca.entity_type = 'hospital'
  );

-- 4b. Create contact_assignments from collaborators.hospital_ids array
INSERT INTO contact_assignments (id, person_id, entity_type, entity_id, is_primary, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'hospital',
  unnest(c.hospital_ids),
  false,
  c.is_active,
  c.created_at,
  c.updated_at
FROM collaborators c
WHERE array_length(c.hospital_ids, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM contact_assignments ca
    WHERE ca.person_id = c.id AND ca.entity_type = 'hospital'
  );

-- 4c. Create contact_channels from collaborators.phone
INSERT INTO contact_channels (id, person_id, channel_type, value, label, is_primary, is_active, created_at)
SELECT gen_random_uuid(), id, 'phone', phone, 'Hlavný telefón', true, true, created_at
FROM collaborators
WHERE phone IS NOT NULL AND phone != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_channels cc WHERE cc.person_id = collaborators.id AND cc.channel_type = 'phone' AND cc.value = collaborators.phone
  );

-- 4d. Create contact_channels from collaborators.mobile
INSERT INTO contact_channels (id, person_id, channel_type, value, label, is_primary, is_active, created_at)
SELECT gen_random_uuid(), id, 'mobile', mobile, 'Mobil', true, true, created_at
FROM collaborators
WHERE mobile IS NOT NULL AND mobile != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_channels cc WHERE cc.person_id = collaborators.id AND cc.channel_type = 'mobile' AND cc.value = collaborators.mobile
  );

-- 4e. Create contact_channels from collaborators.mobile_2
INSERT INTO contact_channels (id, person_id, channel_type, value, label, is_primary, is_active, created_at)
SELECT gen_random_uuid(), id, 'mobile', mobile_2, 'Mobil 2', false, true, created_at
FROM collaborators
WHERE mobile_2 IS NOT NULL AND mobile_2 != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_channels cc WHERE cc.person_id = collaborators.id AND cc.channel_type = 'mobile' AND cc.value = collaborators.mobile_2
  );

-- 4f. Create contact_channels from collaborators.email
INSERT INTO contact_channels (id, person_id, channel_type, value, label, is_primary, is_active, created_at)
SELECT gen_random_uuid(), id, 'email', email, 'Hlavný email', true, true, created_at
FROM collaborators
WHERE email IS NOT NULL AND email != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_channels cc WHERE cc.person_id = collaborators.id AND cc.channel_type = 'email' AND cc.value = collaborators.email
  );

-- 4g. Create contact_channels from collaborators.other_contact
INSERT INTO contact_channels (id, person_id, channel_type, value, label, is_primary, is_active, created_at)
SELECT gen_random_uuid(), id, 'phone', other_contact, 'Iný kontakt', false, true, created_at
FROM collaborators
WHERE other_contact IS NOT NULL AND other_contact != ''
  AND NOT EXISTS (
    SELECT 1 FROM contact_channels cc WHERE cc.person_id = collaborators.id AND cc.value = collaborators.other_contact
  );
