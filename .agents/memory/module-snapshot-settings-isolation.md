---
name: Module snapshot settings isolation
description: Prevent one module's version restore from overwriting another module's settings stored in shared campaign configuration.
---

Module configuration snapshots must include only the `campaign.settings` keys owned by that module. Restore removes and reapplies only those owned keys, merging them into the current shared settings object rather than replacing the object.

**Why:** Nexus Pulse and Mission store configuration in the same campaign settings JSON. Replacing the whole object during a Nexus Pulse rollback could silently revert SMS, telephony, recording, or other Mission configuration.

**How to apply:** Keep an explicit module-owned key allowlist. When adding a setting to a module snapshot, confirm ownership first; on restore, preserve every non-owned key exactly as it exists at restore time.