---
name: Ubuntu static asset delivery
description: Production delivery constraint for the large INDEXUS frontend bundle behind nginx.
---

CORPCRM01 nginx forwards the Express static response without adding compression. Hashed assets must therefore be Brotli/gzip compressed by the Node server and cached as public immutable resources; only `index.html` should remain no-cache.

**Why:** An uncompressed ~6.9 MB entry bundle combined with `no-store` made the production page remain blank or on its loader while every visit slowly downloaded the full asset. Brotli reduced the transfer to ~1.8 MB and restored the login page.

**How to apply:** Preserve in-process static compression without adding an npm dependency, because the Ubuntu deployment skips `npm install`. Verify production with `Accept-Encoding: br` and require `Content-Encoding: br` plus an immutable cache header on `/assets/*`.