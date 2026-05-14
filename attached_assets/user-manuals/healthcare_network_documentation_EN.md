# INDEXUS — Documentation: Healthcare Network

> **Healthcare Network** is the core of the sales team's work. This section of the system tracks all healthcare institutions and their personnel — from large maternity hospitals to private gynecological practices and midwives. The goal is to always have an up-to-date overview of partner relationships, cooperation status, and contact history.

---

## Table of Contents

1. [Module Overview and Relationships](#1-module-overview-and-relationships)
2. [Module: Hospitals](#2-module-hospitals)
3. [Module: Clinics](#3-module-clinics)
4. [Module: Persons / Collaborators](#4-module-persons--collaborators)
5. [Referral System — with a Real Example](#5-referral-system--with-a-real-example)
6. [Working with Institution Personnel](#6-working-with-institution-personnel)
7. [Pipeline — Cooperation Status with a Clinic](#7-pipeline--cooperation-status-with-a-clinic)
8. [Tips for Daily Work](#8-tips-for-daily-work)

---

## 1. Module Overview and Relationships

The Healthcare Network in INDEXUS consists of four interconnected entities:

```
HOSPITAL
│
├── has assigned CLINICS
│     └── a clinic has a primary DOCTOR (Person)
│
└── has PERSONNEL (Persons)
      ├── Doctors (Gynecologist, Chief Physician, Attending...)
      ├── Midwives
      ├── Nurses (Head Nurse, Nurse...)
      └── Other healthcare workers
```

### How entities relate

| Entity | Relationship |
|--------|-------------|
| **Hospital → Clinics** | A clinic may be physically located within a hospital or part of its network |
| **Hospital → Personnel** | Doctors and nurses are assigned to specific hospital departments |
| **Clinic → Doctor** | Each clinic has a primary doctor (practice owner) |
| **Clinic → Personnel** | Besides the primary doctor, additional persons can be assigned to a clinic |
| **Person → Institutions** | One person (e.g. a midwife) can be assigned to multiple hospitals and clinics simultaneously |
| **Person → Person** | Via the referral system — one person recommended another as a potential collaborator |

### When to use which module

- **Hospital** — for maternity hospitals, university hospitals, or other inpatient healthcare facilities
- **Clinic** — for gynecological practices, general practitioners, or outpatient consultations
- **Person** — a doctor, midwife, nurse, or other healthcare worker you collaborate with or plan to approach
- **Midwife** — a person with type or professional classification in the midwife category; managed in the Persons module

---

## 2. Module: Hospitals

### What we track here

Hospitals are large healthcare facilities — maternity hospitals, university hospitals, regional hospitals. They serve as the primary geographic anchor of the network: clinics and personnel are assigned to them.

### Hospital list

The main page displays a table of all hospitals with:
- **Name** and **country** (with flag)
- **City** and **region**
- **Status** (Active / Inactive)
- **Number of assigned clinics** and **personnel**
- **Network badge** — if the hospital belongs to a healthcare network (e.g. Svet zdravia), a colored badge with the network name is shown

Use the filter in the top right corner to filter hospitals by country, region, activity status, or network membership.

### Hospital card — tabs

Clicking on a hospital in the list (or the edit icon) opens a side panel with three tabs:

---

#### Tab: Basic Data

Core information about the hospital that you can directly edit.

| Field | Description |
|-------|-------------|
| **Full name** *(required)* | Official complete name of the hospital, e.g. *University Hospital L. Pasteur Košice* |
| **Short name** | Working abbreviated name for display in lists |
| **Country** *(required)* | Country where the hospital is located |
| **Street and number** | Address — street name and building number |
| **City** | City — the region and district are automatically suggested after entry |
| **Postal code** | Postal / ZIP code |
| **Region** | Auto-filled after entering city; can be changed manually |
| **District** | District within the region |
| **GPS coordinates** | Latitude and longitude — enter manually or use the *Get Location* button (uses device GPS) |
| **Responsible person** | INDEXUS user responsible for this hospital |
| **Contact person** | Name of an internal contact at the hospital |
| **Laboratory** | Assigned collection laboratory for the respective country |
| **Active** | Toggle — inactive hospitals do not appear in campaigns and filters |
| **Auto-recruiting** | If enabled, the system may automatically include the hospital in recruiting |
| **Svet zdravia / Network** | Membership in a hospital network |

> **Tip:** After entering the city, the system automatically suggests the region and district. If the suggestion is incorrect, use the magic wand button next to the Region field.

---

#### Tab: Personnel

Displays all healthcare workers assigned to this hospital. For each person you see:
- **Full name** with titles
- **Category / position** (Chief Physician, Gynecologist, Midwife...)
- **Department** and **role** within the department
- **Contact details** (phone, email)
- **"Primary" badge** — main contact at the institution
- **Who recommended this person** — purple badge with the recommender's name
- **Status** (Active / Inactive)

Personnel management (adding, editing assignments) is done directly in the Person's card or via the personnel management button.

---

#### Tab: Campaigns

Displays the history and current status of all campaigns this hospital has been included in.

---

### Adding a new hospital

Click the **+ Add Hospital** button in the top right corner. A wizard opens with 5 steps:

1. **Basic** — name and country
2. **Address** — street, city, postal code, GPS
3. **Contacts** — responsible person, contact person
4. **Settings** — laboratory, auto-recruiting, network
5. **Review** — check before saving

---

## 3. Module: Clinics

### What we track here

Clinics are gynecological, obstetric, or other outpatient workplaces — private practices, polyclinics, counseling centers. Each clinic has a primary doctor (gynecologist, GP) and the entire process from first contact through to an active contract is tracked.

### Clinic list

The table shows:
- **Doctor's name** and **clinic name**
- **City, region, country**
- **Pipeline status** — a colored badge shows the current stage of cooperation
- **Lead source** — how the clinic entered the system
- **Date of last contact / next contact**
- **Referral badge** — if the clinic was referred by another doctor

### Clinic card — tabs

---

#### Tab: Basic Data

| Section | Fields |
|---------|--------|
| **Identification** | Clinic name, Doctor's title, First name, Last name |
| **Codes** | Healthcare facility ID, PZS code, PZS name, Company registration number |
| **Address** | Street, building number, orientation number, city, postal code, country, region, district |
| **Contacts** | Phone 1/2/3, Email 1/2/3, Website |
| **GPS** | Coordinates — manual entry or GPS capture |
| **Status** | Active / Inactive, Notes |

> **Contact tip:** A clinic can have up to 3 phone numbers and 3 email addresses. Each phone number has a direct call button to dial via INDEXUS telephony.

---

#### Tab: Pipeline and Cooperation

This tab is the heart of the sales process for a clinic. The entire relationship lifecycle is tracked here.

**Lead Source** — Where did this contact come from:

| Type | Description |
|------|-------------|
| **New contact** | Clinic approached for the first time, no prior relationship |
| **Former collaborator** | The doctor was previously our collaborator |
| **Current collaborator** | The clinic was referred by another active collaborator |
| **Doctor referral** | Referred by a specific doctor (activates a field for the referrer's name) |
| **Conference** | Contact made at a professional conference |

**Pipeline status** — Progress in the sales process:

| Stage | Description |
|-------|-------------|
| **Not contacted** | Clinic is in the database, no contact has been made yet |
| **Former collaborator** | Historical relationship exists |
| **Cooperation interest** | Doctor expressed interest in cooperating with CBC |
| **Contract interest** | Doctor is willing to sign a contract |
| **Active contract** | Contract is signed and valid |
| **Not interested** | Doctor declined cooperation |

**Communication and contract:**
- **Last call result** and its note
- **Next contact date** — follow-up planning
- **Contract sent / Contract returned** — dates tracking the contract lifecycle
- **Flyers** — whether they were sent, when, and where they are stored

---

#### Tab: Contact History

A chronological list of all interactions with the clinic — calls, emails, visits.

---

#### Tab: Communication (Email)

Send an email directly to the clinic without leaving INDEXUS. Supports sender selection, templates, CC, and attachments.

---

#### Tab: Personnel

Displays all workers assigned to this clinic. The clinic's primary doctor (practice owner) is highlighted at the top.

---

#### Tab: Campaigns / Network / Referrals

Campaigns — history of involvement. Network — healthcare network membership. Referrals — who referred this clinic and which clinics it has referred. More in chapter [5 — Referral System](#5-referral-system--with-a-real-example).

---

### Adding a new clinic

Click **+ Add Clinic**. When you enter the city, the system automatically suggests the region and district. The postal code can be automatically looked up via AI search.

**After saving, we recommend:**
1. Setting the pipeline status (at least *Not contacted*)
2. Adding a lead source
3. Adding personnel via the Personnel tab

---

## 4. Module: Persons / Collaborators

### What we track here

The Persons module contains all healthcare workers — doctors, midwives, nurses, and other staff. Each person can be assigned to one or more hospitals and clinics. Some persons are also active collaborators with a signed contract and receive fees.

### Person types

| Type | Description |
|------|-------------|
| **Doctor** | Gynecologist, GP, specialist |
| **Nurse** | Healthcare nurse |
| **Midwife (Vedono)** | Midwife — a key role in the referral process |
| **Head Nurse** | Department head nurse |
| **Resident** | Doctor in training |
| **BM / Representative** | Field representative |
| **External** | External collaborator outside healthcare |
| **Other** | Other categories |

### Person card — tabs (Wizard)

The person's card is organized into 9 steps / tabs:

---

#### Tab 1: Personal Data

| Field | Description |
|-------|-------------|
| **Title before name** | e.g. MUDr., Mgr., doc. |
| **First / Middle / Last name** | Full name |
| **Maiden name** | Birth surname (if different) |
| **Title after name** | e.g. PhD., MPH |
| **Birth number** | National identification number |
| **Date and place of birth** | Day, month, year, city |
| **Health insurance** | Insurance company |
| **Marital status** | Single, Married, Divorced, Widowed |
| **Professional classification** | Detailed healthcare worker category |
| **Highest education** | From primary school to doctorate |
| **Workplace name** | Name of primary workplace |
| **Is manager** | Toggle — marks leadership positions |
| **Collaborator type** | Doctor, Nurse, Midwife... |
| **Partner category** | Precise position in the network (Chief Physician, KOL, Gynecologist...) |
| **CBC activities** | Activities in the cord blood banking area |
| **Countries** | May operate in multiple countries |
| **Active / Svet zdravia / Client contact** | Status and flags |

---

#### Tab 2: Contact Details

Phone, Mobile 1 / Mobile 2, Other contact, Email. Each phone number has a direct call button to dial via INDEXUS.

---

#### Tab 3: Banking Details

Filled in for collaborators who receive fees: IBAN, SWIFT/BIC, Company name, Company registration / tax / VAT numbers, Company IBAN and SWIFT.

---

#### Tab 4: Contracts and Fees

| Field | Description |
|-------|-------------|
| **Contract type / number / form** | Type and identification of the agreement |
| **Valid from / to** | Date range of contract validity |
| **Contract sent / returned** | Tracking physical circulation of the contract |
| **Social insurance registration / cancellation** | Dates for the Social Insurance Agency |
| **Monthly fees** | Whether the collaborator receives regular monthly fees |
| **Fee type** | Fixed amount or percentage-based |
| **Fixed fee amount / Percentage fee** | Amount or share by country |

---

#### Tab 5–7: Documents, Activities, History

Documents — upload and view scanned contracts and attachments. Activities — interaction history (visits, calls). History — complete chronological log of all changes.

---

#### Tab 8: Medical Network

A key tab — shows which hospitals and clinics this person is assigned to.

For each assignment you see:
- **Institution** (hospital or clinic) with a link to its card
- **Department** — e.g. *Gynecology and Obstetrics Department*
- **Position** — e.g. *Chief Physician*, *Attending Physician*, *Delivery Midwives*
- **Role** — specific role within the position
- **Category** — from the MPN category list
- **Date from / to** and **Primary assignment**
- **Active / Inactive** — assignment status
- **Who recommended this person** — purple badge with recommender's name

> **Important:** An assignment to an institution is added via the **Personnel** tab in the hospital or clinic card — not directly here. This tab only serves to view and edit existing assignments.

---

#### Tab 9: Mobile Application

Management of the collaborator's access to INDEXUS Connect. QR code for login, connection status.

---

## 5. Referral System — with a Real Example

### Why referrals are key

In cord blood banking, trust is fundamental. Most new collaborators come through recommendations from another doctor or midwife. INDEXUS therefore tracks these relationships precisely — we know who referred whom, and we can strategically develop the referral network.

---

### Real example from the database: Referral chain — Feráková → Korčok → Trnava

> **This is a real example from the INDEXUS database, recorded on 15 April 2026. Names and dates are real.**

#### The situation

A sales representative visited **MUDr. Nataša Feráková** from *Ambulancia detskej gynekológie* (Pediatric Gynecology Practice) in **Nové Mesto**. Dr. Feráková is a long-standing collaborator who mentioned a colleague worth contacting.

#### Step 1 — Dr. Feráková refers Dr. Korčok

MUDr. Feráková recommended reaching out to her colleague **MUDr. Martin Korčok**, who runs the *4D Ultrazvuk* practice in **Štúrovo**.

**What to do in INDEXUS:**
1. Open the clinic card for **4D Ultrazvuk** (Štúrovo)
2. In the **Pipeline** tab, set:
   - Lead source = **Doctor referral**
   - Check the **Is referred by a doctor** toggle
3. In the **Referrals** tab, add a link to *Ambulancia detskej gynekológie* (MUDr. Feráková, Nové Mesto)

**Result in the system:**
```
4D Ultrazvuk — MUDr. Martin Korčok, Štúrovo
  └─ [Referral] ← Ambulancia detskej gynekológie — MUDr. Nataša Feráková, Nové Mesto
       Type: Doctor referral  |  Recorded: 15 Apr 2026
```

#### Step 2 — Dr. Korčok refers another clinic

After successfully establishing cooperation with Dr. Korčok, he in turn referred another clinic — the **Gynecological and Obstetric Practice** in **Trnava**.

**Final referral chain in INDEXUS:**

```
MUDr. Nataša Feráková
Ambulancia detskej gynekológie, Nové Mesto
        │
        └──► MUDr. Martin Korčok
             4D Ultrazvuk, Štúrovo               [15 Apr 2026]
                     │
                     └──► Gynekologicko-pôrodnícka ambulancia
                          Trnava                 [15 Apr 2026]
```

#### What this visibility gives a manager

- **Dr. Feráková is a key referrer** — one visit generated 2 new clinics in the network
- **Professional trust transfers**: Korčok trusts Feráková, Trnava trusts Korčok
- When planning **referral fees**, the entire chain is clearly documented and auditable
- You can strategically **deepen the relationship with Dr. Feráková** — she can refer further contacts

---

### How referrals work in general

#### For clinics

1. When entering a clinic, select **Lead Source** = *Doctor referral*
2. Check the **Is referred by a doctor** toggle
3. In the **Referrals** tab, a link to the referring doctor appears

The system tracks both directions — who referred this clinic and which clinics this clinic has referred.

#### For persons (institution personnel)

When assigning a person to a hospital or clinic via the Personnel tab, you can fill in:
- **Recommended by** — select the name of the person who recommended this worker

After saving, a purple badge appears next to the worker's name in the personnel list:
> *"Recommended by John Smith"*

INDEXUS automatically detects gender from the last name suffix.

### Best practices for maintaining the referral network

| Situation | What to do |
|-----------|-----------|
| A doctor recommended a new clinic | Set Lead Source = *Doctor referral*, link via the Referrals tab |
| A midwife recommended a colleague | When creating the person, fill in *Recommended by* in the institution assignment |
| An active collaborator referred colleagues | Lead Source = *Current collaborator* — allows measuring referrer productivity |
| Conference contact | Lead Source = *Conference*, add conference name and date |

> **Why this matters:** Based on lead sources, you can measure which channels bring the most collaborators. Correctly filled-in referral history is also the basis for referral fees.

---

## 6. Working with Institution Personnel

### Adding a person to a hospital or clinic

1. Open the **hospital** or **clinic** card
2. Go to the **Personnel** tab
3. Click **+ Add person**
4. Search for an existing person or create a new one
5. Fill in: Department, Position, Category, Primary assignment, Recommended by, Active
6. Save

### Current MPN position list

INDEXUS uses an **MPN category** list for precise personnel classification.

#### Categories for hospitals

| Code | Slovak name | English name |
|------|------------|--------------|
| `hospital_director` | Riaditeľ nemocnice | Hospital Director |
| `department_head` | Vedúci pôrodníckeho oddelenia | Head of Obstetrics Department |
| `head_nurse` | Hlavná/vrchná sestra pôrodníckeho oddelenia | Head Nurse of Obstetrics Department |
| `delivery_midwife` | Pôrodné asistentky/hebamme | Delivery Midwives |
| `department_doctor` | Lekári pôrodníckeho oddelenia | Obstetrics Department Doctors |
| `department_nurse` | Sestry pôrodníckeho oddelenia | Obstetrics Department Nurses |

#### Categories for clinics

| Code | Slovak name | English name |
|------|------------|--------------|
| `gynecologist_private` | Súkromný gynekológ | Private Gynecologist |
| `pediatrician_private` | Súkromný pediater | Private Pediatrician |

#### Categories for independent workers

| Code | Slovak name | English name |
|------|------------|--------------|
| `prenatal_instructor` | Lektorka predpôrodnej prípravy | Prenatal Preparation Instructor |
| `doula` | Dula | Doula |
| `lactation_consultant` | Laktačná poradkyňa | Lactation Consultant |

> **Note:** This list is definitive. Categories such as Head of Neonatology / Neonatology Doctors / Neonatology Nurses have been intentionally removed and will not be re-added by automatic updates.

---

## 7. Pipeline — Cooperation Status with a Clinic

### Visual progress of cooperation

For each clinic, INDEXUS shows a **5-step progress bar**:

```
[Contact] → [Referral] → [Cooperation Interest] → [Contract Interest] → [Partner]
```

| Step | When it is completed |
|------|---------------------|
| **Contact** | A lead source has been set (the clinic has an assigned origin) |
| **Referral** | The clinic was referred by another doctor / collaborator |
| **Cooperation interest** | The doctor confirmed interest (pipeline = *coop:interested*) |
| **Contract interest** | The doctor is willing to sign a contract (pipeline = *contract_int:interested*) |
| **Partner** | The contract is signed and active (pipeline = *contract:active*) |

Steps marked in red signal rejection at a given phase.

### Recommended pipeline workflow

1. **At first contact** — set the Lead Source and Pipeline = *Not contacted*
2. **After the first call** — record the result and set the Next contact date
3. **On a positive response** — advance the pipeline: *Cooperation interest* → *Contract interest*
4. **When sending the contract** — fill in the Contract sent date
5. **After signing** — set Pipeline = *Active contract* and add the Contract returned date

---

## 8. Tips for Daily Work

### Quick search

Every module has a search field at the top — it searches by name, city, postal code, and codes. The global search (magnifying glass icon in the navigation) searches hospitals, clinics, and persons simultaneously.

### Filtering and presets

The **Filter** button allows combining multiple criteria at once — country, region, pipeline status, person type, activity status, etc. Filters can be saved as **presets** for repeated use.

### Export

Every list page has an **Export** button (table icon) — exports the currently displayed and filtered dataset to Excel/CSV.

### Web enrichment

For clinics, an **Enrich from web** feature is available — the system automatically finds missing contact details (phone, email, website) based on the clinic name and address.

### GPS and map

Coordinates can be entered manually, captured from the device GPS (*Get Location*), or displayed on a map after entry (*Show on Map*). Available for hospitals, clinics, and person addresses.

### Multi-language environment

INDEXUS is fully localized — Slovak, Czech, English, Hungarian, Romanian, Italian, German. The interface language is set in the user profile. The country filter in the navigation allows displaying only records for the selected country.

---

*Healthcare Network Documentation — INDEXUS CRM*
*Last updated: May 2026*
