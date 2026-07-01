---
name: useCallback deps TDZ in production
description: useState declared after a useCallback that lists it in the dep array causes TDZ crash only in prod builds, not dev.
---

## Rule
Declare every `const [x, setX] = useState(...)` **before** any `useCallback(..., [..., x, ...])` that lists `x` in its dependency array — in the same component function, in source order.

## Why
- **Dev (esbuild)**: Vite dev transpiles `const` → `var`, so TDZ is silently erased and everything works.
- **Prod (Rollup + terser)**: keeps native `const`, so accessing `x` in the dep-array expression (evaluated at hook-call time, before the `useState` line runs) throws `ReferenceError: can't access lexical declaration 'x' before initialization`.
- The closure body of the callback is fine (it runs after mount, so `x` is initialized); only the **dep-array literal** is evaluated at `useCallback` call time.

## How to apply
Whenever adding a `useCallback` with a state variable in its deps, scan upward in the same component — if the matching `useState` is *below* the `useCallback`, move it above. This applies even if the file "works in dev"; it will crash in production.

## Example (observed crash)
```tsx
// ❌ TDZ in production — slPendingCallback evaluated in deps before useState runs
const handleConfirm = useCallback(async () => {
  if (!slPendingCallback) return;
  ...
}, [slPendingCallback, ...]);          // ← dep evaluated NOW

const [slPendingCallback, setSlPendingCallback] = useState(null); // ← declared AFTER
```

```tsx
// ✅ Fixed — state declared first
const [slPendingCallback, setSlPendingCallback] = useState(null); // ← declared BEFORE

const handleConfirm = useCallback(async () => {
  if (!slPendingCallback) return;
  ...
}, [slPendingCallback, ...]);
```
