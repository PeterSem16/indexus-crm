---
name: Person reward payment state
description: Defines ownership and timestamp semantics for marking institution personnel rewards as paid.
---

Reward-paid state belongs to the shared person/collaborator record, not an institution assignment or an individual activity. Existing reward eligibility, amount, and percentage settings remain independent.

**Why:** The same person can appear through hospital, clinic, midwife, and Nexus Pulse views. One canonical state prevents contradictory payment status between those surfaces.

**How to apply:** The server sets the payment timestamp only on the unpaid-to-paid transition, preserves it while paid, and clears it when marked unpaid. New and migrated records default to unpaid.