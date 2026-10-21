import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import copy from "../client/src/i18n/mission-communication-translations";
import { getSmsActionCopy } from "../client/src/i18n/automation-sms-copy";

test("Mission SMS gateway is selectable, persists independently of recipient country and works on mobile", async () => {
  const bundle = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {AutomationSendSmsAction} from "./client/src/components/automation-send-sms-action";
      const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
      function Fixture(){
        const [config,setConfig]=useState({smsActionVersion:2,to:["+421900123456"],text:"Test",kind:"transactional"});
        return <QueryClientProvider client={client}><AutomationSendSmsAction config={config}
          onChange={setConfig} testId="sms" countryCodes={["CZ"]} availableVariables={[]}/><pre data-testid="config">{JSON.stringify(config)}</pre></QueryClientProvider>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "mission-sms-language",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useI18n=()=>({locale:"sk",t:{missionCommunication:${JSON.stringify(copy.sk)},common:{close:"Zavrieť"}}});`,
          loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const styles = await postcss([tailwindcss({
    ...loadConfig(`${process.cwd()}/tailwind.config.ts`),
    content: [
      "client/src/components/automation-send-sms-action.tsx",
      "client/src/components/phone-number-field.tsx",
      "client/src/components/ui/{select,input,button,label}.tsx",
    ],
  })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", route => route.fulfill({ json: [] }));
    await page.setContent('<div id="root"></div>');
    await page.addStyleTag({ content: styles.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const state = async () => JSON.parse(await page.getByTestId("config").innerText());
    await page.getByTestId("sms-gateway").click();
    await page.getByRole("option", { name: copy.sk.smsMission, exact: true }).click();
    assert.equal((await state()).provider, "mission");
    assert.deepEqual((await state()).to, ["+421900123456"]);
    assert.equal((await state()).country, undefined);
    await expect(page.getByTestId("sms")).toContainText(copy.sk.smsHelp);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("sms-gateway").click();
    await page.getByRole("option", { name: getSmsActionCopy("sk").gatewayDefault, exact: true }).click();
    assert.equal((await state()).provider, undefined);
    await page.getByTestId("sms-gateway").click();
    await page.getByRole("option", { name: copy.sk.smsMission, exact: true }).click();
    assert.equal((await state()).provider, "mission");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
