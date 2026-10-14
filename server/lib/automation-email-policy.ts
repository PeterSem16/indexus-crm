import { load } from "cheerio";
import { templateTokenInUrl } from "./automation-display-values";
import { emptyCommunicationText } from "../../shared/automation-communication-context";
import { emailAddressList, EMAIL_RECIPIENT_LIMIT, validEmailTargets, type AutomationEmailTarget } from "../../shared/automation-email-action";
import { normalizeEmailTemplateLayout } from "../../shared/email-template-layout";
import { humanFindingLabel, humanPriorityLabel } from "./automation-human-copy";
import { taskStatusTemplateLabel } from "../../shared/task-status-labels";
import { emailBadgeStyle, emailStateImage, EMAIL_BADGE_PALETTES, priorityBadgePalette, stateBadgePalette, stateIcon } from "../../shared/automation-email-decoration";

type RecipientDeps = {
  group: (target: AutomationEmailTarget) => Promise<string[]>;
  userEmail: (id: string) => Promise<string>;
};

/** Identity is server-owned: actor and client-provided sender IDs never win. */
export function selectAutomationEmailSender(config: any, context: any) {
  const country = typeof context.event?.countryCode === "string" ? context.event.countryCode : undefined;
  if (config.senderMode === "personal") {
    const authorId = context.rule?.createdByUserId;
    if (typeof authorId !== "string" || !authorId) throw new Error("Personal email requires a known rule author");
    return { mode: "personal" as const, authorId, country };
  }
  if (!country) throw new Error("System email requires the actual event country");
  return { mode: "system" as const, authorId: undefined, country };
}

/** Resolve all recipients BEFORE sending. To takes precedence over CC, then BCC. */
export async function resolveEmailRecipients(config: any, deps: RecipientDeps) {
  const cachedTargets = new Map<string, Promise<string[]>>();
  const cachedUsers = new Map<string, Promise<string>>();
  const seen = new Set<string>();
  const resolve = async (field: "to" | "cc" | "bcc") => {
    const targets = [...(config[`${field}Targets`] || [])];
    if (field === "to") {
      if (config.taskGroupId) targets.push({ kind: "group", id: config.taskGroupId });
      if (config.targetRole) targets.push({ kind: "role", id: config.targetRole });
    }
    if (!validEmailTargets(targets)) throw new Error("Invalid email recipient targets");
    const addresses = emailAddressList(config[field]);
    for (const target of targets) {
      const key = `${target.kind}:${target.id}`;
      if (!cachedTargets.has(key)) cachedTargets.set(key, target.kind === "user"
        ? Promise.resolve([target.id]) : deps.group(target));
      const ids = await cachedTargets.get(key)!;
      if (!ids.length) throw new Error("Email recipient target has no active members");
      for (const id of ids) {
        if (!cachedUsers.has(id)) {
          if (cachedUsers.size >= EMAIL_RECIPIENT_LIMIT) throw new Error("Email recipients exceed the 100-person limit");
          cachedUsers.set(id, deps.userEmail(id));
        }
        const email = await cachedUsers.get(id)!;
        const parsed = emailAddressList(email);
        if (parsed.length !== 1) throw new Error("A recipient has no valid email address");
        addresses.push(parsed[0]);
      }
    }
    const result = [...new Set(addresses)].filter(address => !seen.has(address));
    for (const address of result) seen.add(address);
    if (seen.size > EMAIL_RECIPIENT_LIMIT) throw new Error("Email recipients exceed the 100-person limit");
    return result;
  };
  const to = await resolve("to");
  const cc = await resolve("cc");
  const bcc = await resolve("bcc");
  if (!to.length) throw new Error("At least one To recipient is required");
  return { to, cc, bcc, count: seen.size };
}

