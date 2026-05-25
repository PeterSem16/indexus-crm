# INDEXUS CRM — Prehľad modulov & Control Check

> **Dátum:** Máj 2026  
> **Produkčný server:** CORPCRM01 (77.72.181.113)  
> **Databáza:** indexus_crm · 205 tabuliek

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
| 3 | **Používatelia bez roly** | Všetkých 12 používateľov nemá záznam v `user_roles` (používajú priamy `role` stĺpec, nie RBAC) |
| 4 | **89 odberov bez zmluvy** | `contract_id = NULL` na 89 záznamoch v collections |

---

## 1. CUSTOMERS — Zákazníci

### Počty per krajina
| Krajina | Počet | % |
|---------|-------|---|
| RO | 78 912 | 47.7% |
| SK | 57 461 | 34.7% |
| HU | 16 961 | 10.3% |
| CZ | 9 777 | 5.9% |
| IT | 1 196 | 0.7% |
| AT | 717 | 0.4% |
| Ostatné | 438 | 0.3% |
| **Spolu** | **165 462** | |

### ISCBC migrácia
| data_source | Počet |
|-------------|-------|
| iscbc | **165 448** ✅ |
| NULL | 14 |

> Migrácia z ISCBC prebehla úspešne — 99.99% zákazníkov má `data_source = 'iscbc'`.  
> `registration_source` je NULL pre takmer všetkých — zákazníci prišli cez ISCBC import, nie cez web formuláre.

### Kontrolné body
| Check | Výsledok |
|-------|----------|
| Zákazníci bez telefónu aj emailu | **0** ✅ |
| Zákazníci bez krajiny | **0** ✅ |
| Zákazníci bez poistovne | **165 448** ⚠️ (ISCBC dáta nemajú poistovne) |

---

## 2. CONTRACTS (contract_instances) — Zmluvy

### Počty per status
| Status | Počet |
|--------|-------|
| completed | **221 467** |
| cancelled | **14 118** |
| signed | **671** |
| sent | **645** |
| pending_signature | **25** |
| draft | **9** |
| **Spolu** | **236 935** |

### Kontrolné body
| Check | Výsledok |
|-------|----------|
| Zmluvy bez zákazníka | **0** ✅ |
| Zmluvy čakajúce na podpis | **25** — overiť či sú aktuálne |
| Zmluvy vo draft stave | **9** — nedokončené |

---

## 3. COLLECTIONS — Odbery

### Počty per krajina
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

### ISCBC migrácia
| data_source | Počet |
|-------------|-------|
| iscbc | **197 991** ✅ |
| NULL | 75 |

### Collection States (číselný kód)
> State je numerický ID z tabuľky `collection_statuses`. Pre dekódovanie spusti:  
> `SELECT id, name FROM collection_statuses ORDER BY id;`

| State | Počet | Poznámka |
|-------|-------|----------|
| 6 | 187 911 | (väčšina — pravdepodobne "Uložená/Stored") |
| 8 | 8 688 | |
| 4 | 446 | |
| 5 | 411 | |
| 3 | 315 | |
| 10 | 134 | |
| ostatné | 171 | |
| evaluated (text) | 14 | Starý formát |

### Kontrolné body
| Check | Výsledok |
|-------|----------|
| Odbery bez dátumu odberu | **0** ✅ |
| Odbery bez zmluvy (contract_id NULL) | **89** ⚠️ |

---

## 4. INVOICES — Faktúry

> **⚠️ KRITICKÉ: Tabuľka `invoices` má 0 záznamov.**  
> Možné príčiny:
> - Fakturácia nebola ešte spustená v produkcii
> - ISCBC faktúry nie sú prenesené (nie sú v `data_source`)
> - Faktúry sú v inej tabuľke alebo systéme

### Schéma faktúry (aká je pripravená)
Systém má plnú fakturačnú infraštruktúru:
- `invoices` — hlavičky faktúr (VAT, total_amount, status, invoice_number)
- `invoice_items` — položky faktúr (15 záznamov — testovacie)
- `invoice_payments` — platby
- `scheduled_invoices` — plánované faktúry
- `billing_company_accounts` — fakturačné firmy
- `number_ranges` — číslovacie rady

