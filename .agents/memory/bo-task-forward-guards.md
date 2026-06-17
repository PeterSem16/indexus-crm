---
name: BO task forward — concurrent-completion guard
description: Guarded UPDATE pattern + nullable-column SQL gotcha when reassigning back-office tasks
---

When a Back Office action reads a task then UPDATEs it (forward/reassign), guard the UPDATE against a concurrent completion (TOCTOU): put the eligibility predicates in the WHERE, `.returning()` the id, and if no row comes back throw a tagged error mapped to HTTP 409.

**Why:** between the read (which rejects done/completed) and the write, another user can complete the task; an unconditional UPDATE resurrects it back to pending/received.

**How to apply:** `tasks.boState` is **nullable**, so `ne(tasks.boState, 'done')` silently EXCLUDES NULL rows (`NULL <> 'done'` is NULL, not true) — it would never match a fresh task. Use `sql\`(${tasks.boState} IS DISTINCT FROM 'done')\`` instead. Same caution for any nullable column used in a guard predicate. Also re-validate the forward target inside the POST handler (e.g. admin `isActive !== false`), not only in the target-list GET endpoint — clients can craft a direct POST.
