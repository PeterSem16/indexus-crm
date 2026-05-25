# INDEXUS CRM — Prehľad modulov, Control Check & Plán úprav

> **Dátum:** Máj 2026  
> **Produkčný server:** CORPCRM01 (77.72.181.113)  
> **Databáza:** indexus_crm · 205 tabuliek  
> **Dokument je editovateľný — časy a návrhy uprav podľa potreby**

---

## Súhrnná tabuľka záznamov (produkcia)

| Modul | Tabuľka | Počet záznamov |
|-------|---------|----------------|
| Komunikácia | communication_messages | **1 163 268** |
| Zmluvy | contract_instances | **236 935** |
| Odbery | collections | **198 066** |
| Zákazníci | customers | **165 462** |
| Spolupracovníci | collaborators | **14 887** |
| Kliniky | clinics | **10 078** |
| Nemocnice | hospitals | **1 213** |
| Hovorový log | call_logs | **1 087** |
| Kampaňové kontakty | campaign_contacts | **734** |
| Návštevy | visit_events | **29** |
| SOP články | sop_articles | **25** |
| Položky faktúr | invoice_items | **15** |
| Používatelia | users | **12** |
| Web form submissions | web_form_submissions | **10** |
| Deals | deals | **10** |
| Úlohy | tasks | **9** |
| Kampane | campaigns | **5** |
| Produkty | products | **3** |
| **Faktúry** | **invoices** | **⚠️ 0** |

---

## 🔴 Kritické nálezy

| # | Nález | Detail |
|---|-------|--------|
| 1 | **Žiadne faktúry** | Tabuľka `invoices` má 0 záznamov — fakturácia nebola spustená alebo nie je prepojená |
| 2 | **Všetci zákazníci bez poistovne** | 165 448 z 165 462 zákazníkov nemá priradenú poistovňu (health_insurance_id = NULL) |
| 3 | **Používatelia bez RBAC roly** | Všetkých 12 používateľov nemá záznam v `user_roles` (používajú priamy `role` stĺpec) |
| 4 | **89 odberov bez zmluvy** | `contract_id = NULL` na 89 záznamoch v collections |

---

## 1. ZÁKAZNÍCI (customers)

### Stav

| Krajina | Počet |
|---------|-------|
| RO | 78 912 |
| SK | 57 461 |
| HU | 16 961 |
| CZ | 9 777 |
| IT | 1 196 |
| AT | 717 |
| Ostatné | 438 |
| **Spolu** | **165 462** |

- Migrácia ISCBC: **165 448** zákazníkov s `data_source = iscbc` ✅
- Zákazníci bez telefónu aj emailu: **0** ✅
- Zákazníci bez krajiny: **0** ✅
- Zákazníci bez poistovne: **165 448** ⚠️

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Import zdravotných poisťovní pre existujúcich zákazníkov (SK, CZ, HU) | ___ dní |
| Vysoká | Aktivácia web form registrácie (6 web_form submissions — testovanie prebehlo) | ___ dní |
| Stredná | Segmentácia zákazníkov podľa krajiny a zdroja pre kampane | ___ dní |
| Nízka | Čistenie 14 záznamov bez data_source | ___ hodín |

**Predpokladaný dátum dokončenia:** ___________

---

## 2. ZMLUVY (contract_instances)

### Stav

| Status | Počet |
|--------|-------|
| completed | 221 467 |
| cancelled | 14 118 |
| signed | 671 |
| sent | 645 |
| pending_signature | 25 |
| draft | 9 |
| **Spolu** | **236 935** |

- Zmluvy bez zákazníka: **0** ✅
- Čakajúce na podpis: **25** ⚠️
- Draft (nedokončené): **9** ⚠️

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Overiť 25 zmlúv s `pending_signature` — sú stále aktuálne? | ___ hodín |
| Vysoká | Overiť 9 zmlúv v `draft` stave — dokončiť alebo zmazať | ___ hodín |
| Stredná | Automatické upozornenie pri zmluvách dlho v `sent` stave | ___ dní |
| Nízka | Automatická obnova zmlúv pri vypršaní | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 3. ODBERY (collections)

### Stav

| Krajina | Počet |
|---------|-------|
| RO | 91 502 |
| SK | 74 041 |
| HU | 19 445 |
| CZ | 11 589 |
| AT | 724 |
| IT | 722 |
| MD | 32 |
| DE | 11 |
| **Spolu** | **198 066** |

