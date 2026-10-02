import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translations, type Locale } from "../../i18n/translations";

const locales: Locale[] = ["en", "sk", "cs", "hu", "ro", "it", "de"];
const noteKeys = [
  "checklistNoteLabel",
  "checklistNotePlaceholder",
  "checklistNoteAdd",
  "checklistNoteEdit",
  "checklistNoteSave",
  "checklistNoteCancel",
] as const;

for (const locale of locales) {
  for (const key of noteKeys) {
    assert.ok(translations[locale].tasks[key].trim(), `${locale}.${key} must be translated`);
  }
}

const checklistSource = readFileSync(new URL("../../pages/tasks.tsx", import.meta.url), "utf8");
const noteMutation = checklistSource.match(/const noteMut = useMutation\(\{([\s\S]*?)\n  \}\);/)?.[1];
assert.ok(noteMutation, "note mutation must remain explicit and independently verifiable");
assert.match(noteMutation, /`\/api\/task-checklist\/\$\{id\}`,\s*\{\s*note\s*\}/);
assert.doesNotMatch(noteMutation, /\bdone\b/, "saving a note must not overwrite concurrent checklist completion changes");
assert.match(checklistSource, /maxLength=\{240\}/);
assert.match(checklistSource, /event\.target\.value\.slice\(0,\s*240\)/);
assert.match(checklistSource, /const noteKey = `\$\{taskId\}:\$\{it\.id\}`/);
assert.match(checklistSource, /queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/tasks", variables\.currentTaskId, "checklist"\] \}\)/);

console.log("checklist note contract checks passed");