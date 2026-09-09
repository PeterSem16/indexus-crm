---
name: Call history outcomes
description: Durable rules for associating Communication history badges with the call that produced them.
---

Communication history call badges must be derived from timestamped events associated with the specific call, never from the current mutable campaign-contact disposition or status.

**Why:** A later Status List automation can change the contact to values such as SMS sent, callback requested, or completed. Reading the current contact then retroactively puts those automation results on older call cards.

**How to apply:** Limit candidate events to the call interval plus at most 30 minutes of after-call work, and stop at the next call for the same campaign contact. For Status List, show the latest still-confirmed item; Batch may additionally show callback, while Immediate must ignore automation outcomes. For Disposition workflow, show the last timestamped disposition selection. Pass the same resolved badges to the recording player and the scheduled Queue Step column instead of letting either independently query current contact state.