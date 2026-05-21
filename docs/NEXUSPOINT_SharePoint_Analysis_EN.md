# NexusPoint — SharePoint Integration Analysis & Roadmap

**May 2026 | INDEXUS CRM**

---

## 1. Current State — What Is Already Built

NexusPoint is embedded inside the **NEXUS Omni** module (email client, left sidebar). It is a fully functional SharePoint file manager inside INDEXUS.

### What works today

| Feature | Status | Location |
|---|---|---|
| Browse SharePoint sites | ✅ Live | NEXUS Omni → NexusPoint tab |
| Browse document libraries (drives) | ✅ Live | NEXUS Omni → NexusPoint tab |
| Navigate folders (breadcrumb) | ✅ Live | NEXUS Omni → NexusPoint tab |
| Upload files (drag & drop or button) | ✅ Live | NEXUS Omni → NexusPoint tab |
| Create new folders | ✅ Live | NEXUS Omni → NexusPoint tab |
| Download files | ✅ Live | NEXUS Omni → NexusPoint tab |
| Delete files and folders | ✅ Live | NEXUS Omni → NexusPoint tab |
| File preview (images, PDFs, Office) | ✅ Live | NEXUS Omni → NexusPoint tab |
| File thumbnails | ✅ Live | NEXUS Omni → NexusPoint tab |
| Search files across a site | ✅ Live | NEXUS Omni → NexusPoint tab |
| Version history per file | ✅ Live | NEXUS Omni → NexusPoint tab |
| Restore previous file version | ✅ Live | NEXUS Omni → NexusPoint tab |
| Generate share links (view / edit) | ✅ Live | NEXUS Omni → NexusPoint tab |
| Manage file permissions | ✅ Live | NEXUS Omni → NexusPoint tab |
| Open file in SharePoint web browser | ✅ Live | NEXUS Omni → NexusPoint tab |

### What the MS365 connection provides

The system already has a full OAuth2 connection to Microsoft Graph API with the `.default` scope, meaning all permissions granted to the Azure AD app are available. The following Graph API areas are authenticated and ready to use:

- **SharePoint/OneDrive** — sites, drives, files, folders, permissions, versions, search
- **Email** — read inbox, send email
- **Calendar** — read events
- **Contacts** — read contacts
- **User profile** — read user info

---

## 2. What SharePoint (Graph API) Can Do — Full Capability Map

This is what Microsoft Graph API makes possible that is NOT yet integrated into INDEXUS:

### 2A. Document & Content Features

| Capability | What it enables | Value |
|---|---|---|
| **Office Online embedding** | Open Word/Excel/PowerPoint inline in INDEXUS — no download needed | ⭐⭐⭐⭐⭐ |
| **Co-authoring** | Multiple users edit the same Office document simultaneously | ⭐⭐⭐⭐ |
| **File metadata & custom columns** | Tag SharePoint files with custom fields (Customer ID, Country, Contract Type) | ⭐⭐⭐⭐⭐ |
| **SharePoint Lists** | Structured database tables in SharePoint (like Excel) usable as data sources | ⭐⭐⭐⭐ |
| **Full-text content search** | Search inside the content of files, not just filenames | ⭐⭐⭐ |
| **File activity feed** | See who opened, edited, or commented on a file | ⭐⭐⭐ |
| **Large file upload** | Resumable uploads for files > 4MB via upload sessions | ⭐⭐ |
| **File comments** | Add comments to specific files (like in Word "Comments") | ⭐⭐ |

### 2B. Integration with INDEXUS Business Entities

