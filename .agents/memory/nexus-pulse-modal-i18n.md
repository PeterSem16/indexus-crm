---
name: Nexus Pulse status-list modal i18n
description: The Nexus Pulse disposition/status-list modal UI is split across two files; translating "the modal" requires touching both.
---

# Nexus Pulse status-list / disposition modal is rendered by TWO files

## The fact
The status-list / disposition modal in Nexus Pulse (agent-workspace) is NOT one file:
- The outer modal shell — callback scheduling, call-note fields, warnings, footers, multi-select bar — lives in `client/src/pages/agent-workspace.tsx` (the disposition Sheet). Strings use `t.agentWorkspace.disp*` and existing `t.statusEngine.disp.*`.
- The status **tiles / category groups / expand-collapse toolbar / "Display" settings popover / action badges** come from the SHARED component `client/src/components/nexus-pulse-view.tsx` (`NexusPulseView`). This component is ALSO used in the campaign-builder preview. Strings use `t.agentWorkspace.pulse*`.

**Why:** `NexusPulseView` originally had NO i18n wiring at all (no `useI18n`), and its action-label map was a module-level Slovak `const`. Fixing only agent-workspace leaves every tile/toolbar/settings string hardcoded Slovak in both the agent modal AND the campaign builder.

## How to apply
- When a user reports "missing texts in the Nexus Pulse status-list modal", check BOTH files.
- A module-level label map cannot call hooks — build it inside the component from `t` (rebuilding per render is fine; the map is tiny and this makes it language-reactive).
- Grep for bare JSX text `>[A-Za-z]{3,}<`, not just accented Slovak chars — English badges like `FINAL`/`CONV` also violate the 7-language rule.