- ISCBC migrácia: **197 991** záznamov ✅
- Odbery bez dátumu odberu: **0** ✅
- Odbery bez zmluvy: **89** ⚠️

#### Collection States (číselné kódy — dekódovať z `collection_statuses`)

| State | Počet | Názov stavu (doplniť) |
|-------|-------|----------------------|
| 6 | 187 911 | ___________ |
| 8 | 8 688 | ___________ |
| 4 | 446 | ___________ |
| 5 | 411 | ___________ |
| 3 | 315 | ___________ |
| 10 | 134 | ___________ |
| 2 | 79 | ___________ |
| 7 | 46 | ___________ |
| evaluated | 14 | Starý formát |
| ostatné | 32 | ___________ |

> Dekódovanie: `SELECT id, name FROM collection_statuses ORDER BY sort_order;`

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Doplniť `contract_id` pre 89 odberov bez zmluvy | ___ hodín |
| Stredná | Migrácia 14 záznamov so starým text state `evaluated` na číselný kód | ___ hodín |
| Stredná | Lab results workflow — dokončenie procesu pre laboratórne výsledky | ___ dní |
| Nízka | CBU report automatizácia pre nové odbery | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 4. FAKTÚRY (invoices) ⚠️ KRITICKÉ

### Stav

- **Tabuľka `invoices` má 0 záznamov** — fakturácia nebola spustená
- Infraštruktúra je pripravená: invoice_items (15 testovacích), billing_company_accounts, number_ranges, scheduled_invoices
- Zmluvy existujú (236 935) — faktúry k ním chýbajú

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Kritická | Rozhodnutie: import historických faktúr z ISCBC alebo štart od nuly | ___ dní |
| Kritická | Konfigurácia number_ranges (číslovacie rady) per krajina | ___ dní |
| Kritická | Konfigurácia billing_company_accounts (fakturačné firmy) | ___ dní |
| Vysoká | Test generovania faktúry pre 1 zákazníka/krajinu | ___ dní |
| Vysoká | Aktivácia scheduled_invoices (periodická fakturácia) | ___ dní |
| Stredná | PDF šablóny per krajina a jazyk | ___ dní |
| Stredná | QR kód platba (EPC QR — SK/CZ/AT) | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 5. HEALTHCARE NETWORK (hospitals / clinics / collaborators)

### Stav

| Entita | Počet |
|--------|-------|
| Nemocnice | **1 213** |
| Kliniky | **10 078** |
| Spolupracovníci (gynekolóji atď.) | **14 887** |

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Dokončenie MPN komunikačných harmonogramov | ___ dní |
| Stredná | Kliniky bez kontaktnej osoby — overiť a doplniť | ___ dní |
| Stredná | First Contact Protocols pre nových partnerov | ___ dní |
| Nízka | Import nových nemocníc a kliník z externých zdrojov | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 6. KOMUNIKÁCIA & KAMPANE

### Stav

| Typ | Počet |
|-----|-------|
| communication_messages | **1 163 268** |
| call_logs | **1 087** |
| campaign_contacts | **734** |

| Status kampane | Počet |
|----------------|-------|
| active | 2 |
| paused | 2 |
| draft | 1 |

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Aktivácia/preverenie 2 pozastavených kampaní | ___ hodín |
| Vysoká | Dokončenie 1 draft kampane | ___ hodín |
| Stredná | Mailchimp sync konfigurácia pre aktívne kampane | ___ dní |
| Stredná | SOP články — rozšírenie (aktuálne len 25) | ___ dní |
| Nízka | Automatické správy pri zmenách stavu zmluvy/odberu | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 7. POUŽÍVATELIA & OPRÁVNENIA (users)

### Stav

- **12 aktívnych používateľov**
- Všetci 12 nemajú záznam v `user_roles` — používajú starý `role` stĺpec
- `role_module_permissions` tabuľka je naplnená (RBAC pripravený)

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Migrácia používateľov z `role` stĺpca na RBAC (`user_roles`) | ___ dní |
| Vysoká | Overenie `assigned_countries` per používateľ | ___ hodín |
| Stredná | Nastavenie role_field_permissions pre citlivé polia | ___ dní |
| Nízka | Onboarding dokumentácia pre nových používateľov | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 8. NEXUSPOINT (SharePoint integrácia)

### Stav

