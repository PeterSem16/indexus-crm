---
name: NexusPulse showOnlyAssigned dual scope
description: showOnlyAssigned controls two independent things — campaign list and contact groups within a campaign.
---

# NexusPulse showOnlyAssigned dual scope

## Rule
`showOnlyAssigned` in agent-workspace.tsx controls **two independent layers** that must both be updated:

1. **`baseCampaigns`** (line ~8992) — filters the campaign list shown to the agent:
   ```js
   const baseCampaigns = showOnlyAssigned ? assignedCampaigns : allCampaigns;
   ```

2. **`contactGroups`** inside `TaskListPanel` — filters the contact groups within a selected campaign. When `showOnlyAssigned` is true, `team-cb` (callbacks assigned to someone else, not due) and `other-cb` (all other-agent callbacks) groups must be excluded:
   ```js
   ...(!showOnlyAssigned ? [{ id: "team-cb", ... }, { id: "other-cb", ... }] : []),
   ```

**Why:** These two filters are in completely different places. Fixing the campaign list filter has zero effect on the contact groups rendered inside TaskListPanel.

## How to apply
Any time you change `showOnlyAssigned` logic, check both locations. The prop is passed from the main component (line ~8319 `const [showOnlyAssigned, setShowOnlyAssigned]`) → to `TaskListPanel` (line ~12130) → used in both `baseCampaigns` (parent) and `contactGroups` (inside TaskListPanel render).
