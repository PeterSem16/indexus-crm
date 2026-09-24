---
name: EntityDetailDrawer stale detail cache
description: Editable entity drawers must start from freshly fetched records, not a cached snapshot.
---

Editable clinic and hospital cards must start each opening from a fresh record, not the previously cached detail. Invalidate the detail query as well as the list after save, but do not treat that as sufficient to protect against another user's edits between openings.

**Why:** These forms initialize their editable state from the first record they receive. Showing cached data and refetching in the background can leave the form editing stale values even after fresh data arrives, risking an overwrite. Previously this also made successfully saved fields look unchanged on reopening.

**How to apply:** On each opening, wait for a fresh read before mounting the editable form (or explicitly reset only untouched form state when fresh data arrives). Keep the per-record invalidation after saves, too.
