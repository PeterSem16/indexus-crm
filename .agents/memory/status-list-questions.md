---
name: Status List Questions system
description: Schema, routes and builder UI for the per-item Q&A/checkbox system in the Campaign Status List Builder
---

## Rule
The campaign_status_list_questions table stores grouped checkbox questions per status-list item, with AND/OR group logic, required flag, and a self-referential gotoQuestionId (no FK, just a varchar ID reference) for branching.

**Why:** Each status-list step can have checklist questions for agents; groupName groups them visually, logicOperator (AND/OR) is per-group (taken from first question in group), gotoQuestionId allows "if checked → jump to question" UX.

## How to apply
- GET /api/campaigns/:cid/status-list returns `questions` array inside each item (LEFT JOIN + aggregated)
- CRUD at /api/campaigns/:cid/status-list/:itemId/questions (GET/POST/PUT/DELETE)
- DELETE on a status-list item cascades to delete its questions
- Builder: QuestionEditor, PreviewQuestions components in campaign-status-list-builder.tsx
- Goto branching: in preview, checking a question with gotoQuestionId scrolls to + highlights the target question with a ring (no FK enforcement, just ID reference)
- Group logic: stored on each question row but displayed from gqs[0].logicOperator for the group header badge
