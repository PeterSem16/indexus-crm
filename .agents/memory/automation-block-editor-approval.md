---
name: Approved automation block editor
description: User-approved compact overview and focused modal editing for automation rules.
---

Keep the automation editor as a compact WHEN/IF/THEN/ELSE overview with focused modal editors, rather than expanding every configuration in the main window. Preserve the approved light/red visual direction and the real action, source, condition, country and execution settings.

**Why:** The user approved the interactive proposal and selected “Zapracovať návrh do aplikácie”.

**How to apply:** Future editor changes should extend this direction, not return to a long inline builder. ELSE offers Stop, its own actions, or an explicitly selected compatible existing rule. Unknown or failed analysis must not silently mean FALSE.

The preview should have generous inset spacing and a playful, attractive modern appearance; enlarging the parent modal is within the requested visual scope.

**Why:** The user found the preview pressed against its edges and asked for a prettier, playful redesign, possibly with a larger modal.

**How to apply:** Preserve readable spacing inside the preview rather than fitting every element flush to its container.

Forwarding actions may apply directly while their focused editor is open, provided the complete forwarding configuration is valid. Do not remove the Done step globally from other action editors.

**Why:** The user reported that sender matching could not be applied. Forwarding controls update the rule draft immediately, whereas other actions can contain separately staged text or recipient edits.

**How to apply:** Treat focus state separately from validity; validate forwarding recipients/configuration in both THEN and ELSE, and retain cancellation rollback.
