---
name: Clinic dedupe representative history
description: Safe handling of active representative assignments while merging duplicate clinics.
---

Clinic dedupe must resolve active representative assignments before redirecting their history to the canonical clinic. Prefer the canonical clinic's active assignment; if it has none, keep one deterministic active loser assignment. Close every other active row with `valid_to`, then redirect all historical rows.

**Why:** The database enforces at most one row with `valid_to IS NULL` per clinic. A generic foreign-key-style redirect put two active rows on the canonical clinic and correctly aborted the entire dedupe transaction.

**How to apply:** Treat clinic representative assignments as a special temporal-history reference, never as a generic redirect. Preserve rows rather than deleting them, and test against the real partial unique index.