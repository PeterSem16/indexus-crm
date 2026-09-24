---
name: Agent phone-card recall
description: Rules for remembering an agent's preferred CRM card for repeated caller numbers.
---

Remembered cards belong to one agent and are only a suggestion: the current
phone lookup must still contain the same entity before it can be promoted or
opened. A persisted customer identity on an individual missed-call record
always takes priority.

**Why:** A number may legitimately match multiple entity types, while records
can be edited or deleted later. Treating an old selection as authoritative can
open the wrong card. The valid-remembered-card behavior was confirmed as the
expected inbound and missed-call experience.

**How to apply:** Persist full international digits, treating `+` and `00`
forms as equivalent, but never remove country prefixes. An unqualified local
number must remain separate unless a country context makes conversion
unambiguous. Use a remembered match to rank an ambiguous live-call choice and
to resolve an otherwise ambiguous missed call; retain all alternative matches.

The same country-qualified, unambiguous matching rule applies when showing a name on a call-history row that has no linked contact. Phone lookup is advisory, not proof of identity.

**Why:** Two countries can share national digits and institutions can share numbers; a guessed display name misattributes a call. Loading every contact in a country for each page also scales poorly.

**How to apply:** Prefer explicit call-to-contact links. For fallback lookup, constrain database candidates by the call's known country and number, then attribute only when exactly one owner remains after full normalization. With no reliable country for a local number, show the number alone.