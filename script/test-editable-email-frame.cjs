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
          const [value, setValue] = useState('<p><br></p><p><br></p><p><br></p><div class="email-signature"><table width="560" style="width:560px;border-top:2px solid #DA1B1D;font-family:Arial,sans-serif"><tbody><tr><td style="padding:16px 20px;border-right:1px solid #e0e0e0"><img alt="Logo" width="160"></td><td style="padding:16px 20px;font-size:14px;line-height:22px"><strong>Mission signature</strong><br><a href="mailto:agent@example.test" style="color:#DA1B1D;text-decoration:none">Email</a></td></tr></tbody></table></div>');
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
    const signatureStyles = async () => body.locator("table").evaluate(table => {
      const style = getComputedStyle(table);
      const cell = getComputedStyle(table.querySelector("td"));
      const link = getComputedStyle(table.querySelector("a"));
      return { width: style.width, border: style.borderTopWidth, color: style.borderTopColor,
        font: style.fontFamily, padding: cell.paddingTop, divider: cell.borderRightWidth,
        linkColor: link.color, decoration: link.textDecorationLine };
    });
    const expectedStyles = { width: "560px", border: "2px", color: "rgb(218, 27, 29)",
      font: "Arial, sans-serif", padding: "16px", divider: "1px",
      linkColor: "rgb(218, 27, 29)", decoration: "none" };
    assert.deepEqual(await signatureStyles(), expectedStyles);
    await body.locator("p").first().click();
    await page.keyboard.type("Hello above the signature");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second line");
    const draft = await page.evaluate(() => window.draft);
    assert.ok(draft.includes("Hello above the signature"));
    assert.ok(draft.includes("Second line"));
    assert.ok(draft.indexOf("Hello") < draft.indexOf("Mission signature"));
    assert.deepEqual(await signatureStyles(), expectedStyles);
    assert.ok(draft.includes('class="email-signature"'));
    assert.ok(draft.includes("border-top:2px solid #DA1B1D"));
    // Reopening the saved draft (expanded editor/send HTML) must keep styling.
    const reopened = await browser.newPage();
    await reopened.setContent(draft);
    assert.equal(await reopened.locator("table").evaluate(el => getComputedStyle(el).borderTopColor), "rgb(218, 27, 29)");
    await reopened.close();
    await page.getByText("Reset", { exact: true }).click();
    await body.getByText("Reset signature").waitFor();
    await body.locator("p").first().click();
    await page.keyboard.type("New message");
    assert.ok((await page.evaluate(() => window.draft)).includes("New message"));
    console.log("Editable email browser test passed: signature layout/colors/fonts, typing, draft HTML, reopen and reset.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });