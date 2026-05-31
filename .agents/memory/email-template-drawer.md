---
name: Email template drawer
description: Email template editor is a Sheet drawer in configurator.tsx — 3-column layout with variables panel
---

The email template editor in `MessageTemplatesTab` (configurator.tsx ~line 12520) is a Sheet drawer, not a Dialog.

**Structure (3-column layout):**
- Drawer width: `sm:max-w-[1300px]`
- Column 1 (260px): settings (name, type, format, language, category, description, tags, switches, attachments)
- Column 2 (flex-1): editor (subject bar, toolbar, Quill/textarea)
- Column 3 (280px): variables panel — always visible, no toggle needed

**State variables:**
- `isTemplateDialogOpen` — controls Sheet open/close (kept for compatibility)
- `varsSearch`, `openVarGroup` — variable panel search + accordion state
- `isTestEmailOpen`, `testEmailTo`, `testEmailSending`, `testEmailTab` — test email dialog

**SYSTEM_VARIABLES format:**
`{ customer: { label, color, description, vars: [{ key, label, example }] } }`
All usages already use this new format — do NOT revert to old array format.

**Test email dialog:**
- Tabbed: "Náhľad" (preview tab) + "Odoslať" (send tab)
- Preview: renders template with `interpolatePreview()` using `getTestSampleValues()`
- Both helpers defined after `detectTemplateVariables()` function
- Backend: POST `/api/message-templates/send-test` (routes.ts ~line 42706)

**Attachment fix:**
- When `!editingTemplate`: shows dashed border box with "Uložiť šablónu" button
- When `editingTemplate` set: shows normal upload button

**Why:** User requested wider drawer, 3-column layout, always-visible variables, preview in test email, and working attachment button for new templates.
**How to apply:** When modifying template editor, keep 3-column structure and SYSTEM_VARIABLES format.
