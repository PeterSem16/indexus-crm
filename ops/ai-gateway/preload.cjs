"use strict";
// Loaded by Node --require, before INDEXUS imports. No npm dependencies.
// No caller-controlled path, no network, no raw exceptions or credentials in output.
(function () {
  const env = process.env;
  try {
    if (env.NODE_ENV !== "production" || env.REPL_ID || env.REPLIT_DEV_DOMAIN) throw Error("blocked");
    const fs = require("node:fs");
    const directory = "/etc/indexus-ai-runtime", file = directory + "/gateway.json";
    for (const entry of ["/etc", directory, file]) {
      const s = fs.lstatSync(entry);
      if (s.isSymbolicLink() || s.uid !== 0) throw Error("blocked");
    }
    const dir = fs.statSync(directory);
    if (!dir.isDirectory() || dir.gid !== 1001 || (dir.mode & 0o7777) !== 0o750) throw Error("blocked");
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let bytes;
    try {
      const s = fs.fstatSync(fd);
      if (!s.isFile() || s.uid !== 0 || s.gid !== 1001 || (s.mode & 0o7777) !== 0o640 ||
        s.size < 2 || s.size > 16384) throw Error("blocked");
      bytes = fs.readFileSync(fd, "utf8");
    } finally { fs.closeSync(fd); }
    const value = JSON.parse(bytes);
    if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "baseURL,enabled,mode,token" ||
      value.enabled !== true || value.mode !== "routed" ||
      value.baseURL !== "https://ai.cordbloodcenter.com/gateway/" ||
      typeof value.token !== "string" || !/^[\x21-\x7e]{16,8192}$/.test(value.token)) throw Error("blocked");
    // Only the four explicitly approved variables may change.
    env.INDEXUS_AI_GATEWAY_TOKEN = value.token;
    env.INDEXUS_AI_GATEWAY_BASE_URL = value.baseURL;
    env.INDEXUS_AI_ROUTER_MODE = value.mode;
    env.INDEXUS_AI_GATEWAY_ENABLED = "true";
  } catch {
    // A credential/configuration failure must not stop CRM or its OpenAI services.
    delete env.INDEXUS_AI_GATEWAY_TOKEN;
    env.INDEXUS_AI_GATEWAY_ENABLED = "false";
    try { process.stderr.write("INDEXUS_GATEWAY_PRELOAD_BLOCKED\n"); } catch {}
  }
})();
