import { build as buildClient } from "vite";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { isolatedTasksRoute } from "./client-route";
import { assertPrivateSpace } from "../../ops/ai-jobs-b1/space-policy.cjs";

// Run only from an isolated source directory. No live dist deletion or backend
// entry import. Existing dependencies are sufficient; no npm install required.
const cwd = await fs.realpath(process.cwd());
const internal = os.hostname().split(".")[0].toUpperCase() === "CORPCRM01" && process.getuid?.() === 1001;
if (internal ? cwd !== path.join(os.homedir(), "INDEXUS-AI-B1/source") :
  !(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID) ||
    !cwd.startsWith("/home/runner/workspace/generated-artifacts/"))
  throw Error("B1_ISOLATED_BUILD_DIRECTORY_REQUIRED");
if (internal) assertPrivateSpace(path.join(os.homedir(), "INDEXUS-AI-B1"));
await fs.rm("dist/B1-BUILD.json", { force: true });
process.env.NODE_ENV = "production";
await buildClient({ plugins: [{
  name: "indexus-b1-original-tasks", enforce: "pre",
  transform(code, id) {
    if (id.replaceAll("\\", "/").endsWith("/client/src/App.tsx"))
      return { code: isolatedTasksRoute(code), map: null };
  },
}] });
const result = await build({
  entryPoints: ["server/ai-b1.ts"], platform: "node", bundle: true,
  format: "cjs", packages: "external", outfile: "dist/ai-b1.cjs",
  define: { "process.env.NODE_ENV": '"production"' }, metafile: true,
});
if (Object.keys(result.metafile!.inputs).some(p => /(^|\/)server\/(index|routes)\.ts$/.test(p)))
  throw Error("B1_PRODUCTION_ENTRY_IMPORTED");
await fs.writeFile("dist/b1-inputs.json", JSON.stringify(Object.keys(result.metafile!.inputs), null, 2));
const hash = async (file: string) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
const source = internal ? JSON.parse(await fs.readFile("B1-SOURCE.json", "utf8")).commit : "local-fixture";
await fs.writeFile("dist/B1-BUILD.json", JSON.stringify({ version: 1, source,
  backend: await hash("dist/ai-b1.cjs"), client: await hash("dist/public/index.html"), originalTasksRoute: true }) + "\n",
{ mode: 0o600 });
console.info("B1_ISOLATED_BUILD_READY");
