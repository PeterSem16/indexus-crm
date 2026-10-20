const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const desktop = fs.readFileSync(path.join(root, "client/src/pages/agent-workspace.tsx"), "utf8");
const mobile = fs.readFileSync(path.join(root, "client/src/components/mobile-agent-workspace.tsx"), "utf8");

for (const [name, source] of [["desktop", desktop], ["mobile", mobile]]) {
  test(`${name}: unapproved standalone workflow panels are not mounted`, () => {
    assert.doesNotMatch(source, /<StatusListWorkflowContact\b/);
    assert.doesNotMatch(source, /import\s*\{\s*StatusListWorkflowContact\s*\}/);
  });
}

test("desktop: phase pipeline is first, with no empty workflow-panel spacer", () => {
  assert.match(desktop, /className="flex flex-col flex-1 overflow-hidden">\s*\{\/\* ── Nexus Pulse Header \+ Phase Pipeline/);
  assert.match(desktop, /handleSlToggle/);
});

test("mobile: original Status List panel remains in all three workspace states", () => {
  assert.equal((mobile.match(/<StatusListPanel\b/g) || []).length, 3);
});
