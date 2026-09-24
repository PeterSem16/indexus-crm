---
name: Call-review event provenance
description: Rules for what a manager may infer from call-linked contact history during quality review.
---

For quality review, do not present today's status-list confirmations or callback date as actions taken in a past call. Use an exact Mission-contact link, the call agent's history, and a bounded wrap-up interval; end attribution before the agent's next call. A confirmed option needs a snapshot of its type and label so later renames/deletions do not rewrite the review. A callback needs evidence of a real date transition, not a note-only edit or an unrelated automation with no date.

**Why:** Contacts and Mission definitions are mutable, and a later change can look like a decision made during the recorded conversation. Older history lacks some immutable option details; do not manufacture an answer from current state when that evidence is missing.

**How to apply:** Label the 15-minute wrap-up association as call-related, not an exact transcript-time guarantee. If strict audit attribution is required, persist the exact call ID with action history and make contact updates and their audit events atomic.