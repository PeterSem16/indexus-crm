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
- **Collections**: Manages cord blood collection processes, including client/child information, staff, status, and lab results.
- **External Communication**: Supports email (MS365) and SMS (BulkGate API).
- **Built-in SIP Phone**: WebRTC-based SIP phone with call recording, role-based access, and playback features.
- **Campaign Management**: Tools for creating, cloning, and managing campaigns with templates, operator scripts, contact filtering, scheduling, and KPI reporting.
- **Call Center Agent Workspace**: Dedicated interface for operators with shift management, queue handling, integrated SIP phone, contact cards, script viewer, communication tools, disposition tracking, AI-powered sentiment analysis, and an FAQ system.
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
- **Campaign Reports**: Detailed campaign-specific reports including operator statistics, complete call lists, call analysis, and scheduled report delivery.

### Multi-Language Support (i18n)
- **Languages**: EN, SK, CS, HU, RO, IT, DE.
- **Implementation**: Custom I18nProvider with React Context, localStorage persistence, and locale-aware date formatting.
- **Coverage**: Full localization across all modules, including call analysis and campaign management.

### Mobile Application (INDEXUS Connect)
- **Framework**: React Native (Expo)
- **Purpose**: For field representatives to manage hospital visits, track GPS, and manage visit events.
- **Features**: Optimistic UI updates, GPS synchronization, localized names, event cancellation, and multi-language support.
- **Authentication**: JWT Bearer token.

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
- OpenAI GPT-4o (for AI Assistant, transcription, sentiment analysis)
- SIP.js (for WebRTC SIP phone)
- Jira API (for issue tracking)