| Capability | What it enables | Value |
|---|---|---|
| **Customer-linked folders** | Each customer gets their own SharePoint folder. From the customer profile → see all their documents | ⭐⭐⭐⭐⭐ |
| **Contract auto-upload** | When a contract is e-signed → PDF automatically saved to customer's SharePoint folder | ⭐⭐⭐⭐⭐ |
| **Collection document storage** | OCR-scanned collection documents → saved to SharePoint automatically | ⭐⭐⭐⭐ |
| **Contract templates from SharePoint** | Pull contract templates directly from SharePoint instead of the INDEXUS database | ⭐⭐⭐⭐ |
| **Document sharing with customers** | Generate a direct download link for a specific document → send to customer via email/SMS | ⭐⭐⭐⭐ |
| **Campaign materials library** | Store campaign scripts, email templates, and training materials in SharePoint — agents browse them during calls | ⭐⭐⭐ |

### 2C. Automation & Real-time Features

| Capability | What it enables | Value |
|---|---|---|
| **SharePoint webhooks** | Get instant notification when a file is created, modified, or deleted in SharePoint | ⭐⭐⭐⭐ |
| **OneDrive delta sync** | Efficiently track changes in a SharePoint library since last check | ⭐⭐⭐ |
| **Approval workflows** (via Graph + Power Automate) | Route a document for approval — e.g., contract review before sending to customer | ⭐⭐⭐ |

### 2D. Microsoft Teams Integration

| Capability | What it enables | Value |
|---|---|---|
| **Teams channel messages** | Read and post to Teams channels from INDEXUS | ⭐⭐⭐ |
| **Teams meetings** | Create Teams meeting links from INDEXUS calendar | ⭐⭐⭐ |
| **Teams files** | Files in Teams channels are stored in SharePoint — already accessible via NexusPoint | ⭐⭐ |
| **Teams chat** | Send direct messages via Teams from within INDEXUS | ⭐⭐ |

### 2E. Microsoft 365 Productivity

| Capability | What it enables | Value |
|---|---|---|
| **Calendar write** | Create calendar events in Outlook from INDEXUS | ⭐⭐⭐⭐ |
| **Calendar invitations** | Schedule meetings with customers — send Outlook invitation directly | ⭐⭐⭐⭐ |
| **Tasks (Planner / To Do)** | Create tasks in Microsoft Planner or To Do from INDEXUS | ⭐⭐⭐ |
| **Outlook contact sync** | Two-way sync of CRM customers with Outlook contacts | ⭐⭐⭐ |

---

## 3. Proposed Enhancements — Prioritized Roadmap

### PRIORITY 1 — High Value, Reasonable Effort

---

#### 3.1 Customer Document Folders

**What:** Each customer in INDEXUS gets a corresponding folder in SharePoint. From the customer profile, there is a "Documents" tab that shows the contents of that customer's SharePoint folder — and allows uploading new documents, downloading, and sharing.

**How it works:**
1. Administrator configures a root SharePoint library (e.g., `Documents/Customers/`)
2. When a customer is created in INDEXUS → a folder is automatically created in SharePoint: `Customers/{Country}/{CustomerName}_{CustomerID}/`
3. From the customer profile → new **"Documents"** tab → shows the SharePoint folder
4. Agents can upload contracts, correspondence, birth certificates, lab results, and other documents
5. All documents are stored in SharePoint with version history — no INDEXUS storage used

**Value:** Replaces ad-hoc file storage. Every customer has a clean, organized document archive in SharePoint, accessible both from INDEXUS and from the SharePoint web interface.

**Effort:** ~3 weeks

---

#### 3.2 Signed Contract Auto-Upload to SharePoint

**What:** After a customer digitally signs a contract in INDEXUS, the signed PDF is automatically uploaded to the customer's SharePoint folder.

**How it works:**
1. Customer signs the contract via the INDEXUS signing link
2. The signed PDF is generated
3. Backend automatically uploads to: `Customers/{Country}/{CustomerName}_{ID}/Contracts/Contract_{Date}.pdf`
4. The customer profile shows the SharePoint path/link

**Value:** Zero manual work for saving contracts. Contracts are immediately in SharePoint, accessible to all team members with SharePoint access.

**Effort:** ~1 week (builds on 3.1)

---

#### 3.3 Office Online File Preview & Editing

