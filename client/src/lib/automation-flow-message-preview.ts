const HTML_TAG = /<\/?(?:a|article|aside|b|blockquote|body|br|caption|center|code|dd|div|dl|dt|em|font|h[1-6]|head|hr|html|i|li|ol|p|pre|s|small|span|strong|style|sub|sup|table|tbody|td|tfoot|th|thead|tr|u)\b/i;
const ALLOWED_TAGS = new Set([
  "A", "ARTICLE", "ASIDE", "B", "BLOCKQUOTE", "BR", "CAPTION", "CENTER", "CODE",
  "DD", "DIV", "DL", "DT", "EM", "FONT", "H1", "H2", "H3", "H4", "H5", "H6",
  "HR", "I", "LI", "OL", "P", "PRE", "S", "SMALL", "SPAN", "STRONG", "SUB",
  "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "STYLE",
]);
const ALLOWED_STYLE_PROPERTIES = new Set([
  "background", "background-color", "border", "border-bottom", "border-collapse", "border-color",
  "border-left", "border-radius", "border-right", "border-spacing", "border-style",
  "border-top", "border-width", "color", "display", "font-family", "font-size",
  "font-style", "font-variant", "font-weight", "height", "letter-spacing", "line-height", "margin", "margin-bottom",
  "margin-left", "margin-right", "margin-top", "max-width", "padding", "padding-bottom",
  "padding-left", "padding-right", "padding-top", "text-align", "text-decoration", "text-transform",
  "vertical-align", "white-space", "width", "word-break",
]);

export function isHtmlMessage(value: string) {
  return HTML_TAG.test(value);
}

function safeCss(value: string) {
  return value
    .replace(/@import[^;]*(?:;|$)/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/behavior\s*:[^;}]*/gi, "")
    .replace(/-moz-binding\s*:[^;}]*/gi, "");
}

function safeStyleAttribute(value: string) {
  return value.split(";").flatMap((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 1) return [];
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const content = safeCss(declaration.slice(separator + 1).trim());
    if (!ALLOWED_STYLE_PROPERTIES.has(property) || !content || /[<>;]/.test(content)) return [];
    return [`${property}: ${content}`];
  }).join("; ");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Rebuild authored email markup from a strict element and attribute allowlist.
 * The resulting document is also loaded in an iframe with an empty sandbox.
 */
export function sanitizeFlowMessageHtml(value: string) {
  if (typeof DOMParser === "undefined") return escapeHtml(value);
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    if (["SCRIPT", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "VIDEO", "AUDIO", "SVG", "MATH"].includes(element.tagName)) return "";
    if (element.tagName === "STYLE") {
      const css = safeCss(element.textContent || "").replace(/<\/style/gi, "<\\/style");
      return `<style>${css}</style>`;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) return Array.from(element.childNodes).map(serialize).join("");
    const attributes: string[] = [];
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name === "style") {
        const style = safeStyleAttribute(attribute.value);
        if (style) attributes.push(`style="${escapeHtml(style)}"`);
      } else if (["colspan", "rowspan", "align", "valign", "width", "height"].includes(name) && /^[a-z0-9% -]{1,20}$/i.test(attribute.value)) {
        attributes.push(`${name}="${escapeHtml(attribute.value)}"`);
      } else if (name === "bgcolor" && (/^#[0-9a-f]{3,8}$/i.test(attribute.value) || /^[a-z]{1,20}$/i.test(attribute.value))) {
        attributes.push(`bgcolor="${escapeHtml(attribute.value)}"`);
      }
    }
    const tag = element.tagName.toLowerCase();
    const contents = Array.from(element.childNodes).map(serialize).join("");
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${contents}</${tag}>`;
  };
  const body = Array.from(parsed.body.childNodes).map(serialize).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'"><style>html{color-scheme:light}body{margin:0;padding:18px;font:14px/1.55 system-ui,sans-serif;color:#243832;overflow-wrap:anywhere}img{display:none}</style></head><body>${body}</body></html>`;
}
