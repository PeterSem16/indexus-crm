# INDEXUS CRM

## Overview
INDEXUS is a CRM system designed for cord blood banking companies, providing multi-country support and role-based access. It features a comprehensive dashboard, customer and user management, and country-specific data filtering. The system incorporates a medical-grade design, integrates with a mobile application for field representatives, and includes advanced functionalities such as campaign management, an AI assistant, real-time notifications, and a built-in SIP phone for call center operations. The project aims to streamline operations, enhance customer engagement, and provide robust tools for managing sales, collections, and communications within the cord blood banking industry across various international markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with CSS custom properties, utilizing shadcn/ui for components
- **Build Tool**: Vite
- **UI/UX**: Sidebar navigation, global country filter, light/dark theme support, and reusable components like DataTable and StatsCard.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API
- **Database ORM**: Drizzle ORM for PostgreSQL
- **Architecture**: Layered design separating app setup, route handling, and database interactions.

### Data Storage
- **Database**: PostgreSQL
- **Schema**: Defined via Drizzle ORM, shared between frontend and backend.
- **Key Tables**: Comprehensive tables for users, customers, products, invoices, collections, campaigns, call logs, SIP settings, and various inbound call center related entities (e.g., `inbound_queues`, `ivr_menus`, `did_routes`, `voicemail_boxes`).

