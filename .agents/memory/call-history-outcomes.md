---
name: Call history outcomes
description: Durable rules for associating Communication history badges with the call that produced them.
---

Communication history call badges must be derived from immutable data associated with the specific call, never from current mutable Mission or campaign-contact settings. Recording badges use the call-time recording policy snapshot; outcome badges use timestamped events in that call's window.

**Why:** A later Status List automation can change the contact, and a manager can later change the Mission recording mode. Reading either current value retroactively mislabels older call cards.

**How to apply:** Parse recording policy from the linked call log first, then from inbound-call metadata when needed; never fall back to current Mission settings. Limit outcome events to the call interval plus at most 30 minutes of after-call work, and stop at the next call for the same campaign contact. For Status List, show the latest still-confirmed item; Batch may additionally show callback, while Immediate must ignore automation outcomes. For Disposition workflow, show the last timestamped disposition selection. Pass the same resolved badges to the recording player and the scheduled Queue Step column instead of letting either independently query current contact state.