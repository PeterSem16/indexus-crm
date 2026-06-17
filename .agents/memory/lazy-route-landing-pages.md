---
name: Lazy routes vs. landing pages
description: Why the post-login landing page(s) must NOT be React.lazy, and how to keep the rest lazy without navigation spinners.
---

# Lazy route splitting and the login landing page

**Rule:** never `React.lazy()` a page the user is redirected to immediately after
login. Eager-import it. Lazy-split everything else, and prefetch the common chunks
on idle after mount.

**Why:** a blanket "make every route lazy" optimization regressed perceived speed.
Each lazy route renders a `<Suspense fallback={<PageLoader/>}>` — a `Loader2`
spinner in the primary brand colour (red here, so users called it "len červené
koliesko"). The agent workspace page is ~12k lines / 54 imports and agents are
redirected straight to it on login (role `defaultLandingPage`). So they ALWAYS
waited for that huge chunk behind the red spinner — pure downside, no benefit,
because they need that page right away. In Vite dev the cost is worse: the first
navigation triggers an on-demand compile of the whole module subtree.

**How to apply (client/src/App.tsx):**
- Eager-import the landing pages: Dashboard (default `/`) and AgentWorkspacePage
  (agent landing). They render with no Suspense spinner.
- Keep the other ~30+ pages `lazy()` so the initial bundle stays small.
- `prefetchRoutes()`: from a `useEffect` in the authenticated shell, on
  `requestIdleCallback` (setTimeout fallback), fire the common pages' `import()`
  thunks (each `.catch()`-guarded, run once) to warm chunks so later navigation
  has no spinner either. Prefetch can NOT save the landing page itself — the route
  renders before idle fires — which is exactly why landing pages must be eager.
- Prefetching before redirect is the only other way to keep a landing page lazy;
  simpler to just eager-import it.
