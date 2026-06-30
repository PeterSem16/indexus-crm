---
name: TabsContent nesting context
description: TabsContent must be inside the correct parent Tabs component; wrong nesting silently hides content even though the trigger appears selected.
---

# TabsContent nesting context

## The rule
`<TabsContent value="X">` must be a direct child (within the same Radix Tabs context) as `<TabsTrigger value="X">`. If there are nested `<Tabs>` components in the file, placing a TabsContent inside the wrong one silently hides it.

**Why:** Radix Tabs uses React Context. Each `<Tabs>` creates its own context. `TabsContent` reads the nearest parent Tabs context to decide whether to show or hide. A trigger in the outer Tabs setting `value="sl-analytics"` has no effect on a TabsContent that lives inside an inner Tabs governed by a different value state (e.g. `mcSubTab`).

**Symptom:** The tab trigger visually highlights on click (its own data-state updates correctly), but the content area stays blank. No error, no console output. Even a static `<div>` inside the TabsContent doesn't render because the parent TabsContent has `data-state="inactive"` / `hidden`.

**How to apply:** In large files with multiple `<Tabs>` components (e.g. campaign-detail.tsx has a main Tabs and a mailchimp inner Tabs), always grep for `<Tabs\b` and `</Tabs>` line numbers before adding a new TabsContent to verify which Tabs block closes first.
