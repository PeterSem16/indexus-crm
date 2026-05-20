# INDEXUS CRM — User Manual

**Version 2.0 | May 2026**

---

## What is INDEXUS?

INDEXUS is a complete business management platform for cord blood banking companies operating across multiple countries. It brings together everything your team needs — customer management, sales campaigns, call center operations, contracts, collections, invoicing, medical partner relationships, and field representative tracking — into one unified system.

INDEXUS is built for multi-country operations with full support for Slovakia, Czech Republic, Hungary, Germany, Italy, Romania, and more. Every user sees data relevant to their country and role.

**Access:** Web browser at `https://indexus.cordbloodcenter.com`

---

## Who Uses INDEXUS?

| Role | What they do in INDEXUS |
|---|---|
| **Administrator** | Manages users, settings, access rights, system configuration |
| **Sales Agent / Call Center** | Works campaigns, makes calls, logs dispositions, manages customer contacts |
| **Team Manager** | Monitors agent activity, reviews reports, manages campaigns |
| **Collections Specialist** | Processes cord blood collection documents, manages lab results |
| **Field Representative** | Manages hospital visits via INDEXUS Connect mobile app |
| **Medical Partner Manager** | Manages relationships with hospitals and medical partners |

---

## Navigation Overview

The sidebar on the left gives access to all modules. It is organized into sections:

| Section | Modules |
|---|---|
| **Overview** | Dashboard, Pipeline, Reports |
| **Medical Network** | Medical Partner Network, Hospitals & Clinics |
| **NEXUS Suite** | NEXUS Omni (Email), NEXUS Pulse (Call Center), NEXUS Missions (Campaigns) |
| **Customers** | Customers, Contracts, Collections, Customer Invoices |
| **Administration** | Users, Settings, Configurator, Automations |

> Some modules are visible only to users with the appropriate role and permissions.

---

---

# SECTION 1 — OVERVIEW

---

## 1.1 Dashboard

The Dashboard is your home screen. It gives a live snapshot of what's happening across the business.

**What you see:**
- **Key metrics** — total customers, active campaigns, open collections, pending tasks
- **Recent activity** — latest customer updates, calls, and system events
- **Country overview** — breakdown of activity by country for multi-country operations
- **Quick access** — shortcuts to the most used functions

The Dashboard adapts to your role — agents see their own stats, managers see team-wide data.

---

## 1.2 Pipeline

The Pipeline is a **Kanban-style board** for tracking customers and leads through your sales process.

**How it works:**
- Each card represents a customer or lead
- Cards move through columns representing stages (e.g. New Contact → Interested → Offer Sent → Signed)
- Drag and drop cards between columns as the status changes
- Click any card to view full customer details

**Use it for:**
- Visualizing your sales funnel at a glance
- Identifying stuck deals that need attention
- Managing lead follow-ups

---

## 1.3 Reports

The Reports module provides analytics and performance data across the entire system.

**Available reports:**
- Campaign performance (contacts reached, conversion rates, dispositions)
- Agent activity (calls made, talk time, outcomes per agent)
- Customer acquisition by country and period
- Collection statistics
- Collaborator (field rep) visit activity

Reports can be filtered by country, date range, campaign, and user. Most reports can be exported.

---

---

# SECTION 2 — MEDICAL NETWORK

---

## 2.1 Medical Partner Network (MPN)

The Medical Partner Network module manages strategic relationships with hospitals, maternity wards, and medical institutions that are partners of the cord blood banking company.

**Key capabilities:**
- **Partner directory** — full database of medical partners with contact details, partnership status, and assigned account manager
- **Communication schedules** — plan and track regular contact with each partner (calls, visits, emails)
- **First contact protocols** — standardized scripts and workflows for approaching new medical partners
- **Partnership status tracking** — from prospect → active partner → strategic partner
- **Activity history** — complete log of all interactions with each partner

