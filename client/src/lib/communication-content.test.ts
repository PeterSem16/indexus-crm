import assert from "node:assert/strict";
import {
  buildConfiguredEmailBody,
  htmlToPlainPreview,
  sanitizeEmailHtml,
} from "./sanitize-html";

// Entity-encoded HTML is common in provider previews.  It must become readable
// text, not leak literal tags into the missed-message card.
assert.equal(
  htmlToPlainPreview("&lt;p&gt;Hello &amp; goodbye&lt;/p&gt;&lt;p&gt;Second line&lt;/p&gt;"),
  "Hello & goodbye\nSecond line",
);
assert.equal(
  htmlToPlainPreview("<div>First<br>Second</div>"),
  "First\nSecond",
);

// The Node fallback is intentionally exercised here (DOMParser is not present
// in this focused test process), matching SSR/build-side sanitization.
const sanitized = sanitizeEmailHtml(
  '<p onclick="alert(1)">Safe</p><script>alert(2)</script>' +
  '<a href="javascript:alert(3)">bad link</a>' +
  '<img src="javascript:alert(4)" onerror="alert(5)" alt="photo">' +
  '<custom><strong>Kept text</strong></custom>',
);
assert.match(sanitized, /<p>Safe<\/p>/);
assert.match(sanitized, /<a>bad link<\/a>/);
assert.match(sanitized, /<img alt="photo">/);
assert.match(sanitized, /<strong>Kept text<\/strong>/);
assert.doesNotMatch(sanitized, /script|onclick|onerror|javascript/i);

// A legacy profile signature is a fallback only for an explicit 404.  Empty,
// inactive, failed, or not-yet-loaded responses must not silently resurrect it.
const legacy = "Legacy Agent\nSupport";
assert.match(buildConfiguredEmailBody({ missing: true }, legacy), /Legacy Agent<br>Support/);
assert.equal(buildConfiguredEmailBody({ htmlContent: "", isActive: true }, legacy), "");
assert.equal(buildConfiguredEmailBody({ htmlContent: "<p>Inactive</p>", isActive: false }, legacy), "");
assert.equal(buildConfiguredEmailBody(undefined, legacy), "");

console.log("communication content regression tests passed");