- MS365 integrácia aktívna
- **Download fix** nasadený (máj 2026) ✅ — streaming cez Graph API
- **Cross-drive move fix** nasadený (máj 2026) — čaká na produkčný test
- Nastavenia uložené v `nexuspoint_settings`, záložky v `nexuspoint_folder_settings`

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Test cross-drive move v produkcii | ___ hodín |
| Stredná | Oprávnenia na úrovni priečinkov (per krajina/používateľ) | ___ dní |
| Nízka | Tagy a poznámky k súborom (nexuspoint_item_tags/notes) — UI rozšírenie | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 9. CALL CENTER & SIP TELEFÓNIA

### Stav

- Asterisk ARI na `10.1.2.112:8088` — **ECONNREFUSED** ⚠️
- SIP settings nakonfigurované, SIP extensions v DB
- inbound_queues a queue_members nakonfigurované
- Virtual agent configs prítomné (AI voice bot)
- call_logs: **1 087** záznamov

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Kritická | Opraviť Asterisk ARI spojenie (mediagateway) | ___ dní |
| Vysoká | Overenie SIP extensions a prihlásenia agentov | ___ hodín |
| Stredná | Virtual AI Agent — kalibrácia odpovedí per krajina | ___ dní |
| Nízka | Nahrávky hovorov — archivácia a prístup cez UI | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 10. AI & LEAD INTELLIGENCE

### Stav

- Lead Intelligence V3 nakonfigurovaný (7 vrstiev)
- `lead_entities`, `lead_scoring_criteria`, `lead_campaigns`, `lead_sources` — tabuľky naplnené
- OpenAI GPT-4o integrácia aktívna
- `contact_scores`, `feedback_patterns`, `entity_relations` — infraštruktúra pripravená

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Spustenie lead search kampaní pre SK/RO | ___ dní |
| Vysoká | Kalibrácia scoring kritérií podľa výsledkov | ___ dní |
| Stredná | Feedback loop — naučenie z uzavretých leadov | ___ dní |
| Nízka | Entity Knowledge Graph — vizualizácia vzťahov | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## 11. WEB FORMS & PIPELINES

### Stav

| Entita | Počet |
|--------|-------|
| web_form_submissions | **10** (testovacie) |
| pipelines | **2** |
| deals | **10** |
| pipeline_stages | — |

### Návrh úprav

| Priorita | Úprava | Odhadovaný čas |
|----------|--------|----------------|
| Vysoká | Aktivácia verejných formulárov pre SK/RO (marketing) | ___ dní |
| Stredná | Pipeline nastavenie pre predajný proces | ___ dní |
| Nízka | Webhook konfigurácia pre externe CRM systémy | ___ dní |

**Predpokladaný dátum dokončenia:** ___________

---

## Celkový plán — Prehľad

| Modul | Priorita | Odhadovaný čas | Zodpovedná osoba | Dátum dokončenia |
|-------|----------|----------------|------------------|------------------|
| Faktúry — aktivácia | Kritická | ___ dní | ___________ | ___________ |
| Asterisk ARI fix | Kritická | ___ dní | ___________ | ___________ |
| RBAC migrácia | Vysoká | ___ dní | ___________ | ___________ |
| Zmluvy pending review | Vysoká | ___ hodín | ___________ | ___________ |
| Poistovne import | Vysoká | ___ dní | ___________ | ___________ |
| Kampane aktivácia | Vysoká | ___ hodín | ___________ | ___________ |
| NexusPoint move test | Vysoká | ___ hodín | ___________ | ___________ |
| Lead Intelligence | Vysoká | ___ dní | ___________ | ___________ |
| Collections — 89 bez zmluvy | Stredná | ___ hodín | ___________ | ___________ |
| Web Forms aktivácia | Stredná | ___ dní | ___________ | ___________ |
| MPN harmonogramy | Stredná | ___ dní | ___________ | ___________ |
| SOP rozšírenie | Nízka | ___ dní | ___________ | ___________ |

---

## Príloha — SQL Control Check Skript

> Spustenie na CORPCRM01:
> ```bash
> PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f /tmp/indexus_final.sql 2>&1 | tee /tmp/indexus_result.txt
> ```

