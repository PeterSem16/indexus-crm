---
name: Custom queryFn must check res.ok
description: Inline TanStack Query queryFns that skip the res.ok check store error JSON as success data and crash .map/.filter
---

In this codebase many components write inline `queryFn: () => fetch(url, {credentials:"include"}).then(r => r.json())` instead of using the shared default fetcher.

**The rule:** any inline `queryFn` MUST check `res.ok` and throw on failure (e.g. `.then(r => { if (!r.ok) throw new Error(...); return r.json(); })`), OR just omit the queryFn and rely on the default fetcher (`getQueryFn`/`throwIfResNotOk` in `client/src/lib/queryClient.ts`), which already does this.

**Why:** the backend returns error bodies as JSON objects (e.g. `requireAuth` → `401 {error:"Unauthorized"}`, handlers → `500 {error}`). Without an ok-check, `r.json()` resolves to that object, React Query treats it as *successful* data, and the common `const { data = [] } = useQuery(...)` default does NOT apply (defaults only fill `undefined`, not a non-array object). The next `.map()`/`.filter()` then throws "x.map is not a function". This shows up production-only because dev sessions stay authenticated, so endpoints return 200 arrays.

**How to apply:** when adding/reviewing a query, prefer the default fetcher; if a custom queryFn is required (URL doesn't match the queryKey, or needs query params like `?type=email`), always include the `res.ok` guard. Symptom to recognize: "…map is not a function" / "…filter is not a function" when opening a data-driven view after a session expiry or transient 500.
