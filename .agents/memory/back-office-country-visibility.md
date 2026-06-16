---
name: Back Office task country visibility
description: Why back-office tasks silently vanish — worker assigned-country filtering vs the task's contact-inherited country
---

Back Office tasks (tasks tagged `back_office`) are filtered by country in `GET /api/back-office/tasks`.

- The worker's assigned countries come from `users.assigned_countries` (DB column) → exposed on the session user as `req.session.user.assignedCountries` (a **string array** of country codes).
- A task's `country` is inherited from the **contact's** country at creation time (the front-end sends `contactCountry`), **not** from the campaign's country. So a contact whose own country differs from the campaign (e.g. an SK customer inside a CZ campaign) produces a task whose country does not match the campaign.

**Why this bites:** the panel originally sent only the FIRST assigned country (`countries[0]`). A worker assigned multiple countries then saw only tasks for that one country plus country-less (NULL) tasks; tasks for their other assigned countries silently disappeared.

**How to apply:**
- Authorization is enforced SERVER-SIDE: the GET endpoint derives the allowed country list from `req.session.user.assignedCountries`, and every task-specific BO endpoint (thread/claim/note/ask-agent/confirm) re-checks via a `canAccessBoTask` helper. Admin bypasses; country-less (NULL) tasks are visible to everyone. A client-supplied `country` query is only an optional narrowing filter — it can NEVER widen visibility beyond the user's assigned countries.
- The filter matches `country IS NULL OR upper(trim(country)) IN (<allowed countries>)` so country-less tasks are never lost and any assigned country matches (case/whitespace-insensitive).
- Do NOT assume `task.country == campaign country`; it is the contact's country.
