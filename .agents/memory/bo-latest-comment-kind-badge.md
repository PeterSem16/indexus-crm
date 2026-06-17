---
name: BO latest-comment-kind status badges
description: How Back Office board "state" badges (e.g. "agent answered") are derived and why they self-clear without read tracking
---

Back Office board badges that signal "the other side just acted" are derived from the task's MOST RECENT `task_comments` row kind, not from any per-user read/seen state.

Example: the "Agent odpovedal / Agent replied" badge = latest comment `kind === 'answer'` AND the task is still open (status != completed, boState != done, no confirmation).

**Why:** comment kinds form a natural conversation order (question → answer → note → state_change). The newest comment already encodes "whose turn it is", so a badge keyed on it is self-clearing: when BO replies (note/new question) or the task is completed/confirmed (which writes a `state_change` comment), a newer row supersedes the answer and the badge disappears. No notification read-tracking table is needed.

**How to apply:** server computes the flag in one `DISTINCT ON (task_id) ... ORDER BY task_id, created_at DESC` query over the visible task ids and attaches it to each board row; the detail drawer recomputes the same thing from the loaded `thread.comments` (pick the max-createdAt comment, order-independent). Keep board flag and detail computation in sync. Comment kinds: `comment | question | answer | state_change`.
