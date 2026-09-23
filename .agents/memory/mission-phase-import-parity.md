---
name: Mission phase import parity
description: Avoid assigning new Mission contacts to a phase solely because a phase is active
---

An active Mission phase does not prove that current Mission contacts participate in phase workflow. Production had an active phase with historical assignment rows, but none joined to current Mission contacts.

**Why:** Assigning only newly imported contacts to the active phase would make them behave differently from every existing Mission contact. Conversely, blocking every import when an active phase exists prevents safe additions without checking actual contact participation.

**How to apply:** Before an additive Mission import, count phase assignments joined to live campaign contacts under the same Mission. If none exist, add only normal Mission membership, preserving phase rows. If live contacts do participate, resolve the intended phase policy explicitly before importing; never infer it from phase status or raw assignment counts.