**Typical workflow:**
1. Add a new hospital as a prospect
2. Assign an account manager
3. Schedule first contact according to protocol
4. Log outcomes of meetings and calls
5. Promote to active partner status once relationship is established

---

## 2.2 Hospitals & Clinics

A comprehensive directory of all hospitals and outpatient clinics in your operating territories.

**What's stored per hospital:**
- Name, address, city, postal code, country
- Contact person (name, title, phone, email)
- Department and specialization
- Notes and internal tags
- GPS coordinates (for field rep navigation)

**What's stored per clinic:**
- Doctor name, title, specialization
- Clinic name and address
- Phone, email, website
- Assignment to a city/district

**Key actions:**
- Search and filter by country, city, specialization
- Export lists to CSV
- Link hospitals to MPN partnerships
- Assign field representatives to territories
- View visit history from INDEXUS Connect

---

---

# SECTION 3 — NEXUS SUITE

The NEXUS Suite is the communications hub of INDEXUS. It covers three major areas: email, call center operations, and campaign management.

---

## 3.1 NEXUS Omni — Email & Communications

NEXUS Omni is the integrated email client and communication hub.

**Features:**
- **Inbox** — read and reply to emails linked to customer accounts
- **Microsoft 365 integration** — connects to your company email via Microsoft Graph API, showing emails from your actual inbox
- **Email-to-customer linking** — emails are automatically or manually linked to customer records
- **Compose and send** — write emails directly in INDEXUS, including template-based messages
- **Email history per customer** — view the full email thread history for any customer from their profile
- **Sentiment analysis** — AI automatically reads incoming emails and tags them as positive/neutral/negative with an alert level
- **NexusPoint (SharePoint)** — integration with Microsoft SharePoint for document sharing and team collaboration. Access company documents, folders, and files directly within INDEXUS

**Email alerts:** If a negative email is received from a customer, the system creates an automatic alert so managers are notified immediately.

---

## 3.2 NEXUS Pulse — Call Center Workspace

NEXUS Pulse is the full-featured call center agent workspace. This is where agents spend most of their working day.

### Agent Dashboard

When an agent opens NEXUS Pulse, they see:
- **Assigned contacts for today** — customers to call from active campaigns
- **Call queue** — inbound calls waiting to be answered
- **SIP phone panel** — built-in telephone directly in the browser (no external software needed)
- **Active call display** — real-time info about the current call

### Making Calls

1. Select a contact from the campaign list or search for a customer
2. Click the **Call** button — the SIP phone dials automatically
3. During the call, the customer's full profile is visible on screen
4. After the call, the agent logs a **disposition** (outcome)

### Logging Call Outcomes (Dispositions)

After every call, agents must log what happened:
- Select a **disposition** (e.g. Interested, Not Interested, Callback Requested, Voicemail, No Answer)
- Select **sub-dispositions** if configured (additional detail codes)
- Fill in the **SOP Checklist** — a structured form ensuring key topics were covered during the call
- Add free-text notes

All outcomes are saved to the customer record and campaign statistics automatically.

### SIP Phone Features

The built-in SIP phone supports:
- Outbound calls to any number
- Inbound call receiving with customer name display
- Call on hold / transfer
- Mute / unmute
- Call recording (automatic if enabled)
- DTMF (keypad tones for IVR navigation)

### Inbound Call Handling

When an inbound call arrives:
- A notification pops up with the caller's number
- If the number matches a customer, their profile opens automatically
- Agent accepts or declines the call from the workspace

### Calls & Transcripts

All calls that are recorded appear in the **Calls & Transcripts** section:
- Listen to call recordings directly in the browser
- Read AI-generated transcripts of calls
- See customer name, campaign, disposition, and sub-dispositions
- Review the SOP checklist filled during the call
- AI sentiment analysis of the call (positive/neutral/negative)
- Quality score and compliance notes

### FAQ & SOP Panel

During an active call, agents have access to:
- **FAQ** — quick answers to common customer questions
- **SOP** — standard operating procedures and call scripts relevant to the current campaign

