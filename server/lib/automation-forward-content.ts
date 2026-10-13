import { load } from "cheerio";
import { escapeEmailText, sanitizeAutomationEmail } from "./automation-email-policy";

/** Source content is untrusted message data, never an automation template. */
export function forwardedMessageContent(value: string, channel: string) {
  const isHtml = channel === "email" && /<[a-z][\s\S]*>/i.test(value);
  if (!isHtml) {
    return {
      text: value.replace(/\r\n?/g, "\n").trim(),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeEmailText(value)}</div>`,
    };
  }
  const $ = load(sanitizeAutomationEmail(value));
  // Inline images are retained in the original RFC822. Do not send broken CIDs
  // or load sender-controlled tracking pixels in the new message.
  $("img").each((_i, image) => { $(image).replaceWith(escapeEmailText($(image).attr("alt") || "")); });
  $("head").remove();
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${$("body").html() || ""}</div>`;
  $("br,hr").replaceWith("\n");
  $("p,div,blockquote,h1,h2,h3,h4,h5,h6,pre,tr").each((_i, element) => {
    $(element).prepend("\n").append("\n");
  });
  $("li").each((_i, element) => { $(element).prepend("\n- ").append("\n"); });
  $("td,th").append("\t");
  const text = $("body").text().replace(/\r\n?/g, "\n")
    .split("\n").map(line => line.replace(/[\t \u00a0]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  return { text, html };
}

/** Encode braces until AFTER template expansion; the sanitizer decodes them. */
export function literalForwardHtml(html: string) {
  return html.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}
