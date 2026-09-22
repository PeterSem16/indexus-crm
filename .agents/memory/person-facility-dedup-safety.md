---
name: Person and facility deduplication safety
description: Safety boundary for merging duplicate collaborators, clinics, and hospitals after mixed imports.
---

Generate and review a redacted, deterministic, read-only production plan before enabling any merge. Exact names or shared workplace clusters alone are review evidence, not sufficient authority to merge.

**Why:** Duplicate imports can split agreements, Actions, workplace assignments, and legacy identifiers across records. An incomplete merge can leave live references on inactive records or cause a later ISCBC sync to attach new data to the archived duplicate.

**How to apply:** Keep production writes disabled until the plan inventories all live scalar, array, and polymorphic references; resolves field conflicts; limits assignment consolidation to approved groups; and defines a durable legacy-ID redirect so future syncs target the canonical active person.