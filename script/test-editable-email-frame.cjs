const { build } = require("esbuild");
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");

(async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { EditableEmailFrame } from "./client/src/components/editable-email-frame";
        function Test() {
          const [value, setValue] = useState('<p><br></p><p><br></p><p><br></p><div class="email-signature">Mission signature</div>');
          return <><EditableEmailFrame value={value} title="Email" onChange={v => { window.draft = v; setValue(v); }} />
            <button onClick={() => setValue('<p><br></p><p><br></p><p><br></p><div>Reset signature</div>')}>Reset</button></>;
        }
        createRoot(document.getElementById("root")).render(<Test />);
      `,
      resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    alias: { "@": process.cwd() + "/client/src" },
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root" style="height:500px"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const body = page.frameLocator("iframe").locator("body");
    await body.locator("p").first().click();
    await page.keyboard.type("Hello above the signature");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second line");
    const draft = await page.evaluate(() => window.draft);
    assert.ok(draft.includes("Hello above the signature"));
    assert.ok(draft.includes("Second line"));
    assert.ok(draft.indexOf("Hello") < draft.indexOf("Mission signature"));
    await page.getByText("Reset", { exact: true }).click();
    await body.getByText("Reset signature").waitFor();
    await body.locator("p").first().click();
    await page.keyboard.type("New message");
    assert.ok((await page.evaluate(() => window.draft)).includes("New message"));
    console.log("Editable email browser test passed: typing, caret, signature and reset.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });