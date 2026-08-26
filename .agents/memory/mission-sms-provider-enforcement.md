---
name: Mission SMS provider enforcement
description: Security boundary for enforcing a Mission-selected SMS gateway across manual and automated sends.
---

A fixed Mission SMS provider must be resolved from authoritative Mission context, not from the provider or campaign identifier supplied by the client or an editable automation action.

**Why:** Agents can reach more than one manual SMS endpoint, and a forged or omitted campaign identifier can otherwise route through a country-default provider. In multi-Mission sessions, campaign membership alone is not enough unless the recipient is also verified as a contact of that Mission.

**How to apply:** Every manual SMS route used during an active agent session must derive or validate the Mission against the session and campaign-contact membership before entering the shared provider layer. Status-list and general automation sends must pass server-originated campaign context; action configuration must not override it.