---

## 5. HEALTHCARE NETWORK

### Počty
| Entita | Počet |
|--------|-------|
| Nemocnice (hospitals) | **1 213** |
| Kliniky (clinics) | **10 078** |
| Spolupracovníci (collaborators) | **14 887** |

### Kontrolné body
Odporúča sa spustiť dodatočné query pre:
- Kliniky bez kontaktnej osoby
- Nemocnice bez kliník
- Spolupracovníci bez krajiny

---

## 6. NEXUS — Komunikačná platforma

### Komunikácia
| Typ | Počet |
|-----|-------|
| communication_messages (email/SMS) | **1 163 268** |
| call_logs | **1 087** |

### Kampane
| Status | Počet |
|--------|-------|
| active | 2 |
| paused | 2 |
| draft | 1 |
| **Spolu** | **5** |

### Ostatné
| Modul | Počet |
|-------|-------|
| campaign_contacts | 734 |
| visit_events | 29 |
| sop_articles | 25 |
| tasks | 9 (1 po termíne) |
| training_room_archives | 2 |
| web_form_submissions | 10 |

### NexusPoint (SharePoint)
- MS365 integrácia aktívna
- Download opravený (máj 2026) ✅
- Move cross-drive fix nasadený (máj 2026) — čaká na test

---

## 7. USER MANAGEMENT

| Celkom používateľov | 12 |
|--------------------|----|
| Aktívni | 12 |

| Krajina (assigned_countries) | Poznámka |
|------------------------------|---------|
| ⚠️ Query zlyhala | `assigned_countries` je ARRAY — treba LATERAL unnest |

### Kontrolné body
| Check | Výsledok |
|-------|----------|
| Používatelia bez záznamu v user_roles | **12** ⚠️ (rola je v stĺpci `role`, nie cez RBAC tabuľku) |

---

## 8. SETTINGS — Čo je nakonfigurované

| Tab | Obsah |
|-----|-------|
| Config | Typy sťažností, Typy spolupráce, VIP statusy |
| Insurance | Zdravotné poisťovne per krajina |
| Laboratories | Laboratóriá per krajina |
| Lead Scoring | Bodovanie leadov podľa kritérií |
| CBC Activities | Aktivity per pozícia v inštitúcii |
| System | Jazyky, krajiny, meny |
| SIP | SIP server, Asterisk ARI (momentálne nedostupný — ECONNREFUSED), iOS zariadenia |

> ⚠️ Asterisk ARI na 10.1.2.112:8088 je nedostupný (ECONNREFUSED v logoch)

---

## 9. CONFIGURATOR — Čo je nakonfigurované

| Tab | Obsah | Stav |
|-----|-------|------|
| Products | 3 produkty, inštancie per krajina | Základné produkty nastavené |
| Billing | Fakturačné spoločnosti, číslovacie rady, šablóny | Pripravené, faktúry = 0 |
| Rates/Inflation | Kurzové prepočty, inflácia | Nastavené |
| Email Router | SMTP/IMAP, GSM BulkGate, Mailchimp | Aktívne |
| Notifications | Notifikačné a alert pravidlá | Nastavené |
| API Keys | OpenAI, BulkGate atď. | Aktívne |
| Permissions | RBAC — role_module_permissions | Nastavené |
| Web Forms | Verejné formuláre (10 submissions) | Aktívne |
| Lead Search | Lead Intelligence V3 | Nakonfigurované |

---

## 10. Doplnkové query pre produkciu

### Dekódovanie collection states
```sql
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "SELECT id, name FROM collection_statuses ORDER BY sort_order;"
```

### Countries pre users (ARRAY)
```sql
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "SELECT u.username, u.assigned_countries FROM users u ORDER BY u.username;"
```

### Kliniky bez kontaktnej osoby
```sql
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "SELECT COUNT(*) FROM clinics c LEFT JOIN collaborators co ON co.clinic_id = c.id WHERE co.id IS NULL;"
```

### Billing companies
```sql
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -c "SELECT id, name, country FROM billing_company_accounts ORDER BY country;"
```
