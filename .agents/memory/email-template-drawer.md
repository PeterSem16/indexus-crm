---
name: Email template drawer
description: Email template editor converted from Dialog modal to Sheet drawer in configurator.tsx
---

The email template editor in `MessageTemplatesTab` (configurator.tsx ~line 12414) is now a Sheet drawer, not a Dialog.

**Key structure:**
- `isTemplateDialogOpen` state still controls the Sheet open/close (name kept for compatibility)
- Sheet: `side="right"`, `sm:max-w-[960px]`, two-panel layout (left 288px settings + right flex editor)
- Variable picker: expandable bottom panel with search + 8 grouped categories
- Test email: separate Dialog triggered by "Test email" button in drawer header

**SYSTEM_VARIABLES format changed:**
Old: `{ customer: [{ key, label }] }`
New: `{ customer: { label, color, description, vars: [{ key, label, example }] } }`
All usages in the file already use the new format — do NOT revert.

**Test email backend:**
- POST `/api/message-templates/send-test` (routes.ts ~line 42708)
- Accepts: `{ to, subject, content, contentHtml, format, variables? }`
- Auto-fills ~40 default sample values; sends via MS365 (requires user MS365 connection)

**Why:** User requested drawer UX, test email functionality, and DB-aligned variable names.
**How to apply:** When modifying variable picker or template editor, keep the new SYSTEM_VARIABLES structure and Sheet component.
