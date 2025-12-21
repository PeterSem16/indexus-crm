# Nexus BioLink CRM - Design Guidelines

## Design Approach
**System Selected**: Combination of modern healthcare UI patterns (inspired by Epic Systems, Athenahealth) with clean SaaS dashboard aesthetics (Linear, Stripe Dashboard)

**Core Principle**: Medical-grade professionalism with intuitive data management. Clean, clinical interface that inspires trust while maintaining efficiency for daily CRM operations.

## Color Strategy
**Primary Medical Palette**:
- Deep Burgundy (#8B1538) - Primary actions, cord blood association
- Clinical White (#FFFFFF) - Backgrounds, cards
- Soft Rose (#FFF5F7) - Subtle backgrounds, hover states
- Medical Gray (#F8F9FA) - Borders, dividers, disabled states
- Life Blue (#3B82F6) - Secondary actions, informational elements
- Success Green (#10B981) - Status indicators, confirmations
- Alert Amber (#F59E0B) - Warnings, pending states

## Typography
**Font Families**:
- Primary: Inter (system UI, data tables, forms)
- Display: Plus Jakarta Sans (headings, statistics)

**Hierarchy**:
- Page Titles: text-3xl font-semibold (Plus Jakarta Sans)
- Section Headers: text-xl font-medium
- Data Labels: text-sm font-medium uppercase tracking-wide
- Body Text: text-base
- Table Content: text-sm
- Metadata: text-xs text-gray-500

## Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 units
- Card padding: p-6
- Section spacing: space-y-8
- Form gaps: gap-6
- Table cells: p-4

**Grid Structure**:
- Dashboard: 12-column grid (grid-cols-12)
- Stat cards: 4-column on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Data tables: Full-width with horizontal scroll
- Max container: max-w-7xl mx-auto

## Component Library

### Navigation
**Sidebar** (280px fixed):
- Logo + company name at top (h-16)
- Country filter dropdown (prominent position below logo)
- Main navigation menu with icons
- User profile section at bottom
- Active state: burgundy background with white text

**Top Bar**:
- Breadcrumbs navigation
- Global search (expandable, cmd+k shortcut indicator)
- Country badge indicator (current viewing context)
- Notifications bell
- User avatar dropdown

### Dashboard Components

**Statistics Cards**:
- White cards with subtle shadow (shadow-sm)
- Large number display (text-4xl font-bold)
- Label below (text-sm text-gray-600)
- Small trend indicator with icon
- Grid layout: 4 cards across desktop

**Country Selector/Filter**:
- Multi-select dropdown with flags
- Options: Slovakia 🇸🇰, Czech Republic 🇨🇿, Hungary 🇭🇺, Romania 🇷🇴, Italy 🇮🇹, Germany 🇩🇪, USA 🇺🇸
- Selected countries shown as badges
- Apply button in burgundy

**Data Tables**:
- Sticky header (position-sticky top-0)
- Alternating row backgrounds (subtle)
- Sortable columns with indicators
- Row hover: soft rose background
- Action column (right-aligned): edit, view, delete icons
- Pagination: simple numbered with prev/next
- Country flag column for multi-country views

**User Management Panel**:
- Split view: User list (left 40%) | User details (right 60%)
- Assigned countries shown as flag badges
- Permission matrix table for country access
- Quick actions: activate/deactivate, edit roles
- Bulk actions toolbar when selecting multiple users

### Forms
**Input Style**:
- Border: border-gray-300
- Focus: ring-2 ring-burgundy-500 border-burgundy-500
- Labels: text-sm font-medium mb-2
- Required asterisk in burgundy
- Helper text: text-xs text-gray-500 mt-1

**Form Layouts**:
- Two-column on desktop (grid-cols-2 gap-6)
- Full-width for textareas
- Country assignment: checkbox group with flags
- Action buttons: right-aligned, primary burgundy, secondary outline

### Data Visualization
- Chart library: ApexCharts or Recharts
- Color scheme: burgundy primary, blue secondary, gray neutrals
- Patient/customer trends by country
- Bar charts for country comparisons
- Line graphs for time-series data

### Status Indicators
- Active: green dot + "Active" text
- Pending: amber dot + "Pending"
- Inactive: gray dot + "Inactive"
- High Priority: red badge
- Dot size: w-2 h-2 rounded-full

### Modals & Overlays
- Backdrop: bg-black/50
- Modal: max-w-2xl, rounded-lg, shadow-xl
- Header: border-bottom with title and close button
- Footer: border-top with action buttons
- Slide-over panels for quick edits (320px from right)

## Icons
**Library**: Heroicons (outline for navigation, solid for indicators)
- Users, Building, Globe, Filter, Search, Bell, ChevronDown, Check, X

## Images
**No hero images needed** - this is a data-focused CRM application. Use medical-themed illustrations sparingly in empty states only.

**Empty States**: Subtle medical illustrations (stethoscope, heartbeat line) with helpful messaging

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation: tab order, escape to close modals
- Screen reader announcements for data updates
- Color contrast ratio: minimum 4.5:1
- Focus indicators: visible 2px burgundy ring

## Animations
**Minimal & Purposeful**:
- Page transitions: 150ms ease
- Dropdown menus: 200ms slide-down
- Modal entry: 300ms fade + scale
- NO loading spinners on tables - use skeleton screens
- Country filter changes: smooth 200ms data fade