// Sanitize campaign-manager-authored HTML that is rendered/sent for OTHER users
// (reply email signatures render via dangerouslySetInnerHTML across agents).
// This is a privilege-crossing surface, so strip active content and dangerous URL schemes.
// Regex-based (no DOMPurify dependency — prod deploy skips npm install).
// Note: `data:` is blocked on href only; base64 images in <img src="data:..."> are legitimate
// in email signatures and cannot execute script, so they are preserved.
export function sanitizeSignatureHtml(html: string): string {
  return (html || "")
    // Remove active/embedding elements entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|link|meta)[\s\S]*?>/gi, "")
    // Strip inline event handlers (onclick, onerror, ...) — quoted and unquoted
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    // Neutralize javascript:/vbscript: in href & src — quoted (allowing leading whitespace/HTML entities)
    .replace(/\s(href|src)\s*=\s*"(?:\s|&#?\w+;)*(?:javascript|vbscript):[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'(?:\s|&#?\w+;)*(?:javascript|vbscript):[^']*'/gi, " $1='#'")
    // ...and unquoted
    .replace(/\s(href|src)\s*=\s*(?:javascript|vbscript):[^\s>]*/gi, ' $1="#"')
    // Neutralize data: on href only (data:text/html is an XSS vector; images in src are kept)
    .replace(/\shref\s*=\s*"(?:\s|&#?\w+;)*data:[^"]*"/gi, ' href="#"')
    .replace(/\shref\s*=\s*'(?:\s|&#?\w+;)*data:[^']*'/gi, " href='#'")
    .replace(/\shref\s*=\s*data:[^\s>]*/gi, ' href="#"');
}

function decodeHtmlEntitiesFallback(input: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
    ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", eacute: "é", egrave: "è",
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X"
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) || code < 0 || code > 0x10ffff
        ? match
        : String.fromCodePoint(code);
    }
    return named[entity] ?? match;
  });
}

/** Decode HTML entities without turning the result into a trusted HTML sink. */
export function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  if (typeof document !== "undefined" && !/<\/?textarea/i.test(input)) {
    try {
      const element = document.createElement("textarea");
      element.innerHTML = input;
      return element.value;
    } catch {
      return decodeHtmlEntitiesFallback(input);
    }
  }
  return decodeHtmlEntitiesFallback(input);
}