**What:** When a user opens a Word, Excel, or PowerPoint file in NexusPoint, instead of downloading it, the file opens inline in INDEXUS using the Office Online embed URL — and can be edited directly in the browser.

**How it works:**
- Microsoft Graph provides an `embeds` URL for every Office file
- The file opens in an `<iframe>` inside INDEXUS
- Full editing capabilities — saves back to SharePoint automatically
- No Office desktop app needed

**Value:** Agents can view and edit documents without leaving INDEXUS and without downloading files.

**Effort:** ~1 week

---

#### 3.4 Calendar Write — Create Meeting Invitations

**What:** From any customer profile or visit event, users can create an Outlook calendar event and send an invitation to the customer.

**How it works:**
1. In the customer profile → button **"Schedule Meeting"**
2. Fill in: title, date/time, location, notes
3. Customer's email is pre-filled as attendee
4. Click **Send** → creates event in Outlook calendar AND sends email invitation to customer
5. The event appears in NEXUS Omni calendar view

**Value:** Removes the need to switch to Outlook for scheduling customer meetings.

**Effort:** ~2 weeks

---

#### 3.5 SharePoint as Contract Template Source

**What:** Instead of storing contract templates in the INDEXUS database, templates are stored in a SharePoint library (`Templates/Contracts/`). The contract editor reads templates from SharePoint.

**How it works:**
1. Contracts team uploads/edits `.docx` templates directly in SharePoint (using full Word)
2. INDEXUS fetches the list of templates from SharePoint
3. When creating a contract → select template → INDEXUS downloads and processes it
4. Templates are versioned — rollback if needed

**Value:** Business users can edit contract templates in Word with full formatting — no need to work in the INDEXUS editor. Templates have version history in SharePoint.

**Effort:** ~2 weeks

---

### PRIORITY 2 — Medium Value, Higher Effort

---

#### 3.6 File Metadata & Custom Columns

**What:** Files in SharePoint can have custom metadata columns (Customer ID, Country, Document Type, Status). INDEXUS can read and write these columns when uploading files.

**Examples of custom columns:**
- `CustomerID` — links the file to a specific customer
- `DocumentType` — Contract, Collection, Invoice, Correspondence
- `Country` — SK, CZ, HU, etc.
- `Status` — Draft, Signed, Archived

**Value:** Makes SharePoint files searchable and filterable by business attributes. Enables cross-customer document reports.

**Effort:** ~3 weeks

---

#### 3.7 SharePoint Webhooks — Real-time Change Notifications

**What:** INDEXUS subscribes to SharePoint change notifications. When a file is added, modified, or deleted in a monitored library, INDEXUS is notified instantly and can react (update the UI, create a task, send a notification to an agent).

**Use cases:**
- Customer uploads a document to a shared folder → agent is notified in INDEXUS
- A signed contract appears in SharePoint → INDEXUS marks the customer as "Contract Received"
- A lab result PDF is uploaded to a collection folder → collection status is updated

**Effort:** ~3 weeks

---

#### 3.8 Outlook Contact Sync

**What:** Two-way synchronization between INDEXUS customers and Outlook/MS365 contacts. Agents' Outlook address books stay up to date automatically.

**How it works:**
- When a customer is created/updated → pushed to Outlook contacts
- Custom Outlook contact folder: "INDEXUS Customers"
- Supports phone, email, address, notes

**Effort:** ~2 weeks

---

### PRIORITY 3 — Future Consideration

---

#### 3.9 Microsoft Teams Integration

Read/send messages to Teams channels from INDEXUS. Create Teams meetings. Mostly valuable if the team actively uses Teams for internal communication.

**Effort:** ~4 weeks

---

#### 3.10 Microsoft Planner Integration

Create tasks in Microsoft Planner from INDEXUS (complementing the existing internal task system). Useful for teams who use Planner as their primary task manager.

**Effort:** ~2 weeks

---

#### 3.11 SharePoint Lists as Data Sources

