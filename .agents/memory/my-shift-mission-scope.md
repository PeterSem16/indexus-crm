---
name: My Shift Mission scope
description: Mission isolation rules for the Agent Workspace My Shift activity feed.
---

My Shift is a selected-Mission view, not a user-wide daily activity view. Every campaign action shown there must belong to the currently selected Mission.

**Why:** A completed FMO call remained visible after the agent switched to another Mission because the activity endpoint and query cache were scoped only by user and day.

**How to apply:** Require and authorize one campaign id on the server, filter call records by that id in the database, include the id in the client query key, and exclude communication activity without an exact matching Mission attribution. Session and break rows may remain because they are shift operations, not actions from another Mission.