### Modules and Features
- **Collections**: Manages cord blood collection processes, including client/child information, staff, status, lab results, and **Sprievodný list OCR** (accompanying document tab with PDF upload → GPT-4o Vision OCR extraction of mother's data, phone contacts, newborn info, collection details; inline manual editing with field whitelist validation; re-upload and delete support). Table: `collection_sprievodny_list` with unique constraint on `collection_id`.
- **External Communication**: Supports email (MS365) and SMS (BulkGate API).
- **Built-in SIP Phone**: WebRTC-based SIP phone with call recording, role-based access, and playback features.
- **Campaign Management**: Tools for creating, cloning, and managing campaigns with templates, operator scripts, contact filtering, scheduling, and KPI reporting. **Extended contact sources**: campaigns can target customers, hospitals, and/or clinics with detailed filtering by all fields (name, email, phone, city, region, status, etc.). **Campaign Phasing**: Multi-phase campaign pipeline — each campaign can have ordered phases (phone or email type), contacts flow through phases based on configurable transition rules (include/exclude result statuses), automatic evaluation of phase results, visual pipeline view with per-phase stats, contact timeline showing journey through all phases with results. Tables: `campaign_phases` (phase definition with type, status, transition rules) and `campaign_contact_phases` (per-contact phase tracking with results, entered/completed timestamps). **Mailchimp integration**: per-country API configuration, automatic Mailchimp campaign creation from email campaigns, contact synchronization with tags, real-time stats (opens, clicks, bounces, unsubscribes), built-in email editor with template selection and ReactQuill WYSIWYG, HTML content push to Mailchimp, test email sending (MS365 + Mailchimp methods), merge variable personalization. **Advanced Mailchimp features**: segment/tag targeting, webhook management, campaign scheduling/unscheduling, pause/resume, replicate/duplicate, cancel send, delete campaign, send checklist validation, campaign settings editing (subject, from_name, reply_to, preview_text), Mailchimp templates browser, automations viewer, audience member management, audience growth history, list activity tracking. **Mailchimp Webhook Auto-Registration**: When a Mailchimp campaign is created, a webhook is automatically registered at `/api/webhooks/mailchimp` (public, no-auth endpoint). Mailchimp sends open/click/bounce/unsubscribe events to this endpoint, which resolves the email→contact mapping and writes timeline entries (`mailchimp_opened`, `mailchimp_clicked`, `mailchimp_bounced`, `mailchimp_unsubscribed`) to `entity_campaign_timeline` for the matching contacts. GET handler returns 200 OK for Mailchimp verification. Fallback lookup scans all synced campaigns when `campaign_id` is missing. **Detailed analytics**: click details per URL, open details per contact, bounce breakdown (hard/soft/syntax), unsubscribe list with timestamps, domain performance table. **Send verification**: email verification code (via MS365) required before campaign dispatch — 6-char code valid 10min, with fallback display mode.
- **Call Center Agent Workspace**: Dedicated interface for operators with shift management, queue handling, integrated SIP phone, contact cards, script viewer, communication tools, disposition tracking, AI-powered sentiment analysis, FAQ system, and **SOP panel** (Standard Operating Procedures accessible directly in the workspace with search, category filters, campaign-specific articles, read tracking, and priority badges).
- **SOP Management**: Admin page (`/sop`) for creating and managing Standard Operating Procedures. Features: **subcategory support** (`parentId` on `sop_categories` for tree hierarchy, parent category selector in category dialog, tree-view display in categories tab with indented children), category management with Lucide icon picker and sort order, **article sort order** (`sortOrder` on `sop_articles`, configurable in article dialog sidebar, articles sorted by category tree order then article sortOrder), **TipTap professional WYSIWYG editor** (`client/src/components/sop/TipTapEditor.tsx`) with full toolbar (undo/redo, headings, bold/italic/underline/strike/sub/super, text color, highlight, alignment, bullet/ordered/task lists, blockquote, code, tables with row/column/merge/split controls, links, images, horizontal rule, clear formatting), PDF upload with text extraction (`POST /api/sop/upload-pdf`), 20/80 sidebar-editor layout in article dialog, priority levels (normal/high/critical), pinning, country filtering, read tracking per user, campaign linking with bulk category toggle (articles can be associated with specific campaigns via SOP Settings card in campaign general settings tab for contextual display in agent workspace), publish/draft status, **deletion safety** (API blocks deleting categories with children or articles). Full i18n support across all 7 languages (EN, SK, CS, HU, RO, IT, DE) via `t.sop.*` translation keys. Tables: `sop_categories` (with `parent_id`), `sop_articles` (with `sort_order`), `sop_article_reads`, `sop_campaign_articles`.
- **Break Types Management**: Configurable global break types for call center agents with multi-language support and duration settings.
- **NEXUS AI Assistant**: OpenAI GPT-4o powered assistant with multi-language and role-based data visibility.
- **Real-time Notification Center**: WebSocket-based push notifications with historical view and rules engine.
- **File Storage**: Centralized storage for various document types (agreements, invoices, email attachments).
- **Invoice PDF Generation**: Automated PDF generation from DOCX templates using `docxtemplater` and LibreOffice, including QR code injection and persistent storage.
- **Call Recording & Analysis**: AI-powered (GPT-4o) transcription, script compliance, sentiment analysis, keyword detection, quality scoring, and full-text search with export options.
- **Transcript Search Module**: Dedicated search interface for call transcripts with advanced filtering.
- **Executive Summaries**: AI-generated executive summaries from collection data, highlighting trends and KPIs with multi-language support.
- **Inbound Queue System**: Asterisk ARI-integrated call queue management with various routing strategies, agent assignment, overflow actions, and SLA targets.
- **IVR Audio Management**: Upload or generate multi-language audio files for IVR prompts using OpenAI TTS.
- **IVR Menu Builder**: Visual tool for designing IVR decision trees with DTMF mapping and routing options.
- **DID Routing**: Configuration for mapping DID numbers to various destinations (queues, IVR, users, voicemail).
- **Inbound Call Reports**: Comprehensive reports on queue performance, SLA, call distribution, missed calls, and agent statistics.
- **Voicemail Management**: Voicemail box configuration with greeting messages, email notifications, transcription, and an inbox for message management.
- **Entity Campaign Timeline**: Automatic recording of all campaign interactions (calls, emails, Mailchimp, SMS) on entity detail pages. Table `entity_campaign_timeline` tracks channel, action, phase info, agent, metadata per entity (customer/hospital/clinic/collaborator). Reusable `EntityCampaignTimeline.tsx` component with filtering, search, and channel/action badges integrated into Customers (Kampane tab), Collaborators (Kampane tab), Hospitals (Kampane tab), and Clinics pages. Server-side `logCampaignTimeline()` helper writes entries automatically on status updates, notes, dispositions, Mailchimp sends, phase transitions, and contact generation.
- **Collaborator Campaign Support**: Collaborators can be targeted as campaign contacts alongside customers, hospitals, and clinics. Contact criteria builder includes collaborator-specific fields (name, email, phone, type, active status). Campaign contact generation and preview counts support collaborator source with criteria filtering.
- **Campaign Reports**: Detailed campaign-specific reports including operator statistics, complete call lists, call analysis, and scheduled report delivery.
- **AI Virtual Agent**: GPT-4o-mini powered voice bot for handling inbound calls when no operators are available. Features configurable greeting/farewell messages, TTS voice selection (with configurable speed), multi-language support, conversation analysis (sentiment, urgency, key topics via GPT-4o post-call), callback request detection, and full transcript logging. Integrates as a queue action type for "no agents" and "overflow" scenarios. Config management and conversation logs viewer in the "Virtuálny agent" tab under Campaigns. **Customer context awareness**: automatic phone number lookup in customers table with last email/call/SMS history injected into conversation context. **Performance optimizations**: greeting/farewell audio caching, thinking tone during AI processing, ARI-first recording download, Whisper text-only response format, reduced silence timeout (2s default), configurable TTS speed. In-memory PCM downsampling (24kHz→8kHz) with WAV header generation — eliminates ffmpeg subprocess. GPT streaming for faster response completion. ARI settings cached (30s TTL) to skip DB queries. All imports hoisted to module level (no dynamic imports in hot path). Compressed system prompt for fewer input tokens. SFTP upload skips WAV compatibility check for VA-generated files. **Configurable AI parameters**: GPT model selection (gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1-nano), TTS model (tts-1, tts-1-hd), temperature, max tokens, all exposed in multi-tab config dialog with helpful descriptions. **Queue MOH**: Uses hold music from assigned Inbound Queue during AI processing instead of default MOH — custom sounds loop continuously via PlaybackFinished event listener, per-channel tracking for concurrent sessions. **SFTP connection pooling**: Persistent SSH connection pool for fast TTS audio uploads to Asterisk. **Website knowledge base**: Configurable company website URL per VA config; automatic scraping of main page + relevant subpages (services, pricing, contact, FAQ); extracted text cached for 24h; injected into GPT system prompt so VA can answer questions about company services, prices, and contacts; manual refresh via UI button; content preview in "Znalosti" tab. **UI**: VA tab moved under Inbound sub-tabs, 4-tab config dialog (Základné, Hlas a reč, AI Model, Znalosti).

### Multi-Language Support (i18n)
- **Languages**: EN, SK, CS, HU, RO, IT, DE.
- **Implementation**: Custom I18nProvider with React Context, localStorage persistence, and locale-aware date formatting.
- **Coverage**: Full localization across all modules, including call analysis and campaign management.

### Mobile Application (INDEXUS Connect)
- **Framework**: React Native (Expo)
- **Purpose**: For field representatives to manage hospital visits, track GPS, and manage visit events.
- **Features**: Optimistic UI updates, GPS synchronization, localized names, event cancellation, and multi-language support.
- **Authentication**: JWT Bearer token.

### Process Stability
- **Production mode**: Frontend is pre-built (`npx vite build` → `dist/public/`) and served as static files. Server is compiled with esbuild (`script/build-server.ts`) into `dist/index.cjs` (~3.8MB bundle). Full build: `npm run build` (Vite frontend + esbuild server, ~28s). Server-only rebuild: `npx tsx script/build-server.ts` (~2s).
- **Fast restart**: `start.sh` checks if frontend build exists (`dist/public/index.html`). If yes, only rebuilds the server (~2s). If not, runs full build. Then starts `node dist/index.cjs`. This replaced `node --import tsx server/index.ts` which transpiled 75K+ lines on every restart.
- **SIGHUP handling**: The Replit workflow system sends SIGHUP to the Node.js process during normal operation. A handler in `server/index.ts` catches and ignores this signal to prevent unexpected shutdowns.
- **After frontend changes**: Run `npx vite build` to rebuild the frontend, or delete `dist/public/index.html` to force a full rebuild on next restart.
- **Email monitoring delay**: 30-second startup delay before making OpenAI API calls.

### Key Design Patterns
- Shared schema definitions.
- Zod schemas for validation.
- Storage interface for database abstraction.
- React Context for global state.
- WebSocket for real-time features.
- Reusable UI components with multi-language support.
- Cache-safe query keys.

## External Dependencies

### Database
- PostgreSQL

### UI Component Libraries
- Radix UI primitives
- Lucide React
- react-hook-form
- date-fns
- embla-carousel-react

### Third-Party Services
- Microsoft 365 Graph API (for email)
- BulkGate API (for SMS)
- Mailchimp API v3 (for email campaign management, per-country configuration)
- OpenAI GPT-4o (for AI Assistant, transcription, sentiment analysis)
- SIP.js (for WebRTC SIP phone)
- Jira API (for issue tracking)