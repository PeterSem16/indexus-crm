---
name: Blank screen debug approach
description: Root causes and fixes for blank screen after MS365 login on worf.replit.dev
---

# Blank screen after MS365 login — root causes found and fixed

## Root causes (in order of discovery)

1. **Vite HMR WebSocket 400 error** — ws v8.19 path mismatch. Fix: `/ws/chat` uses `noServer: true` pattern; HMR uses `/vite-hmr` path in `server/vite.ts`.

2. **Session cookie not set on HTTPS** — `trust proxy` was only set in production. Fix: set `trust proxy: 1` always; `cookie.secure: "auto"` lets Express auto-detect HTTPS.

3. **Missing i18n keys crash** — `email-client.tsx` accesses `t.tasks.taskGroups.backOfficeTab` without optional chaining. If the key is missing in any locale, React crashes → blank screen. Fix: add `backOfficeDesc` and `backOfficeTab` to all 7 locales in `translations.ts`.

**Why:** translations.ts is ~50k lines. When a new key is added, it is easy to miss a locale (or add it twice). Python scripts with exact locale scoping (by finding locale block start/end line numbers) are the reliable way to verify and fix.

**How to apply:** When blank screen occurs after login, check browser console for runtime errors. If no JS errors visible, check session cookie is set. Then grep translations.ts for the crashing key across all 7 locales.
