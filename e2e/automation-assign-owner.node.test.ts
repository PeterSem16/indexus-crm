import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { getAutomationAssignOwnerCopy } from "../client/src/i18n/automation-assign-owner-copy";

test("Owner editor: native requests, named targets/people, four strategies, scope, review and mobile", async () => {
  const copy = getAutomationAssignOwnerCopy("en");
  const keys = Object.keys(copy).sort();
  for (const locale of ["sk", "cs", "hu", "ro", "it", "de"])
    assert.deepEqual(Object.keys(getAutomationAssignOwnerCopy(locale)).sort(), keys);
  const bundle = await build({
    stdin: { contents: `
      import React,{useState} from "react";import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      import {AutomationAssignOwnerAction} from "./client/src/components/automation-assign-owner-action";
      import {CustomerOwnerBadge} from "./client/src/components/customer-owner-badge";
      const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:0}}});
      function Fixture(){const [config,setConfig]=useState({}),[module,setModule]=useState("task");
        const [countries,setCountries]=useState(["SK"]),[invalid,setInvalid]=useState(true),[schedule,setSchedule]=useState(undefined);
        window.fixture={setConfig,setModule,setCountries,setSchedule};
        return <QueryClientProvider client={client}><Dialog open><DialogContent className="task-modern-modal automation-rule-dialog max-w-3xl max-h-[88dvh] overflow-y-auto">
        <DialogTitle>Owner rule</DialogTitle><DialogDescription>Actual INDEXUS controls</DialogDescription>
        <div className="task-modern-modal-body"><AutomationAssignOwnerAction config={config} onChange={setConfig}
        sourceModule={module} countryCodes={countries} index={0} scheduleMode={schedule} onDraftValidityChange={setInvalid}/>
        <CustomerOwnerBadge customerId="fixture-record"/></div>
        <div className="task-modern-modal-footer"><button type="button" data-testid="save" disabled={invalid}>Save rule</button></div>
        </DialogContent></Dialog><pre data-testid="config">{JSON.stringify(config)}</pre></QueryClientProvider>;
      }createRoot(document.getElementById("root")).render(<Fixture/>);`, resolveDir: process.cwd(), loader: "tsx" },
    plugins: [{ name: "language", setup(builder) {
      builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        contents: `export const useI18n=()=>({locale:"en",t:{common:{close:"Close"}}});`, loader: "ts",
      }));
    } }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` },
  });
  const config = loadConfig(`${process.cwd()}/tailwind.config.ts`);
  const css = await postcss([tailwindcss({ ...config, content: [
    "client/src/components/automation-assign-owner-action.tsx", "client/src/components/customer-owner-badge.tsx",
    "client/src/components/ui/{dialog,input,button,select,label,badge,popover}.tsx",
  ] })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<main id='root'></main>"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    // Route network requests, never wrap or replace native fetch.
    await page.route("**/api/**", route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/owner")) return route.fulfill({ json: { name: "Alice Owner" } });
      if (url.searchParams.get("countries") !== "SK") return route.fulfill({ status: 400, json: { error: "Unavailable" } });
      if (url.pathname.endsWith("/people")) {
        const people = [{ value: "alice", label: "Alice Owner" }, { value: "bob", label: "Bob Owner" },
          ...(url.searchParams.get("assignmentKind") === "representative" ? [] : [{ value: "charlie", label: "Charlie Internal" }])];
        const id = url.searchParams.get("id"), query = (url.searchParams.get("q") || "").toLowerCase();
        return route.fulfill({ json: { options: people.filter(person => id ? person.value === id : person.label.toLowerCase().includes(query)) } });
      }
      const record = { id: "fixture-record", label: "Verified record", country: "SK", secondary: "Bratislava" };
      if (url.pathname.endsWith("/records")) return route.fulfill({ json: { records: [record], truncated: false } });
      if (url.pathname.endsWith("/record")) return route.fulfill({ json: { record, values: {} } });
      return route.fulfill({ status: 404, json: { error: "Unknown fixture endpoint" } });
    });
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
    await page.addStyleTag({ content: `${css.css}\n${await readFile("client/src/pages/automations-workspace.css", "utf8")}` });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByTestId("save")).toBeDisabled();
    await expect(page.getByTestId("customer-owner")).toContainText("Alice Owner");
    const chooseAlice = async () => {
      await page.getByTestId("assign-owner-0-user-search").fill("Alice");
      await page.getByTestId("assign-owner-0-user-alice").click();
    };
    for (const type of ["task", "customer", "hospital"]) {
      await page.evaluate(type => { (window as any).fixture.setModule(type); (window as any).fixture.setConfig(
        type === "hospital" ? { assignOwnerVersion: 2, assignmentKind: "owner", target: { mode: "event", entityType: type },
          strategy: "specific", userIds: [], replaceExisting: false, acknowledged: false } : {}); }, type);
      await chooseAlice();
      await expect(page.getByText(copy.invalidUsers, { exact: true })).not.toBeVisible();
      await page.getByTestId("assign-owner-0-ack").check();
      await expect(page.getByTestId("save")).toBeEnabled();
      const saved = JSON.parse(await page.getByTestId("config").textContent() || "{}");
      assert.equal(saved.target.entityType, type); assert.deepEqual(saved.userIds, ["alice"]);
      assert.equal(saved.replaceExisting, false);
    }
    for (const strategy of ["round_robin", "least_loaded", "random"] as const) {
      await page.getByTestId("assign-owner-0-strategy").click();
      await page.getByRole("option", { name: copy[strategy], exact: true }).click();
      await expect(page.getByTestId("save")).toBeDisabled();
      await page.getByTestId("assign-owner-0-ack").check();
      await expect(page.getByTestId("save")).toBeEnabled();
    }
    await page.getByTestId("assign-owner-0-user-search").fill("Bob");
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("assign-owner-0-user-bob").click();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("assign-owner-0-ack").check();
    await expect(page.getByTestId("save")).toBeEnabled();
    await page.getByTestId("assign-owner-0-replace").check();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("assign-owner-0-ack").check();
    await expect(page.getByTestId("save")).toBeEnabled();
    await page.getByRole("button", { name: copy.helpTitle, exact: true }).click();
    await expect(page.getByText(copy.helpWhere, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.evaluate(() => (window as any).fixture.setCountries(["CZ"]));
    await expect(page.getByTestId("save")).toBeDisabled();
    assert.deepEqual(JSON.parse(await page.getByTestId("config").textContent() || "{}").userIds, ["alice", "bob"], "Do not drop inaccessible selections");
    await page.evaluate(() => { (window as any).fixture.setCountries(["SK"]); (window as any).fixture.setConfig({}); });
    await page.getByTestId("assign-owner-0-mode").click();
    await page.getByRole("option", { name: copy.selected, exact: true }).click();
    await page.getByTestId("assign-owner-0-type").click();
    await page.getByRole("option", { name: "Customer", exact: true }).click();
    await page.getByTestId("assign-owner-0-record-search").fill("Verified");
    await page.getByTestId("assign-owner-0-record-fixture-record").click();
    await chooseAlice();
    await page.getByTestId("assign-owner-0-ack").check();
    await expect(page.getByTestId("save")).toBeEnabled();
    assert.equal(JSON.parse(await page.getByTestId("config").textContent() || "{}").target.recordId, "fixture-record");
    await page.evaluate(() => { (window as any).fixture.setModule("task"); (window as any).fixture.setConfig({}); });
    await page.getByTestId("assign-owner-0-mode").click();
    await page.getByRole("option", { name: copy.related, exact: true }).click();
    await chooseAlice();
    await page.getByTestId("assign-owner-0-ack").check();
    await expect(page.getByTestId("save")).toBeEnabled();
    assert.equal(JSON.parse(await page.getByTestId("config").textContent() || "{}").target.relation, "customerId");
    for (const type of ["clinic", "hospital"]) {
      await page.evaluate(type => { (window as any).fixture.setModule(type); (window as any).fixture.setConfig({}); }, type);
      await chooseAlice();
      await page.getByTestId("assign-owner-0-ack").check();
      await expect(page.getByTestId("save")).toBeEnabled();
      assert.equal(JSON.parse(await page.getByTestId("config").textContent() || "{}").assignmentKind, "representative");
      await page.getByTestId("assign-owner-0-user-search").fill("Charlie");
      await expect(page.getByText(copy.noPeople, { exact: true })).toBeVisible();
      await page.getByTestId("assign-owner-0-user-search").fill("");
    }
    await page.getByTestId("assign-owner-0-kind").click();
    await page.getByRole("option", { name: copy.internalOwner, exact: true }).click();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("assign-owner-0-ack").check();
    await expect(page.getByTestId("save")).toBeEnabled();
    const internalHospital = JSON.parse(await page.getByTestId("config").textContent() || "{}");
    assert.equal(internalHospital.assignmentKind, "owner");
    assert.deepEqual(internalHospital.userIds, ["alice"], "Changing kind rechecks, never silently drops people");
    await page.evaluate(() => (window as any).fixture.setConfig({ strategy: "round_robin" }));
    await expect(page.getByTestId("assign-owner-0-legacy-review")).toBeVisible();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.getByTestId("assign-owner-0-legacy-review").click();
    await expect(page.getByTestId("assign-owner-0-user-search")).toBeVisible();
    await expect(page.getByTestId("save")).toBeDisabled();
    await page.evaluate(() => { (window as any).fixture.setSchedule("once"); (window as any).fixture.setConfig({}); });
    await expect(page.getByTestId("assign-owner-0-mode")).toContainText(copy.selected);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("assign-owner-0")).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "No mobile horizontal overflow");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
