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
