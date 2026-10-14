import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("automation run history dialog stacks above the shared blurred overlay", () => {
  const page = read("../../pages/automations.tsx");
  const dialog = read("../ui/dialog.tsx");
  const modalStyles = read("./task-modal-modern.css");

  assert.match(page, /<DialogContent className="automation-history-dialog\b/);
  assert.match(page, /overlayClassName="task-modern-modal-overlay"/);
  assert.match(page, /<DialogTitle>[\s\S]*?historyFor\?\.name/);
  assert.match(page, /<AutomationRunHistory[\s\S]*?ruleId=\{historyFor\.id\}[\s\S]*?onOpenRule=/);

  const overlay = modalStyles.match(/\.task-modern-modal-overlay\s*\{([^}]*)\}/)?.[1];
  const history = modalStyles.match(/\.automation-history-dialog\s*\{([^}]*)\}/)?.[1];
  assert.ok(overlay, "shared blurred overlay keeps its existing style rule");
  assert.ok(history, "history-specific stacking rule exists");
  const overlayZ = Number(overlay.match(/z-index:\s*(\d+)/)?.[1]);
  const historyZ = Number(history.match(/z-index:\s*(\d+)/)?.[1]);
  assert.ok(historyZ > overlayZ, `history dialog (${historyZ}) must be above overlay (${overlayZ})`);

  assert.match(dialog, /DialogPrimitive\.Content/);
  assert.match(dialog, /DialogPrimitive\.Close/);
});