### Shift Management

Managers can define work shifts and assign agents. The system tracks:
- When agents log in and out
- Active time vs. idle time
- Calls per shift

### AI Virtual Agent

INDEXUS includes an AI-powered voice bot for handling inbound calls:
- Answers calls automatically when no agent is available
- Speaks in multiple languages (Slovak, Czech, Hungarian, etc.)
- Collects basic information and routes calls to the right department
- Full conversation transcript available after the call

---

## 3.3 NEXUS Missions — Campaign Management

NEXUS Missions is the campaign management engine. Every outbound calling or contact initiative is organized as a campaign.

### What is a Campaign?

A campaign is a structured outreach effort targeting a specific group of customers. It has:
- A defined list of contacts to reach
- A schedule and timeline
- Assigned agents
- Disposition codes (outcome categories)
- Reporting and KPIs

### Creating a Campaign

1. Go to **NEXUS Missions** → **New Campaign**
2. Set the campaign name, country, target segment, and date range
3. Import or select contacts (from the customer database, filtered by criteria)
4. Configure dispositions — define what outcomes agents can log
5. Assign agents to the campaign
6. Set a caller ID (the number shown to customers)
7. Activate the campaign

### Campaign Phases

Campaigns can be divided into multiple phases, each with different contact lists, scripts, or assigned agents. This allows for structured follow-up sequences (e.g. Phase 1: Initial contact, Phase 2: Follow-up, Phase 3: Final attempt).

### Mailchimp Integration

Campaigns can be connected to Mailchimp for email sequences:
- Sync contact lists to Mailchimp audiences
- Trigger email sequences based on call outcomes
- Track email open rates alongside call outcomes

### Status Management Engine

Each campaign can have its own custom disposition system configured in the **Configurator**. This allows different campaigns to use different outcome categories — for example, a hospital partner campaign uses different dispositions than a customer retention campaign.

### Campaign Reports

Each campaign has a detailed reports page showing:
- Total contacts: reached, unreached, pending
- Disposition breakdown (how many of each outcome)
- Agent performance comparison
- Daily/weekly progress charts
- Conversion rates

---

---

# SECTION 4 — CUSTOMER MANAGEMENT

---

## 4.1 Customers

The Customers module is the central database of all people who have signed contracts or are in the process of signing — expecting parents who have registered for cord blood banking.

**Customer record contains:**
- Personal details (name, date of birth, address)
- Contact information (phone, email)
- Partner / spouse details
- Expected due date and pregnancy information
- Assigned country, region, district
- Source of acquisition (how they found the company)
- Assigned sales agent
- Full activity timeline (calls, emails, notes, tasks)

**Key features:**

| Feature | Description |
|---|---|
| **Advanced search** | Filter by country, region, status, date, agent, source |
| **Activity timeline** | Every interaction logged chronologically |
| **Documents** | Upload and store documents per customer |
| **AI Assistant** | Ask questions about a customer record in natural language |
| **Tasks** | Assign follow-up tasks linked to the customer |
| **Call history** | All calls with recordings and transcripts |
| **Email history** | All emails exchanged |
| **Notes** | Internal notes visible to the team |

**Customer statuses** move the customer through the pipeline: Lead → In Progress → Contract Signed → Active → etc. (configurable per country)

---

## 4.2 Contracts

The Contracts module manages the full lifecycle of customer contracts — from drafting to signing to storage.

**Features:**
- **Contract templates** — pre-built templates per country and product type
- **Visual contract editor** — edit contract content directly in INDEXUS
- **Digital signatures** — send contracts for electronic signature (customers sign via a unique link in their browser — no app needed)
- **Signature tracking** — see when a customer opened the signing link, when they signed, and download the signed PDF
- **Audit timeline** — full log of every action on the contract (created, sent, opened, signed, downloaded)
- **Multi-language contracts** — contracts available in the customer's language
- **Status tracking** — Draft → Sent → Signed → Archived

