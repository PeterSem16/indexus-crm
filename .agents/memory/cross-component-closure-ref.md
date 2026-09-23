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

For a focused regression when full-repo typechecking is impractical, use TypeScript symbol binding with `noResolve` to verify each affected identifier resolves in its component scope.

**Why:** Isolated modal fixtures do not execute references in the full workspace parent, and successful production builds do not detect unbound translation variables.

The same rule applies to Express route closures, especially when reporting and contact-list handlers contain similar enrichment code. Match the exact route before inserting logic.

**Why:** A successful build can ship a contacts handler referencing a map declared only inside reporting; every nonempty facility list then returns HTTP 500 and the UI looks empty.

**How to apply:** Execute the actual extracted route handler with facility fixtures for both admin and agent paths, including optional-metadata failures. Do not substitute a login-page screenshot or a passing enrichment-helper test for this check.
