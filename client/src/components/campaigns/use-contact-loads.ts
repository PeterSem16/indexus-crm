import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ContactLoadError, canApplyContactLoad, contactLoadErrorCopy } from "./contact-load-model";
import type { LoadBatch, LoadPreview, UndoPreview } from "./contact-load-model";
import type { ContactLoadCopy } from "./contact-load-translations";

async function request<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  // apiRequest handles JSON and cookies; FormData must not receive a JSON content type.
  let res: Response;
  try {
    res = body instanceof FormData
      ? await fetch(url, { method, body, credentials: "include" })
      : await apiRequest(method, url, body);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status) throw new ContactLoadError(err instanceof Error ? err.message : "load_failed", status);
    throw err;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ContactLoadError(typeof data.error === "string" ? data.error : "load_failed", res.status);
  }
  return res.json();
}

export function useContactLoads(campaignId: string | undefined, inputKey: string, file: File | null, copy: ContactLoadCopy) {
  const [preview, setPreview] = useState<LoadPreview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [undoReview, setUndoReview] = useState<{ id: string; counts: UndoPreview } | null>(null);
  const lock = useRef(false);
  const epoch = useRef(0);
  const previewEpoch = useRef(-1);
  const undoEpoch = useRef(-1);
  const lastPreviewBody = useRef<unknown>(undefined);
  const identity = useRef({ campaignId, inputKey, file });
  // Invalidate in render as well as the effect: a response cannot win the
  // gap between a changed source render and passive effect cleanup.
  if (identity.current.campaignId !== campaignId || identity.current.inputKey !== inputKey || identity.current.file !== file) {
    identity.current = { campaignId, inputKey, file };
    epoch.current += 1;
  }
  const base = `/api/campaigns/${encodeURIComponent(campaignId || "")}/contact-loads`;
  const historyKey = ["/api/campaigns", campaignId, "contact-loads"];
  const history = useQuery<{ batches: LoadBatch[] }>({
    queryKey: historyKey, enabled: !!campaignId && historyOpen, staleTime: 0,
    queryFn: () => request("GET", base), retry: false,
  });
  useEffect(() => {
    setPreview(null); setReviewOpen(false); setUndoReview(null);
    setError(null); setNotice(null); setAmbiguous(false); setBlocked(false);
    lastPreviewBody.current = undefined;
    lock.current = false; setBusy(false);
  }, [campaignId, inputKey, file]);
  useEffect(() => () => { epoch.current += 1; }, []);
  useEffect(() => { setHistoryOpen(false); }, [campaignId]);

  function invalidate() {
    for (const key of [
      ["/api/campaigns", campaignId, "contacts"], ["/api/campaigns", campaignId, "stats"],
      ["/api/campaigns/contact-counts"], ["/api/campaigns", campaignId, "contact-counts"], historyKey,
    ]) void queryClient.invalidateQueries({ queryKey: key });
  }
  async function createPreview(body: unknown): Promise<boolean> {
    if (!campaignId || lock.current || ambiguous) return false;
    const version = ++epoch.current;
    lastPreviewBody.current = body;
    lock.current = true; setBusy(true); setPreview(null); setError(null); setNotice(null);
    setBlocked(false); setReviewOpen(true);
    try {
      const data = await request<LoadPreview>("POST", `${base}/preview`, body);
      if (version !== epoch.current) return false;
      previewEpoch.current = version;
      setPreview(data);
      void queryClient.invalidateQueries({ queryKey: historyKey });
      return true;
    } catch (err) {
      if (version === epoch.current) setError(contactLoadErrorCopy(err, copy));
      return false;
    } finally {
      if (version === epoch.current) { lock.current = false; setBusy(false); }
    }
  }
  async function apply() {
    if (!preview || lock.current || blocked || previewEpoch.current !== epoch.current) return;
    if (!ambiguous && !canApplyContactLoad(preview)) {
      setError(preview.counts.invalid ? copy.invalidError : copy.stale); setBlocked(true); return;
    }
    const version = epoch.current;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await request<{ added: number; existing: number }>("POST", `${base}/${encodeURIComponent(preview.id)}/apply`, {});
      // Invalidate even if navigation/source changes while the server applies.
      invalidate();
      if (version !== epoch.current) return;
      setNotice(`${copy.success} ${copy.added}: ${result.added}; ${copy.existing}: ${result.existing}`);
      setPreview(null); setAmbiguous(false); setReviewOpen(false); setHistoryOpen(true);
    } catch (err) {
      invalidate();
      if (version !== epoch.current) return;
      // apiRequest throws codes for HTTP errors, but a transport or response-parse
      // failure cannot prove that the atomic apply did not commit.
      const code = err instanceof Error ? err.message : "";
      const definite = ["stale_preview", "preview_expired", "invalid_rows", "phase_policy_required", "forbidden", "contact_load_preview_required", "invalid_input"].includes(code)
        || (err instanceof ContactLoadError && [400, 401, 403, 413].includes(err.status || 0));
      setAmbiguous(!definite);
      setBlocked(definite);
      setError(definite ? contactLoadErrorCopy(err, copy) : copy.ambiguous);
    } finally {
      if (version === epoch.current) { lock.current = false; setBusy(false); }
    }
  }
  async function reviewUndo(id: string) {
    if (lock.current) return;
    const version = epoch.current;
    lock.current = true; setBusy(true); setError(null); setNotice(null); setUndoReview(null);
    try {
      const counts = await request<UndoPreview>("POST", `${base}/${encodeURIComponent(id)}/undo-preview`, {});
      if (version === epoch.current) { undoEpoch.current = version; setUndoReview({ id, counts }); }
    } catch (err) { if (version === epoch.current) setError(contactLoadErrorCopy(err, copy)); }
    finally { if (version === epoch.current) { lock.current = false; setBusy(false); } }
  }
  async function undo() {
    if (!undoReview || lock.current || undoEpoch.current !== epoch.current) return;
    const version = epoch.current;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await request<{ removed: number; protected: number; missing: number }>("POST", `${base}/${encodeURIComponent(undoReview.id)}/undo`, {});
      invalidate();
      if (version !== epoch.current) return;
      setUndoReview(null);
      setNotice(`${copy.undoSuccess} ${copy.removed}: ${result.removed}; ${copy.protected}: ${result.protected}; ${copy.missing}: ${result.missing}`);
    } catch (err) {
      invalidate();
      if (version === epoch.current) {
        setError(contactLoadErrorCopy(err, copy));
        // Counts must be recomputed after any failed/ambiguous undo.
        setUndoReview(null);
      }
    } finally { if (version === epoch.current) { lock.current = false; setBusy(false); } }
  }
  return {
    preview, reviewOpen, historyOpen, busy, error, notice, ambiguous, blocked, undoReview, history,
    createPreview, apply, reviewUndo, undo,
    retryPreview: () => { if (lastPreviewBody.current !== undefined) void createPreview(lastPreviewBody.current); },
    openHistory: () => { setError(null); setHistoryOpen(true); },
    openReview: () => setReviewOpen(true),
    closeReview: () => { if (!lock.current && !ambiguous) setReviewOpen(false); },
    closeHistory: () => { if (!lock.current) { setHistoryOpen(false); setUndoReview(null); } },
    cancelUndo: () => { if (!lock.current) setUndoReview(null); },
  };
}
export type ContactLoadsController = ReturnType<typeof useContactLoads>;
