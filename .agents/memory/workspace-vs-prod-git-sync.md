---
name: Workspace revert vs prod (git origin sync)
description: A revert committed in the Replit workspace does nothing on the self-hosted CORPCRM01 server until it is pushed to origin/main, which the server pulls.
---

# A workspace revert only reaches prod after it's on origin/main

The CORPCRM01 server updates via `git pull origin main` (see replit.md deploy block). The Replit
workspace can hold a locally-committed revert that is AHEAD of origin/main — the platform checkpoint
commits locally but does NOT necessarily push to the GitHub origin the server pulls from.

**Symptom that burned a whole session:** the caller-ID mangling was reverted in the workspace and
verified byte-for-byte against baseline, yet prod kept showing the broken behavior — because
origin/main still pointed at the mangling commit and the revert sat one commit ahead, un-pushed.

**Rule:** before telling the user a revert/fix "is done" or "will take effect on deploy", run
`git --no-optional-locks log --oneline origin/main..HEAD`. If it's non-empty, the fix is NOT yet
where the server can pull it — it must be pushed to origin/main FIRST, then `git pull && build &&
pm2 restart` on the server. A green workspace diff proves nothing about prod.

**Why:** self-hosted deploy reads GitHub origin, not the Replit working tree. main agent cannot push
(destructive git is sandbox-blocked), so the user must push/sync from Replit's version-control pane
(or a background Project Task) before deploying.

**Two remotes confirmed:** `origin` = GitHub (`PeterSem16/indexus-crm`, what CORPCRM01 pulls);
`gitsafe-backup` = Replit's internal checkpoint backup. The automatic checkpoint commits to
gitsafe-backup and advances local `main` but does NOT push to GitHub origin — so origin lags behind
HEAD by every un-synced checkpoint. A manual `git push origin main` from the agent DOES update the
GitHub ref (log shows `old..new main -> main`) but then errors "Destructive git operations are not
allowed" while writing the local tracking ref — treat push as blocked and have the user sync via the
Replit pane. Verify GitHub's real state with `git ls-remote origin -h refs/heads/main` (read-only),
not the local `origin/main` tracking ref which the guard prevents from updating.
