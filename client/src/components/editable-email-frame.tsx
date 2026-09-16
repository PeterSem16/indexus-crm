import { useEffect, useRef } from "react";
import { sanitizeSignatureHtml } from "@/lib/sanitize-html";

/** Isolated HTML editor; local input must not reload the iframe and lose its caret. */
export function EditableEmailFrame({ value, onChange, title }: {
  value: string;
  onChange: (html: string) => void;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const lastValue = useRef(value);
  // This is authored compose HTML, not an untrusted inbox preview. Preserve
  // its email layout/styles using the same sanitizer as Mission signatures.
  const initialValue = useRef(sanitizeSignatureHtml(value));
  const changeHandler = useRef(onChange);
  changeHandler.current = onChange;

  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    const body = frame.current?.contentDocument?.body;
    if (body) body.innerHTML = sanitizeSignatureHtml(value);
  }, [value]);

  return <iframe
    ref={frame}
    srcDoc={initialValue.current}
    sandbox="allow-same-origin"
    className="w-full h-full bg-white"
    title={title}
    onLoad={() => {
      const doc = frame.current?.contentDocument;
      if (!doc?.body) return;
      doc.body.innerHTML = sanitizeSignatureHtml(lastValue.current);
      doc.body.contentEditable = "true";
      doc.body.style.minHeight = "calc(100vh - 32px)";
      doc.body.style.padding = "8px";
      doc.body.style.outline = "none";
      doc.body.setAttribute("role", "textbox");
      doc.body.setAttribute("aria-label", title);
      doc.body.setAttribute("aria-multiline", "true");
      doc.body.oninput = () => {
        const html = doc.body.innerHTML;
        lastValue.current = html;
        changeHandler.current(html);
      };
    }}
  />;
}