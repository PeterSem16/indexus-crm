---
name: Public upload extension XSS
description: Files written to a publicly-served static mount must use a server-controlled extension, never the client filename's.
---

# Stored XSS via preserved upload extension

When an upload is written into a directory that is exposed through an Express
`express.static` mount (in this app `/data` and `/uploads` both serve `DATA_ROOT`),
the saved file's extension determines the `Content-Type` the browser receives.

**Rule:** never derive the on-disk extension from `file.originalname` /
`path.extname(originalname)` for files that land on a public static mount. Derive it
from a server-controlled whitelist keyed by an allowed MIME type (e.g. map
`image/png` -> `.png`, `application/pdf` -> `.pdf`, fallback `.bin`).

**Why:** multer's `fileFilter` only sees the *client-supplied* `file.mimetype`, which
is spoofable. An attacker can send `mimetype: application/pdf` (passes the filter)
while `originalname` is `evil.html`. If you keep the `.html`/`.svg`/`.js` extension,
the static mount serves it as active content and clicking the stored link executes
attacker JS in the app origin -> stored XSS.

**How to apply:** for any new disk-upload endpoint whose target dir is publicly
served, (1) keep a MIME->safe-ext map and use it in multer's `filename`, ignoring the
original extension; ensure no allowed MIME maps to an active type (html/svg/js are
simply absent from the map and thus cannot be uploaded). The original filename can
still be stored as display-only text (React escapes it) but must not touch the
filesystem path. A URL-prefix sanitizer (only allow `/data//uploads`) blocks external
URL injection but does NOT stop this internal-extension spoof.
