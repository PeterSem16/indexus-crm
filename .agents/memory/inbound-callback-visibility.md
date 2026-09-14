---
name: Rescheduled inbound callback visibility
description: Visibility rules for pending inbound callbacks and Scheduled today grouping.
---

Pending inbound callbacks must remain queryable regardless of when their record was created. “Scheduled today” is determined from the callback timestamp in Europe/Bratislava, not from `createdAt` or the browser timezone.

**Why:** A callback created on an earlier day can be rescheduled to today. Filtering pending rows by creation day makes the successful reschedule disappear from both the scheduled queue and the agent callback list.

**How to apply:** Scope callback queries by ownership, completion state, and callback presence as needed, but not by creation day. Compare calendar dates using the explicit application timezone.

The scheduled Queue's time filters are exclusive: a past-due call belongs to Overdue, not Today, even if its date is today.

**Why:** The user explicitly confirmed this is intended behavior. Do not diagnose disappearance from Today alone as a missing callback.

**How to apply:** Check Overdue before changing callback visibility. Keep this separate from Priority Builder's first-match contact groups.

Completed outside-Mission callbacks remain usable as contact entry points; calling again must not reopen the old callback.

**Why:** Completion describes the previous follow-up task, not whether the agent may contact that person again. The user explicitly rejected disabled, struck-through contacts.

**How to apply:** Preserve completion history while allowing card opening and a fresh call, without inheriting the currently selected Mission's identity.