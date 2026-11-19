"use strict";
// Reuse the tested backend-only promotion engine; never infer the current live hash.
const fs = require("node:fs");
const crypto = require("node:crypto");
const engine = require("./promote-email-reply-perspective.cjs");
const BASE = "65ff72b9db040ac166aaa899ca8291f9d5a5717e";
const PREVIOUS = "/var/www/indexus-crm/data/email-reply-fix-xfqtyf";
const PREVIOUS_HASH = "03e956745252f86f73378e349bf686474fe334c760e3273319dfc454b38de871";
const FILES = {
  "server/routes.ts": "6e9910cb8afd45ab12e859c4422cc61a750dcd42fb5f34da4b1b55125585555c",
  "server/lib/ai/email-compose-prompt.test.cjs": "deadc22142a4bb2ef5c362c2bc801fceae8ef5c573e2b88c4bd5d6f94ee0bca7",
};
const BLOBS = {
  "server/routes.ts": "9d250c91db672c3df7dd2fbf3056deb658663720",
  "server/lib/ai/email-compose-prompt.test.cjs": "892d3045dbce9f8ccccfdc241fdb0d49e8337f82",
};
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
function resolveBaseline(root = PREVIOUS, io = fs) {
  try {
    const directory = io.lstatSync(root);
    if (!directory.isDirectory() || directory.uid !== 0 ||
        (directory.mode & 0o777) !== 0o700 || io.realpathSync(root) !== root)
      fail("previous_release_directory_invalid");
    const read = name => {
      const file = root + "/" + name, stat = io.lstatSync(file);
      if (!stat.isFile() || stat.uid !== 0 || io.realpathSync(file) !== file)
        fail("previous_release_file_identity_invalid");
      // Root's tar extraction preserves Git's usual 0664 source modes.
      // The root-owned 0700 ancestor prevents group traversal; reject public writes.
      if (stat.mode & 0o002) fail("previous_release_file_world_writable");
      return io.readFileSync(file);
    };
    const hash = value => crypto.createHash("sha256").update(value).digest("hex");
    const receipt = JSON.parse(read("release.json").toString("utf8"));
    if (receipt.base !== engine.BASE || receipt.target !== BASE || receipt.backend !== PREVIOUS_HASH ||
        Object.keys(receipt.files || {}).sort().join("\n") !== Object.keys(engine.FILES).sort().join("\n"))
      fail("previous_release_receipt_identity_invalid");
    for (const [file, expected] of Object.entries(engine.FILES))
      if (receipt.files[file] !== expected || hash(read("build/" + file)) !== expected)
        fail("previous_release_source_hash_invalid");
    if (hash(read("previous-index.cjs")) !== PREVIOUS_HASH) fail("previous_release_backup_hash_invalid");
    return hash(read("build/dist/index.cjs"));
  } catch (error) {
    if (error.safeCode) throw error;
    fail("previous_release_evidence_unavailable");
  }
}
const options = { base: BASE, files: FILES, blobs: BLOBS, kind: "email_compose",
  testFile: "server/lib/ai/email-compose-prompt.test.cjs", resolveBackendHash: resolveBaseline };
module.exports = { BASE, FILES, BLOBS, resolveBaseline, options };
if (require.main === module) engine.main(process.argv.slice(2), options).catch(error => {
  console.error("STOP: " + (error.safeCode || "preflight_failed")); process.exitCode = 1;
});
