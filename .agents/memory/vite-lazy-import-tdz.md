---
name: Vite React.lazy import order (TDZ)
description: Why `const X = lazy(...)` above its react import crashes in Vite dev despite ESM hoisting.
---

# Vite React.lazy import-order TDZ

When code-splitting routes with `const Page = lazy(() => import("..."))`, the
`import { lazy, Suspense } from "react"` statement MUST appear ABOVE the `lazy(...)`
const declarations.

**Symptom:** Vite dev runtime-error overlay: `Cannot access 'lazy' before initialization`
pointing at the first `const X = lazy(...)` line.

**Why:** Although ESM import bindings are spec-hoisted, Vite/esbuild's dev transform
evaluates the named import binding as a TDZ `const`, so using `lazy` on a source line
*above* its import statement throws. The "imports are hoisted so order doesn't matter"
assumption is FALSE here.

**How to apply:** Put the react import (with `lazy`, `Suspense`) immediately after the
other top-of-file imports and before the block of `lazy()` route consts. Keep tiny/always-
needed pages (e.g. login/landing, NotFound) eager; wrap the routed `<Switch>` in `<Suspense>`.