**Signing process:**
1. Prepare contract from template
2. Fill in customer data (auto-populated from customer record)
3. Send signing link to customer by email or SMS
4. Customer opens link, reviews, and signs electronically
5. Signed PDF is stored automatically in INDEXUS

---

## 4.3 Collections

The Collections module manages the cord blood sample collection process — from the birth of the baby through lab processing to final storage.

**What it covers:**
- **Collection requests** — tracking each collection from registration to completion
- **OCR document scanning** — upload birth certificates, hospital forms, and other documents; INDEXUS automatically extracts key data (baby name, date of birth, hospital) using AI-powered OCR
- **Lab results** — record and track laboratory analysis results for each sample
- **CBU (Cord Blood Unit) reports** — generate and download standardized CBU reports
- **Collection status tracking** — from Registered → Sample Collected → In Transit → Lab Received → Results Ready → Stored
- **Courier coordination** — log pickup and delivery details

**Key workflow:**
1. Customer's baby is born — hospital notifies the company
2. Courier collects the sample kit from the hospital
3. Sample is sent to the lab
4. Lab results are entered into INDEXUS (or uploaded via document scanning)
5. CBU report is generated and delivered to the customer
6. Sample is confirmed as stored

---

## 4.4 Customer Invoices

The Customer Invoices module handles billing for cord blood banking services.

**Features:**
- Create invoices for customers (annual storage fees, registration fees, additional services)
- Track payment status (unpaid, paid, overdue)
- Send invoice reminders
- Record payments
- View full invoice history per customer
- Filter by country, status, date range

---

---

# SECTION 5 — ADDITIONAL MODULES

---

## 5.1 Tasks

The Tasks module is a shared task manager for the entire team.

- Create tasks with a title, description, due date, priority, and assignee
- Link tasks to specific customers
- Track status: Open → In Progress → Done
- Filter by assignee, priority, due date
- Receive notifications when tasks are assigned to you or become overdue

---

## 5.2 Collaborators & Field Representatives

The Collaborators module manages the network of field representatives — people who visit hospitals and clinics in person to build relationships.

**Collaborator record contains:**
- Personal and contact information
- Assigned territory (country, regions, districts)
- Bank account details (for commission payments)
- INDEXUS Connect mobile app access credentials
- SIP phone extension (for VoIP calling from the mobile app)
- Activity reports: visits completed, hospitals covered

**Collaborator Reports:**
- Visit counts per collaborator per period
- Territory coverage maps
- Commission calculations based on visit activity

---

## 5.3 Visit Events

Tracks hospital and clinic visits made by field representatives via INDEXUS Connect:
- Date, time, hospital, representative
- Visit type and status
- GPS coordinates at start and end of visit
- Voice note transcripts attached to the visit
- Duration

---

## 5.4 Lead Intelligence System

The Lead Intelligence System (accessible from the configurator menu as "Lead Search") is a 7-layer AI-powered tool for discovering new potential medical partners and customers.

**How it works:**
1. Define a search goal (e.g. "gynecology clinics in Slovakia")
2. The system searches public web sources, directories, and registries
3. Extracts contact information (doctor name, clinic, phone, email, address)
4. Scores each lead by confidence and relevance
5. Deduplicates against existing customers and contacts
6. Imports approved leads directly into INDEXUS

**Key features:**
- Country and segment filtering
- AI-powered data extraction
- Contact scoring (0–100 confidence)
- Deduplication against existing database
- Direct import to customer or hospital database

---

## 5.5 SOP Management

Standard Operating Procedures — a knowledge base for the call center team.

- Create and organize SOP documents (call scripts, handling guidelines, FAQs)
- Organize by category and country
- Agents access SOPs during live calls in the NEXUS Pulse workspace
- Version control — track changes to procedures over time
- AI-searchable — agents can ask questions and get answers from SOPs

---

## 5.6 Training Room

A dedicated space for agent training and quality management.

