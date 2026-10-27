import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {chromium,expect} from "@playwright/test";
import {createServer} from "vite";
import {getStatusListRecapCopy} from "../client/src/components/status-list-recap-copy";

test("both Status List triggers use the native Pulse callback dialog without early execution",async()=>{
  const source=fs.readFileSync("client/src/pages/agent-workspace.tsx","utf8");
  const triggers=source.slice(source.indexOf("function SlStatusButton("),source.indexOf("\n}\n",source.indexOf("function SlCallbackButton("))+2);
  assert.equal((triggers.match(/<StatusListManualCallbackButton /g)||[]).length,2);
  assert.doesNotMatch(triggers,/<Popover|<DateTimePicker/);
  assert.match(triggers,/if \(!isCallback\)/);
  fs.mkdirSync("generated-artifacts/status-list-manual-callback",{recursive:true});
  const vite=await createServer({configFile:false,root:"client",cacheDir:"/tmp/indexus-manual-callback-vite",
    resolve:{alias:{"@":`${process.cwd()}/client/src`,"@shared":`${process.cwd()}/shared`}},esbuild:{jsx:"automatic"},
    server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await vite.listen();
  const {port}=vite.httpServer!.address() as {port:number};
  const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:850}});
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    for(const locale of ["sk","en","cs","hu","ro","it","de"]) {
      await page.goto(`http://127.0.0.1:${port}/test-fixtures/status-list-manual-callback.html?locale=${locale}`,{timeout:90000});
      for(const kind of ["callback","status"]) {
        const trigger=page.getByTestId(`btn-sl-${kind}-${kind}`);
        await trigger.click();
        const dialog=page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveClass(/sl-recap-dialog/);
        if(locale==="sk" && kind==="status")await page.screenshot({path:"generated-artifacts/status-list-manual-callback/status-desktop.png"});
        await expect(page.locator(".sl-agent-dialog-popover")).toHaveCount(0);
        await expect(page.getByTestId("events")).toHaveText("[]");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(page.getByTestId("events")).toHaveText("[]");
        await trigger.click();
        const prefix=kind==="callback"?`sl-callback-${kind}`:`sl-status-callback-${kind}`;
        await expect(page.getByTestId(`${prefix}-day`)).toBeVisible();
        await expect(page.getByTestId(`${prefix}-hour`)).toBeVisible();
        await expect(page.getByTestId(`${prefix}-minute`)).toBeVisible();
        await page.getByTestId(`input-sl-${kind}-note-${kind}`).fill("  Callback note  ");
        await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-testid="rerender"]')!.click());
        await expect(page.getByTestId(`input-sl-${kind}-note-${kind}`)).toHaveValue("  Callback note  ");
        await dialog.getByRole("button",{name:getStatusListRecapCopy(locale).cancel,exact:true}).click();
        await expect(page.getByTestId("events")).toHaveText("[]");
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.goto(`http://127.0.0.1:${port}/test-fixtures/status-list-manual-callback.html?locale=sk&dark&weekends`,{timeout:90000});
    await page.setViewportSize({width:390,height:844});
    for(const kind of ["callback","status"]) {
      await page.getByTestId(`btn-sl-${kind}-${kind}`).click();
      const dialog=page.getByRole("dialog");
      const prefix=kind==="callback"?`sl-callback-${kind}`:`sl-status-callback-${kind}`;
      await page.getByTestId(`${prefix}-hour`).selectOption("11");
      await page.getByTestId(`${prefix}-minute`).selectOption("17");
      await page.getByTestId(`input-sl-${kind}-note-${kind}`).fill(`  ${kind} note  `);
      const bounds=await dialog.boundingBox();
      assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=391);
      const confirmBounds=await page.getByTestId(`btn-sl-${kind}-confirm-${kind}`).boundingBox();
      assert.ok(confirmBounds && confirmBounds.y>=0 && confirmBounds.y+confirmBounds.height<=844);
      await page.screenshot({path:`generated-artifacts/status-list-manual-callback/${kind}-mobile-dark.png`});
      await page.getByTestId(`btn-sl-${kind}-confirm-${kind}`).click();
      await expect(dialog).toHaveCount(0);
      const events=JSON.parse((await page.getByTestId("events").textContent())!);
      assert.equal(events.length,kind==="callback"?1:2);
      const event=events.at(-1);
      assert.equal(event.id,kind);
      assert.equal(event.callbackNote,`  ${kind} note  `);
      assert.equal(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Bratislava",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(event.callbackDate)),"11:17");
    }
    assert.equal(await page.locator("html").getAttribute("data-outer-submits"),null);
    await page.getByTestId("btn-sl-callback-callback").click();
    await expect(page.getByTestId("input-sl-callback-note-callback")).toHaveValue("");
    await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-testid="change-scope"]')!.click());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`http://127.0.0.1:${port}/test-fixtures/status-list-manual-callback.html?locale=sk&running`,{timeout:90000});
    await expect(page.getByTestId("btn-sl-callback-callback")).toBeDisabled();
    await expect(page.getByTestId("btn-sl-status-status")).toBeDisabled();
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await vite.close();}
});