export const escapeEmailText = (value: string) => value.replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export function renderEmailValue(value: unknown, ctx: any, html = false, display?: ReadonlyMap<string, string>, allowEmptyText = true): string {
  let source = String(value ?? "");
  if (html && source.includes("data-indexus-optional")) {
    const $ = load(source);
    $("[data-indexus-optional]").each((_index, element) => {
      const path = $(element).attr("data-indexus-optional")!;
      const raw = path.split(".").reduce((current: any, key) =>
        ["__proto__", "prototype", "constructor"].includes(key) ? undefined : current?.[key], ctx);
      const shown = display?.get(path) ?? raw;
      if (shown == null || shown === "" || (Array.isArray(shown) && !shown.length)) $(element).remove();
    });
    source = $.html();
  }
  let scanned = 0, inTag = false, quote = "";
  const rendered = source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string, offset: number) => {
    // HTML attributes (including links) need raw IDs, not display names.
    if (html) for (; scanned < offset; scanned++) {
      const ch = source[scanned];
      if (inTag && quote) { if (ch === quote) quote = ""; }
      else if (inTag && (ch === '"' || ch === "'")) quote = ch;
      else if (ch === "<") inTag = true;
      else if (ch === ">") inTag = false;
    }
    const raw = path.split(".").reduce((current: any, key: string) =>
      ["__proto__", "prototype", "constructor"].includes(key) ? undefined : current?.[key], ctx);
    const resolved = display?.has(path) && !(html && inTag) && !templateTokenInUrl(source, offset) ? display.get(path) : raw;
    if (resolved == null && !(allowEmptyText && emptyCommunicationText(ctx, path) &&
        !(html && inTag) && !templateTokenInUrl(source, offset)))
      throw new Error(`Email variable is unavailable: ${path}`);
    const text = resolved == null ? "" : String(resolved);
    return html ? escapeEmailText(text) : text;
  });
  if (!html || !source.includes("data-indexus-")) return rendered;
  const $ = load(rendered);
  $("[data-indexus-optional]").each((_index, element) => {
    const path = $(element).attr("data-indexus-optional")!;
    const raw = path.split(".").reduce((current: any, key) =>
      ["__proto__", "prototype", "constructor"].includes(key) ? undefined : current?.[key], ctx);
    const shown = display?.get(path) ?? raw;
    if (shown == null || shown === "" || (Array.isArray(shown) && !shown.length))
      $(element).remove();
    $(element).removeAttr("data-indexus-optional");
  });
  $("[data-indexus-result]").each((_index, element) => {
    const field = $(element).attr("data-indexus-result");
    const value = field === "sentiment" || field === "tone" ? ctx.analysis?.[field] : null;
    const palette = field === "tone" ? ["#f2edfb", "#695486", "#ded4f0"]
      : ["negative", "angry"].includes(value) ? ["#fff0e5", "#93503c", "#f3d2bf"]
      : ["positive", "calm"].includes(value) ? ["#e9f3ef", "#176b5d", "#c9ded7"]
      : ["#f2eef9", "#695589", "#dcd1ee"];
    const text = typeof value === "string" ? humanFindingLabel($("html").attr("lang") || "en", value) : null;
    if (!text) $(element).remove();
    else {
      const caption = $(element).find("small").first().clone();
      const emotive = $(element).attr("data-indexus-emotive") === "true";
      const icon = emotive ? stateIcon(value) : null;
      $(element).empty().append(icon ? emailStateImage(icon) : '<i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:7px;"></i>').append(caption).append(escapeEmailText(text))
        .attr("style", `display:inline-block;margin:0 8px 8px 0;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;background:${palette[0]};color:${palette[1]};border:1px solid ${palette[2]};`);
      if (emotive) $(element).attr("style", emailBadgeStyle(field === "tone" ? EMAIL_BADGE_PALETTES.lavender : stateBadgePalette(value)));
    }
    $(element).removeAttr("data-indexus-result").removeAttr("data-indexus-emotive");
  });
  const language = $("html").attr("lang") || "en";
  for (const kind of ["priority", "status"] as const) $(`[data-indexus-${kind}]`).each((_index, element) => {
    const block = $(element);
    const path = block.attr(`data-indexus-${kind}`)!;
    const raw = path.split(".").reduce((current: any, key) =>
      ["__proto__", "prototype", "constructor"].includes(key) ? undefined : current?.[key], ctx);
    if (raw == null || raw === "") { block.remove(); return; }
    const taskStatus = kind === "status" && (ctx.event?.module === "task" || path === "communication.taskStatus") &&
      ["pending", "in_progress", "completed", "cancelled"].includes(raw);
    const text = display?.get(path) ?? (kind === "priority" ? humanPriorityLabel(language, raw)
      : taskStatus ? taskStatusTemplateLabel(raw, language) : null) ?? block.text();
    const icon = taskStatus ? stateIcon(raw) : null;
    const palette = kind === "priority" ? priorityBadgePalette(raw) : stateBadgePalette(taskStatus ? raw : null);
    block.empty().append(icon ? emailStateImage(icon) : kind === "priority"
      ? '<i style="display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:currentColor;vertical-align:middle;"></i>' : "")
      .append(escapeEmailText(text)).attr("style", `${emailBadgeStyle(palette)}margin-top:6px;`)
      .removeAttr(`data-indexus-${kind}`);
  });
  return $.html();
}

export function renderEmailAddressConfig(config: any, ctx: any) {
  const addresses = { ...config };
  for (const key of ["to", "cc", "bcc"])
    addresses[key] = Array.isArray(config[key])
      ? config[key].map((value: unknown) => renderEmailValue(value, ctx, false, undefined, false))
      : renderEmailValue(config[key], ctx, false, undefined, false);
  return addresses;
}

/** Keep email formatting, but remove executable HTML and unsafe attributes/URLs. */
export function sanitizeAutomationEmail(html: string): string {
  const $ = load(html, { xml: false });
  $("script,style,iframe,object,embed,link,meta,base,form,input,button,svg,math").remove();
  const allowed = new Set("html head body title a b blockquote br code del div em h1 h2 h3 h4 h5 h6 hr i img li ol p pre s small span strong sub sup table tbody td th thead tr u ul wbr".split(" "));
  $("*").each((_i, node) => {
    if (!("tagName" in node) || !("attribs" in node)) return;
    if (!allowed.has(node.tagName)) { $(node).replaceWith(escapeEmailText($(node).text())); return; }
    for (const [key, value] of Object.entries(node.attribs || {})) {
      if (key.startsWith("on") || !["style", "href", "src", "alt", "title", "width", "height", "align", "valign", "cellpadding", "cellspacing", "border", "colspan", "rowspan", "role", "lang"].includes(key)) {
        $(node).removeAttr(key); continue;
      }
      if (key === "style" && /url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(value))
        $(node).removeAttr(key);
      if (["href", "src"].includes(key)) {
        const normalized = value.replace(/[\u0000-\u0020]/g, "");
        const valid = key === "href" ? /^(https?:\/\/|mailto:|tel:|#)/i : /^(https?:\/\/|cid:)/i;
        if (!valid.test(normalized)) $(node).removeAttr(key);
      }
    }
  });
  return normalizeEmailTemplateLayout($.html());
}

export function addCountrySignature(html: string, signature: string) {
  if (!signature.trim()) return html;
  // Country signatures are configured as multiline text, not trusted markup.
  const block = `<div style="margin:24px 0 0;padding:16px 24px;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#64748b;">${escapeEmailText(signature).replace(/\r?\n/g, "<br>")}</div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
}