/** Convert an email fragment to readable text for cards, search, and fallback views. */
export function htmlToPlainPreview(raw?: string | null): string {
  if (!raw) return "";
  // Decode before stripping tags.  Inbound providers often HTML-escape the
  // entire fragment, so stripping first would leave "&lt;p&gt;" visible.
  let text = decodeHtmlEntities(String(raw))
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ConfiguredEmailSignature {
  htmlContent?: string;
  isActive?: boolean;
  /** Set only when the signature endpoint confirms there is no mailbox row. */
  missing?: boolean;
}

/**
 * Build the compose-body signature.  The legacy user signature is a fallback
 * only for an explicitly missing mailbox signature (or the legacy 200-empty
 * response), never for an API failure or an explicitly inactive/empty row.
 * The mailbox endpoint returns a 200 response for both a missing row and an
 * inactive row, so the server adds `missing: true`/`false` to distinguish them.
 */
export function buildConfiguredEmailBody(
  signature: ConfiguredEmailSignature | undefined,
  legacyUserSignature?: string | null,
  missionSignatureHtml?: string | null,
): string {
  if (missionSignatureHtml?.trim()) {
    return buildConfiguredEmailBody({ htmlContent: missionSignatureHtml, isActive: true });
  }
  // Older deployments returned `{ htmlContent: "", isActive: false }` for a
  // missing row.  Treat that legacy 200 shape as missing too, while honoring
  // `missing: false` from the current endpoint for an explicitly inactive
  // empty row.
  const emptyLegacyResponse = signature
    && signature.missing === undefined
    && signature.isActive === false
    && !signature.htmlContent?.trim();
  const raw = signature?.missing || emptyLegacyResponse
    ? legacyUserSignature || ""
    : signature?.isActive === false
      ? ""
      : signature?.htmlContent || "";
  if (!raw.trim()) return "";
  const safe = sanitizeSignatureHtml(raw);
  if (/class\s*=\s*["']email-signature["']/i.test(safe)) return safe;
  const content = /<\s*[a-z][^>]*>/i.test(safe)
    ? safe
    : safe.replace(/\r?\n/g, "<br>");
  return `<p><br></p><div class="email-signature">${content}</div>`;
}

export interface EmailSignatureBodyReconciliation {
  body: string;
  autoSignature: string;
}

/**
 * Keep an automatically inserted signature in sync without taking ownership of
 * the editor after the agent starts typing.  The whole body is tracked as the
 * auto-owned value rather than appending HTML fragments, which makes repeated
 * renders/account changes idempotent and prevents duplicate signatures.
 */
export function reconcileEmailSignatureBody({
  body,
  nextSignature,
  previousAutoSignature,
  userEdited,
  templateSelected,
}: {
  body: string;
  nextSignature: string;
  previousAutoSignature: string;
  userEdited: boolean;
  templateSelected: boolean;
}): EmailSignatureBodyReconciliation {
  if (templateSelected || userEdited) {
    return { body, autoSignature: previousAutoSignature };
  }

  // An empty body is still safe to initialize, while a body that is no longer
  // equal to the previous auto-inserted value belongs to the agent.
  if (body.trim() && body !== previousAutoSignature) {
    return { body, autoSignature: "" };
  }

  return { body: nextSignature, autoSignature: nextSignature };
}

/**
 * Sanitize an inbound email body before putting it in an iframe.  Email bodies
 * are data received from outside the application, not trusted UI markup.  The
 * signature sanitizer deliberately keeps arbitrary formatting attributes for
 * backwards compatibility, so it is not sufficient for this sink.
 *
 * When a DOM is available (the browser), parse the fragment and rebuild it
 * from a small, formatting-only allow-list.  This also means text such as
 * "&lt;tag&gt;" remains text instead of becoming markup.  The fallback keeps
 * the same important guarantees for SSR/tests where DOMParser is unavailable.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  const allowedTags = new Set([
    "a", "b", "blockquote", "br", "code", "del", "div", "em", "h1",
    "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p",
    "pre", "s", "small", "span", "strong", "sub", "sup", "table", "tbody",
    "td", "th", "thead", "tr", "u", "ul", "wbr",
  ]);
  const isSafeUrl = (value: string, attribute: "href" | "src") => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (/^(javascript|vbscript):/.test(normalized)) return false;
    if (attribute === "href" && /^data:/.test(normalized)) return false;
    if (attribute === "src" && /^data:(?!image\/(?:gif|jpe?g|png|webp|bmp);base64,)/.test(normalized)) return false;
    return /^(https?:|mailto:|tel:|\/|#|data:image\/)/i.test(value.trim());
  };

  if (typeof DOMParser !== "undefined" && typeof document !== "undefined") {
    const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const sanitizeNode = (node: Node): void => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const element = child as HTMLElement;
        const tag = element.tagName.toLowerCase();
        if (!allowedTags.has(tag)) {
          // Drop active content completely; for unknown formatting wrappers,
          // retain their text/allowed descendants rather than losing the body.
          if (["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"].includes(tag)) {
            child.remove();
          } else {
            sanitizeNode(child);
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            child.remove();
          }
          continue;
        }
        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.name.toLowerCase();
          if (name.startsWith("on") || name === "style" || name === "class" || name === "id") {
            element.removeAttribute(attribute.name);
          } else if (name === "href" || name === "src") {
            if (!isSafeUrl(attribute.value, name)) element.removeAttribute(attribute.name);
          } else if (tag !== "img" || !["alt", "title", "width", "height"].includes(name)) {
            element.removeAttribute(attribute.name);
          }
        }
        sanitizeNode(element);
      }
    };
    sanitizeNode(parsed.body);
    return parsed.body.innerHTML;
  }

  // DOMParser is not present in node-side tests/build tooling.  Keep this
  // conservative fallback intentionally small: decode entities first, remove
  // active elements, and rebuild every remaining tag from the same allow-list.
  // This is deliberately stricter than sanitizeSignatureHtml, whose legacy
  // formatting attributes cannot be trusted for an inbound-message sink.
  const decoded = decodeHtmlEntities(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*\/?>/gi, "");
  return decoded.replace(/<\s*(\/?)\s*([a-z][\w-]*)([^>]*)>/gi, (full, closing: string, rawTag: string, rawAttributes: string) => {
    const tag = rawTag.toLowerCase();
    if (!allowedTags.has(tag)) return "";
    if (closing) return `</${tag}>`;
    const attributes: string[] = [];
    rawAttributes.replace(
      /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
      (_attribute, rawName: string, doubleQuoted: string | undefined, singleQuoted: string | undefined, unquoted: string | undefined) => {
        const name = rawName.toLowerCase();
        const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
        if (tag === "img" && ["alt", "title", "width", "height"].includes(name)) {
          attributes.push(` ${name}="${value.replace(/"/g, "&quot;")}"`);
        } else if ((name === "href" || name === "src") && isSafeUrl(value, name)) {
          attributes.push(` ${name}="${value.replace(/"/g, "&quot;")}"`);
        }
        return "";
      },
    );
    return `<${tag}${attributes.join("")}>`;
  });
}
