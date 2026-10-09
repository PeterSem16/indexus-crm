import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { UPDATE_RECORD_ENTITIES, UPDATE_RECORD_RELATIONS } from "../shared/automation-update-record";
import { getUpdateRecordCopy } from "../client/src/i18n/automation-update-record-copy";

test("Update record editor: seven-language help, event default, scoped search and explicit review", async () => {
  const english = getUpdateRecordCopy("en");
  for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
    const copy = getUpdateRecordCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(english).sort());
    assert.deepEqual(Object.keys(copy.field).sort(), Object.keys(english.field).sort());
    assert.deepEqual(Object.keys(copy.entity).sort(), Object.keys(english.entity).sort());
    assert.ok(copy.fixedWarning && copy.legacyHelp && copy.description && copy.field.internalNotes);
    assert.equal(copy.entity.campaign, "Mission", `${locale}: preserve the INDEXUS Mission name`);
    assert.ok(copy.safetyHelp.includes("Mission"));
  }
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      import {AutomationUpdateRecordAction} from "./client/src/components/automation-update-record-action";
      const client = new QueryClient({defaultOptions:{queries:{staleTime:0,retry:false}}});
      function Fixture(){
        const [config,setConfig]=useState({});
        const [countries,setCountries]=useState(["SK"]);
        const [invalid,setInvalid]=useState(true);
        window.fixture={setCountries,setConfig};
        return <QueryClientProvider client={client}>
          <Dialog open><DialogContent className="task-modern-modal automation-editor-dialog automation-rule-dialog max-h-[88vh]" overlayClassName="task-modern-modal-overlay" data-testid="parent">
            <DialogTitle>Rule fixture</DialogTitle><DialogDescription>Update record action</DialogDescription>
            <div className="task-modern-modal-body">
              <AutomationUpdateRecordAction config={config} onChange={setConfig} index={0} sourceModule="clinic"
                countryCodes={countries} availableVariables={[{value:"newValues.notes",label:"Notes"}]}
                onDraftValidityChange={setInvalid}/>
            </div>
            <div className="task-modern-modal-footer"><button type="button" data-testid="parent-save" disabled={invalid}>Save rule</button></div>
          </DialogContent></Dialog>
          <pre data-testid="config">{JSON.stringify(config)}</pre>
        </QueryClientProvider>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "fixture-language",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useI18n=()=>({locale:"sk",t:{common:{close:"Zavrieť"}}});`, loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const styles = await postcss([tailwindcss({
    ...loadConfig(`${process.cwd()}/tailwind.config.ts`), content: [
      "client/src/components/automation-update-record-action.tsx",
      "client/src/components/tasks/task-create-controls.tsx",
      "client/src/components/ui/{dialog,input,button,select,label,calendar,popover}.tsx",
    ],
  })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body><main id='root'></main></body></html>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/automation/update-record/**", route => {
      const url = new URL(route.request().url()), countries = url.searchParams.get("countries");
      if (url.pathname.endsWith("/catalog")) return route.fulfill({
        json: { entities: Object.entries(UPDATE_RECORD_ENTITIES).map(([value, fields]) => ({ value, fields })), relations: UPDATE_RECORD_RELATIONS },
      });
      if (url.pathname.endsWith("/records")) return route.fulfill({ json: {
        records: countries === "SK" && url.searchParams.get("q")?.toLowerCase().includes("test")
          ? [{ id: "fixture-clinic", label: "Test clinic", secondary: "Bratislava", country: "SK" }] : [],
        truncated: false,
      } });
      if (url.pathname.endsWith("/record") && countries === "CZ")
        return route.fulfill({ status: 400, json: { error: "outside permitted countries" } });
      if (url.pathname.endsWith("/record")) return route.fulfill({ json: {
        record: { id: "fixture-clinic", label: "Test clinic", secondary: "Bratislava", country: "SK" }, values: { notes: "Old" },
      } });
      return route.fulfill({ json: { options: [] } });
    });
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}/`);
    await page.addStyleTag({ content: styles.css +
      await readFile("client/src/components/tasks/task-modal-modern.css", "utf8") +
      await readFile("client/src/pages/automations-workspace.css", "utf8") });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const state = async () => JSON.parse(await page.getByTestId("config").innerText());
    await expect(page.getByTestId("update-record-0")).toBeVisible();
    await expect(page.getByTestId("update-record-0-migrate")).toHaveCount(0);
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.getByTestId("update-record-0-add-field").click();
    await page.getByRole("option", { name: getUpdateRecordCopy("sk").field.notes, exact: true }).click();
    assert.equal((await state()).target.entityType, "clinic", "Default event target must be saved when a field is first added");
    await page.getByTestId("update-record-0-value-notes").fill("Updated");
    await page.getByTestId("update-record-0-ack").check();
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    await page.getByTestId("update-record-0-value-notes").fill("Changed again");
    await expect(page.getByTestId("update-record-0-ack")).not.toBeChecked();
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.getByTestId("update-record-0-mode").click();
    await page.getByRole("option", { name: getUpdateRecordCopy("sk").selected, exact: true }).click();
    await page.getByTestId("update-record-0-type").click();
    await expect(page.getByRole("option", { name: "Mission", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Kampaň", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: getUpdateRecordCopy("sk").entity.clinic, exact: true }).click();
    await page.getByTestId("update-record-0-search").fill("Test");
    await page.getByTestId("update-record-result-fixture-clinic").click();
    await expect(page.getByTestId("update-record-0-summary")).toContainText("Test clinic");
    assert.equal((await state()).target.recordId, "fixture-clinic");
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.getByTestId("update-record-0-add-field").click();
    await page.getByRole("option", { name: getUpdateRecordCopy("sk").field.notes, exact: true }).click();
    await page.getByTestId("update-record-0-value-notes").fill("Fixed target");
    await page.getByTestId("update-record-0-ack").check();
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    await page.evaluate(() => (window as any).fixture.setCountries(["CZ"]));
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await expect(page.getByTestId("update-record-0-ack")).not.toBeChecked();
    for (const size of [{ width: 1280, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await expect.poll(async () => {
        const bounds = await page.getByTestId("parent").boundingBox();
        return Boolean(bounds && bounds.x >= -1 && bounds.y >= -1 &&
          bounds.x + bounds.width <= size.width + 1 && bounds.y + bounds.height <= size.height + 1);
      }).toBe(true);
      await page.screenshot({ path: `/tmp/update-record-${size.width}.png` });
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
