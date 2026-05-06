# INDEXUS CRM

INDEXUS is a multi-country CRM system for cord blood banking companies, streamlining operations and enhancing customer engagement with tools for sales, collections, and communication.

## Run & Operate
_Populate as you build_

## Stack
- **Frontend**: React 18, TypeScript, Wouter, TanStack React Query, Tailwind CSS, shadcn/ui, Vite
- **Backend**: Node.js, Express, TypeScript (ESM), Drizzle ORM, PostgreSQL
- **Build Tool**: Vite

## Where things live
- `client/src/lib/regions.ts`: Geographic data (regions, districts) source of truth.
- `server/db/schema.ts`: Database schema definition (Drizzle ORM).
- `server/seed-statuses.ts`: Seed data for Status Management Engine.
- `/api/mpn/*`: API routes for Medical Partner Network.
- `/api/status-categories/*`, `/api/status-definitions/*`, `/api/campaigns/:id/status-assignments/*`: API routes for Status Management Engine.
- `/api/lead-intelligence/*`: API routes for Lead Intelligence System V3.
- `attached_assets/indexus_gyn_data_import_*.csv`: Source for INDEXUS Gyn CSV Import.
- `attached_assets/postal_code_cache.json`: Persistent cache for postal code AI lookup.
- `attached_assets/import_write_log_<timestamp>.md`: Audit log for INDEXUS Gyn CSV Import.

## Architecture decisions
- **Shared Schema**: Database schema defined via Drizzle ORM is shared between frontend and backend.
- **Layered Backend**: Clear separation of app setup, route handling, and database interactions.
- **WebSocket for Real-time**: Utilizes WebSockets for features like real-time notifications.
- **AI Integration**: Deep integration with OpenAI GPT-4o for AI assistant, transcription, sentiment analysis, and lead intelligence.
- **Multi-country Design**: Core features like i18n, regional data, and country-specific filters are built-in from the ground up.

## Product
- **Customer & User Management**: Role-based access, comprehensive dashboard.
- **Collections Management**: OCR extraction from documents, CBU report downloads.
- **Communication Suite**: Email, SMS, Tasks, Chats, Teams, NexusPoint (SharePoint integration), built-in SIP phone.
- **Campaign Management**: Multi-phase campaigns, templates, contact filtering, KPI reporting, Mailchimp integration.
- **Call Center Operations**: Agent workspace, shift management, queue handling, AI sentiment analysis, FAQ, SOP panel.
- **AI Assistant**: GPT-4o powered, multi-language, role-based data visibility.
- **Real-time Notifications**: WebSocket-based push notifications.
- **Medical Partner Network (MPN)**: Management of medical partner relationships, communication schedules, first contact protocols.
- **Lead Intelligence System V3**: 7-layer self-learning lead generation platform with goal-based search, discovery engine, hybrid extraction, contact scoring, feedback learning, entity knowledge graph, and closed-loop CRM integration.
- **Web Forms Module**: Public-facing registration forms with visual builder and pipeline management.
- **Status Management Engine**: Configurable status/disposition system for campaigns.
- **AI Virtual Agent**: GPT-4o-mini powered voice bot for inbound calls with TTS, multi-language support, and conversation analysis.
- **Mobile Application (INDEXUS Connect)**: For field representatives with optimistic UI, GPS tracking, and WebRTC phone.

## User preferences
Preferred communication style: Simple, everyday language.

## Gotchas
- **INDEXUS Gyn CSV Import**: `--dry-run` is default; use `--commit` for actual writes. Replit shell kills background processes after ~60s, requiring temporary workflow configuration for long runs.
- **Pagination**: Endpoints for customers, invoices, hospitals, clinics, collaborators return plain arrays if no pagination parameters are sent (backwards compatible).

## Pointers
- Radix UI: [https://www.radix-ui.com/](https://www.radix-ui.com/)
- Lucide React: [https://lucide.dev/](https://lucide.dev/)
- react-hook-form: [https://react-hook-form.com/](https://react-hook-form.com/)
- date-fns: [https://date-fns.org/](https://date-fns.org/)
- embla-carousel-react: [https://www.embla-carousel.com/](https://www.embla-carousel.com/)
- Drizzle ORM: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- Tailwind CSS: [https://tailwindcss.com/](https://tailwindcss.com/)
- Vite: [https://vitejs.dev/](https://vitejs.dev/)
- Wouter: [https://docs.wouter.com/](https://docs.wouter.com/)
- TanStack Query: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- Mailchimp API v3: [https://mailchimp.com/developer/marketing/docs/](https://mailchimp.com/developer/marketing/docs/)
- OpenAI API: [https://platform.openai.com/docs/](https://platform.openai.com/docs/)
- SIP.js: [https://sipjs.com/](https://sipjs.com/)
- Jira API: [https://developer.atlassian.com/cloud/jira/platform/rest/v3/](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)