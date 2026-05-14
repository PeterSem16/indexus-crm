# INDEXUS — Documentation: Healthcare Network

> **Healthcare Network** is the core of the sales team's work. This section of the system tracks all healthcare institutions and their personnel — from large maternity hospitals to private gynecological practices and midwives. The goal is to always have an up-to-date overview of partner relationships, cooperation status, and contact history.

---

## Table of Contents

1. [Module Overview and Relationships](#1-module-overview-and-relationships)
2. [Module: Hospitals](#2-module-hospitals)
3. [Module: Clinics](#3-module-clinics)
4. [Module: Persons / Collaborators](#4-module-persons--collaborators)
5. [Referral System](#5-referral-system)
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
| **Contact person** | Name of an internal contact at the hospital (not from the Persons module) |
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

Displays the history and current status of all campaigns this hospital has been included in. You can track how outreach to this institution is progressing across individual campaigns.

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
| **Codes** | Healthcare facility ID, PZS code, PZS name, Company registration number (IČO) |
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

A chronological list of all interactions with the clinic — calls, emails, visits. Each record contains date, contact type, result, and note.

---

#### Tab: Communication (Email)

Send an email directly to the clinic without leaving INDEXUS. Supports:
- Sender selection (personal MS365 account or shared mailbox)
- Template selection by category and language
- CC recipient
- Attachments

---

#### Tab: Personnel

Displays all workers assigned to this clinic — same view as for hospitals. The clinic's primary doctor (practice owner) is highlighted at the top.

---

#### Tab: Campaigns

History of the clinic's involvement in campaigns.

---

#### Tab: Network

Shows which healthcare network the clinic belongs to (if it is part of a clinic group or hospital network).

---

#### Tab: Referrals

Displays a list of referrals — who referred this clinic and which other clinics this clinic has referred. More in the [Referral System](#5-referral-system) chapter.

---

### Adding a new clinic

Click **+ Add Clinic**. A side panel opens with a form. When you enter the city, the system automatically suggests the region and district. The postal code can be automatically looked up via AI search (button next to the postal code field).

**After saving, we recommend:**
1. Setting the pipeline status (at least *Not contacted*)
2. Adding a lead source
3. Adding personnel via the Personnel tab

---

## 4. Module: Persons / Collaborators

### What we track here

The Persons module (also called Collaborators in the navigation) contains all healthcare workers — doctors, midwives, nurses, and other staff. Each person can be assigned to one or more hospitals and clinics. Some persons are also active collaborators with a signed contract and receive fees.

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

### Professional classifications (detailed)

For more precise tracking, a professional classification is used:
- Gynecology specialists
- General practitioners
- Chief physicians (Primár)
- Medical directors
- Specialized midwives
- Charge midwives (leading midwives)
- Midwives without specialization
- Head nurses
- Operating room nurses
- General nurses
- Healthcare assistants
- ...and others

### Person card — tabs (Wizard)

The person's card is organized into steps / tabs:

---

#### Tab 1: Personal Data

| Field | Description |
|-------|-------------|
| **Title before name** | e.g. MUDr., Mgr., doc. |
| **First name** | Given name |
| **Middle name** | Optional |
| **Last name** | Surname |
| **Maiden name** | Birth surname (if different) |
| **Title after name** | e.g. PhD., MPH |
| **Birth number** | National identification number |
| **Date of birth** | Day, month, year |
| **Place of birth** | Birth city |
| **Health insurance** | Insurance company |
| **Marital status** | Single, Married, Divorced, Widowed |
| **Professional classification** | Detailed category (see above) |
| **Highest education** | From primary school to doctorate |
| **Workplace name** | Name of primary workplace |
| **Is manager** | Toggle — marks leadership positions |
| **Collaborator type** | Doctor, Nurse, Midwife... |
| **Partner category** | Precise position in the network (Chief Physician, KOL, Gynecologist...) |
| **CBC activities** | Activities in the cord blood banking area |
| **Countries** | May operate in multiple countries |
| **Active** | Person's status in the system |
| **Svet zdravia** | Membership in a hospital network |
| **Client contact** | Person is a direct contact for clients |

---

#### Tab 2: Contact Details

| Field | Description |
|-------|-------------|
| **Phone** | Work phone |
| **Mobile 1 / Mobile 2** | Mobile numbers |
| **Other contact** | e.g. WhatsApp, Viber |
| **Email** | Email address |

> Each phone number has a direct call button to dial via INDEXUS.

---

#### Tab 3: Banking Details

Filled in for collaborators who receive fees.

| Field | Description |
|-------|-------------|
| **IBAN** | Personal bank account |
| **SWIFT / BIC** | Bank code |
| **Company name** | If the person invoices through a company or sole trader |
| **Company reg. no. / Tax no. / VAT no.** | Company identification numbers |
| **Company IBAN / SWIFT** | Company bank account |

---

#### Tab 4: Contracts and Fees

Records of the collaborator's contractual relationships.

| Field | Description |
|-------|-------------|
| **Contract type** | Form of agreement (DPP, DPČ, cooperation agreement...) |
| **Contract number** | Internal contract number |
| **Agreement form** | Legal form |
| **Valid from / to** | Date range of contract validity |
| **Contract sent / returned** | Tracking physical circulation of the contract |
| **Social insurance registration** | Date of registration with the Social Insurance Agency |
| **Social insurance cancellation** | Date of deregistration |
| **Monthly fees** | Whether the collaborator receives regular monthly fees |
| **Fee type** | Fixed amount or percentage-based |
| **Fixed fee amount** | Amount in the relevant currency |
| **Percentage fee** | Share of value by country |
| **Contract note** | Internal notes |

---

#### Tab 5: Documents

Storage of documents assigned to the person — scanned contracts, attachments, certificates. Documents can be uploaded and viewed directly in INDEXUS.

---

#### Tab 6: Activities and Actions

Overview of the collaborator's activities — visits, calls, actions. The complete history of interactions recorded for this person is displayed here.

---

#### Tab 7: History

Complete chronological overview of all changes and events recorded for this person.

---

#### Tab 8: Medical Network

A key tab — shows which hospitals and clinics this person is assigned to.

For each assignment you see:
- **Institution** (hospital or clinic) with a link to its card
- **Department** — e.g. *Gynecology and Obstetrics Department*
- **Position** — e.g. *Chief Physician*, *Attending Physician*, *Midwife*
- **Role** — specific role within the position
- **Category** — from the MPN category list
- **Date from / to** — time range of the assignment
- **Primary assignment** — designation of the main workplace
- **Active / Inactive** — assignment status
- **Note** — optional note for the assignment

> **Important:** An assignment to an institution is added via the **Personnel** tab in the hospital or clinic card — not directly here. This tab only serves to view and edit existing assignments.

---

#### Tab 9: Mobile Application

Management of the collaborator's access to INDEXUS Connect (mobile application). Shows connection status, QR code for login, and mobile access settings.

---

### Lead source and referrals for persons

Just like for clinics, the following is tracked for persons:
- **Lead source** — how the person entered the database
- **Is referred by a doctor** — toggle (if yes, it is visible next to the person in the personnel list)
- **From a conference** — whether the contact was made at a conference

---

## 5. Referral System

### Why referrals are key

In cord blood banking, trust is fundamental. Most new collaborators come through recommendations from another doctor or midwife. INDEXUS therefore tracks these relationships precisely — we know who referred whom, and we can strategically develop the referral network.

### How referrals work

#### For clinics

1. When entering a clinic, select **Lead Source** = *Doctor referral*
2. Check the **Is referred by a doctor** toggle
3. In the **Referrals** tab, a link to the referring doctor appears

The system tracks:
- Who referred this clinic
- Which other clinics this clinic has referred

#### For persons (institution personnel)

When assigning a person to a hospital or clinic via the Personnel tab, you can fill in:
- **Recommended by** — select the name of the person who recommended this worker

After saving, a purple badge appears next to the worker's name in the personnel list:
> *"Recommended by John Smith"*

The system correctly handles gendered language based on the surname.

### How to keep referrals up to date — best practices

| Situation | What to do |
|-----------|-----------|
| A doctor recommended a new colleague | When creating the person, set Lead Source = *Doctor referral* and record the referrer's name in the institution assignment |
| A midwife recommended a clinic | For the clinic, set Lead Source = *Doctor referral* and in the Referrals tab, link to the referring person |
| An active collaborator referred colleagues | Lead Source = *Current collaborator* — allows measuring the productivity of existing collaborators |
| Conference contact | Lead Source = *Conference*, add the conference name and date |

> **Why this matters:** Based on lead sources, you can measure which channels bring the most collaborators and set outreach priorities. Correctly filled-in referral history is also the basis for referral fees.

---

## 6. Working with Institution Personnel

### Adding a person to a hospital or clinic

1. Open the **hospital** or **clinic** card
2. Go to the **Personnel** tab
3. Click **+ Add person**
4. Search for an existing person in the database or create a new one
5. Fill in:
   - **Department** — e.g. *Gynecology and Obstetrics Dept.*
   - **Position** — e.g. *Midwife*
   - **Category** — from the MPN category list
   - **Primary assignment** — if this is the person's main workplace
   - **Recommended by** — who recommended this person (for referral tracking)
   - **Active** — whether the assignment is currently active
6. Save

### Categorical classification of personnel

INDEXUS uses an **MPN category** list for precise personnel classification. Categories apply to both hospitals and clinics and are divided by scope:

**Categories for hospitals:**
- Hospital Director
- Department Head
- Chief Physician (Primár)
- Attending Physician (Sekundár)
- Gynecologist
- Obstetrician
- Neonatologist
- Pediatrician
- Head Nurse
- Nurse
- Delivery Midwife
- Midwife
- Anesthesiologist, Surgeon, Hematologist, Oncologist...

**Categories for clinics:**
- Ambulatory Gynecologist
- General Practitioner
- KOL (Key Opinion Leader) — doctors with significant influence in the field
- Strategic Partner
- Referral Source

**Special categories:**
- Prenatal Instructor
- Doula
- Lactation Consultant
- Pharmacist
- Laboratory Specialist

---

## 7. Pipeline — Cooperation Status with a Clinic

### Visual progress of cooperation

For each clinic, INDEXUS shows a **5-step progress bar** indicating the current stage of the relationship:

```
[Contact] → [Referral] → [Cooperation Interest] → [Contract Interest] → [Partner]
```

| Step | When it is completed |
|------|---------------------|
| **Contact** | A lead source has been set (the clinic is in the database with an assigned origin) |
| **Referral** | The clinic was referred by another doctor / collaborator |
| **Cooperation interest** | The doctor confirmed interest in cooperation (pipeline = *coop:interested*) |
| **Contract interest** | The doctor is willing to sign a contract (pipeline = *contract_int:interested*) |
| **Partner** | The contract is signed and active (pipeline = *contract:active*) |

Steps marked in red signal rejection at a given phase — e.g. the doctor declined cooperation or refused to sign a contract.

### Recommended pipeline workflow

1. **At first contact** — set the Lead Source and Pipeline = *Not contacted* or *Cooperation interest*
2. **After the first call** — record the result (Last call result field) and set the Next contact date
3. **On a positive response** — advance the pipeline: *Cooperation interest* → *Contract interest*
4. **When sending the contract** — fill in the Contract sent date
5. **After signing** — set Pipeline = *Active contract* and add the Contract returned date

---

## 8. Tips for Daily Work

### Quick search

Every module has a search field at the top — it searches by name, city, postal code, and codes. The global search (magnifying glass icon in the navigation) searches hospitals, clinics, and persons simultaneously.

### Filtering

The **Filter** button allows combining multiple criteria at once — country, region, pipeline status, person type, activity status, etc. Filters can be saved as **presets** for repeated use.

### Export

The hospital, clinic, and person list pages all have an **Export** button (table icon) — exports the currently displayed and filtered dataset to an Excel/CSV file.

### Web enrichment

For clinics, a **Enrich from web** feature is available — the system attempts to automatically find missing contact details (phone, email, website) based on the clinic name and address.

### GPS and map

Every hospital, clinic, and person address can have GPS coordinates. Coordinates can be:
- Entered manually
- Captured from the device's GPS (*Get Location* button)
- Displayed on a map after entry (*Show on Map* button)

### Multi-language environment

INDEXUS is fully localized — Slovak, Czech, English, Hungarian, Romanian, Italian, German. The interface language is set in the user profile. The country filter in the navigation allows displaying only records for the selected country.

---

*Healthcare Network Documentation — INDEXUS CRM*
*Last updated: May 2026*
