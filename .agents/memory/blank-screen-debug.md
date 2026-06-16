---
name: Blank screen debug approach
description: Root causes and fixes for blank screen after MS365 login on worf.replit.dev
---

# Blank screen after MS365 login — root causes found and fixed

## Root causes (in order of discovery)

1. **Vite HMR WebSocket 400 error** — ws v8.19 path mismatch. Fix: `/ws/chat` uses `noServer: true` pattern; HMR uses `/vite-hmr` path in `server/vite.ts`.

2. **Session cookie not set on HTTPS** — `trust proxy` was only set in production. Fix: set `trust proxy: 1` always; `cookie.secure: "auto"` lets Express auto-detect HTTPS.

3. **Missing i18n keys crash** — `email-client.tsx` accesses `t.tasks.taskGroups.backOfficeTab` without optional chaining. If the key is missing in any locale, React crashes → blank screen. IT and DE were missing. Fixed.

4. **redirect_uri = localhost:5000 when using Replit preview pane** — The Replit canvas/preview pane accesses the app via `localhost:5000` internally (bypasses the external proxy). `req.get("host")` returned `localhost:5000` → redirect_uri was built as `https://localhost:5000/api/auth/microsoft/callback` → NOT registered in Azure AD → Microsoft rejected it → callback never arrived → user stuck on login page.

**Fix for #4:** Set `MS365_REDIRECT_URI` env var to the stable worf URL. Code now uses `process.env.MS365_REDIRECT_URI || dynamic` in both `/api/auth/login-ms365` and `/api/auth/microsoft/callback` handlers. Env var set in Replit shared environment.

## How to apply
- When deploying to production: set `MS365_REDIRECT_URI` to the production callback URL (must match Azure AD registration)
- Azure AD app: client id is in the `MS365_CLIENT_ID` env var — add all needed redirect URIs in Azure Portal → App registrations → Authentication → Redirect URIs
- Stable Replit worf URL for this repl: `https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev/api/auth/microsoft/callback`

## Debugging tip
Added `[AUTH-REQ]` logger for all `/api/auth/*` requests — shows method, URL, host, proto, session. Use to verify redirect_uri construction.
