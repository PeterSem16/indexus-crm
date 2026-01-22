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
- **Key Tables**: `users`, `customers`, `products`, `invoices`, `collections`, `collaborators`, `visit_events`, `voice_notes`, `notifications`.

### Modules and Features
- **Collections (Odbery)**: Manages cord blood collections, including client/child info, collection staff, status tracking, and lab results.
- **External Communication**: Supports email via SendGrid and SMS via Twilio.
- **Built-in SIP Phone**: WebRTC-based SIP phone using SIP.js for direct calls from the CRM.
- **Campaign Management**: Features campaign templates, cloning, operator scripts, contact filtering, bulk actions, CSV export, scheduling, KPI reporting, and calendar view.
- **NEXUS AI Assistant**: OpenAI GPT-4o powered assistant with multi-language support, role-based data visibility, and integrated chat interface.
- **Real-time Notification Center**: WebSocket-based push notifications with historical view, rules engine, and various notification types.
- **File Storage**: Centralized file storage with environment-specific paths for agreements, avatars, contracts, invoices, and email attachments.

### Mobile Application (INDEXUS Connect)
- **Framework**: React Native (Expo)
- **Purpose**: For field representatives to manage hospital visits, track GPS, and manage visit events.
- **Features**: Optimistic UI updates for visit status, GPS synchronization, localized names for visit types and places, event cancellation, and multi-language support.
- **Authentication**: JWT Bearer token authentication for mobile API endpoints.

### Key Design Patterns
- Shared schema definitions (`@shared/*`).
- Zod schemas for validation from Drizzle.
- Storage interface for database abstraction.
- React Context for global state.
- WebSocket for real-time features.

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
- SendGrid API (for email)
- Twilio API (for SMS)
- OpenAI GPT-4o (for NEXUS AI Assistant)
- SIP.js (for WebRTC SIP phone)