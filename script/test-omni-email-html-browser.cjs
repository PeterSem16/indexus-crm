const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { transformSync } = require("esbuild");
const { chromium } = require("@playwright/test");

async function main() {
  const source = fs.readFileSync("client/src/pages/email-client.tsx", "utf8");
  const viewerCss = fs.readFileSync("client/src/components/email-html-body.css", "utf8");
  assert.equal((source.match(/className="omni-email-html-body"/g) || []).length, 3,
    "Reading pane, reply quotation and detail dialog must share the neutral mail styling");
  const start = source.indexOf("const processHtmlForImages = ");
  const end = source.indexOf("  const knownEmails =", start);
  assert.ok(start >= 0 && end > start);
  const processor = transformSync(
    `window.processMail = ${source.slice(start + "const processHtmlForImages = ".length, end)}`,
    { loader: "ts", target: "es2020" },
  ).code;
  const assetRoot = "dist/public/assets";
  const themeCss = fs.readdirSync(assetRoot)
    .filter(name => /^index.*\.css$/.test(name))
    .map(name => fs.readFileSync(path.join(assetRoot, name), "utf8"))
    .join("\n");
  assert.ok(themeCss, "Built application CSS is needed to exercise Tailwind preflight");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const [width, dark] of [[1024, false], [390, false], [390, true]]) {
      const page = await browser.newPage({ viewport: { width, height: 720 } });
      await page.setContent(`<html class="${dark ? "dark" : ""}"><head><style>${themeCss}\n${viewerCss}</style></head><body><div class="p-4 overflow-x-auto"><div class="omni-email-html-body" id="mail"></div></div></body></html>`);
      await page.addScriptTag({ content: `window.user={id:"fixture-user"}; window.emailDetailMailbox="fixture@example.test"; ${processor}` });
      const result = await page.evaluate(() => {
        const nest = (content, level) => level
          ? `<table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td class="layout-cell">${nest(content, level - 1)}</td></tr></table>`
          : content;
        // Like the supplied newsletter/order screenshots: several nested
        // layout tables, then a deliberately bordered content panel.
        const newsletter = nest(`<div style="background:#e4f1fa;padding:24px">
          <h2 style="font-size:24px;color:#153f65">O₂ SMS Connector</h2>
          <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
            <td id="authored-cell" style="border:2px solid #3878bd;padding:18px;background:#fff">Newsletter content</td>
          </tr></table></div>`, 6);
        const mail = document.getElementById("mail");
        mail.innerHTML = window.processMail(newsletter, "fixture-mail", []);
        const cells = [...mail.querySelectorAll(".layout-cell")].map(cell => {
          const css = getComputedStyle(cell);
          return { border: css.borderTopWidth, padding: css.paddingTop, whiteSpace: css.whiteSpace };
        });
        const authored = getComputedStyle(document.getElementById("authored-cell"));
        const imageHtml = `<img width="120" height="40" style="border:2px solid red;display:block" src="https://example.test/logo.png">`;
        const image = new DOMParser().parseFromString(window.processMail(imageHtml, "fixture-mail", []), "text/html").querySelector("img");
        const cid = new DOMParser().parseFromString(
          window.processMail('<img src="cid:logo@example.test">', "fixture-mail",
            [{ id: "fixture-inline", contentId: "<logo@example.test>", isInline: true }]), "text/html",
        ).querySelector("img");
        return {
          cells,
          authored: { border: authored.borderTopWidth, padding: authored.paddingTop, color: authored.borderTopColor },
          body: { background: getComputedStyle(mail).backgroundColor, color: getComputedStyle(mail).color },
          image: { width: image.getAttribute("width"), height: image.getAttribute("height"), style: image.getAttribute("style"), src: image.getAttribute("src") },
          cid: cid.getAttribute("src"),
        };
      });
      assert.equal(result.cells.length, 6);
      result.cells.forEach(cell => {
        assert.equal(cell.border, "0px", "Layout cells must not gain artificial frames");
        assert.equal(cell.padding, "0px", "Sender's zero cellpadding must not become app padding");
        assert.equal(cell.whiteSpace, "normal", "Reply quotations must not force nowrap");
      });
      assert.deepEqual(result.authored, { border: "2px", padding: "18px", color: "rgb(56, 120, 189)" });
      assert.deepEqual(result.body, { background: "rgb(255, 255, 255)", color: "rgb(32, 33, 36)" });
      assert.equal(result.image.width, "120");
      assert.equal(result.image.height, "40");
      assert.equal(result.image.style, "border:2px solid red;display:block");
      assert.ok(result.image.src.startsWith("/api/users/fixture-user/email-image-proxy?url="));
      assert.ok(result.cid.includes("/attachment-inline/fixture-inline?mailbox="));
      fs.mkdirSync("/tmp/omni-email-html-proof", { recursive: true });
      await page.screenshot({ path: `/tmp/omni-email-html-proof/mail-${width}-${dark ? "dark" : "light"}.png` });
      await page.close();
      console.log(`PASS: ${width}px ${dark ? "dark" : "light"} — layout frames removed, authored borders/padding/colors and image metadata/proxies preserved`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });