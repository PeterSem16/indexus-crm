---
name: Export cleanup verification
description: How to verify asynchronous export cleanup without false deployment failures.
---

Do not treat an HTTP success response as proof that asynchronous temporary-file cleanup has completed. Verify the expected filesystem state with a bounded deadline, require the specific missing-file error, and reject unrelated filesystem errors.

**Why:** A deploy-equivalent Omni test run reproduced a release-blocking failure because the test assumed cleanup would finish within a short fixed sleep after the response. Keep the deletion requirement; do not bypass the test or change application response sequencing solely to satisfy that timing assumption.

**How to apply:** Run release tests with the operator's exact isolated environment and concurrency. Wait for observable cleanup rather than elapsed time, retain a finite failure deadline, and ensure operator failure output includes the failing test rather than only a tail of subsequent successes.
