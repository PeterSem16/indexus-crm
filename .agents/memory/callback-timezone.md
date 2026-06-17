---
name: Callback wall-clock timezone
description: Why callback times must be built/parsed in the app timezone, not the UTC server clock
---

# Callback wall-clock timezone

The prod server (CORPCRM01) runs with `TZ` unset → Node uses UTC. A callback time is a
*wall-clock* time in the operation's local zone (Slovakia, `Europe/Bratislava`), but the
agent UI renders the stored instant in the **browser's** zone. So `setHours(9)` /
`new Date("YYYY-MM-DDTHH:MM")` on the server produced `09:00Z`, which the browser showed
as **11:00** CEST. This was the "callback set to 9:00 shows as 11:00" bug.

**Rule:** never build or parse a callback instant with the server's local clock.
- A naive `"YYYY-MM-DDTHH:MM"` string from the client is a wall-clock in the app timezone
  → convert with a zoned-wall-clock→UTC helper (2-pass offset settle for DST).
- A string that carries an explicit `Z`/`±HH:MM` is already an absolute instant → trust it
  as-is (this is what the reschedule popover sends via `new Date(...).toISOString()`).
- Business-day "+N days at 09:00" must walk the calendar in the app timezone too, so the
  day boundary and weekend skip match the agent's local date, not the UTC date.

**Why:** UTC server + browser-local rendering silently shifts every naive callback by the
offset (1–2h). The canonical zone is the operation's (Bratislava), not each agent's browser,
so prefer sending naive wall-clock and interpreting it server-side in the app timezone.

**How to apply:** route every callback write path (status-list set_status / set_callback,
disposition PATCH auto + manual, inbound callback POST/PATCH) through the same parse helper;
keep `APP_TIMEZONE` as the single source of truth.
