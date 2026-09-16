import assert from "node:assert/strict";
import {
  buildConfiguredEmailBody,
  htmlToPlainPreview,
  reconcileEmailSignatureBody,
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

// A legacy profile signature is a fallback only for an explicitly missing
// mailbox row.  Empty, inactive, failed, or not-yet-loaded responses must not
// silently resurrect it.
const legacy = "Legacy Agent\nSupport";
assert.match(buildConfiguredEmailBody({ missing: true }, legacy), /Legacy Agent<br>Support/);
assert.equal(buildConfiguredEmailBody({ htmlContent: "", isActive: true }, legacy), "");
assert.equal(buildConfiguredEmailBody({ htmlContent: "<p>Inactive</p>", isActive: false }, legacy), "");
assert.match(buildConfiguredEmailBody({ htmlContent: "", isActive: false }, legacy), /Legacy Agent<br>Support/);
assert.equal(buildConfiguredEmailBody({ htmlContent: "", isActive: false, missing: false }, legacy), "");
assert.equal(buildConfiguredEmailBody(undefined, legacy), "");
// Mission settings take priority for ordinary emails, even before the
// mailbox lookup completes or when the personal signature is disabled.
const missionHtml = '<table><tr><td>Mission Agent</td></tr></table>';
assert.match(buildConfiguredEmailBody(undefined, legacy, missionHtml), /Mission Agent/);
assert.doesNotMatch(buildConfiguredEmailBody({ htmlContent: "Personal", isActive: true }, legacy, missionHtml), /Personal|Legacy/);
assert.match(buildConfiguredEmailBody({ isActive: false, missing: false }, legacy, missionHtml), /Mission Agent/);
assert.match(buildConfiguredEmailBody({ missing: true }, legacy, "  "), /Legacy Agent/);
assert.doesNotMatch(buildConfiguredEmailBody(undefined, legacy, '<p onclick="bad()">Mission</p><script>bad()</script>'), /onclick|script/);

const signature = "<p><br></p><div class=\"email-signature\">Mailbox</div>";
assert.equal(
  reconcileEmailSignatureBody({
    body: "",
    nextSignature: signature,
    previousAutoSignature: "",
    userEdited: false,
    templateSelected: false,
  }).body,
  signature,
);
assert.equal(
  reconcileEmailSignatureBody({
    body: "",
    nextSignature: signature,
    previousAutoSignature: "",
    userEdited: true,
    templateSelected: false,
  }).body,
  "",
);
assert.equal(
  reconcileEmailSignatureBody({
    body: signature,
    nextSignature: signature,
    previousAutoSignature: signature,
    userEdited: false,
    templateSelected: false,
  }).body,
  signature,
);
assert.equal(
  reconcileEmailSignatureBody({
    body: "<p>Typed message</p>",
    nextSignature: signature,
    previousAutoSignature: "",
    userEdited: true,
    templateSelected: false,
  }).body,
  "<p>Typed message</p>",
);
assert.equal(
  reconcileEmailSignatureBody({
    body: "<p>Template</p>",
    nextSignature: signature,
    previousAutoSignature: "",
    userEdited: false,
    templateSelected: true,
  }).body,
  "<p>Template</p>",
);

console.log("communication content regression tests passed");