- Review recorded calls for training purposes
- Leave timestamped comments on call recordings
- Score calls against quality criteria
- Assign training materials to agents
- Real-time monitoring — managers can listen to live calls (barge-in)
- Track training progress per agent

---

## 5.7 AI Assistant

Available throughout INDEXUS via the chat icon — a GPT-4o powered assistant that understands the context of your work.

**What you can ask:**
- "Show me all customers from Bratislava who haven't been contacted in 30 days"
- "Summarize the last 5 calls with this customer"
- "What are the next steps for this customer?"
- "How many collections were processed last month in Slovakia?"
- "Find all overdue invoices for Czech Republic"

The assistant respects your role — it only shows data you have permission to access. It understands Slovak, Czech, Hungarian, German, Italian, Romanian, and English.

---

## 5.8 Notifications

The Notifications Center shows real-time alerts for events that require your attention:
- New inbound call or missed call
- Task due or overdue
- Customer email received (with negative sentiment)
- Campaign completion
- New lead imported
- Document signed by customer

Notifications appear as a bell icon in the top bar and as browser push notifications if enabled.

---

---

# SECTION 6 — ADMINISTRATION

---

## 6.1 Users

Manage who has access to INDEXUS and what they can do.

**For each user you can set:**
- Name, email, password
- Role (Admin, Manager, Agent, Collections, Read-only, etc.)
- Country assignment — which country's data they can access
- Module permissions — which modules are visible and editable
- Active/inactive status

**Roles control:**
- Which sidebar modules appear
- Which customers and campaigns are accessible
- Whether the user can create, edit, or only view data

---

## 6.2 Settings

System-wide configuration for your INDEXUS installation.

**Key settings areas:**

| Area | What you configure |
|---|---|
| **Company** | Company name, logo, contact details |
| **Countries** | Active countries, currencies, default language |
| **SIP / Telephony** | Asterisk server connection, SIP trunks, extensions |
| **Email** | Microsoft 365 / SMTP connection for outgoing email |
| **Mailchimp** | API key for campaign email integration |
| **AI** | OpenAI API key for AI assistant, transcription, sentiment |
| **Exchange Rates** | Currency rates for multi-country pricing |
| **Notifications** | Push notification settings |
| **Mobile App** | INDEXUS Connect configuration |

---

## 6.3 Configurator

The Configurator is where administrators customize INDEXUS for their specific workflows. It has several sub-sections:

### Status Management Engine

Define the disposition system used in campaigns:
- Create status categories (groups of dispositions)
- Create individual disposition codes with names, colors, and meanings
- Assign dispositions to specific campaigns
- Configure sub-disposition codes (checklists)

This allows each campaign to have a completely different set of outcome codes tailored to that campaign's goals.

### Web Forms

Build and manage public registration forms:
- **Form Builder** — drag-and-drop form editor with custom fields
- **Public URL** — each form gets a unique shareable link (e.g. `https://indexus.cordbloodcenter.com/f/form-slug`)
- **Pipeline integration** — form submissions automatically create customer records and appear in the pipeline
- **Country-specific forms** — different forms for different countries
- **Email notifications** — get notified when a form is submitted

### Products

Manage the product catalog — cord blood banking packages, pricing tiers, and service options available in each country.

### Invoices (Internal)

Internal financial record management separate from customer invoices.

---

## 6.4 Automations

The Automations module lets you define rules that trigger actions automatically — without manual intervention.

**How automations work:**

Every automation has three parts:
1. **Trigger** — what event starts the automation (e.g. "Customer status changes to Interested")
2. **Conditions** — optional filters (e.g. "Only if country is Slovakia")
3. **Actions** — what happens automatically (e.g. "Assign a task to the customer's agent", "Send an email", "Create a notification")

**Available triggers:**
- Customer created or updated
- Customer status changed
- Campaign disposition logged
- Form submitted
- Collection status changed
- Invoice created or overdue
- Scheduled (time-based, e.g. "Every Monday at 9:00")

