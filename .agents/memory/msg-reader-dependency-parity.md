---
name: MSG reader dependency parity
description: Unpublished local msgreader mapping extensions can cause production-only validation failures.
---

The published msgreader 1.0.1 package does not expose bodyHtml. Do not rely on that property in application code or release tests.

**Why:** The Replit installation contained extra field mappings absent from the official npm tarball and CORPCRM01. Both hosts reported the same package version and identical entry-point hashes, but the mapping file differed. A test relying on the local extension passed in development and blocked production deployment.

**How to apply:** Validate MSG HTML through its required PidTagBodyHtml binary stream and property declaration, while retaining independent reader checks for supported message fields and attachments. Test against the unmodified published reader in an isolated reference fixture. Compare actual implementation/mapping fingerprints when outputs differ; version and entry-point parity alone are insufficient. Do not patch production node_modules merely to satisfy a release test.
