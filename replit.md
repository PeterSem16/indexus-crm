# INDEXUS CRM

## Overview

INDEXUS is a CRM (Customer Relationship Management) system designed specifically for cord blood banking companies. It provides multi-country support for managing customers across different regions (Slovakia, Czech Republic, Hungary, Romania, Italy, Germany, USA) with role-based user access control.

The application features a dashboard with statistics, customer management, user management, and country-based filtering capabilities. It follows a medical-grade professional design aesthetic with a deep burgundy primary color palette.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Component Library**: shadcn/ui (Radix UI primitives with custom styling)
- **Build Tool**: Vite with hot module replacement

The frontend uses a sidebar-based layout with:
- Collapsible sidebar navigation
- Global country filter context for filtering data across views
- Light/dark theme support via ThemeProvider
- Reusable components: DataTable, StatsCard, StatusBadge, PageHeader

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API at `/api/*` endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL dialect

The server follows a layered architecture:
- `server/index.ts`: Express app setup and middleware
- `server/routes.ts`: API route handlers
- `server/storage.ts`: Database abstraction layer (IStorage interface)
- `server/db.ts`: Database connection pool

### Data Storage
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` using Drizzle schema definitions
- **Migrations**: Generated via `drizzle-kit push` command

Database tables:
- `users`: CRM system users with roles and assigned countries
- `customers`: Cord blood banking customers with country, status, and service type
- `products`: Services/products with country availability
- `customer_products`: Products assigned to customers
- `invoices`: Generated invoices with billing details snapshot
- `invoice_items`: Line items for invoices
- `billing_details`: Country-specific billing configuration (VAT, payment terms)
- `customer_notes`: Notes on customer records
- `activity_logs`: User action audit trail
- `communication_messages`: Email/SMS messages sent to customers
- `collaborators`: Medical staff collaborators with personal info, company details
- `collaborator_addresses`: Collaborator addresses (permanent, correspondence, work, company)
- `collaborator_other_data`: Pension and disability dates for collaborators
- `collaborator_agreements`: Agreements with billing companies, reward types, file uploads

### External Communication Integration
The system supports sending emails and SMS to customers:
- **Email**: Via SendGrid API (set `SENDGRID_API_KEY` and `EMAIL_FROM` environment variables)
- **SMS**: Via Twilio API (set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- When credentials are not configured, messages are simulated (logged but not actually sent)

### Built-in SIP Phone (WebRTC)
The system includes a built-in SIP phone for operators to make calls directly from the CRM:
- **Library**: SIP.js for WebRTC-based SIP calling
- **Component**: `client/src/components/sip-phone.tsx`
- **Features**: Dial pad, mute/hold controls, volume slider, call duration timer
- **Configuration**: Operators configure their Asterisk server credentials (server address, username, password)
- **Integration**: Floating phone button available on campaign detail pages

To use the SIP phone:
1. Click the phone icon in the bottom-right corner of campaign detail page
2. Configure SIP settings (server address like `pbx.example.com`, username, password)
3. Click "Pripojiť" to connect to the Asterisk server via WebSocket (wss://server/ws)
4. Enter phone number and click the call button

### Campaign Management
The system includes comprehensive campaign management for marketing and sales:
- **Templates**: Save campaign configurations as reusable templates
- **Cloning**: Duplicate existing campaigns with all settings
- **Operator Scripts**: Text-based scripts for call center agents
- **Contact Filtering**: Filter contacts by status, country, lead score
- **Bulk Actions**: Update multiple contact statuses at once
- **CSV Export**: Export contacts with Slovak character support
- **Scheduling**: Configure working hours and contact frequency limits
- **KPI Reporting**: Dashboard with conversion rates, completion rates, status breakdowns
- **Calendar View**: Month-based calendar showing campaign timelines
- **Campaign Comparison**: Side-by-side comparison of up to 4 campaigns

### NEXUS AI Assistant
The system includes an intelligent AI assistant powered by OpenAI:
- **Enable/Disable**: Toggle in user profile settings under NEXUS tab
- **Header Integration**: NEXUS icon appears in header when enabled for user
- **Heartbeat Sound**: 5-second heartbeat sound plays on first login when NEXUS is enabled
- **Chat Dialog**: Full-featured chat interface for natural language queries
- **Multi-language Support**: Responds in the language the user asks in (SK, CZ, HU, DE, IT, RO, EN)
- **Role-based Access**: Data visibility respects user role and assigned countries
- **Components**: 
  - `client/src/components/nexus/nexus-button.tsx` - Header button with icon
  - `client/src/components/nexus/nexus-chat.tsx` - Chat dialog
  - `client/src/components/nexus/nexus-icon.tsx` - Animated icon
  - `client/src/hooks/use-heartbeat-sound.ts` - Web Audio API heartbeat sound
- **API Endpoint**: `POST /api/nexus/query` - Processes queries via OpenAI GPT-4o
- **Database Field**: `nexus_enabled` boolean in users table

### Real-time Notification Center
The system includes a comprehensive notification center with real-time push notifications:
- **WebSocket Service**: `server/lib/notification-service.ts` provides real-time notifications via `/ws/notifications`
- **Notification Bell**: Header component showing unread count with popover for quick access
- **Notification Center Page**: Full page at `/notifications` with:
  - History tab: View, filter, mark read/dismiss notifications
  - Rules tab: Create/edit/delete automated notification rules
- **Notification Types**: new_email, new_sms, new_customer, status_change, sentiment_alert, task_assigned, task_due, task_completed, mention, system
- **Priority Levels**: low, normal, high, urgent (with color coding)
- **Database Tables**: `notifications`, `notification_rules`
- **Hook**: `useNotifications` hook for real-time WebSocket connection and notification management

### Key Design Patterns
- Shared schema definitions between frontend and backend via `@shared/*` path alias
- Zod schemas generated from Drizzle for validation (drizzle-zod)
- Storage interface pattern for database operations (allows swapping implementations)
- React Context for global state (CountryFilter, Theme)
- WebSocket for real-time features (notifications, chat)

### File Storage Architecture
The system uses a centralized file storage configuration that automatically detects the environment:
- **Configuration File**: `server/config/storage-paths.ts`
- **Replit**: Files stored in `./uploads/` directory
- **Ubuntu Production**: Files stored in `/var/www/indexus-crm/data/` (mounted data disk)

Storage directories:
- `agreements/` - Collaborator agreement files
- `avatars/` - User profile images
- `contract-pdfs/` - PDF contract templates
- `contract-templates/` - DOCX contract templates
- `generated-contracts/` - Generated customer contracts
- `invoice-images/` - Invoice logo/images
- `email-images/` - Email attachments

Files are served via:
- Replit: `/uploads/...`
- Ubuntu: `/data/...` (both `/uploads` and `/data` routes work for compatibility)

## External Dependencies

### Database
- PostgreSQL database required (provisioned via Replit)
- Connection string via `DATABASE_URL` environment variable

### UI Component Libraries
- Radix UI primitives (dialog, dropdown, popover, etc.)
- Lucide React for icons
- react-hook-form for form handling
- date-fns for date formatting
- embla-carousel-react for carousels

### Development Tools
- Vite for frontend bundling and HMR
- esbuild for production server bundling
- drizzle-kit for database migrations
- TypeScript for type checking

### Replit-Specific
- @replit/vite-plugin-runtime-error-modal for error display
- @replit/vite-plugin-cartographer for development
- connect-pg-simple for session storage (if sessions needed)

## INDEXUS Connect Mobile Application

### Overview
INDEXUS Connect is a React Native (Expo) mobile application for field representatives (collaborators) to manage hospital visits, track GPS location, and manage visit events.

### Current Version: 1.1.12
- **Comprehensive Visit Lifecycle Fix**: Complete overhaul of status management with optimistic updates
- **Status Priority Protection**: Local status (in_progress, completed) never overwritten by stale server data (scheduled)
- **All Mutations Optimistic**: Start, End, Cancel, Not Realized mutations all use optimistic updates for instant UI feedback
- **Home Page Visit Type Fix**: Visit types on home page now show localized names instead of numeric codes
- **Visits Page Crash Fix**: Fixed crash when opening visits tab (missing language variable)
- **GPS Sync Fix**: Visit start/end GPS coordinates now sync to server immediately and show on CRM map
- **Visit Type Display Fix**: Visit types now show localized names instead of numeric codes
- **Place Name Translation**: Place options show localized names in all supported languages
- **Local Status Protection**: Local visit status (in_progress/completed) preserved when server has stale data
- **New Database Columns**: status, actualStart, actualEnd, startLatitude, startLongitude, endLatitude, endLongitude
- **Map Visualization**: Leaflet map shows completed visits with GPS coordinates
- **14 Visit Types**: Personal visit, phone call, online meeting, training, conference, examination of problematic collection, hospital kit delivery, pregnancy lecture, group lectures for midwives/doctors, contract management (hospital/doctor/business partner), other
- **6 Place Options**: Obstetrics department, private office, state office, hospital management, phone/video, other
- **7 Remark Detail Options**: Price, Competitors, Doctor, Resident, Midwife, Business Partner, Other
- **Event Cancellation**: Cancel events with "Cancelled" or "Not Realized" status options
- **Calendar Default**: Calendar view is now the default tab in visits screen (was list view)
- **Auto-refresh**: Visits data auto-refreshes every 30 seconds

### Mobile API Endpoints
All mobile endpoints require JWT Bearer token authentication:
- `POST /api/mobile/auth/login` - Authenticate and receive JWT token
- `GET /api/mobile/auth/verify` - Verify token validity
- `GET /api/mobile/hospitals` - List hospitals (filtered by collaborator's country)
- `POST /api/mobile/hospitals` - Create new hospital
- `PUT /api/mobile/hospitals/:id` - Update hospital
- `GET /api/mobile/visit-events` - List visit events
- `POST /api/mobile/visit-events` - Create visit event
- `PUT /api/mobile/visit-events/:id` - Update visit event
- `DELETE /api/mobile/visit-events/:id` - Delete visit event
- `GET /api/mobile/visit-options` - Get localized visit type options
- `POST /api/mobile/voice-notes` - Upload voice note with OpenAI Whisper transcription
- `GET /api/mobile/voice-notes/:visitEventId` - Get voice notes for a visit
- `POST /api/mobile/push-token` - Register push notification token
- `DELETE /api/mobile/push-token` - Deactivate push token on logout

### JWT Authentication
- Secret: Uses SESSION_SECRET environment variable (fail-secure if not set)
- Token lifetime: 30 days
- Token payload: `{ collaboratorId, countryCode }`
- Header format: `Authorization: Bearer <token>`

### Key Database Tables
- `visit_events` - Field visit events with GPS coordinates
- `voice_notes` - Voice recordings with transcriptions
- `mobile_push_tokens` - Push notification tokens per device
- `collaborators.mobileAppEnabled` - Flag to enable mobile access
- `collaborators.mobileUsername` - Mobile app login username
- `collaborators.mobilePasswordHash` - Bcrypt hashed password

### Design Documentation
Complete mobile app design specification: `docs/INDEXUS_CONNECT_MOBILE_APP.md`

### Key Features
- Offline-first architecture with SQLite local storage
- GPS tracking during active visits
- 14 expanded visit types with place selection
- Event cancellation with "Cancelled" / "Not Realized" options
- Multi-language support (SK, CZ, HU, DE, IT, RO, EN)
- Push notifications for visit reminders
- Local Android builds on headless Ubuntu server (SSH-only)

### Android APK Build Procedure
To build a new Android APK on the Ubuntu production server:

```bash
# Navigate to mobile app directory and pull latest changes
cd /var/www/indexus-crm/mobile-app
git pull origin main
grep version app.json  # Verify version number

# Clean cache and rebuild
rm -rf node_modules/.cache android/app/build android/.gradle
npm install
eas build --platform android --profile preview --local --clear-cache

# Deploy the APK
./deploy-apk.sh
```