**Available actions:**
- Create a task
- Send an email (using a template)
- Send an SMS
- Create a notification
- Update a customer field
- Assign a customer to a different agent
- Add a note to a customer record

**Example automations:**
- When a customer signs a contract → automatically create a "Send welcome package" task
- When a collection is marked as overdue → notify the collections manager
- When a web form is submitted → assign the lead to the agent responsible for that district
- Every Friday → generate a weekly summary report and email it to managers

---

---

# SECTION 7 — INTEGRATIONS

---

## Microsoft 365 / NexusPoint

INDEXUS connects to Microsoft 365 for:
- **Email** — read and send emails from your company inbox within INDEXUS
- **SharePoint (NexusPoint)** — browse and access SharePoint document libraries directly in INDEXUS. Share documents with customers and partners without leaving the system.

Setup requires a Microsoft 365 admin to grant API permissions. Once connected, all users with MS365 credentials can access their email and SharePoint.

---

## Mailchimp

For campaigns that include email sequences:
- Connect your Mailchimp account in Settings
- Sync campaign contact lists to Mailchimp audiences
- Trigger automated email sequences based on call outcomes
- View open and click rates alongside call dispositions

---

## OpenAI

INDEXUS uses GPT-4o and Whisper for:
- **AI Assistant** — natural language queries across the entire CRM
- **Call transcription** — automatic speech-to-text for recorded calls
- **Sentiment analysis** — automatic tone detection on calls and emails
- **Lead extraction** — parsing raw text from web sources into structured contact data
- **AI Virtual Agent** — the inbound call bot

---

## Asterisk / SIP Telephony

INDEXUS integrates with Asterisk via ARI (Asterisk REST Interface) for:
- Call routing to agents
- Call recording
- Inbound call handling
- Automatic call distribution (ACD)
- SIP extension management

---

---

# SECTION 8 — QUICK REFERENCE

---

## Common Tasks — Where to Go

| I want to… | Go to |
|---|---|
| See today's overview | Dashboard |
| Make outbound calls | NEXUS Pulse → Agent Workspace |
| Log a call outcome | NEXUS Pulse → After call → Disposition form |
| Listen to a recorded call | NEXUS Pulse → Calls & Transcripts |
| Start a new campaign | NEXUS Missions → New Campaign |
| Find a customer | Customers → Search |
| Add a new customer | Customers → New Customer |
| Send a contract | Contracts → Select customer → Send for signature |
| Check a collection status | Collections → Search |
| Create an invoice | Customer Invoices → New Invoice |
| Schedule a hospital visit | INDEXUS Connect (mobile app) |
| Find a hospital contact | Hospitals & Clinics → Search |
| Add a task | Tasks → New Task |
| Check my notifications | Bell icon (top right) |
| Configure automations | Automations |
| Add a new user | Users → New User |
| Change system settings | Settings |

---

## Role-Based Access Summary

| Module | Admin | Manager | Agent | Collections |
|---|---|---|---|---|
| Dashboard | Full | Full | Personal stats | Limited |
| Customers | Full | Full | Own + team | Read |
| Contracts | Full | Full | Read | Read |
| Collections | Full | Full | Read | Full |
| Campaigns | Full | Full | Assigned only | — |
| NEXUS Pulse | Full | Full | Full | — |
| Reports | Full | Full | Personal | Limited |
| Users | Full | Read | — | — |
| Settings | Full | — | — | — |
| Automations | Full | View | — | — |

> Actual permissions are configured by the system administrator per user. The table above shows typical default access levels.

---

## Keyboard & Navigation Tips

- **Ctrl+K** — Quick search across the entire system
- **Click the logo** — Return to Dashboard from anywhere
- **Bell icon** — Open Notification Center
- **Avatar (top right)** — Access your profile and preferences
- **Language switcher** — Change UI language (available in profile settings)

---

*INDEXUS CRM User Manual v2.0*
*Last updated: May 2026*
*For technical support: support@cordbloodcenter.com*
