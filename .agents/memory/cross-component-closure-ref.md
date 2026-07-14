---
name: Cross-component closure reference ships but crashes at runtime
description: A helper defined in one React component's closure but called from another component throws "X is not defined" only when the code path runs.
---

A function defined inside component A (a `const fn = useCallback(...)` / closure) but referenced
from an event handler that actually lives in component B is a genuine out-of-scope reference. It
is NOT a TDZ/minification quirk.

**Why:** esbuild/Vite (and the prod Vite build) do not resolve/validate free identifiers — they
emit the reference and assume a global. If `tsc` type-checking is not part of the build gate, the
"Cannot find name" error never blocks the build, so the broken code ships. At runtime it throws
`ReferenceError: <fn> is not defined` — but ONLY when that branch executes. When the branch is
data-gated (e.g. only fires when a per-campaign signature exists, which the dev DB lacked), the
bug is invisible in dev and surfaces only in prod.

**How to apply:** when logic must be shared across two components, hoist it to a **module-level**
function that takes an explicit context object (all the data it needs as params). Never rely on a
component-scoped closure being visible from another component's handler. Have the original
component delegate to the module-level function so behavior stays in one place. Related but
distinct failure mode: usecallback-deps-tdz.md (const declared after the useCallback that lists it
in deps).
