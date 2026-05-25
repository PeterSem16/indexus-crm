# INDEXUS CRM — Prehľad modulov & Control Check

> **Dátum:** Máj 2026  
> **Verzia systému:** Production @ CORPCRM01 (77.72.181.113)  
> Pre počty záznamov spusti SQL skript `indexus_check.sql` na produkcii.

---

## 1. CUSTOMERS — Zákaznícky modul

### Čo modul obsahuje
- Osobné údaje, kontakty, adresy, krajina, región, PSČ
- Marketing tagy, VIP status, zdroj získania
- Priradenie poistovne, lekár, pôrodnica
- Súhlasy (GDPR), emailové notifikácie
- Lead Scoring (automatické bodovanie)
- Audit log zmien

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Zákazníci bez telefónu aj emailu | Neúplné kontakty |
| 2 | Zákazníci bez regiónu/PSČ | Chýba geografické zaradenie |
| 3 | Zákazníci bez poistovne | Chýba pre SK/CZ faktúrovanie |
| 4 | Duplicitné záznamy (rovnaký email) | Možné importné duplikáty |
| 5 | Zákazníci bez priradeného lekára/pôrodnice | Chýba MPN väzba |
| 6 | **ISCBC migrácia** — záznamy bez `source` alebo source=iscbc | Overiť či sú prenesené všetky |
| 7 | Zákazníci bez súhlasu | GDPR compliance |

---

## 2. CONTRACTS — Zmluvy

### Čo modul obsahuje
- Zmluvy viazané na zákazníka a produkt
- Stav zmluvy (draft, active, cancelled, expired)
- Verzie zmlúv, podpisové tokeny (e-sign)
- Zmluvné inštancie (produkt + cena + zľava)
- Auditný log zmien, zdieľanie cez link
- Plánované faktúry (scheduled invoices)

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Zmluvy bez inštancie produktu | Prázdne zmluvy |
| 2 | Aktívne zmluvy bez zákazníka | Osirelé záznamy |
| 3 | Zmluvy s expirovaným podpisovým tokenom | Čakajúce na podpis |
| 4 | **ISCBC migrácia** — zmluvy bez čísla zmluvy | Chýbajúci identifikátor |
| 5 | Naplánované faktúry bez dátumu | Bloker fakturácie |

---

## 3. COLLECTIONS — Odbery (Cord Blood)

### Čo modul obsahuje
- Záznamy o odbere krvi (kedy, kde, kuriér)
- Stav odberu (registered, collected, received, processed, stored)
- Lab výsledky, CBU správy (PDF download)
- OCR extrakcia z dokumentov
- Väzba na zmluvu a zákazníka

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Odbery bez lab výsledkov | Nespracované vzorky |
| 2 | Odbery v stave "registered" dlhšie ako 30 dní | Zaseknuté |
| 3 | Odbery bez väzby na zmluvu | Osirelé záznamy |
| 4 | **ISCBC migrácia** — odbery bez dátumu odberu | Chýbajúce dáta |
| 5 | Odbery bez kuriéra | Chýba logistika |

---

## 4. INVOICES — Faktúry

### Čo modul obsahuje
- Faktúry viazané na zákazníka a zmluvu
- Položky faktúry (invoice items), DPH, zľavy
- Stav faktúry (draft, issued, paid, overdue, cancelled)
- PDF generovanie, emailové odosielanie
- Platobné splátky (installments)
- Exchange rates (kurzové prepočty)
- Šablóny faktúr (Billing Companies)

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Faktúry v stave "issued" staršie ako 60 dní | Nezaplatené — upomienky |
| 2 | Faktúry bez položiek | Prázdne faktúry |
| 3 | Faktúry bez zákazníka | Osirelé záznamy |
| 4 | **ISCBC migrácia** — faktúry bez čísla faktúry | Chýbajúci identifikátor |
| 5 | Faktúry bez billing company | Chýba fakturačná entita |
| 6 | Faktúry s nulovou sumou | Podozrivé záznamy |

---

## 5. HEALTHCARE NETWORK — Nemocnice & Kliniky

### Čo modul obsahuje
- Nemocnice (hospitals) a kliniky (clinics)
- Personál na inštitúciách (doctors, nurses, contact persons)
- Regióny, okresy, geografické zaradenie
- Spolupráca (cooperation types), CBC aktivity
- Medical Partner Network (MPN) — komunikačné plány, first contact protokol
- Návštevy (visit events), aktivitný log

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Nemocnice bez kliník | Prázdne siete |
| 2 | Kliniky bez kontaktnej osoby | Chýba MPN kontakt |
| 3 | Kliniky bez regiónu | Chýba geografické zaradenie |
| 4 | MPN partneri bez komunikačného plánu | Nezapojení do MPN |
| 5 | Nemocnice bez zákazníkov (pôrodnica bez rodičiek) | Možný import problém |
| 6 | Kontaktné osoby bez emailu | Nie je možné komunikovať |

---

## 6. NEXUS — Komunikačná platforma

### 6a. Email / SMS
- Microsoft 365 integrácia (Exchange Online)
- Zdieľané mailboxy, podpisy, šablóny
- Emailové tagy, farby, spam filter
- SMS cez BulkGate / GSM konfigurácia
- Mailchimp integrácia (kampane)
- AI analýza sentimentu prichádzajúcich mailov

**Kontrolné body:** Overit MS365 token platnosť, GSM sender ID, Mailchimp API key aktívny

### 6b. Tasks — Úlohy
- Interné úlohy s checklist položkami
- Priradenie používateľom, termíny, stavy
- Komentáre, priorita

