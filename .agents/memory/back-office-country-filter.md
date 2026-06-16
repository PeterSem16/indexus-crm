---
name: Back Office agenda country segmentation
description: Why the Back Office task agenda must treat null-country tasks as a shared bucket, and how its country filtering actually works.
---

# Back Office agenda country segmentation

The Back Office agenda (`GET /api/back-office/tasks`, surfaced by `back-office-panel.tsx` inside Nexus Puls) filters tasks by `back_office` tag plus a country.

**Rule:** When a country is supplied, the query must match `tasks.country IS NULL OR upper(trim(tasks.country)) = upper(trim(country))` — i.e. country-less tasks are a *shared* bucket visible to every country's agenda, and the comparison is case/whitespace-insensitive.

**Why:** A task created from a Status List "assign task" automation inherits the *contact's* country (`currentContact?.country`), which is frequently null or in a variant format/case. The panel only ever passes the worker's **first** country (`user.countries[0]`). With the old exact-equality filter, any null/variant-country back-office task was silently hidden and the user reported "the task never shows in the Back Office agenda." Including null + normalizing case fixes the disappearing-task bug without breaking per-country segmentation for tasks that *do* have a country.

**How to apply:** Keep null-country tasks visible across countries (it's the intended catch-all). The `back_office` tag is only added at creation when the selected task group has `is_back_office = true`, so a task can also be missing from the agenda simply because its group isn't flagged — the builder now shows a "Back Office" badge + routing hint on BO-flagged groups to make this obvious. Known remaining gap (intentionally not fixed here): the endpoint trusts the client-supplied `country` and does not validate it against the session user's allowed countries; harden only if a real cross-country leakage requirement arises.
