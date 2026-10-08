import { load } from "cheerio";

const FRAME_RADIUS = "12px";

function styleDeclarations(style: string): string[] {
  const result: string[] = [];
  let start = 0, depth = 0, quote = "";
  for (let i = 0; i < style.length; i++) {
    const character = style[i];
    if (character === "\\") { i++; continue; }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "(") depth++;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === ";" && depth === 0) { result.push(style.slice(start, i)); start = i + 1; }
  }
  result.push(style.slice(start));
  return result;
}

function styleWithRoundedFrame(style: string | undefined): string {
  const declarations: Array<[string, string]> = [];
  for (const declaration of styleDeclarations(style || "")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (!property || !value) continue;
    if (/^border-(top|bottom)-(left|right)-radius$/.test(property)) continue;
    const existing = declarations.findIndex(([key]) => key === property);
    if (existing >= 0) declarations[existing] = [property, value];
    else declarations.push([property, value]);
  }

  const set = (property: string, value: string) => {
    const existing = declarations.findIndex(([key]) => key === property);
    if (existing >= 0) declarations[existing] = [property, value];
    else declarations.push([property, value]);
  };
  set("border-radius", FRAME_RADIUS);
  set("overflow", "hidden");
  set("border-collapse", "separate");
  set("border-spacing", "0");
  return declarations.map(([property, value]) => `${property}:${value}`).join(";");
}

function pixelDimension(value: string | undefined): number {
  if (!value) return 0;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
  return match ? Number(match[1]) : 0;
}

function dimensionFor($: ReturnType<typeof load>, element: any): number {
  const style = ($(element).attr("style") || "");
  const maxWidth = style.match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i)?.[1];
  const widthStyle = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i)?.[1];
  return Math.max(pixelDimension(maxWidth), pixelDimension($(element).attr("width")), pixelDimension(widthStyle));
}

function nestingDepth(element: any): number {
  let depth = 0;
  for (let parent = element.parent; parent; parent = parent.parent) {
    if (parent.tagName === "table" || parent.tagName === "div") depth++;
  }
  return depth;
}

/**
 * Apply the approved 12px outer content frame to an email without rebuilding
 * its markup. Only the main layout container is touched; nested content tables
 * (including callouts and image layouts) retain their original styling.
 */
export function normalizeEmailTemplateLayout(html: string): string {
  if (!html) return html;
  const $ = load(html, { xml: false });

  const tables = $("table").toArray();
  let frame: any = $('[data-indexus-email-frame="true"]').first()[0] || tables
    .filter(element => dimensionFor($, element) >= 400)
    .sort((a, b) => nestingDepth(a) - nestingDepth(b) || dimensionFor($, b) - dimensionFor($, a))[0];

  // Legacy email containers occasionally use a styled div instead of a
  // width-constrained table. Prefer it only when no primary table was found.
  if (!frame) {
    const divs = $("div").toArray().filter(element => dimensionFor($, element) >= 400);
    frame = divs.sort((a, b) => nestingDepth(a) - nestingDepth(b) || dimensionFor($, b) - dimensionFor($, a))[0];
  }

  // Last-resort legacy table fallback: a single full-width, visibly boxed
  // content table is a frame; the plain full-width background wrapper is not.
  if (!frame) {
    frame = tables.find(element => {
      const style = $(element).attr("style") || "";
      const hasBoxTreatment = /(?:background(?:-color)?|border)\s*:/i.test(style);
      const hasNestedLayout = $(element).find("table").length > 0;
      return hasBoxTreatment && hasNestedLayout && !$(element).parent("td").length;
    });
  }

  if (!frame) {
    // Simple legacy HTML has no existing card to round. Add only a frame,
    // retaining the document, content, colors and any existing nested layout.
    const wrapper = $("<div>").attr("data-indexus-email-frame", "true")
      .attr("style", "border:1px solid #d9e4ed;border-radius:12px;overflow:hidden");
    wrapper.append($("body").contents());
    $("body").append(wrapper);
    frame = wrapper[0];
  }
  $(frame).attr("style", styleWithRoundedFrame($(frame).attr("style")));
  return $.html();
}

/** Normalize only HTML message templates; Task and SMS records are untouched. */
export function normalizeEmailTemplateRecord<T extends {
  type?: unknown;
  format?: unknown;
  contentHtml?: unknown;
}>(record: T): T {
  if (
    typeof record.type === "string" &&
    record.type.toLowerCase() === "email" &&
    typeof record.format === "string" &&
    record.format.toLowerCase() === "html" &&
    typeof record.contentHtml === "string"
  ) {
    return { ...record, contentHtml: normalizeEmailTemplateLayout(record.contentHtml) };
  }
  return record;
}
