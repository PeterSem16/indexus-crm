---
name: Post-merge timeout fix
description: npm install + db:push needs more than the default 20s post-merge timeout
---

The default post-merge timeout (20 000 ms) is too short for this project.

`npm install` alone takes ~15–20 s; combined with `npm run db:push` the total is ~27 s.

**Why:** The project has many dependencies. The Replit npm cache helps but the first run after a fresh merge still takes >20 s.

**How to apply:** Keep `timeoutMs` at 90 000 ms (90 s) in the post-merge config. If you ever reset the config, remember to set it back to 90000. Script lives at `scripts/post-merge.sh` and runs `npm install && npm run db:push`.
