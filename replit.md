# INDEXUS CRM

## Overview
INDEXUS is a CRM system for cord blood banking companies, offering multi-country support (Slovakia, Czech Republic, Hungary, Romania, Italy, Germany, USA) and role-based access. It includes a dashboard, customer management, user management, and country-based filtering. The system features a medical-grade design with a deep burgundy palette and integrates with a mobile application for field representatives. Key features include comprehensive campaign management, an AI assistant, real-time notifications, and a built-in SIP phone for call center operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with CSS custom properties, shadcn/ui component library
- **Build Tool**: Vite
- **UI/UX**: Sidebar-based layout, global country filter, light/dark theme support, reusable components (DataTable, StatsCard).

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API at `/api/*`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Architecture**: Layered design with separate concerns for app setup, route handling, and database abstraction.

### Data Storage
- **Database**: PostgreSQL
- **Schema**: Defined using Drizzle ORM, shared between frontend and backend.
- **Key Tables**: `users`, `customers`, `products`, `invoices`, `collections`, `collaborators`, `visit_events`, `voice_notes`, `notifications`, `call_logs`, `call_recordings`, `campaigns`, `campaign_contacts`, `campaign_templates`, `sip_settings`, `faq_entries`, `executive_summaries`, `scheduled_reports`.

### Modules and Features
- **Collections (Odbery)**: Manages cord blood collections, including client/child info, collection staff, status tracking, and lab results.
- **External Communication**: Supports email via MS365 and SMS via BulkGate API.
- **Built-in SIP Phone**: WebRTC-based SIP phone using SIP.js for direct calls from the CRM. Includes call recording via MediaRecorder API (WebM/Opus) with pause/resume capability, visual recording indicators, automatic upload to server, role-based access control, and playback in agent workspace and customer detail views. Manual recording controls available from customer detail pages.
- **Campaign Management**: Features campaign templates, cloning, operator scripts, contact filtering, bulk actions, CSV export, scheduling, KPI reporting with targets, calendar view, and campaign tracking in recordings.
- **Call Center Agent Workspace**: Dedicated 3-column layout for call center operators with shift login flow (multi-campaign selection modal with country/date/operator filtering), session time tracking (login to logout), queue management (including scheduled queue), integrated SIP phone, contact cards, modern script viewer, campaign scripts, email/SMS composer (connected to MS365/BulkGate APIs), disposition tracking, persistent communication history with AI-powered sentiment analysis, and FAQ system. Sidebar and header are hidden during active session (fullscreen agent mode via CSS `data-agent-fullscreen`). Campaigns display as compact boxes in left panel. Session stores selected `campaignIds` array. Break exceeded visual indicator shows red pulsing alert when break duration exceeds expected time.
- **Break Types Management**: Global break type management in Campaigns module "Breaks" tab. Features icon picker (24 Lucide icons), color picker, multi-language name translations (EN/SK/CS/HU/RO/IT/DE via `translations` JSONB), expected duration (visual warning threshold) and max duration settings, active/inactive toggle. Admin API supports `?all=true` to fetch all break types including inactive. `BreakTypesTab` component at `client/src/components/campaigns/BreakTypesTab.tsx`.
- **NEXUS AI Assistant**: OpenAI GPT-4o powered assistant with multi-language support, role-based data visibility, and integrated chat interface.
- **Real-time Notification Center**: WebSocket-based push notifications with historical view, rules engine, and various notification types.
- **File Storage**: Centralized file storage with environment-specific paths for agreements, avatars, contracts, invoices, and email attachments.
- **Invoice PDF Generation (DOCX Templates)**: Upload Word DOCX templates with `{variable}` placeholders → docxtemplater fills variables → LibreOffice headless converts filled DOCX to PDF. Uses unique user profiles per conversion to prevent lock conflicts. Templates support `{#items}...{/items}` loops and `{{double braces}}` auto-converted to single braces. Preview shows actual PDF in browser via iframe. QR codes (Pay by Square + EPC) injected into DOCX XML before PDF conversion.
- **Call Recording & Analysis**: Call recording with pause/resume capability, visual recording indicators, AI-powered call transcription using GPT-4o. Features script compliance checking (1-10 score), sentiment analysis, keyword alert detection, quality scoring, full-text transcript search with advanced filters, export capabilities (TXT/JSON formats), and localized call analysis results displayed across all modules including customer detail pages and agent workspace.
- **Transcript Search Module**: Dedicated search page for call transcripts with filters by sentiment, quality range, date range, campaign, agent. Supports full-text search with locale-aware date formatting, export to TXT/JSON, and multi-language UI.
- **Executive Summaries**: AI-powered (GPT-4o) generation of executive summaries from collection data. Highlights key trends, anomalies, and KPIs. Supports period filtering (monthly/quarterly/yearly), country filtering, and multi-language generation. Stored in `executive_summaries` table with expandable card UI showing trends, anomalies, and KPI grids.
- **Campaign Reports**: Comprehensive per-campaign reporting with 3 report types: Operator Statistics (login/session times including total login time, work/break/call durations, contacts handled), Complete Call List (ring time, talk time, total duration, disposition, status), and Call Analysis (sentiment, quality score, script compliance, key topics, alert keywords). All reports exportable to CSV, XLSX, and sendable via email (MS365) with user selection UI. Accessible from campaign detail page with date range and agent filters. Includes scheduled report system with daily auto-send at configurable time, date range options (yesterday/last 7 days/last 30 days), and recipient user selection. Email sending uses country-specific system MS365 connections.

### Multi-Language Support (i18n)
- **Languages**: English (EN), Slovak (SK), Czech (CS), Hungarian (HU), Romanian (RO), Italian (IT), German (DE)
- **Implementation**: Custom I18nProvider with React Context, localStorage persistence, locale-aware date formatting via date-fns locales.
- **Coverage**: Complete localization across all modules including call analysis results (83+ keys for sentiments, statuses, filters, and UI labels), campaign management, agent workspace, customer details, invoice management, and transcript search.

### Mobile Application (INDEXUS Connect)
- **Framework**: React Native (Expo)
- **Purpose**: For field representatives to manage hospital visits, track GPS, and manage visit events.
- **Features**: Optimistic UI updates for visit status, GPS synchronization, localized names for visit types and places, event cancellation, and multi-language support.
- **Authentication**: JWT Bearer token authentication for mobile API endpoints.

### Key Design Patterns
- Shared schema definitions (`@shared/*`).
- Zod schemas for validation from Drizzle.
- Storage interface for database abstraction.
- React Context for global state (auth, i18n, country filter).
- WebSocket for real-time features.
- SentimentBadge and StatusBadge components accept `labels` prop for multi-language support.
- Call logs API supports `includeRecordings` parameter for enriched data fetching.
- Cache-safe query keys using arrays to prevent collision (e.g., `["/api/campaigns", "basic-list"]` for lightweight campaign lists).

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL` environment variable).

### UI Component Libraries
- Radix UI primitives
- Lucide React (icons)
- react-hook-form
- date-fns
- embla-carousel-react

### Development Tools
- Vite
- esbuild
- drizzle-kit
- TypeScript

### Third-Party Services
- Microsoft 365 Graph API (for email via MS365)
- BulkGate API (for SMS)
- OpenAI GPT-4o (for NEXUS AI Assistant, call transcription, sentiment analysis, script compliance)
- SIP.js (for WebRTC SIP phone)
- Jira API (for issue tracking integration)
