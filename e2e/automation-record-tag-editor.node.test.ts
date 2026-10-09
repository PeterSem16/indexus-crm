import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { RECORD_TAG_ENTITY_TYPES } from "../shared/automation-record-tags";
import { UPDATE_RECORD_RELATIONS } from "../shared/automation-update-record";
import { getAutomationRecordTagCopy } from "../client/src/i18n/automation-record-tag-copy";

test("Tag editors: native browser add/remove, ten types, review, country scope, legacy CSV and visible tags", async () => {
  const copy = getAutomationRecordTagCopy("en");
  const bundle = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      import {AutomationRecordTagAction,RecordTagConditionInput} from "./client/src/components/automation-record-tag-action";
      import {RecordTagsBadges} from "./client/src/components/record-tags-badges";
      import {RecordTagsBrowser} from "./client/src/components/record-tags-browser";
      const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:0}}});
      function Fixture(){
        const [config,setConfig]=useState({}),[module,setModule]=useState("clinic");
        const [countries,setCountries]=useState(["SK"]),[mode,setMode]=useState("add");
        const [invalid,setInvalid]=useState(true),[directory,setDirectory]=useState(false),[value,setValue]=useState("");
        window.fixture={setConfig,setModule,setCountries,setMode,setDirectory};
        return <QueryClientProvider client={client}><Dialog open><DialogContent className="task-modern-modal automation-rule-dialog max-w-3xl max-h-[88dvh] overflow-y-auto" data-testid="parent">
          <DialogTitle>Tag rule</DialogTitle><DialogDescription>Actual INDEXUS tag controls</DialogDescription>
          <div className="task-modern-modal-body">{directory?<RecordTagsBrowser countryCodes={countries}/>:<>
            <AutomationRecordTagAction config={config} onChange={setConfig} sourceModule={module}
              countryCodes={countries} index={0} mode={mode} onDraftValidityChange={setInvalid}/>
            <RecordTagsBadges entityType="clinic" entityId="fixture-clinic"/>
            <RecordTagConditionInput entityType={module} countryCodes={countries} value={value} onChange={setValue}/>
          </>}</div>
          <div className="task-modern-modal-footer"><button type="button" data-testid="parent-save" disabled={invalid}>Save rule</button></div>
        </DialogContent></Dialog><pre data-testid="config">{JSON.stringify(config)}</pre></QueryClientProvider>;
      }createRoot(document.getElementById("root")).render(<Fixture/>);`,
      loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "language-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useI18n=()=>({locale:"en",t:{common:{close:"Close"}}});`, loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` },
  });
  const config = loadConfig(`${process.cwd()}/tailwind.config.ts`);
  const css = await postcss([tailwindcss({ ...config, content: [
    "client/src/components/automation-record-tag-action.tsx", "client/src/components/record-tags-{badges,browser}.tsx",
    "client/src/components/ui/{dialog,input,button,select,label,badge,popover}.tsx",
  ] })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" }); res.end("<main id='root'></main>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } }), errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // No fetch shim: preserve native Request receiver semantics.
    await page.route("**/api/**", route => {
      const url = new URL(route.request().url()), path = url.pathname;
      if (path.startsWith("/api/record-tags/")) return route.fulfill({ json: { tags: ["VIP", "group_id:hidden", "status_list"] } });
      if (path.endsWith("/catalog")) return route.fulfill({ json: {
        entities: RECORD_TAG_ENTITY_TYPES.map(value => ({ value })), relations: UPDATE_RECORD_RELATIONS,
      } });
      if (url.searchParams.get("countries") !== "SK") return route.fulfill({ status: 400, json: { error: "Unavailable" } });
      if (path.endsWith("/suggestions")) return route.fulfill({ json: { tags: ["VIP", "Follow-up"] } });
      const record = { id: "fixture-clinic", label: "Verified clinic", secondary: "Bratislava", country: "SK" };
      if (path.endsWith("/records")) return route.fulfill({ json: { records: [record], truncated: false } });
      if (path.endsWith("/record")) return route.fulfill({ json: { record, tags: ["VIP"] } });
      if (path.endsWith("/tagged")) return route.fulfill({ json: { records: [{ ...record, tags: ["VIP"] }], truncated: false } });
      return route.fulfill({ status: 404, json: { error: "Unknown test endpoint" } });
    });
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
    await page.addStyleTag({ content: `${css.css}\n${await readFile("client/src/pages/automations-workspace.css", "utf8")}` });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await expect(page.getByTestId("record-tag-badges")).toContainText("VIP");
    await expect(page.getByTestId("record-tag-badges")).not.toContainText("group_id");
    await expect(page.getByTestId("record-tag-badges")).not.toContainText("status_list");
    for (const type of RECORD_TAG_ENTITY_TYPES) {
      await page.evaluate(type => { (window as any).fixture.setModule(type); (window as any).fixture.setConfig({}); }, type);
      await page.getByTestId("tag-action-0-add-input").fill("VIP");
      await page.getByTestId("tag-action-0-add").click();
      await page.getByTestId("tag-action-0-ack").check();
      await expect(page.getByTestId("parent-save")).toBeEnabled();
      const saved = JSON.parse(await page.getByTestId("config").textContent() || "{}");
      assert.equal(saved.target.entityType, type); assert.deepEqual(saved.tags, ["VIP"]);
    }
    await page.evaluate(() => { (window as any).fixture.setModule("clinic"); (window as any).fixture.setConfig({}); });
    await page.getByTestId("tag-action-0-add-input").fill("VIP");
    await page.getByTestId("tag-action-0-add").click();
    await page.getByTestId("tag-action-0-ack").check();
    await page.evaluate(() => (window as any).fixture.setMode("remove"));
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await expect(page.getByTestId("tag-action-0")).toContainText(copy.removeHelp);
    await page.getByTestId("tag-action-0-ack").check();
    await page.getByTestId("tag-action-0-mode").click();
    await page.getByRole("option", { name: copy.selected, exact: true }).click();
    await page.getByTestId("tag-action-0-type").click();
    await page.getByRole("option", { name: "Clinic", exact: true }).click();
    await page.getByTestId("tag-action-0-search").fill("Verified");
    await page.getByTestId("tag-action-0-result-fixture-clinic").click();
    await expect(page.getByTestId("tag-action-0-summary")).toContainText("Verified clinic");
    await page.getByTestId("tag-action-0-ack").check();
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    await page.evaluate(() => (window as any).fixture.setCountries(["CZ"]));
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.evaluate(() => { (window as any).fixture.setCountries(["SK"]); (window as any).fixture.setConfig({ tags: "VIP, Follow-up" }); });
    await expect(page.getByTestId("tag-action-0")).toContainText(copy.legacyTitle);
    await page.getByRole("button", { name: copy.legacyConvert, exact: true }).click();
    await expect(page.getByTestId("tag-action-0-summary")).toContainText("Follow-up");
    assert.deepEqual(JSON.parse(await page.getByTestId("config").textContent() || "{}").tags, ["VIP", "Follow-up"]);
    await page.evaluate(() => (window as any).fixture.setConfig({ tags: ["VIP", "group_id:protected"] }));
    await expect(page.getByRole("button", { name: copy.legacyConvert, exact: true })).toBeDisabled();
    await page.evaluate(() => (window as any).fixture.setDirectory(true));
    await page.getByTestId("tag-browser-type").click();
    await page.getByRole("option", { name: "Clinic", exact: true }).click();
    await page.getByTestId("tag-browser-tag").fill("VIP");
    await expect(page.getByText("Verified clinic", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("tag-browser-search")).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "No mobile horizontal overflow");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