Use SharePoint lists (structured tables) as configuration data sources for INDEXUS — for example, pricing lists, product catalogs, country configurations. Business users maintain these lists in SharePoint; INDEXUS reads them via API.

**Effort:** ~3 weeks

---

## 4. Recommended Implementation Order

| Phase | Features | Effort | Outcome |
|---|---|---|---|
| **Phase 1** | 3.1 Customer folders + 3.2 Contract auto-upload | ~4 weeks | Every customer has a SharePoint archive. Signed contracts saved automatically. |
| **Phase 2** | 3.3 Office Online preview + 3.4 Calendar meetings | ~3 weeks | Open Office files inline. Schedule customer meetings from INDEXUS. |
| **Phase 3** | 3.5 Templates from SharePoint | ~2 weeks | Business team maintains contract templates in Word, no dev required for template changes. |
| **Phase 4** | 3.6 Metadata + 3.7 Webhooks | ~6 weeks | SharePoint becomes a fully integrated document management system. |
| **Phase 5** | 3.8–3.11 | varies | Full Microsoft 365 ecosystem integration. |

---

## 5. Technical Notes

### SharePoint Folder Structure — Recommended Design

```
SharePoint Document Library (root)
├── Customers/
│   ├── SK/
│   │   ├── Novakova_Jana_cust-abc123/
│   │   │   ├── Contracts/
│   │   │   │   └── Contract_2026-03-15.pdf
│   │   │   ├── Collections/
│   │   │   │   └── BirthCertificate_scan.pdf
│   │   │   └── Correspondence/
│   ├── CZ/
│   └── HU/
├── Templates/
│   ├── Contracts/
│   │   ├── SK_Standard_v3.docx
│   │   └── CZ_Premium_v2.docx
│   └── Emails/
├── Campaigns/
│   ├── Scripts/
│   └── Materials/
└── Internal/
    ├── SOPs/
    └── Training/
```

### Graph API Endpoints Needed (not yet implemented)

| Feature | Graph API endpoint |
|---|---|
| Create calendar event | `POST /me/events` |
| Embed Office file | `GET /drives/{id}/items/{id}/preview` |
| File metadata (columns) | `GET/PATCH /sites/{id}/lists/{id}/items/{id}` |
| Subscribe to changes | `POST /subscriptions` |
| Sync contacts | `POST/PATCH /me/contacts` |
| Teams messages | `POST /teams/{id}/channels/{id}/messages` |
| Create Teams meeting | `POST /me/onlineMeetings` |

### What Requires New Azure AD Permissions

Current permissions (`/.default` scope) cover most features. For some advanced scenarios, explicit additional permissions may need to be added in Azure AD:

| Feature | Permission needed |
|---|---|
| Calendar write | `Calendars.ReadWrite` |
| Contact write | `Contacts.ReadWrite` |
| Teams messages | `ChannelMessage.Send` |
| Teams meetings | `OnlineMeetings.ReadWrite` |
| SharePoint webhooks | Already covered by `Sites.FullControl.All` |

> Most of these are likely already granted if admin consent was used. Check the Azure AD app registration → API permissions to confirm.

---

## 6. Summary

**What INDEXUS already has in NexusPoint:**
A complete SharePoint file manager (browse, upload, download, delete, preview, share, versions, permissions, search). This is already excellent coverage.

**The biggest untapped opportunities:**
1. **Customer-linked document folders** — connecting SharePoint storage to INDEXUS customer records
2. **Contract auto-upload after signing** — zero-effort document archiving
3. **Office Online inline editing** — open Word/Excel in browser, no downloads
4. **Calendar event creation** — schedule meetings with customers from INDEXUS

**What requires no new permissions:** Customer folders, contract auto-upload, Office Online embedding, calendar writing (permission likely already granted).

**Bottom line:** The SharePoint API connection is fully established and powerful. The next step is connecting SharePoint storage to INDEXUS business objects (customers, contracts, collections) rather than treating NexusPoint as a standalone file browser.

---

*INDEXUS NexusPoint Analysis | May 2026*
