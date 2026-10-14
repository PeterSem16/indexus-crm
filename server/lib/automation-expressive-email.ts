import { load } from "cheerio";
import { emailBadgeStyle, emailStateImage, EMAIL_BADGE_PALETTES, templateEventIcon } from "../../shared/automation-email-decoration";

/** Portable enhancement of the approved B layout; all wording/tokens stay intact. */
export function expressiveHumanEmail(html: string, templateId: string) {
  const $ = load(html);
  const eventIcon = templateEventIcon(templateId);
  const heading = $("h1").first();
  heading.prevAll("small").first()
    .attr("style", emailBadgeStyle(EMAIL_BADGE_PALETTES.lavender))
    .prepend(emailStateImage(eventIcon, 28));
  // Existing real status/priority fields only: no fabricated status or priority.
  $("[data-indexus-optional]").each((_index, element) => {
    const block = $(element);
    const path = block.attr("data-indexus-optional")!;
    const strong = block.children("strong").first();
    if (!strong.length) return;
    const kind = /(?:^|\.)(?:priority|taskPriority)$/.test(path) ? "priority"
      : /(?:^|\.)(?:status|taskStatus)$/.test(path) ? "status" : null;
    if (!kind) return;
    strong.attr(`data-indexus-${kind}`, path)
      .attr("style", `${emailBadgeStyle(kind === "priority" ? EMAIL_BADGE_PALETTES.mint : EMAIL_BADGE_PALETTES.blue)}margin-top:6px;`);
    if (kind === "status") strong.prepend(emailStateImage("neutral"));
    else strong.prepend('<i style="display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:currentColor;vertical-align:middle;"></i>');
  });
  $("[data-indexus-result]").each((_index, element) => {
    $(element).attr("data-indexus-emotive", "true").prepend(emailStateImage("neutral"));
  });
  // Give supporting information more depth without widening the email.
  const details = heading.parent().children("div").filter((_i, node) => {
    const style = $(node).attr("style") || "";
    return style.includes("border-top:1px solid #dce9df") && style.includes("border-bottom:");
  });
  details.attr("style", "margin-top:18px;padding:14px 18px;background:#f5f8f3;border:1px solid #dce9df;border-radius:16px;");
  return $.html();
}
