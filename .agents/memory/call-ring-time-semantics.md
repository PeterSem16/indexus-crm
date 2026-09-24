---
name: Call ring-time semantics
description: Canonical ring-time calculation for call history, reports, and transcript browsing.
---

Ring time is start-to-answer when answer evidence exists. For a finished attempt without answer evidence, it is start-to-end. An active attempt with no end timestamp stays at zero rather than accumulating a display-only estimate.

If the call metadata contains a valid positive `maxRingSeconds` snapshot, cap the calculated ring time to that snapshot. Do not cap from current Mission settings, because those settings may have changed since the call. Do not rewrite historical timestamps to make the display fit the configured limit.

**Why:** Unanswered calls previously showed zero because only answered calls were calculated, while delayed finalization could make elapsed timestamps exceed the limit that applied to that call.

**How to apply:** Keep one server-owned helper for every report and call-history API. New call flows must persist the trusted limit at call creation if their displayed ring time should be bounded.