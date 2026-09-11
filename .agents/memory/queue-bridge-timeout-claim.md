---
name: Queue bridge timeout claim
description: Prevents max-wait processing from racing with ARI bridge creation after an agent answers.
---

An agent answer must synchronously claim the caller and remove it from waiting/assigned timeout tracking before the first asynchronous stop-MOH or create/add-bridge operation.

**Why:** The periodic timeout loop can otherwise observe an already-answered call as still assigned while bridge creation is awaiting ARI. If max wait expires in that window, overflow removes both channels immediately after they join the bridge.

**How to apply:** Any new queue answer or bridge path must establish a synchronous ownership/claim guard before ARI awaits. On bridge failure, explicitly restore the call to the queue rather than leaving it untracked.

For timeout/overflow, claim the database row with a guarded transition before
removing in-memory tracking or hanging up any channel. If the claim loses to an
answer, perform no destructive side effects.

**Why:** A process-local guard cannot prevent a concurrent answer and timeout
worker from both acting on the same call.

**How to apply:** Use one queue-entry timestamp in memory and the database.
Agent retries do not reset it. A real queue-to-queue transfer may reset it, but
the same atomic requeue transition must clear all terminal timeout metadata
(`completedAt`, abandon reason, answer and duration fields) before restoring the
call to waiting state.