---
name: Pulse toolbar design approval
description: Approved visual direction and limits when translating the toolbar mockup into the working application.
---

Preserve the light-blue Unified styling, but keep the desktop toolbar in ONE compact row with consistent small gaps. Wrap only when the available width genuinely requires it. Empty missed-channel counts stay neutral; pending counts receive emphasis.

**Why:** After seeing the implementation on 2026-09-18, the user explicitly rejected the two-row layout and the large gap after the shift timer. This correction supersedes the canvas layout approval. It is not a request to change telephony, queue semantics, or the separate mobile workspace.

**How to apply:** Keep the approved canvas source intact. Translate illustrative copy to actual functionality: Queue opens scheduled contacts, not an inbound line; the audio toggle controls incoming ringing, not all notifications. Verify conditional break/forwarding content and wider translations in the real fullscreen app, not just the short English mockup.

Keep user-selected break details in the approved modal, not in a second toolbar block. Hiding the modal must not end the break; the status control reopens it.

**Why:** On 2026-09-18 the user approved the visible lunch-break modal with a large timer and a clear finish-and-continue action, specifically to save toolbar space.

**How to apply:** Preserve that approved reference during implementation. Automatic system pauses, such as working in Back Office, are not human-selected rest breaks and must not interrupt the agent by auto-opening the modal.