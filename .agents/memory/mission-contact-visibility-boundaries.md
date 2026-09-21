---
name: Mission contact visibility boundaries
description: Durable rules for representative-only Mission contact visibility and safe persistence through generic campaign settings updates.
---

# Mission contact visibility boundaries

Representative-only Mission visibility must be applied to every agent-facing source of contacts, including the main Mission contact list and the separate scheduled-callback queue. Primary contact mutations must re-check the current assignment because representatives can change after a list was loaded.

**Why:** Filtering only the main list still exposed another representative's contacts through scheduled callbacks. A cached contact could also remain mutable after reassignment.

**How to apply:** When adding another Agent Workspace queue or contact source, apply the same Mission visibility predicate server-side before returning records. Derive entity type from the actual clinic/hospital/collaborator ID first; legacy `contactType` can be stale or wrong. Enforce it in Agent Workspace even when the logged-in account also has manager/admin privileges; exempt only explicit management views.

The Campaign Contacts page defaults failed query data to an empty array, so a server exception appears as a misleading `0 / 0` rather than a visible error.

**Why:** An optional enrichment left a missing runtime variable in the main contacts route. The endpoint returned 500 while Overview still showed the real total, making it look like all contacts were deleted.

**How to apply:** Keep optional enrichment fail-isolated from the base contacts response, and treat Overview-total-with-empty-Contacts as an endpoint failure before investigating data loss or filters.

Generic campaign-settings updates must preserve manager-owned visibility keys when the incoming replacement object omits them.

**Why:** Treating an omitted key as “unchanged” for permission checks is insufficient if the whole settings object is then persisted; omission silently removes the restriction and falls back to the legacy default.

**How to apply:** Restore protected current values before validation/persistence whenever an incoming generic settings object does not explicitly own those keys. Require explicit manager action to change them.