---
name: Person and facility deduplication safety
description: Safety boundary for merging duplicate collaborators, clinics, and hospitals after mixed imports.
---

Generate and review a redacted, deterministic, read-only production plan before any merge. Exact names or shared workplace clusters alone are review evidence, not sufficient authority to merge.

**Why:** Duplicate imports can split agreements, Actions, workplace assignments, and legacy identifiers across records. An incomplete merge can leave live references on inactive records or cause a later ISCBC sync to attach new data to the archived duplicate.

**How to apply:** Require an immutable mode-0600 hash-bound plan, exact confirmation, and a fully read-verified complete backup before opening a SERIALIZABLE write transaction. Revalidate source, reference, and assignment fingerprints under lock; fail closed on unknown references; never delete losers; preserve audit history; record durable aliases that resolve only to active canonical records; and prove rollback with isolated PostgreSQL fault-injection tests. Batch all loser IDs when inventorying references and scan each table at most once; per-operation full-table scans overloaded production during dry-run. A strong identifier match is automatic only when populated scalar fields do not conflict; differing legacy IDs are safe through aliases, and arrays are safe only because the reviewed patch unions them.