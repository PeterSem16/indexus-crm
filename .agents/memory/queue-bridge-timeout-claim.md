---
name: Queue bridge timeout claim
description: Prevents max-wait processing from racing with ARI bridge creation after an agent answers.
---

An agent answer must synchronously claim the caller and remove it from waiting/assigned timeout tracking before the first asynchronous stop-MOH or create/add-bridge operation.

**Why:** The periodic timeout loop can otherwise observe an already-answered call as still assigned while bridge creation is awaiting ARI. If max wait expires in that window, overflow removes both channels immediately after they join the bridge.

**How to apply:** Any new queue answer or bridge path must establish a synchronous ownership/claim guard before ARI awaits. On bridge failure, explicitly restore the call to the queue rather than leaving it untracked.