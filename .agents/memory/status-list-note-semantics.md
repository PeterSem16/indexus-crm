---
name: Status-list note audit semantics
description: Why editing a confirmed step note must remain separate from confirmation and batch contact actions.
---

A note-only edit is not a new step confirmation. Saving it must not rerun automations, schedule a callback, change contact status, or close the contact.

**Why:** The existing batch workflow couples new step confirmations to subsequent contact actions. Reusing that whole workflow for a note edit can silently perform unrelated agent actions.

**How to apply:** Treat changed notes as unsaved work for navigation and Save availability, but persist existing-step notes independently. Confirmation retries with a null note mean preserve the existing note; an explicit null in a note-edit request means clear it. Do not unify those two meanings.

History must show the note snapshot recorded at the event, not the current editable note. Missing visible history does not by itself prove the note was never saved.

**Why:** Older note events can already contain text in event metadata even when the history renderer does not show it.

**How to apply:** Check stored event metadata before concluding data was lost, preserve historical actor/time, and keep later edits or clears from replacing earlier history text.