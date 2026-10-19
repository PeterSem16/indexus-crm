import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Move one stable portal host, not its React subtree: drafts survive resizing. */
export function StatusListViewport({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [host] = useState(() => document.createElement("div"));
  useLayoutEffect(() => {
    const target = expanded ? document.body : anchor.current;
    target?.appendChild(host);
    if (!expanded) return;
    const root = document.getElementById("root");
    const wasInert = root?.inert;
    const overflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    // Replit's development notice sits above the application, including portals.
    // Production has no notice and therefore uses the complete viewport.
    const measureNotice = () => {
      const banner = document.getElementById("replit-dev-banner");
      const padding = window.location.hostname.endsWith(".replit.dev") ? parseFloat(getComputedStyle(document.body).paddingTop) || 0 : 0;
      host.style.setProperty("--slw-preview-top", `${Math.max(0, banner?.getBoundingClientRect().height || 0, padding)}px`);
    };
    const notice = document.getElementById("replit-dev-banner");
    const resize = new ResizeObserver(measureNotice);
    resize.observe(document.body);
    if (notice) resize.observe(notice);
    const mutation = new MutationObserver(measureNotice);
    mutation.observe(document.body, { childList: true, attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measureNotice);
    measureNotice();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measureNotice);
      host.style.removeProperty("--slw-preview-top");
      if (root) root.inert = wasInert ?? false;
      document.body.style.overflow = overflow;
    };
  }, [expanded, host]);
  useLayoutEffect(() => () => host.remove(), [host]);
  return <div ref={anchor} data-testid="status-list-viewport-anchor">{createPortal(children, host)}</div>;
}
