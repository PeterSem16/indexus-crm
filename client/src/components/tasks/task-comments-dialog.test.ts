import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const component = readFileSync(fileURLToPath(new URL("./task-comments-dialog.tsx", import.meta.url)), "utf8");
const picker = readFileSync(fileURLToPath(new URL("./task-attachments.tsx", import.meta.url)), "utf8");
const styles = readFileSync(fileURLToPath(new URL("./task-comments-dialog.css", import.meta.url)), "utf8");

for (const [, value] of styles.matchAll(/--comments-(?:accent|tint):\s*([^;]+);/g)) {
  assert.match(value, /^\d+(?:\.\d+)? \d+(?:\.\d+)?% \d+(?:\.\d+)?%$/, "comment color tokens must be HSL, not RGB tuples");
}

assert.match(component, /disabled=\{submitting\}[\s\S]*data-testid="input-task-comment"/, "comment text is locked during POST");
assert.match(component, /disabled=\{submitting\}[\s\S]*<textarea[\s\S]*disabled=\{submitting\}/, "attachment and text inputs are locked during POST");
assert.match(component, /disabled=\{submitting \|\| uploading \|\| uploadFailed/, "send cannot race an upload or active failure");
assert.match(component, /setUploading\(false\);[\s\S]*setUploadFailed\(false\);/, "closing the comments dialog reconciles aborted upload state");
assert.match(component, /data-testid=\{`delete-comment-\$\{comment\.id\}`\}/, "delete controls keep their stable id");
assert.match(component, /button-close-task-comments/, "dialog has a localized close action");
assert.match(component, /task-preview-comment-\$\{comment\.id\}/, "preview comments use a distinct test id from modal history");
assert.match(component, /task-comment-\$\{comment\.id\}/, "full comment history keeps the stable task-comment id");
assert.match(component, /comment\.userId === currentUserId/, "only the author's own comments can be deleted");
assert.match(picker, /button-dismiss-task-attachment-error/, "failed uploads have an explicit recovery control");
assert.match(picker, /onErrorChangeRef\.current\?\.\(false\)/, "dismissing an upload error clears the parent's blocked-send state");
assert.match(styles, /\.task-comments-composer \{[^}]*max-height:46%/, "composer is bounded to preserve the send action");
assert.match(styles, /\.task-comments-composer \.task-attachment-chips \{ max-height:58px; overflow-y:auto/, "long attachment chips scroll inside the composer");
assert.match(styles, /max-height:76px; resize:none/, "textarea cannot expand over the send footer");
assert.match(styles, /\.task-comments-preview\s*\{[^}]*container-type:\s*inline-size/, "preview responds to its host panel width, not just viewport width");
assert.match(styles, /@container\s*\(max-width:\s*360px\)[\s\S]*\.task-comments-preview__head\s*\{[^}]*flex-direction:\s*column/, "narrow preview stacks heading and action to avoid overlap");
assert.match(styles, /@container\s*\(max-width:\s*360px\)[\s\S]*\.task-comments-open\s*\{[^}]*width:\s*100%/, "narrow preview action remains full-width and usable");
assert.match(styles, /@media\(max-width:420px\)[\s\S]*\.task-comments-composer__footer\s*\{[^}]*flex-direction:\s*column/, "mobile composer actions wrap into a non-overlapping stack");
assert.match(styles, /overflow-wrap:\s*anywhere/, "unbroken content cannot force horizontal overflow");
assert.match(component, /aria-label=\{t\.tasks\.addComment\}/, "preview add action has a localized accessible name");
assert.match(component, /orderedComments\.length > 0 && <p>\{t\.tasks\.commentsActivity\}/, "empty preview avoids duplicating its hint in the heading");
assert.match(component, /task-comments-preview__empty[\s\S]*<strong>\{t\.tasks\.noComments\}<\/strong>[\s\S]*<p>\{t\.tasks\.commentsEmptyHint\}<\/p>/, "empty preview groups title and hint into one composed state");
assert.match(component, /task-comments-empty-mark" aria-hidden="true" \/>/, "preview empty-state marker is decorative rather than a second speech icon");
assert.match(styles, /\.task-comments-preview__empty\s*\{[^}]*border:\s*1px dashed/, "empty state has a contained card treatment");
assert.match(styles, /\.task-comment-preview-item:hover/, "filled preview rows have a restrained interactive hover state");

console.log("Task comments close, send-lock, upload recovery, and composer-bound contracts passed.");