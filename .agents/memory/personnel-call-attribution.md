---
name: Personnel call attribution
description: Rules for Mission-enabled calls to personnel assigned to a clinic or hospital.
---

Personnel dialing keeps the clinic or hospital as the authoritative Mission contact for KPI, disposition, workflow, and parent history. Person identity is separate, server-validated context used only to dial the assigned number and mirror call events into that person’s history.

**Why:** Replacing the parent contact with the person breaks Mission attribution. Browser-provided identity or assignment is not authoritative, and concurrent SIP lifecycle updates can otherwise duplicate person-history events.

**How to apply:** Require an explicit strict-boolean Mission capability and Mission assignment, derive the parent from the campaign contact, validate the canonical person assignment and number server-side, hide personnel controls when disabled, and claim each person-history outcome with a database uniqueness key before inserting it.