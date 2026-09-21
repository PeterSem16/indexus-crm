---
name: Personnel call attribution
description: Rules for Mission-enabled calls to personnel assigned to a clinic or hospital.
---

Personnel dialing keeps the clinic or hospital as the authoritative Mission contact for KPI, disposition, workflow, and parent history. Person identity is separate, server-validated context used to dial the assigned number, mirror call events into that person’s history, and expose assigned-person email/SMS recipients.

**Why:** Replacing the parent contact with the person breaks Mission attribution. Browser-provided identity or assignment is not authoritative, and concurrent SIP lifecycle updates can otherwise duplicate person-history events.

**How to apply:** Require an explicit strict-boolean Mission capability and Mission assignment, derive the parent from the campaign contact, validate the canonical person assignment and number server-side, and hide personnel call controls plus person recipient choices when disabled. When enabled, offer active assigned persons in institution Email/SMS recipient lists with an explicit person label; do not replace the parent Mission contact. Claim each person-history outcome with a database uniqueness key before inserting it.