**Kontrolné body:** Úlohy po termíne, úlohy bez priradeného používateľa

### 6c. Campaigns — Kampane (NEXUS Missions)
- Outreach kampane (telefón, email, SMS)
- Fázy kampane, kontakty, scripty
- KPI reporting, snapshot metriky
- Status Management Engine (konfigurovateľné disposície)
- Virtuálny AI agent (GPT-4o-mini, TTS)

**Kontrolné body:** Kampane bez kontaktov, kampane bez agentov, expirované kampane aktívne

### 6d. Agent Workspace (NEXUS Pulse)
- Call center pracovisko (WebRTC/SIP)
- Shift management, queue handling
- Hovorový log, nahrávky
- AI sentiment analýza hovorov
- FAQ & SOP panel počas hovoru
- Break management

**Kontrolné body:** Agenti bez SIP extension, queue bez agentov

### 6e. NexusPoint — SharePoint integrácia
- Prehľadávanie SharePoint sites & drives
- Upload, download, presun súborov
- Taggovanie súborov, farebné priečinky
- Globálne vyhľadávanie podľa tagov
- Zdieľanie linkov, náhľad súborov

**Kontrolné body:** MS365 token aktívny, download funkčný ✓ (opravené máj 2026)

### 6f. Chats & Teams
- Interný chat (realtime WebSocket)
- Microsoft Teams integrácia (meetings, recordings)
- Archív nahrávok

### 6g. SOP Management
- Štandardné operačné postupy
- Priradenie k agentom a kampaniam
- Čítanosť (read tracking)

### 6h. Training Room
- Vzdelávacie materiály pre zamestnancov/partnerov
- Archív prezentácií, videí
- AI asistovaný obsah

---

## 7. USER MANAGEMENT

### Čo modul obsahuje
- Správa používateľov (meno, email, heslo, krajina)
- Roly (Admin, Manager, User, Agent)
- Granulárne oprávnenia per modul (RBAC)
- Field-level permissions
- SIP extension priradenie
- Audit session log

### Kontrolné body
| # | Kontrola | Poznámka |
|---|----------|----------|
| 1 | Používatelia bez roly | Nemajú prístup k ničomu |
| 2 | Používatelia bez krajiny | Nevidí data svojej krajiny |
| 3 | Deaktivovaní používatelia s aktívnymi sessions | Security gap |
| 4 | Agenti bez SIP extension | Nemôžu volať |
| 5 | Roly bez definovaných oprávnení | Prázdna rola |

---

## 8. SETTINGS — Nastavenia

### Čo sa tam konfiguruje

| Tab | Obsah |
|-----|-------|
| **Config** | Typy sťažností (complaint types), Typy spolupráce (cooperation types), VIP statusy |
| **Insurance** | Zdravotné poisťovne per krajina (kód + názov) |
| **Laboratories** | Laboratóriá per krajina (adresa, kontakt) |
| **Lead Scoring** | Bodovanie leadov — kritériá (má telefón: +5b, má email: +3b atď.) |
| **CBC Activities** | Aktivity per pozícia v inštitúcii (ikony a labely) |
| **System** | Jazykové nastavenia, krajiny, meny |
| **SIP** | SIP server (host, port, user), Asterisk ARI konfigurácia, iOS zariadenia |

### Kontrolné body
- Každá aktívna krajina má poisťovne nastavené
- SIP server je dostupný (CORPCRM01 → Asterisk)
- Laboratóriá majú platné kontakty

---

## 9. CONFIGURATOR — Konfigurátor

### Čo sa tam konfiguruje

| Tab | Obsah |
|-----|-------|
| **Products** | Produkty (Rodinná banka atď.), inštancie per krajina, ceny, splátky, zľavy, DPH, sady (sets) |
| **Billing** | Fakturačné spoločnosti, číslovacie rady (faktúry, zmluvy), šablóny faktúr, šablóny zmlúv, system settings |
| **Rates/Inflation** | Kurzové prepočty, inflačné koeficienty |
| **Email Router** | SMTP/IMAP konfigurácia, GSM sender, šablóny správ, Mailchimp |
| **Notifications** | Notifikačné pravidlá, alert pravidlá |
| **API Keys** | Externé API kľúče (OpenAI, BulkGate, atď.) |
| **Permissions** | Role-based access control (detailné) |
| **Web Forms** | Verejné registračné formuláre, vizuálny builder |
| **Lead Search** | Lead Intelligence System V3 — zdroje, scrapovanie |

### Kontrolné body
- Produkty majú nastavené ceny pre každú krajinu
- Fakturačné spoločnosti majú bankové údaje
- Číslovacie rady nie sú vyčerpané
- API kľúče (OpenAI, BulkGate) sú platné

---

## 10. OSTATNÉ MODULY

| Modul | Popis |
|-------|-------|
| **Pipeline** | Kanban board pre acquisition fázy |
| **Reports** | Export dát, customer audit, Collaborator reports |
| **Automations** | Workflow pravidlá (trigger → akcia) |
| **Transcript Search** | Fulltextové vyhľadávanie v hovoroch |
| **Executive Summaries** | AI sumarizácia pre manažment |
| **Lead Intelligence V3** | 7-vrstvový self-learning lead generation |
| **Web Forms** | Verejné formuláre (public URL) |

---

## SQL Skript pre produkciu

Skript je v súbore `indexus_check.sql` — spusti ho na CORPCRM01:

```bash
PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f indexus_check.sql
```
