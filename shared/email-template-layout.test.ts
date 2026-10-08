import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import { normalizeEmailTemplateLayout, normalizeEmailTemplateRecord } from "./email-template-layout";

test("rounds the primary content frame without flattening nested layouts or changing email content", () => {
  const source = `<!doctype html><html><head><title>Approved</title></head><body>
    <table width="100%" style="background:#edf3f8"><tr><td>
      <table width="560" style="width:100%;max-width:560px;background-color:#fff;border:1px solid #ddd">
        <tr><td><h1>Je pripravená nová úloha {{task.name}}</h1>
          <table width="100%" style="background:#f3f7fa;border:1px solid #e1eaf0"><tr><td>Rýchly prehľad</td></tr></table>
          <img src="cid:indexus-automation-task" width="240" alt="Úloha">
          <a href="{{task.url}}" style="color:#316bd8">Otvoriť</a>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
  const result = normalizeEmailTemplateLayout(source);

  assert.match(result, /<title>Approved<\/title>/);
  assert.match(result, /Je pripravená nová úloha \{\{task\.name\}\}/);
  assert.match(result, /href="\{\{task\.url\}\}"/);
  assert.match(result, /src="cid:indexus-automation-task"/);
  assert.match(result, /width="240"/);
  assert.match(result, /background:#f3f7fa;border:1px solid #e1eaf0/);
  assert.match(result, /max-width:560px;background-color:#fff;border:1px solid #ddd;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0/);

  const $ = load(result);
  assert.equal($("table").eq(1).attr("style")?.includes("border-radius:12px"), true);
  assert.equal($("table").eq(2).attr("style")?.includes("border-radius"), false);
});

test("is idempotent and supports older width-constrained tables and div frames", () => {
  const table = '<table width="600" style="width:600px;color:#21384c"><tr><td>Original copy</td></tr></table>';
  const once = normalizeEmailTemplateLayout(table);
  assert.equal(normalizeEmailTemplateLayout(once), once);
  assert.match(once, /color:#21384c;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0/);

  const legacyDiv = '<div style="width:560px;background-color:#fff;padding:24px"><p>Legacy body</p></div>';
  const normalizedDiv = normalizeEmailTemplateLayout(legacyDiv);
  assert.match(normalizedDiv, /width:560px;background-color:#fff;padding:24px;border-radius:12px/);
  assert.match(normalizedDiv, /Legacy body/);
});

test("simple legacy HTML gets one frame and CSS data images retain their semicolons", () => {
  const simple = normalizeEmailTemplateLayout("<p>{{newValues.status}}</p>");
  assert.match(simple, /data-indexus-email-frame="true"/);
  assert.match(simple, /border-radius:12px/);
  assert.equal(normalizeEmailTemplateLayout(simple), simple);
  const html = `<table width="600" style="background-image:url('data:image/svg+xml;charset=utf-8;abc');border-top-left-radius:0"><tr><td>Keep image</td></tr></table>`;
  const normalized = load(normalizeEmailTemplateLayout(html));
  const style = normalized("table").attr("style")!;
  assert.ok(style.includes("data:image/svg+xml;charset=utf-8;abc"));
  assert.ok(!style.includes("border-top-left-radius"));
  assert.ok(style.includes("border-radius:12px"));
});

test("email record normalization leaves non-HTML records and original records unchanged", () => {
  const task = { type: "task", format: "text", contentHtml: "<table width='600'>Task</table>" };
  const sms = { type: "sms", format: "html", contentHtml: "<table width='600'>SMS</table>" };
  const email = { type: "email", format: "html", subject: "Original subject", contentHtml: '<table width="600">Email</table>' };

  assert.equal(normalizeEmailTemplateRecord(task), task);
  assert.equal(normalizeEmailTemplateRecord(sms), sms);
  const normalized = normalizeEmailTemplateRecord(email);
  assert.equal(email.contentHtml, '<table width="600">Email</table>');
  assert.equal(normalized.subject, "Original subject");
  assert.match(normalized.contentHtml, /border-radius:12px/);
});

test("approved source email templates retain their complete parsed document when normalized", async () => {
  const templates = JSON.parse(await readFile("server/assets/automation-email/templates.json", "utf8"));
  assert.equal(templates.length, 6);
  for (const template of templates) {
    const original = load(template.contentHtml);
    const normalizedHtml = normalizeEmailTemplateLayout(template.contentHtml);
    const normalized = load(normalizedHtml);
    const sourceFrame = original("table").toArray().find(element =>
      Number(original(element).attr("width")) >= 400 ||
      Number((original(element).attr("style") || "").match(/max-width:\s*(\d+)/i)?.[1]) >= 400);
    assert.ok(sourceFrame, `${template.id} has a primary frame`);

    const normalizedFrame = normalized("table").toArray().find(element =>
      Number(normalized(element).attr("width")) >= 400 ||
      Number((normalized(element).attr("style") || "").match(/max-width:\s*(\d+)/i)?.[1]) >= 400);
    assert.ok(normalizedFrame);
    assert.match(normalized(normalizedFrame).attr("style") || "", /border-radius:\s*12px/);
    original(sourceFrame).removeAttr("style");
    normalized(normalizedFrame).removeAttr("style");
    assert.equal(normalized.html(), original.html(), `${template.id} content and layout remain unchanged`);
  }
});
