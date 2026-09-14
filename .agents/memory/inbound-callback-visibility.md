---
name: Rescheduled inbound callback visibility
description: Visibility rules for pending inbound callbacks and Scheduled today grouping.
---

Pending inbound callbacks must remain queryable regardless of when their record was created. “Scheduled today” is determined from the callback timestamp in Europe/Bratislava, not from `createdAt` or the browser timezone.

**Why:** A callback created on an earlier day can be rescheduled to today. Filtering pending rows by creation day makes the successful reschedule disappear from both the scheduled queue and the agent callback list.

**How to apply:** Scope callback queries by ownership, completion state, and callback presence as needed, but not by creation day. Compare calendar dates using the explicit application timezone.