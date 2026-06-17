---
name: useNotifications double-mount → duplicate WS delivery
description: Why per-notification side effects (sound/toast) must dedup via a module-level Set, not component state.
---

# useNotifications is mounted more than once

`useNotifications()` runs in at least two places at the same time: the always-present
`NotificationBell` and the notifications/center page route. **Each mount opens its own
WebSocket**, so a single server notification is delivered to the handler more than once
in the same tab.

**Why it matters:** any *per-notification side effect* — playing a sound, showing a
toast, incrementing a counter — will fire once per mount (i.e. duplicated) unless it is
deduped by a key that is shared across mounts.

**How to apply:** dedup with a **module-level** `Set<string>` keyed by notification id
(check-then-add with no awaits in between, so it's atomic per delivery). Component state
or refs will NOT dedup because each mount has its own copy. Cap the Set size and clear it
when it grows (e.g. >300) to avoid unbounded growth. This is how the Back Office new-task
chime/toast avoids double-firing.
