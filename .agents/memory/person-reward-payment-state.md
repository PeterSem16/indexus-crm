---
name: Action reward payment state
description: Defines ownership and timestamp semantics for marking individual personnel Actions rewards as paid.
---

Reward-paid state belongs to each individual collaborator activity (Actions row), not to the shared person/collaborator record. Existing reward amount and other person-level reward settings remain independent.

**Why:** A person can have multiple separately payable actions. A single person-level switch incorrectly marks every action as paid.

**How to apply:** Extend every real Actions row with paid status and payment time. The server sets the timestamp only on unpaid-to-paid, preserves it while paid, and clears it when unpaid. New and migrated action rows default unpaid. In Nexus Pulse, the warning belongs in the header of the actual opened entity form, including the collaborator/person form—not only clinic/hospital forms, sidebars, or queue cards.

For pre-call reward readiness, use only each linked person's newest Action by action date (null dates last; creation time/id only break ties). A person with no Actions does not create an unpaid warning. If the newest Action lacks either paid status or payment time, count that person once against every linked clinic/hospital contact.