```sql
SELECT 'customers'              AS modul, COUNT(*) AS pocet FROM customers
UNION ALL SELECT 'contract_instances', COUNT(*) FROM contract_instances
UNION ALL SELECT 'collections',        COUNT(*) FROM collections
UNION ALL SELECT 'invoices',           COUNT(*) FROM invoices
UNION ALL SELECT 'hospitals',          COUNT(*) FROM hospitals
UNION ALL SELECT 'clinics',            COUNT(*) FROM clinics
UNION ALL SELECT 'collaborators',      COUNT(*) FROM collaborators
UNION ALL SELECT 'campaigns',          COUNT(*) FROM campaigns
UNION ALL SELECT 'campaign_contacts',  COUNT(*) FROM campaign_contacts
UNION ALL SELECT 'communication_messages', COUNT(*) FROM communication_messages
UNION ALL SELECT 'tasks',              COUNT(*) FROM tasks
UNION ALL SELECT 'call_logs',          COUNT(*) FROM call_logs
UNION ALL SELECT 'users',              COUNT(*) FROM users
UNION ALL SELECT 'products',           COUNT(*) FROM products
UNION ALL SELECT 'invoice_items',      COUNT(*) FROM invoice_items
UNION ALL SELECT 'visit_events',       COUNT(*) FROM visit_events
UNION ALL SELECT 'sop_articles',       COUNT(*) FROM sop_articles
UNION ALL SELECT 'web_form_submissions', COUNT(*) FROM web_form_submissions
UNION ALL SELECT 'training_room_archives', COUNT(*) FROM training_room_archives
UNION ALL SELECT 'pipelines',          COUNT(*) FROM pipelines
UNION ALL SELECT 'deals',              COUNT(*) FROM deals
ORDER BY pocet DESC;

-- Customers per krajina
SELECT COALESCE(country,'?') AS krajina, COUNT(*) AS pocet
FROM customers GROUP BY country ORDER BY pocet DESC;

-- ISCBC migrácia check
SELECT COALESCE(data_source,'NULL') AS data_source, COUNT(*) AS pocet
FROM customers GROUP BY data_source ORDER BY pocet DESC;

-- Contract instances per status
SELECT COALESCE(status,'?') AS status, COUNT(*) AS pocet
FROM contract_instances GROUP BY status ORDER BY pocet DESC;

-- Collections per state
SELECT COALESCE(state,'?') AS state, COUNT(*) AS pocet
FROM collections GROUP BY state ORDER BY pocet DESC;

-- Collections per krajina
SELECT COALESCE(country_code,'?') AS krajina, COUNT(*) AS pocet
FROM collections GROUP BY country_code ORDER BY pocet DESC;

-- Campaigns per status
SELECT COALESCE(status,'?') AS status, COUNT(*) AS pocet
FROM campaigns GROUP BY status ORDER BY pocet DESC;

-- Control checks
SELECT 'Customers bez tel aj email'       AS check_name, COUNT(*) AS pocet
FROM customers WHERE (phone IS NULL OR phone='') AND (email IS NULL OR email='')
UNION ALL SELECT 'Customers bez krajiny',  COUNT(*) FROM customers WHERE country IS NULL OR country=''
UNION ALL SELECT 'Customers bez poistovne', COUNT(*) FROM customers WHERE health_insurance_id IS NULL
UNION ALL SELECT 'Contract_instances bez customer', COUNT(*) FROM contract_instances WHERE customer_id IS NULL
UNION ALL SELECT 'Invoices bez invoice_number', COUNT(*) FROM invoices WHERE invoice_number IS NULL OR invoice_number=''
UNION ALL SELECT 'Invoices nulova suma',   COUNT(*) FROM invoices WHERE total_amount=0 OR total_amount IS NULL
UNION ALL SELECT 'Invoices issued > 60 dni', COUNT(*) FROM invoices
       WHERE status='issued' AND COALESCE(issue_date, generated_at) < NOW()-INTERVAL '60 days'
UNION ALL SELECT 'Collections bez collection_date', COUNT(*) FROM collections WHERE collection_date IS NULL
UNION ALL SELECT 'Collections bez contract_id', COUNT(*) FROM collections WHERE contract_id IS NULL
UNION ALL SELECT 'Tasks po termine (open)', COUNT(*) FROM tasks WHERE due_date < NOW() AND status != 'done'
UNION ALL SELECT 'Users bez roly (user_roles)', COUNT(*) FROM users u
       LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE ur.role_id IS NULL AND u.is_active=true
ORDER BY pocet DESC;

-- Collection statuses dekodovanie
SELECT id, name FROM collection_statuses ORDER BY sort_order;

-- Users a krajiny
SELECT username, assigned_countries FROM users ORDER BY username;
```
