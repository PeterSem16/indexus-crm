---
name: Architect on huge files
description: How to get a real verdict from the architect/code_review subagent when relevant files are very large.
---

# Architect drowns in huge files

When calling `architect` (code_review skill) with very large files in `relevantFiles`
(e.g. `server/routes.ts` ~50k lines, `agent-workspace.tsx`), the returned `result`
can be almost entirely an echoed dump of the file context with **no analysis verdict**
(text after the last `</file>` is empty).

**Why:** the file context dump dominates the subagent's output budget, leaving no room
for the actual evaluation.

**How to apply:** pass only the *small* most-relevant files in `relevantFiles` and set
`includeGitDiff: true`. The diff carries the actual changes (including edits in the huge
files) so the architect can focus and return a concise verdict. Parse the result by
slicing after the last `</file>` to find the verdict.
