---
name: huge-repo tsc verification
description: How to reliably run tsc --noEmit on this very large repo when temp output files keep vanishing
---

Running `tsc --noEmit` here is slow (~110s cold, ~5s warm via the incremental buildinfo at `node_modules/typescript/tsbuildinfo`) and the output file frequently disappears mid-run.

**Why:** `/home/runner` (outside the workspace), `/tmp`, and `.local/state` get cleaned out from under you (platform ephemeral cleanup — NOT server crashes; the dev server does not crash-loop, its log only shows benign BABEL "deoptimised styling" notes). A cold tsc run can also be OOM-killed (exit -1, no output) on this codebase.

**How to apply:**
- Write the output file to the **workspace root** (e.g. `./tscout.txt`) — that mount persists. Do NOT write to `/home`, `/tmp`, or `.local/state`.
- Background it with a larger heap and poll the pid every 1s, reading the file the instant it exits: `NODE_OPTIONS="--max-old-space-size=4096" nohup npx tsc --noEmit > tscout.txt 2>&1 &`
- An **empty** output file = 0 errors (tsc prints nothing on success).
- Do NOT override `--tsBuildInfoFile` to an outside path — that forces a cold ~110s+ run that times out. Use the default (warm) buildinfo.
- Editing a server file triggers a tsx reload but does NOT re-type-check; restart the workflow only to load new backend routes, then verify with a curl (unauth endpoint should return 401, not 404).
- Clean up the temp file afterward.
