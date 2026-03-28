# INDEXUS CRM

## Overview
INDEXUS is a multi-country CRM system for cord blood banking companies. It provides role-based access, a comprehensive dashboard, and tools for customer and user management. Key capabilities include medical-grade design, mobile integration for field representatives, campaign management, an AI assistant, real-time notifications, and a built-in SIP phone for call center operations. The project aims to streamline operations, enhance customer engagement, and offer robust sales, collections, and communication management across international markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with CSS custom properties, utilizing shadcn/ui components
- **Build Tool**: Vite
- **UI/UX**: Sidebar navigation, global country filter, light/dark theme support, reusable components (DataTable, StatsCard).

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API
- **Database ORM**: Drizzle ORM for PostgreSQL
- **Architecture**: Layered design separating app setup, route handling, and database interactions.

### Data Storage
- **Database**: PostgreSQL
- **Schema**: Defined via Drizzle ORM, shared between frontend and backend.

### Modules and Features
- **Collections**: Manages cord blood collection processes, including OCR extraction from accompanying documents with per-field confidence and highlighting, and CBU report downloads via LAB API integration.
- **NEXUS Communication Client**: Tab-based interface (Email, SMS, Tasks, Chats, Teams, NexusPoint) with AI-powered search (GPT-4o to KQL parsing), Tiptap-based rich text editor for email, email tagging, mailbox color coding, and filter toolbar.
- **NexusPoint (SharePoint File Manager)**: Full SharePoint integration for file management, including browsing, upload/download, folder creation, deletion, version history, and sharing, with IDOR protection.
- **Teams Meeting Enhancement**: Facilitates meeting creation with participant picker and scheduler, and displays upcoming meetings with real-time notifications.
- **External Communication**: Supports email (MS365) and SMS (BulkGate API).
- **Built-in SIP Phone**: WebRTC-based SIP phone with call recording and playback.
- **Campaign Management**: Tools for creating and managing multi-phase campaigns with templates, operator scripts, contact filtering (customers, hospitals, clinics, collaborators), scheduling, KPI reporting, and Mailchimp integration (campaign creation, contact sync, analytics, webhook auto-registration).
- **Call Center Agent Workspace**: Dedicated interface with shift management, queue handling, integrated SIP phone, contact cards, script viewer, disposition tracking, AI sentiment analysis, FAQ system, SOP panel, and multi-rule contact sorting.
- **MSG Template Import**: ZIP-based import of Outlook .msg email templates with variable detection, HTML cleaning, and attachment handling.
- **SOP Management**: Admin page for creating and managing Standard Operating Procedures with subcategory support, article sorting, rich text editor (Tiptap), PDF upload with text extraction, priority levels, pinning, country filtering, read tracking, and campaign linking.
- **Break Types Management**: Configurable global break types for call center agents with multi-language support.
- **NEXUS AI Assistant**: OpenAI GPT-4o powered, multi-language, role-based data visibility assistant.
- **Real-time Notification Center**: WebSocket-based push notifications with historical view.
- **File Storage**: Centralized storage for documents.
- **Invoice PDF Generation**: Automated PDF generation from DOCX templates with QR code injection.
- **Call Recording & Analysis**: AI-powered (GPT-4o) transcription, sentiment analysis, keyword detection, and quality scoring with search.
- **Inbound Queue System**: Asterisk ARI-integrated call queue management with routing strategies and SLA targets.
- **IVR Audio Management**: Upload or generate multi-language audio files for IVR prompts using OpenAI TTS.
- **IVR Menu Builder**: Visual tool for designing IVR decision trees.
- **DID Routing**: Configuration for mapping DID numbers.
- **Inbound Call Reports**: Reports on queue performance, SLA, and agent statistics.
- **Voicemail Management**: Voicemail box configuration with greetings, email notifications, and transcription.
- **Entity Campaign Timeline**: Automatic recording of campaign interactions on entity detail pages (customers, hospitals, clinics, collaborators).
- **Web Forms Module**: Public-facing registration forms with a visual field builder, layout templates, typography customization, GDPR consent, confirmation emails, and progress pipeline.
- **Collaborator Campaign Support**: Collaborators can be targeted as campaign contacts with specific filtering criteria.
- **Lead Search System**: AI-powered contact search in Configurator that uses web search + GPT-4o-mini to find and extract contacts (hospitals, clinics, collaborators). Results can be reviewed and assigned to CRM modules. Tables: `search_jobs`, `search_results`.
- **Campaign Reports**: Detailed campaign reports including operator statistics and call analysis.
- **AI Virtual Agent**: GPT-4o-mini powered voice bot for inbound calls with configurable greetings, TTS, multi-language support, conversation analysis, callback detection, transcript logging, customer context awareness, configurable AI parameters, queue MOH integration, SFTP connection pooling, and website knowledge base integration.

### Multi-Language Support (i18n)
- **Languages**: EN, SK, CS, HU, RO, IT, DE.
- **Implementation**: Custom I18nProvider with React Context, localStorage persistence, and locale-aware formatting.
- **Coverage**: Full localization across all modules.

### Mobile Application (INDEXUS Connect)
- **Framework**: React Native (Expo)
- **Purpose**: For field representatives (hospital visits, GPS tracking, event management).
- **Features**: Optimistic UI, GPS synchronization, multi-language support.
- **Authentication**: JWT Bearer token.
- **WebRTC Phone**: SIP.js-based phone with keypad, CRM contact search (customers, hospitals, clinics), local and server-side call history, recording playback, SIP auto re-registration, fake ringback, and personal contacts management.
- **Activity Tab**: Displays complete mobile app activity history (calls, visits) for collaborators.

### Process Stability
- **Production mode**: Frontend is pre-built and served statically. Backend is compiled into a single CJS bundle.
- **Fast restart**: Script checks for frontend build presence to optimize server rebuild time.
- **SIGHUP handling**: Node.js process ignores SIGHUP to prevent unexpected shutdowns.

### Key Design Patterns
- Shared schema definitions.
- Zod schemas for validation.
- Storage interface for database abstraction.
- React Context for global state.
- WebSocket for real-time features.
- Reusable UI components.
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
- Microsoft 365 Graph API (Email)
- BulkGate API (SMS)
- Mailchimp API v3 (Email campaign management)
- OpenAI GPT-4o (AI Assistant, transcription, analysis)
- SIP.js (WebRTC SIP phone)
- Jira API (Issue tracking)

### ISCBC Migration
- Migration from MSSQL CBC database.
- Migrated data includes customers, contracts, invoices, collections, collaborators, hospitals, notes, calls, debt collection, potential clients.
- Supports full and incremental migration procedures.