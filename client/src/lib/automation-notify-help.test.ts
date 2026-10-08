import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import copy from "../i18n/automation-editor-help-translations";

for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  const help = copy[locale];
  assert.ok(help.notifyTitle.trim(), `${locale}: notification help title`);
  assert.equal(help.notify.length, 4, `${locale}: all delivery explanations`);
  assert.ok(help.notify.every(paragraph => paragraph.trim().length > 60));
  assert.match(help.notify[0], /INDEXUS/, `${locale}: visible app destination`);
  assert.match(help.notify[3], /THEN/, `${locale}: separate delivery actions`);
}
assert.match(copy.sk.notify[0], /zvončekom.*hornej lište.*centre notifikácií/);
assert.match(copy.sk.notify[1], /uloží.*po prihlásení/);
assert.match(copy.sk.notify[1], /neotvára.*ani neprehráva zvuk/);
assert.match(copy.sk.notify[3], /Neposiela e-mail, SMS.*nevytvára ani nepriraďuje Task/);
const page = readFileSync("client/src/pages/automations.tsx", "utf8");
assert.match(page, /action\.type === "notify_user"[\s\S]*?<AutomationStepHelp step="notify"/);
assert.match(page, /t\.automationEditorHelp\.notify\[0\]/);
console.log("Notify action help: all 7 languages and contextual UI passed.");
