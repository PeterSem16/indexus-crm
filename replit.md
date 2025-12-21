# Nexus BioLink CRM

## Overview

Nexus BioLink is a CRM (Customer Relationship Management) system designed specifically for cord blood banking companies. It provides multi-country support for managing customers across different regions (Slovakia, Czech Republic, Hungary, Romania, Italy, Germany, USA) with role-based user access control.

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

### External Communication Integration
The system supports sending emails and SMS to customers:
- **Email**: Via SendGrid API (set `SENDGRID_API_KEY` and `EMAIL_FROM` environment variables)
- **SMS**: Via Twilio API (set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- When credentials are not configured, messages are simulated (logged but not actually sent)

### Key Design Patterns
- Shared schema definitions between frontend and backend via `@shared/*` path alias
- Zod schemas generated from Drizzle for validation (drizzle-zod)
- Storage interface pattern for database operations (allows swapping implementations)
- React Context for global state (CountryFilter, Theme)

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