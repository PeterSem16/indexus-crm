import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { TEMPLATE_VISUAL_PALETTES, templateVisualTone } from "../../shared/automation-template-visual";
import { automationTemplateVisuals, refreshPristineTemplateVisuals } from "./automation-template-visuals";
import { automationPhoneArtworkFor, PHONE_ARTWORK_NAMES } from "./automation-phone-artwork";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { loadAutomationActivityTemplates } from "./automation-activity-templates";

test("sentiment, urgency, success and deadlines have separate named semantic palettes", async () => {
  for (const [id, tone] of [["positive-sentiment", "positive"], ["negative-sentiment", "negative"],
    ["urgent-tone", "urgent"], ["task-overdue", "deadline"], ["task-completed", "positive"]] as const)
    assert.equal(templateVisualTone(id), tone);
  const templates = await loadAutomationActivityTemplates();
  for (const criterion of ["positive", "negative", "urgent", "summary"]) {
    const template = templates.find(item => item.id === `indexus-activity-email-analysis-inbound-${criterion}-sk`)!;
    const tone = templateVisualTone(template.id);
    assert.ok(template.contentHtml!.includes(TEMPLATE_VISUAL_PALETTES[tone].accent));
    assert.ok(template.contentHtml!.includes(TEMPLATE_VISUAL_PALETTES[tone].background));
    assert.ok(template.contentHtml!.includes(`cid:indexus-automation-phone-${tone}`));
  }
});

test("every phone variant is a real animated GIF, allowlisted in attachments; unknown assets fail closed", async () => {
  for (const name of PHONE_ARTWORK_NAMES) {
    const bytes = automationPhoneArtworkFor(name)!;
    assert.equal(bytes.subarray(0, 6).toString(), "GIF89a");
    assert.ok(bytes.includes(Buffer.from("NETSCAPE2.0")));
    // Graphic Control Extension for each animation frame.
    let count = 0;
    for (let i = 0; i < bytes.length - 2; i++) if (bytes[i] === 0x21 && bytes[i+1] === 0xf9 && bytes[i+2] === 4) count++;
    assert.ok(count >= 12, `${name}: real frame animation`);
    const assets = await automationEmailInlineAttachments(`<img src="cid:indexus-automation-${name}">`);
    assert.equal(assets[0].contentType, "image/gif");
    assert.equal(assets[0].contentBytes, bytes.toString("base64"));
  }
  assert.equal(automationPhoneArtworkFor("../../private"), undefined);
  await assert.rejects(automationEmailInlineAttachments('<img src="cid:indexus-automation-phone-custom">'), /unavailable/);
});

test("visual upgrades change only pristine HTML, with exact old-value guards and no rule mutation", async () => {
  const old = { id: "system-email", name: "Name", subject: "Subject", content: "Content",
    contentHtml: '<p style="color:#316bd8">{{analysis.summary}}</p>' };
  const next = { ...old, contentHtml: automationTemplateVisuals("negative", old.contentHtml) };
  const sql: string[] = [];
  await refreshPristineTemplateVisuals({ query: async query => { sql.push(query); } }, [old], [next]);
  assert.equal(sql.length, 1);
  assert.match(sql[0], /template\.content_html=visuals\.old_html/);
  assert.match(sql[0], /template\.name=visuals\.name/);
  assert.match(sql[0], /template\.subject=visuals\.subject/);
  assert.match(sql[0], /template\.is_active=true/);
  assert.doesNotMatch(sql[0], /DELETE|workflow_rules|DO UPDATE/);
});

test("all four editor catalogs and Configurator refetch instead of inheriting infinite stale cache", async () => {
  const { queryClient } = await import("../../client/src/lib/queryClient");
  for (const key of [["/api/message-templates"], ["/api/message-templates", "email", "SK"], ["/api/message-templates", "sms"]]) {
    assert.equal(queryClient.getQueryDefaults(key).staleTime, 0);
    assert.equal(queryClient.getQueryDefaults(key).refetchOnMount, "always");
    assert.equal(queryClient.getQueryDefaults(key).refetchOnWindowFocus, true);
  }
  assert.equal(queryClient.getDefaultOptions().queries?.staleTime, Infinity);
  for (const filename of ["automation-create-task-action.tsx", "automation-notify-user-action.tsx", "automation-send-email-action.tsx", "automation-send-sms-action.tsx"]) {
    const source = await readFile(`client/src/components/${filename}`, "utf8");
    assert.match(source, /staleTime:\s*0/);
    assert.match(source, /refetchOnMount:\s*"always"/);
    assert.match(source, /AutomationTemplatePicker/);
  }
  const configurator = await readFile("client/src/pages/configurator.tsx", "utf8");
  assert.match(configurator, /queryKey:\s*\["\/api\/message-templates"\],\s*staleTime:\s*0,\s*refetchOnMount:\s*"always"/);
  assert.match(configurator, /AutomationActivityTemplateIcon templateId=\{template.id\} type=\{template.type\}/);
});
