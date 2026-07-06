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
- **`read` tool reports a stale file length on huge files:** on `server/routes.ts` (~52k lines) the `read` tool claimed the file was only 24094 lines and refused offsets past that ("start exceeds file length"). `wc -l` and `rg` gave correct, much larger numbers. When `read` blocks a high offset on a big file, trust `wc -l`/`rg` line numbers and use `sed -n 'A,Bp' file` to read the real content.
- **PREFER LSP diagnostics over tsc for verifying YOUR edits — do this FIRST, not as a fallback.** Cold `tsc` here reliably exceeds the ~120s tool cap AND backgrounded/nohup jobs are killed at ~60s, so a full `tsc` run essentially never completes in-session; the "empty log = 0 errors" heuristic is UNSAFE because a killed run leaves an equally-empty file (you cannot tell success from kill without a `DONE_EXIT` sentinel that also gets wiped). Don't burn turns on it. Instead the editor's `tsserver` is already running with the whole project loaded — use the diagnostics skill's `getLatestLspDiagnostics({filePath})` per edited file. It returns real type errors for those files in seconds and is authoritative for the files you touched (it is what the IDE shows). Backgrounded `tsc` here is frequently OOM-killed by the resident tsserver (~2.4GB) + vite + tsx; don't expect it to complete.
- **This repo is NOT tsc-clean and never has been — do not use the global error count as a pass/fail gate.** A WARM incremental run reports ~112 errors; a CLEAN run (after `rm node_modules/typescript/tsbuildinfo`) reports ~1770. The buildinfo masks the vast majority. The project ships fine because dev uses `tsx` and the build uses `vite`/`esbuild`, neither of which strict-typechecks. The bulk of the errors are pre-existing: `translations.ts` duplicate-identifier + missing-property mismatches (~200, the same set as the Vite "Duplicate key" startup warnings) and `queue-engine.ts` `TS2802` downlevelIteration errors on Map/Set iteration.
- **Verify your OWN change is net-neutral, not that tsc is globally clean.** After editing, grep the clean error list for (a) any mention of your new identifiers/keys and (b) errors whose line numbers fall inside the ranges you actually edited. If both are empty, you added zero errors even though the global count is huge. Nearby errors just after your inserted block are usually pre-existing code shifted down by your insertion — read the source at those lines to confirm they aren't yours.
