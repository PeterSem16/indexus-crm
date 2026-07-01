---
name: Hand-written form zod schemas silently drop fields
description: In this repo, react-hook-form forms use local hand-written zod schemas separate from the shared drizzle schema; a field missing from that schema is silently stripped on submit.
---

# Hand-written form zod schemas silently drop fields

Several forms (e.g. `user-form.tsx`) define their OWN zod schemas for
react-hook-form's `zodResolver` instead of reusing the shared drizzle-zod
insert/update schemas. `zodResolver` runs `schema.parse()` on submit, and a
plain zod object **strips keys it does not declare**. So if you add a
`<FormField name="X">` input but forget to add `X` to the local form schema,
the field renders and accepts input, but `X` is silently removed before
`onSubmit` — it is never sent to the server and looks like "save does nothing /
the text is erased on Update".

**Two things must both be present for a form field to work end to end:**
1. The field declared in the local form zod schema (so `zodResolver` keeps it).
2. The field in `defaultValues` (loaded from `initialData`), or an existing
   value never populates and the input shows empty when editing.

**Why:** the form schema and the shared/DB schema are maintained separately, so
the DB column + shared insert/update schema + `storage` can all be correct while
the field still fails purely on the client. When a "field won't save" bug
appears, check the local form schema FIRST, not the server.

**How to apply:** when adding or debugging a form field, grep the component's
local zod schema(s) for the field name and confirm it is in both the schema and
`defaultValues`.
